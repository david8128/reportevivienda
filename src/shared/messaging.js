/**
 * messaging.js
 * Constantes de tipos de mensajes usados con chrome.runtime.sendMessage /
 * chrome.runtime.onMessage entre popup, dashboard, background, content script
 * y el documento offscreen.
 */

export const MSG = {
    // Popup -> Background
    INICIAR_RECOLECCION_HISTORIAL: 'INICIAR_RECOLECCION_HISTORIAL',
    DETENER_RECOLECCION: 'DETENER_RECOLECCION',
    OBTENER_PROGRESO: 'OBTENER_PROGRESO',
    TOGGLE_MONITOREO_VIVO: 'TOGGLE_MONITOREO_VIVO',
    OBTENER_ESTADO: 'OBTENER_ESTADO',

    // Background -> Popup/Dashboard (broadcast)
    PROGRESO_ACTUALIZADO: 'PROGRESO_ACTUALIZADO',
    RECOLECCION_COMPLETA: 'RECOLECCION_COMPLETA',
    PROPIEDAD_GUARDADA: 'PROPIEDAD_GUARDADA',
    PRECIO_ACTUALIZADO: 'PRECIO_ACTUALIZADO',

    // Content script -> Background
    GUARDAR_PROPIEDAD: 'GUARDAR_PROPIEDAD',
    SOLICITAR_CAPTURA_MAPA: 'SOLICITAR_CAPTURA_MAPA',
    CONFIRMAR_CAMPOS: 'CONFIRMAR_CAMPOS',

    // Background -> Content script
    MOSTRAR_PANEL_CONFIRMACION: 'MOSTRAR_PANEL_CONFIRMACION',

    // Background -> Offscreen
    OFFSCREEN_PROCESAR_URL: 'OFFSCREEN_PROCESAR_URL',
    OFFSCREEN_RESULTADO: 'OFFSCREEN_RESULTADO',

    // Dashboard -> Background
    RECALCULAR_PUNTUACIONES: 'RECALCULAR_PUNTUACIONES',
    EXPORTAR_DB: 'EXPORTAR_DB',
    IMPORTAR_DB: 'IMPORTAR_DB',
    LIMPIAR_ANTIGUOS: 'LIMPIAR_ANTIGUOS',
    GENERAR_REPORTE_PDF: 'GENERAR_REPORTE_PDF',
    GUARDAR_CONFIGURACION: 'GUARDAR_CONFIGURACION',
    RESTABLECER_CONFIGURACION: 'RESTABLECER_CONFIGURACION',
    APLICAR_PATCH_MAPEO: 'APLICAR_PATCH_MAPEO',
    RECUPERAR_DESDE_HISTORIAL: 'RECUPERAR_DESDE_HISTORIAL'
};

/** Envuelve chrome.runtime.sendMessage en una Promesa. */
export function enviarMensaje(mensaje) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(mensaje, (respuesta) => {
            if (chrome.runtime.lastError) {
                // Muchos listeners no responden explícitamente; no siempre es un error real.
                resolve(undefined);
                return;
            }
            resolve(respuesta);
        });
    });
}

/** Envía un mensaje a una pestaña específica (usado por background -> content script). */
export function enviarMensajeATab(tabId, mensaje) {
    return new Promise((resolve) => {
        chrome.tabs.sendMessage(tabId, mensaje, (respuesta) => {
            if (chrome.runtime.lastError) {
                resolve(undefined);
                return;
            }
            resolve(respuesta);
        });
    });
}
