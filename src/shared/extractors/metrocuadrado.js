/**
 * metrocuadrado.js
 * Extractor de datos de propiedades para metrocuadrado.com
 * Prioriza window.__NEXT_DATA__ (SSR de Next.js) sobre selectores CSS,
 * ya que MetroCuadrado usa clases CSS-in-JS inestables.
 * Ver mappings/metrocuadrado/*.txt para el detalle documentado por campo.
 */
import {
    parsePrecioTexto, parseAreaTexto, parseEstratoTexto, parsePisoTexto,
    detectarParqueaderoTexto, detectarAscensorTexto, detectarConjuntoCerradoTexto,
    extraerTelefonos, parseTipoInmueble, parseNextData, buscarClaveRecursiva,
    probarSelectores, marcarEstimado, normalizarTriEstado
} from './common.js';

const SELECTORES = {
    area: ['[class*="AreaLabel"]', '[class*="squareMeters"]', '[data-testid="area"]'],
    precio: ['[class*="Price"]', '.property-price', '[data-testid="price"]'],
    administracion: ['[class*="Administration"]', '[data-testid="admin-fee"]'],
    estrato: ['[class*="Stratum"]', '[data-testid="stratum"]'],
    piso: ['[class*="Floor"]', '[data-testid="floor"]'],
    ubicacion: ['[class*="Location"]', '.property-location', '[data-testid="location"]']
};

function normalizarTipo(valor) {
    if (!valor) return null;
    const v = String(valor).toLowerCase();
    if (v.includes('house') || v === 'casa') return 'casa';
    if (v.includes('apartment') || v === 'apartamento') return 'apartamento';
    return v;
}

export function extractMetroCuadrado(doc, url) {
    const camposEstimados = [];
    const textoCompleto = doc.body ? doc.body.innerText || doc.body.textContent || '' : '';
    const nextData = parseNextData(doc);
    const pageProps = nextData?.props?.pageProps ?? null;
    const titulo = doc.querySelector('h1')?.textContent?.trim() || doc.title || '';

    // Precio
    let precio = pageProps ? buscarClaveRecursiva(pageProps, ['price', 'salePrice']) : null;
    precio = precio ? parseInt(precio, 10) : null;
    if (!precio) {
        const metaPrecio = doc.querySelector('meta[property="product:price:amount"]')?.getAttribute('content');
        if (metaPrecio) precio = parseInt(metaPrecio, 10);
    }
    if (!precio) {
        precio = parsePrecioTexto(probarSelectores(doc, SELECTORES.precio));
    }
    if (!precio) {
        precio = parsePrecioTexto(textoCompleto);
        if (precio) marcarEstimado(camposEstimados, 'precio');
    }

    // Metros cuadrados
    let metrosCuadrados = pageProps ? buscarClaveRecursiva(pageProps, ['area', 'metrosCuadrados', 'area_total']) : null;
    metrosCuadrados = metrosCuadrados ? parseFloat(metrosCuadrados) : null;
    if (!metrosCuadrados) {
        metrosCuadrados = parseAreaTexto(probarSelectores(doc, SELECTORES.area));
    }
    if (!metrosCuadrados) {
        metrosCuadrados = parseAreaTexto(textoCompleto);
        if (metrosCuadrados) marcarEstimado(camposEstimados, 'metros_cuadrados');
    }

    // Tipo de inmueble
    let tipoBruto = pageProps ? buscarClaveRecursiva(pageProps, ['propertyType', 'type']) : null;
    let tipo = normalizarTipo(tipoBruto) || parseTipoInmueble(titulo, url);
    if (!tipo) marcarEstimado(camposEstimados, 'tipo');

    // Administración
    let administracion = pageProps ? buscarClaveRecursiva(pageProps, ['adminPrice', 'administration', 'adminFee', 'administration_price']) : null;
    administracion = administracion != null ? parseInt(administracion, 10) : null;
    if (administracion == null) {
        administracion = parsePrecioTexto(probarSelectores(doc, SELECTORES.administracion));
    }
    if (administracion == null) {
        const matchTexto = textoCompleto.match(/administraci[oó]n[:\s]+\$?\s*([\d.,]+)/i);
        if (matchTexto) {
            administracion = parsePrecioTexto(matchTexto[0]);
            marcarEstimado(camposEstimados, 'administracion');
        }
    }
    if (/administraci[oó]n[:\s]+(?:incluida|incluye)/i.test(textoCompleto)) administracion = 0;

    // Estrato
    let estrato = pageProps ? buscarClaveRecursiva(pageProps, ['stratum', 'estrato']) : null;
    estrato = estrato != null ? parseInt(estrato, 10) : null;
    if (!estrato) {
        estrato = parseInt(probarSelectores(doc, SELECTORES.estrato) || '', 10) || null;
    }
    if (!estrato) {
        estrato = parseEstratoTexto(textoCompleto);
        if (estrato) marcarEstimado(camposEstimados, 'estrato');
    }

    // Piso
    let piso = pageProps ? buscarClaveRecursiva(pageProps, ['floor', 'floorNumber']) : null;
    piso = piso != null ? parseInt(piso, 10) : null;
    if (piso == null) {
        piso = parseInt(probarSelectores(doc, SELECTORES.piso) || '', 10);
        if (Number.isNaN(piso)) piso = null;
    }
    if (piso == null) {
        piso = parsePisoTexto(textoCompleto);
        if (piso != null) marcarEstimado(camposEstimados, 'piso');
    }

    // Parqueadero
    let parqueaderoRaw = pageProps ? buscarClaveRecursiva(pageProps, ['parkingSpaces', 'garage']) : null;
    let parqueadero = parqueaderoRaw != null ? parseInt(parqueaderoRaw, 10) > 0 : null;
    if (parqueadero === null) {
        parqueadero = detectarParqueaderoTexto(textoCompleto);
        if (parqueadero !== null) marcarEstimado(camposEstimados, 'parqueadero');
    }

    // Ascensor
    let ascensor = pageProps ? buscarClaveRecursiva(pageProps, ['hasElevator', 'elevator']) : null;
    if (typeof ascensor !== 'boolean') ascensor = null;
    if (ascensor === null) {
        if (tipo === 'casa') {
            ascensor = false;
        } else {
            ascensor = detectarAscensorTexto(textoCompleto);
            if (ascensor !== null) marcarEstimado(camposEstimados, 'ascensor');
        }
    }

    // Conjunto cerrado
    let conjuntoCerrado = pageProps ? buscarClaveRecursiva(pageProps, ['isGatedCommunity']) : null;
    if (typeof conjuntoCerrado !== 'boolean') conjuntoCerrado = null;
    if (conjuntoCerrado === null) {
        conjuntoCerrado = detectarConjuntoCerradoTexto(textoCompleto);
        if (conjuntoCerrado !== null) marcarEstimado(camposEstimados, 'conjunto_cerrado');
    }

    // Ubicación y coordenadas
    const ubicacionObj = pageProps ? buscarClaveRecursiva(pageProps, ['location', 'address']) : null;
    let ubicacionTexto = null;
    let lat = null, lng = null;
    if (ubicacionObj && typeof ubicacionObj === 'object') {
        ubicacionTexto = [ubicacionObj.address, ubicacionObj.neighborhood, ubicacionObj.city]
            .filter(Boolean).join(', ') || null;
        lat = ubicacionObj.lat ?? ubicacionObj.latitude ?? null;
        lng = ubicacionObj.lng ?? ubicacionObj.longitude ?? null;
    }
    if (!ubicacionTexto) {
        ubicacionTexto = probarSelectores(doc, SELECTORES.ubicacion) ||
            doc.querySelector('.breadcrumb')?.textContent?.trim() || null;
        if (ubicacionTexto) marcarEstimado(camposEstimados, 'ubicacion_texto');
    }
    if (lat == null) {
        lat = pageProps ? buscarClaveRecursiva(pageProps, ['latitude']) : null;
        lng = pageProps ? buscarClaveRecursiva(pageProps, ['longitude']) : null;
    }

    const telefonos = extraerTelefonos(textoCompleto);

    return {
        url,
        origen: 'metrocuadrado',
        tipo,
        precio,
        metros_cuadrados: metrosCuadrados ? Math.round(metrosCuadrados) : null,
        estrato: (estrato && estrato >= 1 && estrato <= 6) ? estrato : null,
        piso,
        administracion,
        parqueadero,
        ascensor,
        conjunto_cerrado: normalizarTriEstado(conjuntoCerrado),
        ubicacion_texto: ubicacionTexto,
        ubicacion_lat: lat != null ? parseFloat(lat) : null,
        ubicacion_lng: lng != null ? parseFloat(lng) : null,
        telefonos,
        campos_estimados: camposEstimados
    };
}
