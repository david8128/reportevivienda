/**
 * scorer.js
 * Motor de puntuación de propiedades. Ver features/05_sistema_puntuacion.feature
 */

const RESPUESTA_SI = new Set(['si', 'sí', 'confirmado_si', true]);

// Umbrales de respaldo, usados solo si no se reciben filtros (no deberían usarse en producción,
// ya que la puntuación debe calcularse siempre con los filtros configurados por el usuario).
const DEFAULT_FILTROS_FALLBACK = {
    precioMax: 550000000,
    estratoMax: 4,
    pisoMax: 2,
    administracionMax: 300000
};

function esSi(valor) {
    if (typeof valor === 'boolean') return valor === true;
    if (typeof valor === 'string') return RESPUESTA_SI.has(valor.toLowerCase());
    return false;
}

/**
 * Calcula el puntaje máximo posible dado un conjunto de pesos
 * (suma de todos los criterios, útil para mostrar "X sobre Y puntos").
 */
export function calcularPuntuacionMaxima(pesos) {
    return (
        pesos.precioMax550 +
        pesos.estratoMax4 +
        pesos.estratoOptimo3 +
        pesos.pisoMax2 +
        pesos.parqueadero +
        pesos.ascensor +
        pesos.conjuntoCerrado +
        pesos.administracionMax300k +
        pesos.viableVivirArrendar +
        pesos.posibleDividir +
        pesos.buenaUbicacion +
        (pesos.mejorPrecioM2 || 0)
    );
}

/**
 * Calcula la puntuación de una propiedad con el desglose de puntos por criterio.
 * Los umbrales (precio máximo, estrato máximo, piso máximo, administración máxima)
 * se toman de los filtros configurados por el usuario en el dashboard, no de
 * valores fijos, de modo que la puntuación refleje siempre los parámetros vigentes.
 * Devuelve { total, maximo, desglose: [{criterio, puntos, aplica}] }
 */
export function calcularPuntuacion(propiedad, pesos, filtros = {}, opciones = {}) {
    const desglose = [];
    let total = 0;

    const agregar = (criterio, aplica, puntos) => {
        const otorgados = aplica ? puntos : 0;
        total += otorgados;
        desglose.push({ criterio, aplica, puntos: otorgados });
    };

    const precioMax = filtros.precioMax ?? DEFAULT_FILTROS_FALLBACK.precioMax;
    const estratoMax = filtros.estratoMax ?? DEFAULT_FILTROS_FALLBACK.estratoMax;
    const pisoMax = filtros.pisoMax ?? DEFAULT_FILTROS_FALLBACK.pisoMax;
    const administracionMax = filtros.administracionMax ?? DEFAULT_FILTROS_FALLBACK.administracionMax;

    const formatoM = (valor) => `${Math.round(valor / 1000000)}M`;
    const formatoK = (valor) => `${Math.round(valor / 1000)}K`;

    agregar(`Precio ≤ ${formatoM(precioMax)}`, propiedad.precio != null && propiedad.precio <= precioMax, pesos.precioMax550);
    agregar(`Estrato ≤ ${estratoMax}`, propiedad.estrato != null && propiedad.estrato <= estratoMax, pesos.estratoMax4);
    agregar('Estrato == 3 (óptimo)', propiedad.estrato === 3, pesos.estratoOptimo3);
    agregar(`Piso ≤ ${pisoMax}`, propiedad.piso != null && propiedad.piso <= pisoMax, pesos.pisoMax2);
    agregar('Parqueadero', !!propiedad.parqueadero, pesos.parqueadero);
    agregar('Ascensor', !!propiedad.ascensor, pesos.ascensor);
    agregar('Conjunto cerrado', esSi(propiedad.conjunto_cerrado), pesos.conjuntoCerrado);
    agregar(`Administración ≤ ${formatoK(administracionMax)}`, propiedad.administracion != null && propiedad.administracion <= administracionMax, pesos.administracionMax300k);
    agregar('Viable vivir+arrendar', esSi(propiedad.bueno_vivir_arrendar), pesos.viableVivirArrendar);
    agregar('Posibilidad de dividir', esSi(propiedad.posible_dividir), pesos.posibleDividir);
    agregar('Buena ubicación', esSi(propiedad.buena_ubicacion), pesos.buenaUbicacion);

    // Puntuación especial por precio/m² (mejor relación = más puntos, relativo al set de comparación)
    if (pesos.mejorPrecioM2 && propiedad.precio && propiedad.metros_cuadrados) {
        const precioM2 = propiedad.precio / propiedad.metros_cuadrados;
        const umbralBueno = opciones.precioM2Promedio ? opciones.precioM2Promedio : (precioMax / 100); // referencia relativa al precio máximo configurado
        const aplica = precioM2 < umbralBueno;
        agregar('Mejor precio/m²', aplica, pesos.mejorPrecioM2);
    }

    const maximo = calcularPuntuacionMaxima(pesos);
    return { total, maximo, desglose };
}

/** Calcula el precio por metro cuadrado (o null si faltan datos). */
export function calcularPrecioM2(propiedad) {
    if (!propiedad.precio || !propiedad.metros_cuadrados) return null;
    return Math.round(propiedad.precio / propiedad.metros_cuadrados);
}

/**
 * Recalcula y devuelve la puntuación total (número simple) de una propiedad.
 * Útil para persistir directamente en el campo "puntuacion".
 */
export function recalcularPuntuacionSimple(propiedad, pesos, filtros = {}, opciones = {}) {
    return calcularPuntuacion(propiedad, pesos, filtros, opciones).total;
}
