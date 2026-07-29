/**
 * popup.js
 * Lógica del popup: iniciar recolección, alternar monitoreo en vivo,
 * mostrar progreso y resumen de propiedades.
 */
import { MSG, enviarMensaje } from '../shared/messaging.js';
import { loadConfig } from '../shared/config.js';
import { obtenerTodasLasPropiedades, cumpleFiltros } from '../shared/db.js';

const btnRecolectar = document.getElementById('btn-recolectar');
const btnDashboard = document.getElementById('btn-dashboard');
const chkMonitoreo = document.getElementById('chk-monitoreo-vivo');
const estadoMonitoreo = document.getElementById('estado-monitoreo');
const progresoContenedor = document.getElementById('progreso-contenedor');
const barraRelleno = document.getElementById('barra-progreso-relleno');
const progresoTexto = document.getElementById('progreso-texto');
const totalPropiedadesEl = document.getElementById('total-propiedades');
const totalPendientesEl = document.getElementById('total-pendientes');
const totalElegiblesEl = document.getElementById('total-elegibles');

async function actualizarResumen() {
    const [config, propiedades] = await Promise.all([loadConfig(), obtenerTodasLasPropiedades()]);
    totalPropiedadesEl.textContent = propiedades.length;
    totalPendientesEl.textContent = propiedades.filter((p) => p.estado === 'pendiente_confirmacion').length;
    totalElegiblesEl.textContent = propiedades.filter((p) => cumpleFiltros(p, config.filtros)).length;
}

function actualizarBarraProgreso(progreso) {
    if (!progreso || !progreso.activo) {
        progresoContenedor.classList.add('oculto');
        btnRecolectar.disabled = false;
        return;
    }
    progresoContenedor.classList.remove('oculto');
    btnRecolectar.disabled = true;
    const pct = progreso.total > 0 ? Math.min(100, Math.round((progreso.procesados / progreso.total) * 100)) : 0;
    barraRelleno.style.width = `${pct}%`;
    progresoTexto.textContent = `Procesando ${progreso.procesados} de ${progreso.total} propiedades`;
}

async function inicializar() {
    const estado = await enviarMensaje({ type: MSG.OBTENER_ESTADO });
    if (estado) {
        chkMonitoreo.checked = estado.config.monitoreoEnVivo;
        actualizarEstadoBadge(estado.config.monitoreoEnVivo);
        actualizarBarraProgreso(estado.progreso);
    }
    await actualizarResumen();
}

function actualizarEstadoBadge(activo) {
    estadoMonitoreo.textContent = activo ? 'Activo' : 'Pausado';
    estadoMonitoreo.classList.toggle('pausado', !activo);
}

btnRecolectar.addEventListener('click', async () => {
    btnRecolectar.disabled = true;
    await enviarMensaje({ type: MSG.INICIAR_RECOLECCION_HISTORIAL });
    progresoContenedor.classList.remove('oculto');
});

chkMonitoreo.addEventListener('change', async () => {
    await enviarMensaje({ type: MSG.TOGGLE_MONITOREO_VIVO, valor: chkMonitoreo.checked });
    actualizarEstadoBadge(chkMonitoreo.checked);
});

btnDashboard.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
});

chrome.runtime.onMessage.addListener((mensaje) => {
    if (mensaje?.type === MSG.PROGRESO_ACTUALIZADO) {
        actualizarBarraProgreso(mensaje.progreso);
    }
    if (mensaje?.type === MSG.RECOLECCION_COMPLETA) {
        actualizarBarraProgreso({ activo: false });
        actualizarResumen();
    }
    if (mensaje?.type === MSG.PROPIEDAD_GUARDADA) {
        actualizarResumen();
    }
});

inicializar();
