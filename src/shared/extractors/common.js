/**
 * common.js
 * Utilidades compartidas de extracción de datos para FincaRaiz y MetroCuadrado.
 * Combina selectores CSS, JSON embebido (__NEXT_DATA__/JSON-LD) y expresiones
 * regulares sobre el texto de la descripción como respaldo.
 * Ver mappings/fincaraiz/*.txt y mappings/metrocuadrado/*.txt para el detalle
 * de selectores documentados por campo.
 */

export const ESTIMADO = 'estimado';

/** Convierte un texto de precio colombiano ("$350.000.000", "350 millones") a número. */
export function parsePrecioTexto(texto) {
    if (!texto) return null;
    const limpio = texto.replace(/\s+/g, ' ').trim();

    const matchMillones = limpio.match(/([\d.,]+)\s*(?:millones?|mill\.?)/i);
    if (matchMillones) {
        const numero = parseFloat(matchMillones[1].replace(/\./g, '').replace(',', '.'));
        return Math.round(numero * 1000000);
    }

    const matchDinero = limpio.match(/\$?\s*([\d][\d.,]{5,})/);
    if (matchDinero) {
        const numero = parseInt(matchDinero[1].replace(/[.,]/g, ''), 10);
        if (!Number.isNaN(numero)) return numero;
    }
    return null;
}

/** Extrae metros cuadrados desde un texto ("65 m²", "Área: 65 m2"). */
export function parseAreaTexto(texto) {
    if (!texto) return null;
    const match = texto.match(/(\d{1,4}(?:[.,]\d+)?)\s*m(?:²|2|ts?2)?\b/i) ||
        texto.match(/[áa]rea[:\s]+(?:construida|privada|total)?[:\s]*(\d{1,4})/i) ||
        texto.match(/(\d{1,4})\s*metros\s*cuadrados?/i);
    if (!match) return null;
    const valor = parseFloat(match[1].replace(',', '.'));
    return Number.isFinite(valor) ? Math.round(valor) : null;
}

const PALABRAS_NUMERO = {
    uno: 1, primero: 1, primer: 1,
    dos: 2, segundo: 2,
    tres: 3, tercero: 3, tercer: 3,
    cuatro: 4, cuarto: 4,
    cinco: 5, quinto: 5,
    seis: 6, sexto: 6,
    siete: 7, séptimo: 7,
    ocho: 8, octavo: 8,
    nueve: 9, noveno: 9,
    diez: 10, décimo: 10
};

/** Extrae el estrato socioeconómico (1-6) de un texto. */
export function parseEstratoTexto(texto) {
    if (!texto) return null;
    let match = texto.match(/estrato[:\s]+(\d)\b/i);
    if (match) {
        const valor = parseInt(match[1], 10);
        if (valor >= 1 && valor <= 6) return valor;
    }
    match = texto.match(/estrato\s+(uno|dos|tres|cuatro|cinco|seis)/i);
    if (match) {
        const valor = PALABRAS_NUMERO[match[1].toLowerCase()];
        if (valor >= 1 && valor <= 6) return valor;
    }
    return null;
}

/** Extrae el número de piso de un texto. */
export function parsePisoTexto(texto) {
    if (!texto) return null;
    let match = texto.match(/piso\s*(?:n(?:[úu]mero)?\.?\s*°?)?\s*[:\-]?\s*(\d{1,2})\b/i);
    if (match) return parseInt(match[1], 10);

    match = texto.match(/(\d{1,2})\s*(?:er|°|do|to|vo|no)?\s*piso/i);
    if (match) return parseInt(match[1], 10);

    match = texto.match(/piso[:\s]+(primero|primer|segundo|tercero|tercer|cuarto|quinto|sexto|s[ée]ptimo|octavo|noveno|d[ée]cimo)/i);
    if (match) return PALABRAS_NUMERO[match[1].toLowerCase()] ?? null;

    if (/semis[oó]tano/i.test(texto)) return 0;
    if (/\bs[oó]tano\b/i.test(texto)) return -1;

    return null;
}

/** Detecta menciones de parqueadero en un texto. Devuelve boolean o null si no hay info. */
export function detectarParqueaderoTexto(texto) {
    if (!texto) return null;
    if (/sin\s+parqueadero|no\s+incluye\s+parqueadero|0\s+parqueadero/i.test(texto)) return false;
    const match = texto.match(/(\d+)\s*parqueadero/i);
    if (match) return parseInt(match[1], 10) > 0;
    if (/\bparqueadero(s)?\b|\bgaraje\b|\bgarage\b/i.test(texto)) return true;
    return null;
}

/** Detecta menciones de ascensor en un texto. Devuelve boolean o null si no hay info. */
export function detectarAscensorTexto(texto) {
    if (!texto) return null;
    if (/sin\s+ascensor|no\s+tiene\s+ascensor|sin\s+elevador/i.test(texto)) return false;
    if (/\bascensor(es)?\b|\belevador\b/i.test(texto)) return true;
    return null;
}

/** Detecta si la propiedad hace parte de un conjunto cerrado/urbanización. */
export function detectarConjuntoCerradoTexto(texto) {
    if (!texto) return null;
    if (/casa\s+independiente|no\s+(?:tiene|pertenece)\s+(?:a\s+)?conjunto/i.test(texto)) return false;
    if (/conjunto\s+(?:cerrado|residencial)|urbanizaci[oó]n|porter[ií]a|vigilancia\s+24|unidad\s+residencial/i.test(texto)) return true;
    return null;
}

/**
 * Convierte un valor booleano|null detectado por el extractor al estado
 * tri-estado usado por los campos confirmables ('si' | 'no' | 'sin_confirmar').
 * El valor 'si'/'no' representa una detección automática (aún no confirmada
 * manualmente por el usuario); solo pasa a 'confirmado_si'/'confirmado_no'
 * cuando el usuario responde la pregunta en el panel o el dashboard.
 */
export function normalizarTriEstado(valorBooleano) {
    if (valorBooleano === true) return 'si';
    if (valorBooleano === false) return 'no';
    return 'sin_confirmar';
}

/** Extrae números de teléfono colombianos (celular o fijo) de un texto. */
export function extraerTelefonos(texto) {
    if (!texto) return [];
    const matches = texto.match(/(?:\+?57)?\s*(3\d{2}[\s.-]?\d{3}[\s.-]?\d{4}|\(?\d{1,3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/g) || [];
    const limpios = matches
        .map((t) => t.replace(/[\s.\-()]/g, ''))
        .filter((t) => t.length >= 7 && t.length <= 12);
    return [...new Set(limpios)];
}

/** Extrae el tipo de inmueble (casa/apartamento) desde un título o URL. */
export function parseTipoInmueble(textoTitulo, url) {
    const fuente = `${textoTitulo || ''} ${url || ''}`.toLowerCase();
    if (/\bcasa\b/.test(fuente)) return 'casa';
    if (/apartamento|penthouse|\bph\b|loft|studio|estudio/.test(fuente)) return 'apartamento';
    return null;
}

/**
 * Intenta parsear window.__NEXT_DATA__ desde el documento (usado en MetroCuadrado).
 * Funciona incluso en HTML obtenido vía fetch (SSR embebe el JSON en el script tag).
 */
export function parseNextData(doc) {
    try {
        const script = doc.getElementById('__NEXT_DATA__');
        if (!script) return null;
        return JSON.parse(script.textContent);
    } catch (e) {
        return null;
    }
}

/** Busca recursivamente una clave dentro de un objeto JSON (profundidad limitada). */
export function buscarClaveRecursiva(obj, claves, profundidadMax = 6) {
    if (!obj || typeof obj !== 'object' || profundidadMax < 0) return undefined;
    for (const clave of claves) {
        if (obj[clave] !== undefined && obj[clave] !== null) return obj[clave];
    }
    for (const valor of Object.values(obj)) {
        if (valor && typeof valor === 'object') {
            const encontrado = buscarClaveRecursiva(valor, claves, profundidadMax - 1);
            if (encontrado !== undefined) return encontrado;
        }
    }
    return undefined;
}

/** Intenta parsear JSON-LD (script type="application/ld+json") del documento. */
export function parseJsonLd(doc) {
    const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
        try {
            const data = JSON.parse(script.textContent);
            if (data) return data;
        } catch (e) {
            // ignorar bloques inválidos
        }
    }
    return null;
}

/** Prueba una lista de selectores CSS sobre el documento y devuelve el primer texto no vacío. */
export function probarSelectores(doc, selectores) {
    for (const selector of selectores) {
        try {
            const el = doc.querySelector(selector);
            if (el && el.textContent && el.textContent.trim()) {
                return el.textContent.trim();
            }
        } catch (e) {
            // selector inválido para querySelector (ej. :contains) -> ignorar
        }
    }
    return null;
}

/** Marca un campo como estimado (agrega el nombre al arreglo de campos estimados). */
export function marcarEstimado(camposEstimados, nombreCampo) {
    if (!camposEstimados.includes(nombreCampo)) camposEstimados.push(nombreCampo);
}
