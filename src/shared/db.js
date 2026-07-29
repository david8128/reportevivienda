/**
 * db.js
 * Envoltorio de IndexedDB para la base de datos "ReporteVivienda".
 * Ver features/04_base_de_datos.feature para la especificación de comportamiento.
 */

const DB_NAME = 'ReporteVivienda';
const DB_VERSION = 1;

const STORE_PROPIEDADES = 'propiedades';
const STORE_CONFIGURACION = 'configuracion';
const STORE_HISTORIAL_COLA = 'historial_cola';
const STORE_CAMBIOS_PRECIO = 'cambios_precio';

let dbPromise = null;

/** Abre (o crea) la base de datos IndexedDB y sus object stores/índices. */
export function openDB() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            if (!db.objectStoreNames.contains(STORE_PROPIEDADES)) {
                const store = db.createObjectStore(STORE_PROPIEDADES, { keyPath: 'id', autoIncrement: true });
                store.createIndex('url', 'url', { unique: true });
                store.createIndex('origen', 'origen', { unique: false });
                store.createIndex('estrato', 'estrato', { unique: false });
                store.createIndex('precio', 'precio', { unique: false });
                store.createIndex('piso', 'piso', { unique: false });
                store.createIndex('fecha', 'fecha_recopilacion', { unique: false });
                store.createIndex('puntuacion', 'puntuacion', { unique: false });
            }

            if (!db.objectStoreNames.contains(STORE_CONFIGURACION)) {
                db.createObjectStore(STORE_CONFIGURACION, { keyPath: 'clave' });
            }

            if (!db.objectStoreNames.contains(STORE_HISTORIAL_COLA)) {
                const cola = db.createObjectStore(STORE_HISTORIAL_COLA, { keyPath: 'id', autoIncrement: true });
                cola.createIndex('url', 'url', { unique: true });
                cola.createIndex('estado', 'estado', { unique: false });
            }

            if (!db.objectStoreNames.contains(STORE_CAMBIOS_PRECIO)) {
                const cambios = db.createObjectStore(STORE_CAMBIOS_PRECIO, { keyPath: 'id', autoIncrement: true });
                cambios.createIndex('propiedad_id', 'propiedad_id', { unique: false });
                cambios.createIndex('fecha', 'fecha', { unique: false });
            }
        };

        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });

    return dbPromise;
}

function tx(db, storeNames, mode = 'readonly') {
    return db.transaction(storeNames, mode);
}

function promisifyRequest(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/* ------------------------------------------------------------------ */
/* PROPIEDADES                                                        */
/* ------------------------------------------------------------------ */

const ESTADO = {
    PENDIENTE_CONFIRMACION: 'pendiente_confirmacion',
    CONFIRMADO: 'confirmado',
    NO_DISPONIBLE: 'no_disponible',
    FUERA_DE_CRITERIO: 'fuera_de_criterio'
};

/** Crea el registro base de una propiedad con valores por defecto. */
export function crearRegistroPropiedad(datos) {
    const ahora = new Date().toISOString();
    return {
        url: datos.url,
        origen: datos.origen,
        tipo: datos.tipo ?? null,
        precio: datos.precio ?? null,
        metros_cuadrados: datos.metros_cuadrados ?? null,
        estrato: datos.estrato ?? null,
        piso: datos.piso ?? null,
        administracion: datos.administracion ?? null,
        parqueadero: datos.parqueadero ?? null,
        ascensor: datos.ascensor ?? null,
        conjunto_cerrado: datos.conjunto_cerrado ?? 'sin_confirmar',
        ubicacion_texto: datos.ubicacion_texto ?? null,
        ubicacion_lat: datos.ubicacion_lat ?? null,
        ubicacion_lng: datos.ubicacion_lng ?? null,
        mapa_imagen: datos.mapa_imagen ?? null,
        bueno_vivir_arrendar: datos.bueno_vivir_arrendar ?? 'sin_confirmar',
        posible_dividir: datos.posible_dividir ?? 'sin_confirmar',
        buena_ubicacion: datos.buena_ubicacion ?? 'sin_confirmar',
        telefonos: datos.telefonos ?? [],
        puntuacion: datos.puntuacion ?? 0,
        campos_estimados: datos.campos_estimados ?? [],
        fecha_recopilacion: ahora,
        fecha_actualizacion: ahora,
        estado: datos.estado ?? ESTADO.PENDIENTE_CONFIRMACION
    };
}

/** Busca una propiedad existente por URL. Devuelve el registro o undefined. */
export async function obtenerPropiedadPorUrl(url) {
    const db = await openDB();
    const t = tx(db, [STORE_PROPIEDADES]);
    const store = t.objectStore(STORE_PROPIEDADES);
    const index = store.index('url');
    return promisifyRequest(index.get(url));
}

/**
 * Guarda una propiedad nueva o actualiza una existente (por URL).
 * Si el precio cambió, registra el cambio en "cambios_precio".
 * Devuelve { id, esNueva, precioAnterior }.
 */
export async function guardarPropiedad(datosExtraidos) {
    const db = await openDB();
    const existente = await obtenerPropiedadPorUrl(datosExtraidos.url);

    if (!existente) {
        const registro = crearRegistroPropiedad(datosExtraidos);
        const t = tx(db, [STORE_PROPIEDADES], 'readwrite');
        const store = t.objectStore(STORE_PROPIEDADES);
        const id = await promisifyRequest(store.add(registro));
        return { id, esNueva: true, precioAnterior: null };
    }

    const precioAnterior = existente.precio;
    const precioNuevo = datosExtraidos.precio ?? existente.precio;
    const huboCambioPrecio = precioNuevo != null && precioAnterior != null && precioNuevo !== precioAnterior;

    // No sobrescribir una confirmación manual de "conjunto cerrado" con una
    // nueva detección automática si la propiedad ya fue reprocesada/revisitada.
    const datosParaMerge = { ...datosExtraidos };
    if (existente.conjunto_cerrado === 'confirmado_si' || existente.conjunto_cerrado === 'confirmado_no') {
        delete datosParaMerge.conjunto_cerrado;
    }

    const actualizado = {
        ...existente,
        ...Object.fromEntries(Object.entries(datosParaMerge).filter(([, v]) => v !== undefined && v !== null)),
        id: existente.id,
        fecha_actualizacion: new Date().toISOString()
    };

    const t = tx(db, [STORE_PROPIEDADES], 'readwrite');
    const store = t.objectStore(STORE_PROPIEDADES);
    await promisifyRequest(store.put(actualizado));

    if (huboCambioPrecio) {
        await registrarCambioPrecio(existente.id, precioAnterior, precioNuevo);
    }

    return { id: existente.id, esNueva: false, precioAnterior: huboCambioPrecio ? precioAnterior : null };
}

/** Actualiza campos puntuales de una propiedad (ej. confirmaciones manuales). */
export async function actualizarPropiedad(id, cambios) {
    const db = await openDB();
    const t = tx(db, [STORE_PROPIEDADES], 'readwrite');
    const store = t.objectStore(STORE_PROPIEDADES);
    const existente = await promisifyRequest(store.get(id));
    if (!existente) throw new Error(`Propiedad ${id} no encontrada`);
    const actualizado = { ...existente, ...cambios, fecha_actualizacion: new Date().toISOString() };
    await promisifyRequest(store.put(actualizado));
    return actualizado;
}

/** Devuelve todas las propiedades almacenadas. */
export async function obtenerTodasLasPropiedades() {
    const db = await openDB();
    const t = tx(db, [STORE_PROPIEDADES]);
    const store = t.objectStore(STORE_PROPIEDADES);
    return promisifyRequest(store.getAll());
}

/**
 * Devuelve las propiedades que cumplen los filtros, ordenadas por puntuación
 * descendente (y precio ascendente en caso de empate).
 */
export async function obtenerPropiedadesFiltradas(filtros) {
    const todas = await obtenerTodasLasPropiedades();
    const filtradas = todas.filter((p) => cumpleFiltros(p, filtros));
    filtradas.sort((a, b) => {
        if ((b.puntuacion ?? 0) !== (a.puntuacion ?? 0)) return (b.puntuacion ?? 0) - (a.puntuacion ?? 0);
        return (a.precio ?? Infinity) - (b.precio ?? Infinity);
    });
    return filtradas;
}

export function cumpleFiltros(propiedad, filtros) {
    if (!filtros) return true;
    if (filtros.estratoMax != null && propiedad.estrato != null && propiedad.estrato > filtros.estratoMax) return false;
    if (filtros.precioMax != null && propiedad.precio != null && propiedad.precio > filtros.precioMax) return false;
    if (filtros.pisoMax != null && propiedad.piso != null && propiedad.piso > filtros.pisoMax) return false;
    if (filtros.administracionMax != null && propiedad.administracion != null && propiedad.administracion > filtros.administracionMax) return false;
    if (filtros.soloConParqueadero && !propiedad.parqueadero) return false;
    if (filtros.soloConAscensor && !propiedad.ascensor) return false;
    if (filtros.soloConjuntoCerrado && !['si', 'confirmado_si'].includes(propiedad.conjunto_cerrado)) return false;
    return true;
}

/** Elimina propiedades por lista de IDs. */
export async function eliminarPropiedades(ids) {
    const db = await openDB();
    const t = tx(db, [STORE_PROPIEDADES], 'readwrite');
    const store = t.objectStore(STORE_PROPIEDADES);
    await Promise.all(ids.map((id) => promisifyRequest(store.delete(id))));
}

/** Devuelve propiedades sin actualizar hace más de `dias` días. */
export async function obtenerPropiedadesAntiguas(dias) {
    const todas = await obtenerTodasLasPropiedades();
    const limite = Date.now() - dias * 24 * 60 * 60 * 1000;
    return todas.filter((p) => new Date(p.fecha_actualizacion).getTime() < limite);
}

/* ------------------------------------------------------------------ */
/* CAMBIOS DE PRECIO                                                   */
/* ------------------------------------------------------------------ */

export async function registrarCambioPrecio(propiedadId, precioAnterior, precioNuevo) {
    const db = await openDB();
    const t = tx(db, [STORE_CAMBIOS_PRECIO], 'readwrite');
    const store = t.objectStore(STORE_CAMBIOS_PRECIO);
    const registro = {
        propiedad_id: propiedadId,
        precio_anterior: precioAnterior,
        precio_nuevo: precioNuevo,
        diferencia: precioNuevo - precioAnterior,
        fecha: new Date().toISOString()
    };
    return promisifyRequest(store.add(registro));
}

export async function obtenerHistorialPrecios(propiedadId) {
    const db = await openDB();
    const t = tx(db, [STORE_CAMBIOS_PRECIO]);
    const store = t.objectStore(STORE_CAMBIOS_PRECIO);
    const index = store.index('propiedad_id');
    return promisifyRequest(index.getAll(propiedadId));
}

/* ------------------------------------------------------------------ */
/* COLA DE HISTORIAL (procesamiento asíncrono headless)                */
/* ------------------------------------------------------------------ */

export const ESTADO_COLA = {
    PENDIENTE: 'pendiente',
    PROCESANDO: 'procesando',
    COMPLETADO: 'completado',
    NO_DISPONIBLE: 'no_disponible',
    YA_PROCESADO: 'ya_procesado'
};

/** Encola URLs nuevas evitando duplicados en la cola y en la base ya procesada. */
export async function encolarUrls(urls) {
    const db = await openDB();
    const t = tx(db, [STORE_HISTORIAL_COLA], 'readwrite');
    const store = t.objectStore(STORE_HISTORIAL_COLA);
    const index = store.index('url');

    let agregadas = 0;
    for (const url of urls) {
        const yaEnCola = await promisifyRequest(index.get(url));
        if (yaEnCola) continue;
        await promisifyRequest(store.add({ url, estado: ESTADO_COLA.PENDIENTE, fecha_encolado: new Date().toISOString() }));
        agregadas++;
    }
    return agregadas;
}

export async function obtenerSiguientePendiente() {
    const db = await openDB();
    const t = tx(db, [STORE_HISTORIAL_COLA]);
    const store = t.objectStore(STORE_HISTORIAL_COLA);
    const index = store.index('estado');
    const pendientes = await promisifyRequest(index.getAll(ESTADO_COLA.PENDIENTE));
    return pendientes[0];
}

export async function obtenerPendientesCola(limite = null) {
    const db = await openDB();
    const t = tx(db, [STORE_HISTORIAL_COLA]);
    const store = t.objectStore(STORE_HISTORIAL_COLA);
    const index = store.index('estado');
    const pendientes = await promisifyRequest(index.getAll(ESTADO_COLA.PENDIENTE));
    return limite ? pendientes.slice(0, limite) : pendientes;
}

export async function actualizarEstadoCola(id, estado) {
    const db = await openDB();
    const t = tx(db, [STORE_HISTORIAL_COLA], 'readwrite');
    const store = t.objectStore(STORE_HISTORIAL_COLA);
    const item = await promisifyRequest(store.get(id));
    if (!item) return;
    item.estado = estado;
    item.fecha_procesado = new Date().toISOString();
    await promisifyRequest(store.put(item));
}

export async function contarPendientesCola() {
    const pendientes = await obtenerPendientesCola();
    return pendientes.length;
}

export async function limpiarCola() {
    const db = await openDB();
    const t = tx(db, [STORE_HISTORIAL_COLA], 'readwrite');
    const store = t.objectStore(STORE_HISTORIAL_COLA);
    await promisifyRequest(store.clear());
}

/* ------------------------------------------------------------------ */
/* EXPORT / IMPORT                                                    */
/* ------------------------------------------------------------------ */

export async function exportarBaseDeDatos() {
    const propiedades = await obtenerTodasLasPropiedades();
    return {
        version: DB_VERSION,
        fecha_exportacion: new Date().toISOString(),
        total_registros: propiedades.length,
        propiedades
    };
}

/** Fusiona un JSON importado evitando duplicados por URL. Devuelve { nuevos, existentes }. */
export async function importarBaseDeDatos(json) {
    if (!json || !Array.isArray(json.propiedades)) {
        throw new Error('Formato de archivo inválido: se esperaba un objeto con "propiedades"');
    }
    let nuevos = 0;
    let existentes = 0;
    for (const propiedad of json.propiedades) {
        const existente = await obtenerPropiedadPorUrl(propiedad.url);
        if (existente) {
            existentes++;
            continue;
        }
        const db = await openDB();
        const t = tx(db, [STORE_PROPIEDADES], 'readwrite');
        const store = t.objectStore(STORE_PROPIEDADES);
        const { id, ...resto } = propiedad;
        await promisifyRequest(store.add(resto));
        nuevos++;
    }
    return { nuevos, existentes };
}

export { STORE_PROPIEDADES, STORE_CONFIGURACION, STORE_HISTORIAL_COLA, STORE_CAMBIOS_PRECIO, ESTADO };
