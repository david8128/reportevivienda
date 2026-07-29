/**
 * service_worker.js
 * Background service worker (Manifest V3) de ReporteVivienda.
 * Orquesta: recolección asíncrona desde el historial, cola con límite de
 * velocidad, comunicación con el documento offscreen (fetch + parseo headless),
 * almacenamiento en IndexedDB, cálculo de puntuación, notificaciones y badge.
 * Ver features/01_scraping_historial.feature y features/02_monitoreo_en_vivo.feature
 */
import { MSG } from '../shared/messaging.js';
import { loadConfig, saveConfig, resetConfig } from '../shared/config.js';
import {
    encolarUrls, obtenerPendientesCola, actualizarEstadoCola, contarPendientesCola,
    obtenerPropiedadPorUrl, guardarPropiedad, obtenerTodasLasPropiedades,
    actualizarPropiedad, exportarBaseDeDatos, importarBaseDeDatos,
    obtenerPropiedadesAntiguas, eliminarPropiedades, ESTADO_COLA
} from '../shared/db.js';
import { recalcularPuntuacionSimple } from '../shared/scorer.js';
import { esUrlSoportada, esPaginaDeDetalle, detectarOrigen } from '../shared/extractors/index.js';

const HOSTS_OBJETIVO = ['fincaraiz.com', 'fincaraiz.com.co', 'metrocuadrado.com'];
const OFFSCREEN_URL = chrome.runtime.getURL('offscreen/offscreen.html');

let recolectando = false;
let progreso = { total: 0, procesados: 0, activo: false };

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function broadcast(mensaje) {
    chrome.runtime.sendMessage(mensaje, () => {
        // Ignorar errores de "no receiving end" cuando no hay popup/dashboard abiertos.
        void chrome.runtime.lastError;
    });
}

async function actualizarBadgePendientes() {
    const propiedades = await obtenerTodasLasPropiedades();
    const pendientesConfirmacion = propiedades.filter((p) => p.estado === 'pendiente_confirmacion').length;
    if (pendientesConfirmacion > 0) {
        chrome.action.setBadgeText({ text: String(pendientesConfirmacion) });
        chrome.action.setBadgeBackgroundColor({ color: '#f9ab00' });
    } else {
        chrome.action.setBadgeText({ text: '' });
    }
}

/* ------------------------------------------------------------------ */
/* Documento Offscreen (fetch + parseo headless en segundo plano)      */
/* ------------------------------------------------------------------ */

let creandoOffscreen = null;

async function asegurarOffscreen() {
    const existentes = await chrome.runtime.getContexts?.({ contextTypes: ['OFFSCREEN_DOCUMENT'] }) ?? [];
    if (existentes.length > 0) return;
    if (creandoOffscreen) return creandoOffscreen;

    creandoOffscreen = chrome.offscreen.createDocument({
        url: OFFSCREEN_URL,
        reasons: ['DOM_PARSER'],
        justification: 'Parsear HTML de anuncios de propiedades obtenidos por fetch para extraer datos.'
    }).finally(() => { creandoOffscreen = null; });

    return creandoOffscreen;
}

/** Solicita al documento offscreen que descargue y parsee un URL. */
function procesarUrlOffscreen(url) {
    return new Promise((resolve) => {
        const requestId = crypto.randomUUID();

        const listener = (mensaje) => {
            if (mensaje?.type === MSG.OFFSCREEN_RESULTADO && mensaje.requestId === requestId) {
                chrome.runtime.onMessage.removeListener(listener);
                resolve(mensaje.resultado);
            }
        };
        chrome.runtime.onMessage.addListener(listener);

        asegurarOffscreen().then(() => {
            chrome.runtime.sendMessage({ type: MSG.OFFSCREEN_PROCESAR_URL, requestId, url });
        });

        // Salvaguarda: si no hay respuesta en 20s, resolver como fallo.
        setTimeout(() => {
            chrome.runtime.onMessage.removeListener(listener);
            resolve({ ok: false, error: 'timeout' });
        }, 20000);
    });
}

/* ------------------------------------------------------------------ */
/* Recolección desde el historial                                      */
/* ------------------------------------------------------------------ */

async function iniciarRecoleccionHistorial() {
    if (recolectando) return;
    recolectando = true;
    progreso = { total: 0, procesados: 0, activo: true };

    const config = await loadConfig();
    const desde = Date.now() - config.historialDiasAtras * 24 * 60 * 60 * 1000;

    const resultadosPorHost = await Promise.all(
        HOSTS_OBJETIVO.map((host) => chrome.history.search({ text: host, startTime: desde, maxResults: 10000 }))
    );
    const urls = resultadosPorHost.flat()
        .map((item) => item.url)
        .filter((url) => esUrlSoportada(url) && esPaginaDeDetalle(url));

    const urlsUnicas = [...new Set(urls)];
    await encolarUrls(urlsUnicas);

    progreso.total = await contarPendientesCola();
    broadcast({ type: MSG.PROGRESO_ACTUALIZADO, progreso });

    await procesarCola();

    recolectando = false;
    progreso.activo = false;
    broadcast({ type: MSG.RECOLECCION_COMPLETA, progreso });
}

async function procesarCola() {
    const config = await loadConfig();
    const { maxConcurrent, delayMs } = config.rateLimit;

    // eslint-disable-next-line no-constant-condition
    while (true) {
        const lote = await obtenerPendientesCola(maxConcurrent);
        if (lote.length === 0) break;

        await Promise.all(lote.map((item) => procesarItemDeCola(item, config)));

        progreso.procesados += lote.length;
        broadcast({ type: MSG.PROGRESO_ACTUALIZADO, progreso });

        await delay(delayMs);
    }
}

async function procesarItemDeCola(item, config) {
    await actualizarEstadoCola(item.id, ESTADO_COLA.PROCESANDO);

    const existente = await obtenerPropiedadPorUrl(item.url);
    if (existente) {
        await actualizarPropiedad(existente.id, { fecha_actualizacion: new Date().toISOString() });
        await actualizarEstadoCola(item.id, ESTADO_COLA.YA_PROCESADO);
        return;
    }

    try {
        const resultado = await procesarUrlOffscreen(item.url);
        if (!resultado || !resultado.ok) {
            await actualizarEstadoCola(item.id, ESTADO_COLA.NO_DISPONIBLE);
            return;
        }

        const puntuacion = recalcularPuntuacionSimple(resultado.datos, config.pesos, config.filtros);
        await guardarPropiedad({ ...resultado.datos, puntuacion });
        await actualizarEstadoCola(item.id, ESTADO_COLA.COMPLETADO);
        await actualizarBadgePendientes();
    } catch (e) {
        await actualizarEstadoCola(item.id, ESTADO_COLA.NO_DISPONIBLE);
    }
}

/* ------------------------------------------------------------------ */
/* Monitoreo en vivo (mensajes desde content script)                   */
/* ------------------------------------------------------------------ */

async function manejarGuardarPropiedad(datos, sender) {
    const config = await loadConfig();
    const puntuacion = recalcularPuntuacionSimple(datos, config.pesos, config.filtros);
    const { id, esNueva, precioAnterior } = await guardarPropiedad({ ...datos, puntuacion });

    await actualizarBadgePendientes();
    broadcast({ type: MSG.PROPIEDAD_GUARDADA, id, esNueva, url: datos.url });

    if (precioAnterior != null && datos.precio < precioAnterior) {
        const diferencia = precioAnterior - datos.precio;
        chrome.notifications?.create(`precio-${id}`, {
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/icon128.png'),
            title: '↓ Precio actualizado',
            message: `Una propiedad bajó $${diferencia.toLocaleString('es-CO')}. Puntuación: ${puntuacion}`
        });
        broadcast({ type: MSG.PRECIO_ACTUALIZADO, id, precioAnterior, precioNuevo: datos.precio });
    }

    return { id, esNueva };
}

/** Recorta una captura completa de pantalla al área del mapa (delegado al remitente). */
function manejarCapturaMapa(sender, respuesta) {
    if (!sender.tab?.windowId) {
        respuesta({ ok: false, error: 'Sin ventana asociada' });
        return;
    }
    chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'png' }, (dataUrl) => {
        if (chrome.runtime.lastError) {
            respuesta({ ok: false, error: chrome.runtime.lastError.message });
            return;
        }
        respuesta({ ok: true, dataUrl });
    });
}

/* ------------------------------------------------------------------ */
/* Recalcular puntuaciones / exportar / importar / limpiar              */
/* ------------------------------------------------------------------ */

async function recalcularTodasLasPuntuaciones() {
    const config = await loadConfig();
    const propiedades = await obtenerTodasLasPropiedades();
    for (const p of propiedades) {
        const puntuacion = recalcularPuntuacionSimple(p, config.pesos, config.filtros);
        if (puntuacion !== p.puntuacion) {
            await actualizarPropiedad(p.id, { puntuacion });
        }
    }
    return propiedades.length;
}

/* ------------------------------------------------------------------ */
/* Listeners                                                           */
/* ------------------------------------------------------------------ */

chrome.runtime.onMessage.addListener((mensaje, sender, sendResponse) => {
    (async () => {
        switch (mensaje?.type) {
            case MSG.INICIAR_RECOLECCION_HISTORIAL:
                iniciarRecoleccionHistorial();
                sendResponse({ ok: true, iniciado: true });
                break;

            case MSG.OBTENER_PROGRESO:
                sendResponse({ ...progreso, recolectando });
                break;

            case MSG.OBTENER_ESTADO: {
                const config = await loadConfig();
                sendResponse({ progreso, recolectando, config });
                break;
            }

            case MSG.TOGGLE_MONITOREO_VIVO: {
                const config = await saveConfig({ monitoreoEnVivo: mensaje.valor });
                sendResponse({ ok: true, config });
                break;
            }

            case MSG.GUARDAR_PROPIEDAD: {
                const resultado = await manejarGuardarPropiedad(mensaje.datos, sender);
                sendResponse(resultado);
                break;
            }

            case MSG.SOLICITAR_CAPTURA_MAPA:
                manejarCapturaMapa(sender, sendResponse);
                return; // respuesta asíncrona vía callback, no cerrar aquí

            case MSG.CONFIRMAR_CAMPOS: {
                const actualizado = await actualizarPropiedad(mensaje.id, mensaje.cambios);
                const config = await loadConfig();
                actualizado.puntuacion = recalcularPuntuacionSimple(actualizado, config.pesos, config.filtros);
                await actualizarPropiedad(mensaje.id, { puntuacion: actualizado.puntuacion });
                await actualizarBadgePendientes();
                sendResponse({ ok: true, propiedad: actualizado });
                break;
            }

            case MSG.RECALCULAR_PUNTUACIONES: {
                const total = await recalcularTodasLasPuntuaciones();
                sendResponse({ ok: true, total });
                break;
            }

            case MSG.EXPORTAR_DB: {
                const data = await exportarBaseDeDatos();
                sendResponse({ ok: true, data });
                break;
            }

            case MSG.IMPORTAR_DB: {
                try {
                    const resultado = await importarBaseDeDatos(mensaje.data);
                    sendResponse({ ok: true, ...resultado });
                } catch (e) {
                    sendResponse({ ok: false, error: e.message });
                }
                break;
            }

            case MSG.LIMPIAR_ANTIGUOS: {
                if (mensaje.confirmarIds) {
                    await eliminarPropiedades(mensaje.confirmarIds);
                    sendResponse({ ok: true, eliminados: mensaje.confirmarIds.length });
                } else {
                    const config = await loadConfig();
                    const antiguas = await obtenerPropiedadesAntiguas(config.limpiezaDiasAntiguedad);
                    sendResponse({ ok: true, candidatas: antiguas });
                }
                break;
            }

            case MSG.GUARDAR_CONFIGURACION: {
                const config = await saveConfig(mensaje.config);
                await recalcularTodasLasPuntuaciones();
                sendResponse({ ok: true, config });
                break;
            }

            case MSG.RESTABLECER_CONFIGURACION: {
                const config = await resetConfig();
                await recalcularTodasLasPuntuaciones();
                sendResponse({ ok: true, config });
                break;
            }

            default:
                sendResponse(undefined);
        }
    })();
    return true; // mantener el canal abierto para respuesta asíncrona
});

/* ------------------------------------------------------------------ */
/* Monitoreo en vivo: detectar nuevas pestañas de FincaRaiz/MetroCuadrado */
/* ------------------------------------------------------------------ */

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete' || !tab.url) return;
    if (!esUrlSoportada(tab.url)) return;

    const config = await loadConfig();
    if (!config.monitoreoEnVivo) return;
    // El content script ya está inyectado declarativamente (content_scripts en manifest)
    // y se activa solo; no se requiere acción adicional aquí más allá del flag de configuración.
});

chrome.runtime.onInstalled.addListener(async () => {
    await loadConfig();
    await actualizarBadgePendientes();
});
