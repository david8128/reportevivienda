/**
 * config.js
 * Configuración por defecto de la extensión: filtros de búsqueda y pesos
 * del sistema de puntuación. Persistida en chrome.storage.local.
 */

export const CONFIG_STORAGE_KEY = 'rv_config';

export const DEFAULT_FILTERS = {
    estratoMax: 4,
    precioMax: 550000000,
    pisoMax: 2,
    administracionMax: 300000,
    soloConParqueadero: false,
    soloConAscensor: false,
    soloConjuntoCerrado: false
};

export const DEFAULT_WEIGHTS = {
    precioMax550: 20,
    estratoMax4: 15,
    estratoOptimo3: 5,
    pisoMax2: 10,
    parqueadero: 10,
    ascensor: 5,
    conjuntoCerrado: 10,
    administracionMax300k: 10,
    viableVivirArrendar: 20,
    posibleDividir: 15,
    buenaUbicacion: 15,
    mejorPrecioM2: 5
};

export const DEFAULT_CONFIG = {
    filtros: DEFAULT_FILTERS,
    pesos: DEFAULT_WEIGHTS,
    monitoreoEnVivo: true,
    historialDiasAtras: 90,
    rateLimit: {
        delayMs: 2000,
        maxConcurrent: 10
    },
    limpiezaDiasAntiguedad: 180,
    googleMapsApiKey: ''
};

/**
 * Carga la configuración desde chrome.storage.local, combinando con
 * los valores por defecto para campos faltantes (permite migraciones).
 */
export async function loadConfig() {
    return new Promise((resolve) => {
        chrome.storage.local.get([CONFIG_STORAGE_KEY], (result) => {
            const stored = result[CONFIG_STORAGE_KEY] || {};
            const merged = {
                ...DEFAULT_CONFIG,
                ...stored,
                filtros: { ...DEFAULT_FILTERS, ...(stored.filtros || {}) },
                pesos: { ...DEFAULT_WEIGHTS, ...(stored.pesos || {}) },
                rateLimit: { ...DEFAULT_CONFIG.rateLimit, ...(stored.rateLimit || {}) }
            };
            resolve(merged);
        });
    });
}

/**
 * Guarda la configuración completa (o parcial fusionada) en chrome.storage.local.
 */
export async function saveConfig(partialConfig) {
    const current = await loadConfig();
    const updated = {
        ...current,
        ...partialConfig,
        filtros: { ...current.filtros, ...(partialConfig.filtros || {}) },
        pesos: { ...current.pesos, ...(partialConfig.pesos || {}) },
        rateLimit: { ...current.rateLimit, ...(partialConfig.rateLimit || {}) }
    };
    return new Promise((resolve) => {
        chrome.storage.local.set({ [CONFIG_STORAGE_KEY]: updated }, () => resolve(updated));
    });
}

export async function resetConfig() {
    return new Promise((resolve) => {
        chrome.storage.local.set({ [CONFIG_STORAGE_KEY]: DEFAULT_CONFIG }, () => resolve(DEFAULT_CONFIG));
    });
}
