/**
 * index.js
 * Punto de entrada único para extracción: detecta el origen por el hostname
 * de la URL y delega al extractor correspondiente.
 */
import { extractFincaRaiz } from './fincaraiz.js';
import { extractMetroCuadrado } from './metrocuadrado.js';

export function detectarOrigen(url) {
    const host = new URL(url).hostname;
    if (host.includes('fincaraiz')) return 'fincaraiz';
    if (host.includes('metrocuadrado')) return 'metrocuadrado';
    return null;
}

export function esUrlSoportada(url) {
    return detectarOrigen(url) !== null;
}

/** Detecta si el URL corresponde a una página de detalle (no listado/búsqueda). */
export function esPaginaDeDetalle(url) {
    const origen = detectarOrigen(url);
    if (!origen) return false;
    try {
        const u = new URL(url);
        if (origen === 'fincaraiz') {
            // Páginas de detalle de FincaRaiz terminan en /.../{id-numerico}
            return /\/\d{5,}(?:$|[/?#])/.test(u.pathname);
        }
        if (origen === 'metrocuadrado') {
            return /\/(inmueble|propiedad)\//.test(u.pathname) || /\/\d{5,}(?:$|[/?#])/.test(u.pathname);
        }
    } catch (e) {
        return false;
    }
    return false;
}

/**
 * Extrae los datos de la propiedad desde un Document ya parseado (DOMParser
 * o el `document` real de la página) y la URL de origen.
 */
export function extraerPropiedad(doc, url) {
    const origen = detectarOrigen(url);
    if (origen === 'fincaraiz') return extractFincaRaiz(doc, url);
    if (origen === 'metrocuadrado') return extractMetroCuadrado(doc, url);
    throw new Error(`Origen no soportado para URL: ${url}`);
}
