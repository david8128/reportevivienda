/**
 * fincaraiz.js
 * Extractor de datos de propiedades para fincaraiz.com / fincaraiz.com.co
 * Basado en los mapeos documentados en mappings/fincaraiz/*.txt
 */
import {
    parsePrecioTexto, parseAreaTexto, parseEstratoTexto, parsePisoTexto,
    detectarParqueaderoTexto, detectarAscensorTexto, detectarConjuntoCerradoTexto,
    extraerTelefonos, parseTipoInmueble, parseJsonLd, probarSelectores, marcarEstimado,
    normalizarTriEstado
} from './common.js';

const SELECTORES = {
    area: [
        '.ficha-inmueble__caracteristicas .metros-cuadrados',
        '[data-id="area"] .value',
        '.ficha-detalle__area',
        '[class*="areaTotal"] [class*="value"]'
    ],
    precio: [
        '.precio-inmueble', '.price-listing',
        '.ficha-inmueble__precio span',
        '[data-testid="price"]', '[data-id="price"]',
        '.valor-total-inmueble'
    ],
    tipo: [
        '.ficha-inmueble__tipo', '.property-type',
        '[data-testid="property-type"]'
    ],
    administracion: [
        '.administracion', '[class*="administracion"]',
        '[data-id="administration"]'
    ],
    estrato: [
        '.estrato', '[class*="estrato"]',
        '[data-id="estrato"]'
    ],
    piso: [
        '[data-testid="floor"]', '[data-feature="piso"]', '[data-id="floor"]',
        '.ficha-inmueble__piso', '[class*="piso"]', '[class*="floor"]',
        '.caracteristicas [class*="floor"]', '.icono-piso ~ span', '.property-floor'
    ],
    ubicacion: [
        '.ficha-inmueble__ubicacion', '.property-location',
        '.direccion-inmueble', '[data-testid="location"]'
    ]
};

export function extractFincaRaiz(doc, url) {
    const camposEstimados = [];
    const textoCompleto = doc.body ? doc.body.innerText || doc.body.textContent || '' : '';
    const jsonLd = parseJsonLd(doc);
    const titulo = doc.querySelector('h1')?.textContent?.trim() || doc.title || '';

    // Precio: JSON-LD > meta > selector CSS > regex
    let precio = null;
    const metaPrecio = doc.querySelector('meta[property="product:price:amount"]')?.getAttribute('content');
    if (metaPrecio) precio = parseInt(metaPrecio, 10);
    if (!precio && jsonLd?.offers?.price) precio = parseInt(jsonLd.offers.price, 10);
    if (!precio) {
        const textoPrecio = probarSelectores(doc, SELECTORES.precio);
        precio = parsePrecioTexto(textoPrecio);
    }
    if (!precio) {
        precio = parsePrecioTexto(textoCompleto);
        if (precio) marcarEstimado(camposEstimados, 'precio');
    }

    // Metros cuadrados
    let metrosCuadrados = parseAreaTexto(probarSelectores(doc, SELECTORES.area));
    if (!metrosCuadrados) {
        metrosCuadrados = parseAreaTexto(textoCompleto);
        if (metrosCuadrados) marcarEstimado(camposEstimados, 'metros_cuadrados');
    }

    // Tipo de inmueble
    let tipo = parseTipoInmueble(probarSelectores(doc, SELECTORES.tipo), url) ||
        parseTipoInmueble(titulo, url);
    if (jsonLd?.['@type']) {
        const tipoLd = String(jsonLd['@type']).toLowerCase();
        if (tipoLd.includes('house') || tipoLd.includes('singlefamily')) tipo = 'casa';
        else if (tipoLd.includes('apartment')) tipo = 'apartamento';
    }
    if (!tipo) marcarEstimado(camposEstimados, 'tipo');

    // Administración
    let administracion = parsePrecioTexto(probarSelectores(doc, SELECTORES.administracion));
    if (administracion == null) {
        const matchTexto = textoCompleto.match(/administraci[oó]n[:\s]+\$?\s*([\d.,]+)/i);
        if (matchTexto) {
            administracion = parsePrecioTexto(matchTexto[0]);
            marcarEstimado(camposEstimados, 'administracion');
        }
    }
    if (/administraci[oó]n[:\s]+(?:incluida|incluye)/i.test(textoCompleto)) administracion = 0;

    // Estrato
    let estrato = parseInt(probarSelectores(doc, SELECTORES.estrato) || '', 10);
    if (!estrato || Number.isNaN(estrato)) {
        estrato = parseEstratoTexto(textoCompleto);
        if (estrato) marcarEstimado(camposEstimados, 'estrato');
    }

    // Piso: el sitio actual presenta "Piso N°" y su valor dentro de .technical-sheet.
    // parsePisoTexto evita que textos como "Piso N°\n2" fallen con parseInt().
    const textoPiso = doc.querySelector('.technical-sheet')?.innerText ||
        probarSelectores(doc, SELECTORES.piso) || '';
    let piso = parsePisoTexto(textoPiso);
    if (piso == null) {
        piso = parsePisoTexto(textoCompleto);
        if (piso != null) marcarEstimado(camposEstimados, 'piso');
    }

    // Parqueadero
    let parqueadero = detectarParqueaderoTexto(probarSelectores(doc, ['[class*="parqueadero"]', '[class*="parking"]', '[class*="garaje"]']));
    if (parqueadero === null) {
        parqueadero = detectarParqueaderoTexto(textoCompleto);
        if (parqueadero !== null) marcarEstimado(camposEstimados, 'parqueadero');
    }

    // Ascensor
    let ascensor = detectarAscensorTexto(probarSelectores(doc, ['[class*="ascensor"]', '[class*="elevator"]']));
    if (ascensor === null) {
        if (tipo === 'casa') {
            ascensor = false;
        } else {
            ascensor = detectarAscensorTexto(textoCompleto);
            if (ascensor !== null) marcarEstimado(camposEstimados, 'ascensor');
        }
    }

    // Conjunto cerrado
    let conjuntoCerrado = detectarConjuntoCerradoTexto(probarSelectores(doc, ['[class*="conjunto"]', '[class*="urbanizacion"]']));
    if (conjuntoCerrado === null) {
        conjuntoCerrado = detectarConjuntoCerradoTexto(textoCompleto);
        if (conjuntoCerrado !== null) marcarEstimado(camposEstimados, 'conjunto_cerrado');
    }

    // Ubicación
    const ubicacionTexto = probarSelectores(doc, SELECTORES.ubicacion) ||
        doc.querySelector('.breadcrumb')?.textContent?.trim() || null;
    if (ubicacionTexto == null) marcarEstimado(camposEstimados, 'ubicacion_texto');

    // Coordenadas (JSON-LD geo, o data-lat/data-lng en contenedor de mapa)
    let lat = null, lng = null;
    if (jsonLd?.geo?.latitude && jsonLd?.geo?.longitude) {
        lat = parseFloat(jsonLd.geo.latitude);
        lng = parseFloat(jsonLd.geo.longitude);
    } else {
        const mapEl = doc.querySelector('[data-lat][data-lng]');
        if (mapEl) {
            lat = parseFloat(mapEl.getAttribute('data-lat'));
            lng = parseFloat(mapEl.getAttribute('data-lng'));
        }
    }

    // Teléfonos
    const telefonos = extraerTelefonos(textoCompleto);

    return {
        url,
        origen: 'fincaraiz',
        tipo,
        precio,
        metros_cuadrados: metrosCuadrados,
        estrato: (estrato && estrato >= 1 && estrato <= 6) ? estrato : null,
        piso,
        administracion,
        parqueadero,
        ascensor,
        conjunto_cerrado: normalizarTriEstado(conjuntoCerrado),
        ubicacion_texto: ubicacionTexto,
        ubicacion_lat: Number.isFinite(lat) ? lat : null,
        ubicacion_lng: Number.isFinite(lng) ? lng : null,
        telefonos,
        campos_estimados: camposEstimados
    };
}
