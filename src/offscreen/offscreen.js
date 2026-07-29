/**
 * offscreen.js
 * Descarga (fetch) y parsea (DOMParser) las páginas de propiedades en segundo
 * plano, sin necesidad de abrir una pestaña visible (procesamiento headless).
 * Ver features/01_scraping_historial.feature
 */
import { MSG } from '../shared/messaging.js';
import { extraerPropiedad } from '../shared/extractors/index.js';
import { loadConfig } from '../shared/config.js';

const parser = new DOMParser();

async function obtenerImagenMapaEstatica(lat, lng) {
    if (lat == null || lng == null) return null;
    try {
        const config = await loadConfig();
        let url;
        if (config.googleMapsApiKey) {
            url = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=15&size=600x400&markers=color:red|${lat},${lng}&key=${config.googleMapsApiKey}`;
        } else {
            // Alternativa gratuita sin API key (OpenStreetMap)
            url = `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=15&size=600x400&markers=${lat},${lng},red-pushpin`;
        }
        const respuesta = await fetch(url);
        if (!respuesta.ok) return null;
        const blob = await respuesta.blob();
        return await blobADataUrl(blob);
    } catch (e) {
        return null;
    }
}

function blobADataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

async function procesarUrl(url) {
    try {
        // Los portales pueden requerir la sesión/cookies activa para entregar el
        // HTML del anuncio; omitirlas convertía toda recuperación en "no disponible".
        const respuesta = await fetch(url, { credentials: 'include', redirect: 'follow' });
        if (!respuesta.ok) {
            return { ok: false, error: `HTTP ${respuesta.status}` };
        }
        const html = await respuesta.text();
        const doc = parser.parseFromString(html, 'text/html');
        const datos = extraerPropiedad(doc, url);

        // No guardar como propiedad una página de bloqueo, acceso o CAPTCHA que
        // respondió 200 pero no incluye el dato mínimo indispensable del anuncio.
        if (!datos.precio || datos.precio <= 0) {
            return { ok: false, error: 'La respuesta no contiene un precio de propiedad válido' };
        }

        if (datos.ubicacion_lat != null && datos.ubicacion_lng != null) {
            datos.mapa_imagen = await obtenerImagenMapaEstatica(datos.ubicacion_lat, datos.ubicacion_lng);
        }

        return { ok: true, datos };
    } catch (e) {
        return { ok: false, error: e.message || 'Error desconocido al procesar URL' };
    }
}

chrome.runtime.onMessage.addListener((mensaje) => {
    if (mensaje?.type !== MSG.OFFSCREEN_PROCESAR_URL) return;

    procesarUrl(mensaje.url).then((resultado) => {
        chrome.runtime.sendMessage({
            type: MSG.OFFSCREEN_RESULTADO,
            requestId: mensaje.requestId,
            resultado
        });
    });
});
