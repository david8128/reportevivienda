/**
 * dashboard.js
 * Lógica principal del dashboard: pestañas, filtros, pesos de puntuación,
 * tabla de propiedades, confirmaciones, importación/exportación y reporte PDF.
 * Ver features/03_dashboard_configuracion.feature, 05_sistema_puntuacion.feature,
 * 06_reporte_pdf.feature y 07_confirmacion_datos.feature
 */
import { MSG, enviarMensaje } from '../shared/messaging.js';
import { loadConfig, saveConfig, resetConfig } from '../shared/config.js';
import {
    obtenerTodasLasPropiedades, cumpleFiltros,
    actualizarPropiedad, obtenerHistorialPrecios, eliminarPropiedades,
    obtenerPropiedadesAntiguas, exportarBaseDeDatos, importarBaseDeDatos
} from '../shared/db.js';
import { recalcularPuntuacionSimple } from '../shared/scorer.js';
import { generarReportePDF } from '../shared/pdf_report.js';

let configActual = null;
let propiedadesCache = [];

/* ------------------------------------------------------------------ */
/* Utilidades de UI                                                    */
/* ------------------------------------------------------------------ */

function mostrarToast(texto, ms = 2500) {
    const toast = document.getElementById('rv-toast');
    toast.textContent = texto;
    toast.classList.remove('oculto');
    clearTimeout(mostrarToast._t);
    mostrarToast._t = setTimeout(() => toast.classList.add('oculto'), ms);
}

function formatoCOP(valor) {
    return valor != null ? `$${Math.round(valor).toLocaleString('es-CO')}` : '—';
}

function inicializarTabs() {
    document.querySelectorAll('.rv-tab').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.rv-tab').forEach((b) => b.classList.remove('activa'));
            document.querySelectorAll('.rv-panel-tab').forEach((p) => p.classList.remove('activa'));
            btn.classList.add('activa');
            document.getElementById(`tab-${btn.dataset.tab}`).classList.add('activa');
            if (btn.dataset.tab === 'pendientes') renderPendientes();
            if (btn.dataset.tab === 'historial') renderHistorial();
            if (btn.dataset.tab === 'datos') renderLimpieza();
        });
    });
}

/* ------------------------------------------------------------------ */
/* Filtros                                                             */
/* ------------------------------------------------------------------ */

function poblarFormularioFiltros() {
    const f = configActual.filtros;
    document.getElementById('filtro-estrato-max').value = f.estratoMax;
    document.getElementById('valor-estrato-max').textContent = f.estratoMax;
    document.getElementById('filtro-precio-min').value = f.precioMin;
    document.getElementById('filtro-precio-max').value = f.precioMax;
    document.getElementById('filtro-piso-max').value = String(f.pisoMax);
    document.getElementById('filtro-admin-max').value = f.administracionMax;
    document.getElementById('filtro-parqueadero').checked = f.soloConParqueadero;
    document.getElementById('filtro-ascensor').checked = f.soloConAscensor;
    document.getElementById('filtro-conjunto').checked = f.soloConjuntoCerrado;

    document.getElementById('filtro-estrato-max').addEventListener('input', (e) => {
        document.getElementById('valor-estrato-max').textContent = e.target.value;
    });
}

function leerFormularioFiltros() {
    return {
        estratoMax: parseInt(document.getElementById('filtro-estrato-max').value, 10),
        precioMin: parseInt(document.getElementById('filtro-precio-min').value, 10),
        precioMax: parseInt(document.getElementById('filtro-precio-max').value, 10),
        pisoMax: parseInt(document.getElementById('filtro-piso-max').value, 10),
        administracionMax: parseInt(document.getElementById('filtro-admin-max').value, 10),
        soloConParqueadero: document.getElementById('filtro-parqueadero').checked,
        soloConAscensor: document.getElementById('filtro-ascensor').checked,
        soloConjuntoCerrado: document.getElementById('filtro-conjunto').checked
    };
}

document.getElementById('btn-guardar-filtros').addEventListener('click', async () => {
    const filtros = leerFormularioFiltros();
    configActual = await saveConfig({ filtros });
    poblarFormularioPesos();
    await recalcularTodas();
    await cargarYRenderizarTabla();
    mostrarToast('Filtros guardados y puntuaciones actualizadas');
});

/* ------------------------------------------------------------------ */
/* Pesos de puntuación                                                 */
/* ------------------------------------------------------------------ */

// Las etiquetas de los criterios de precio/estrato/piso/administración se generan
// dinámicamente a partir de los filtros configurados, para que siempre reflejen
// los umbrales vigentes (y no valores fijos como "550M" o "300K").
function formatoMillones(valor) {
    return `${Math.round(valor / 1000000)}M`;
}

function formatoMiles(valor) {
    return `${Math.round(valor / 1000)}K`;
}

function obtenerEtiquetasPesos(filtros) {
    return {
        precioMinimo: `Precio ≥ ${formatoMillones(filtros.precioMin)}`,
        precioMax550: `Precio ≤ ${formatoMillones(filtros.precioMax)}`,
        estratoMax4: `Estrato ≤ ${filtros.estratoMax}`,
        estratoOptimo3: 'Estrato == 3 (óptimo)',
        pisoMax2: `Piso ≤ ${filtros.pisoMax}`,
        parqueadero: 'Parqueadero',
        ascensor: 'Ascensor',
        conjuntoCerrado: 'Conjunto cerrado',
        administracionMax300k: `Administración ≤ ${formatoMiles(filtros.administracionMax)}`,
        viableVivirArrendar: 'Viable vivir + arrendar',
        posibleDividir: 'Posibilidad de dividir',
        buenaUbicacion: 'Buena ubicación (manual)',
        mejorPrecioM2: 'Mejor precio/m²'
    };
}

function poblarFormularioPesos() {
    const cont = document.getElementById('pesos-contenedor');
    cont.innerHTML = '';
    const etiquetasPesos = obtenerEtiquetasPesos(configActual.filtros);
    for (const [clave, etiqueta] of Object.entries(etiquetasPesos)) {
        const valor = configActual.pesos[clave] ?? 0;
        const div = document.createElement('div');
        div.className = 'rv-peso-fila';
        div.innerHTML = `
      <label>${etiqueta} <span id="valor-peso-${clave}">${valor}</span></label>
      <input type="range" min="0" max="30" value="${valor}" data-peso="${clave}">
    `;
        cont.appendChild(div);
    }
    cont.querySelectorAll('input[type=range]').forEach((input) => {
        input.addEventListener('input', () => {
            document.getElementById(`valor-peso-${input.dataset.peso}`).textContent = input.value;
        });
    });
}

function leerFormularioPesos() {
    const pesos = {};
    document.querySelectorAll('#pesos-contenedor input[type=range]').forEach((input) => {
        pesos[input.dataset.peso] = parseInt(input.value, 10);
    });
    return pesos;
}

document.getElementById('btn-guardar-pesos').addEventListener('click', async () => {
    const pesos = leerFormularioPesos();
    configActual = await saveConfig({ pesos });
    mostrarToast('Recalculando puntuaciones...');
    await recalcularTodas();
    mostrarToast(`Puntuaciones actualizadas (${propiedadesCache.length} propiedades)`);
    await cargarYRenderizarTabla();
});

document.getElementById('btn-restablecer').addEventListener('click', async () => {
    if (!confirm('¿Restablecer todos los filtros y pesos a los valores predeterminados?')) return;
    configActual = await resetConfig();
    poblarFormularioFiltros();
    poblarFormularioPesos();
    await recalcularTodas();
    await cargarYRenderizarTabla();
    mostrarToast('Configuración restablecida');
});

async function recalcularTodas() {
    const propiedades = await obtenerTodasLasPropiedades();
    for (const p of propiedades) {
        const puntuacion = recalcularPuntuacionSimple(p, configActual.pesos, configActual.filtros);
        if (puntuacion !== p.puntuacion) {
            await actualizarPropiedad(p.id, { puntuacion });
        }
    }
}

/* ------------------------------------------------------------------ */
/* Tabla de propiedades                                                */
/* ------------------------------------------------------------------ */

async function cargarYRenderizarTabla() {
    const todas = await obtenerTodasLasPropiedades();
    todas.sort((a, b) => {
        if ((b.puntuacion ?? 0) !== (a.puntuacion ?? 0)) return (b.puntuacion ?? 0) - (a.puntuacion ?? 0);
        return (a.precio ?? Infinity) - (b.precio ?? Infinity);
    });
    propiedadesCache = todas;

    const tbody = document.getElementById('tabla-propiedades-body');
    tbody.innerHTML = '';

    const elegibles = todas.filter((p) => cumpleFiltros(p, configActual.filtros));
    document.getElementById('contador-resultados').textContent = `${elegibles.length} de ${todas.length} propiedades cumplen los filtros`;

    let posicionElegible = 0;
    for (const p of todas) {
        const cumple = cumpleFiltros(p, configActual.filtros);
        if (cumple) posicionElegible++;

        const tr = document.createElement('tr');
        if (!cumple) tr.classList.add('fuera-de-criterio');

        const medalla = cumple && posicionElegible <= 3 ? ['🥇', '🥈', '🥉'][posicionElegible - 1] : '';
        const historial = await obtenerHistorialPrecios(p.id);
        const ultimoCambio = historial[historial.length - 1];
        const bajoPrecio = ultimoCambio && ultimoCambio.diferencia < 0
            ? `<span class="rv-badge-precio-baja">↓ ${Math.round(ultimoCambio.diferencia / 1000000)}M</span>` : '';

        const tieneEstimados = p.campos_estimados?.length > 0;
        const tienePendientes = ['conjunto_cerrado', 'bueno_vivir_arrendar', 'posible_dividir', 'buena_ubicacion']
            .some((c) => p[c] === 'sin_confirmar');
        const advertencia = (tieneEstimados || tienePendientes)
            ? `<span class="rv-warning" title="Tiene campos por confirmar" data-confirmar="${p.id}">⚠</span>` : '';

        tr.innerHTML = `
      <td><span class="rv-medalla">${medalla}</span><span class="rv-puntuacion">${p.puntuacion ?? 0}</span></td>
      <td>${p.tipo ?? '—'}</td>
      <td>${formatoCOP(p.precio)}${bajoPrecio}</td>
      <td>${p.metros_cuadrados ?? '—'}</td>
      <td>${p.estrato ?? '—'}</td>
      <td>${p.piso ?? '—'}</td>
      <td>${formatoCOP(p.administracion)}</td>
      <td>${p.parqueadero ? '✔' : '—'}</td>
      <td>${p.ascensor ? '✔' : '—'}</td>
      <td>${['si', 'confirmado_si'].includes(p.conjunto_cerrado) ? '✔' : '—'}</td>
      <td>${p.ubicacion_texto ?? '—'}</td>
      <td>${p.origen}</td>
      <td>${advertencia} ${p.estado}</td>
      <td>
        <button class="rv-btn-mini" data-abrir="${p.url}">🔗</button>
        <button class="rv-btn-mini" data-confirmar-btn="${p.id}">⚠ Confirmar</button>
        <button class="rv-btn-mini" data-eliminar="${p.id}">🗑</button>
      </td>
    `;
        tbody.appendChild(tr);
    }

    tbody.querySelectorAll('[data-abrir]').forEach((btn) => {
        btn.addEventListener('click', () => chrome.tabs.create({ url: btn.dataset.abrir }));
    });
    tbody.querySelectorAll('[data-confirmar-btn], [data-confirmar]').forEach((el) => {
        el.addEventListener('click', () => abrirModalConfirmacion(el.dataset.confirmarBtn || el.dataset.confirmar));
    });
    tbody.querySelectorAll('[data-eliminar]').forEach((btn) => {
        btn.addEventListener('click', async () => {
            if (!confirm('¿Eliminar esta propiedad de la base de datos?')) return;
            await eliminarPropiedades([parseInt(btn.dataset.eliminar, 10)]);
            await cargarYRenderizarTabla();
        });
    });
}

/* ------------------------------------------------------------------ */
/* Modal de confirmación de campos estimados                           */
/* ------------------------------------------------------------------ */

const CAMPOS_SI_NO = [
    { campo: 'conjunto_cerrado', etiqueta: '¿Está dentro de un conjunto cerrado o urbanización con acceso controlado?' },
    { campo: 'bueno_vivir_arrendar', etiqueta: '¿Viable para vivir y arrendar simultáneamente?' },
    { campo: 'posible_dividir', etiqueta: '¿Se podría dividir en dos o más unidades?' },
    { campo: 'buena_ubicacion', etiqueta: '¿Considera que la ubicación es buena?' }
];
const CAMPOS_NUMERICOS = ['estrato', 'piso', 'metros_cuadrados', 'precio', 'administracion'];

async function abrirModalConfirmacion(idStr) {
    const id = parseInt(idStr, 10);
    const propiedad = propiedadesCache.find((p) => p.id === id);
    if (!propiedad) return;

    const modal = document.getElementById('modal-confirmacion');
    const contenedor = document.getElementById('modal-campos');
    contenedor.innerHTML = '';

    for (const { campo, etiqueta } of CAMPOS_SI_NO) {
        const valorActual = propiedad[campo];
        const esSiEstimado = valorActual === 'confirmado_si' || valorActual === 'si';
        const esNoEstimado = valorActual === 'confirmado_no' || valorActual === 'no';
        const div = document.createElement('div');
        div.className = 'rv-modal-campo';
        div.innerHTML = `
      <label>${etiqueta}</label>
      <select data-campo="${campo}">
        <option value="sin_confirmar" ${!esSiEstimado && !esNoEstimado ? 'selected' : ''}>No sé</option>
        <option value="confirmado_si" ${esSiEstimado ? 'selected' : ''}>Sí</option>
        <option value="confirmado_no" ${esNoEstimado ? 'selected' : ''}>No</option>
      </select>
    `;
        contenedor.appendChild(div);
    }

    for (const campo of CAMPOS_NUMERICOS) {
        if (!propiedad.campos_estimados?.includes(campo)) continue;
        const div = document.createElement('div');
        div.className = 'rv-modal-campo';
        div.innerHTML = `
      <label>${campo} (estimado - requiere confirmación)</label>
      <input type="number" data-campo-num="${campo}" value="${propiedad[campo] ?? ''}">
    `;
        contenedor.appendChild(div);
    }

    if (!contenedor.hasChildNodes()) {
        contenedor.innerHTML = '<p>No hay campos pendientes de confirmación para esta propiedad.</p>';
    }

    modal.classList.remove('oculto');

    document.getElementById('btn-modal-guardar').onclick = async () => {
        const cambios = {};
        contenedor.querySelectorAll('[data-campo]').forEach((sel) => { cambios[sel.dataset.campo] = sel.value; });
        contenedor.querySelectorAll('[data-campo-num]').forEach((input) => {
            const campo = input.dataset.campoNum;
            const valor = parseFloat(input.value);
            if (!Number.isNaN(valor)) {
                cambios[campo] = valor;
                cambios.campos_estimados = (propiedad.campos_estimados || []).filter((c) => c !== campo);
            }
        });
        const actualizado = { ...propiedad, ...cambios };
        actualizado.puntuacion = recalcularPuntuacionSimple(actualizado, configActual.pesos, configActual.filtros);
        await actualizarPropiedad(id, { ...cambios, puntuacion: actualizado.puntuacion, estado: 'confirmado' });
        modal.classList.add('oculto');
        mostrarToast('Confirmación guardada');
        await cargarYRenderizarTabla();
    };
    document.getElementById('btn-modal-cerrar').onclick = () => modal.classList.add('oculto');
}

/* ------------------------------------------------------------------ */
/* Pendientes de confirmación                                          */
/* ------------------------------------------------------------------ */

async function renderPendientes() {
    const todas = await obtenerTodasLasPropiedades();
    const pendientes = todas.filter((p) =>
        CAMPOS_SI_NO.some(({ campo }) => p[campo] === 'sin_confirmar') || p.campos_estimados?.length > 0
    );
    const cont = document.getElementById('lista-pendientes');
    cont.innerHTML = '';

    if (pendientes.length === 0) {
        cont.innerHTML = '<p>No hay propiedades pendientes de confirmación 🎉</p>';
        return;
    }

    for (const p of pendientes) {
        const div = document.createElement('div');
        div.className = 'rv-pendiente-item';
        div.innerHTML = `<h4>${p.tipo ?? 'Propiedad'} - ${formatoCOP(p.precio)} - ${p.ubicacion_texto ?? p.url}</h4>`;
        const preguntas = document.createElement('div');
        preguntas.className = 'rv-pendiente-preguntas';
        for (const { campo, etiqueta } of CAMPOS_SI_NO) {
            if (p[campo] !== 'sin_confirmar') continue;
            const fila = document.createElement('div');
            fila.className = 'rv-pregunta-fila';
            fila.innerHTML = `
        <span>${etiqueta}</span>
        <span class="opciones">
          <button class="rv-btn-mini" data-si>Sí</button>
          <button class="rv-btn-mini" data-no>No</button>
        </span>
      `;
            fila.querySelector('[data-si]').onclick = async () => {
                await actualizarPropiedad(p.id, { [campo]: 'confirmado_si' });
                await refrescarPuntuacion(p.id);
                renderPendientes();
            };
            fila.querySelector('[data-no]').onclick = async () => {
                await actualizarPropiedad(p.id, { [campo]: 'confirmado_no' });
                await refrescarPuntuacion(p.id);
                renderPendientes();
            };
            preguntas.appendChild(fila);
        }
        div.appendChild(preguntas);
        cont.appendChild(div);
    }
}

async function refrescarPuntuacion(id) {
    const todas = await obtenerTodasLasPropiedades();
    const p = todas.find((x) => x.id === id);
    if (!p) return;
    const puntuacion = recalcularPuntuacionSimple(p, configActual.pesos, configActual.filtros);
    await actualizarPropiedad(id, { puntuacion });
}

document.getElementById('btn-confirmar-todos-nose').addEventListener('click', async () => {
    if (!confirm('¿Marcar todos los campos pendientes como "No sé"?')) return;
    const todas = await obtenerTodasLasPropiedades();
    for (const p of todas) {
        const cambios = {};
        for (const { campo } of CAMPOS_SI_NO) {
            if (p[campo] === 'sin_confirmar') cambios[campo] = 'sin_confirmar';
        }
        if (Object.keys(cambios).length) await actualizarPropiedad(p.id, cambios);
    }
    mostrarToast('Pendientes resueltos como "No sé"');
    renderPendientes();
});

/* ------------------------------------------------------------------ */
/* Historial                                                           */
/* ------------------------------------------------------------------ */

async function renderHistorial() {
    const todas = await obtenerTodasLasPropiedades();
    const cont = document.getElementById('lista-historial');
    cont.innerHTML = '';
    let huboCambios = false;

    for (const p of todas) {
        const historial = await obtenerHistorialPrecios(p.id);
        for (const cambio of historial) {
            huboCambios = true;
            const div = document.createElement('div');
            div.className = 'rv-pendiente-item';
            const signo = cambio.diferencia < 0 ? '↓' : '↑';
            div.innerHTML = `<strong>${p.ubicacion_texto ?? p.url}</strong> - ${signo} ${formatoCOP(Math.abs(cambio.diferencia))}
        (de ${formatoCOP(cambio.precio_anterior)} a ${formatoCOP(cambio.precio_nuevo)}) el ${new Date(cambio.fecha).toLocaleString('es-CO')}`;
            cont.appendChild(div);
        }
    }
    if (!huboCambios) cont.innerHTML = '<p>Aún no hay cambios de precio registrados.</p>';
}

/* ------------------------------------------------------------------ */
/* Import / Export / Limpieza                                          */
/* ------------------------------------------------------------------ */

function descargarJSON(objeto, nombreArchivo) {
    const blob = new Blob([JSON.stringify(objeto, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    a.click();
    URL.revokeObjectURL(url);
}

document.getElementById('btn-exportar-db').addEventListener('click', async () => {
    const data = await exportarBaseDeDatos();
    descargarJSON(data, `reportevivienda_db_${new Date().toISOString().slice(0, 10)}.json`);
    mostrarToast('Base de datos exportada');
});

document.getElementById('btn-exportar-config').addEventListener('click', () => {
    descargarJSON(configActual, `reportevivienda_config_${new Date().toISOString().slice(0, 10)}.json`);
    mostrarToast('Configuración exportada');
});

document.getElementById('input-importar-db').addEventListener('change', async (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;
    try {
        const json = JSON.parse(await archivo.text());
        const { nuevos, existentes } = await importarBaseDeDatos(json);
        mostrarToast(`Importados: ${nuevos} nuevos, ${existentes} ya existían`);
        await cargarYRenderizarTabla();
    } catch (err) {
        mostrarToast(`Error al importar: ${err.message}`);
    }
    e.target.value = '';
});

document.getElementById('input-importar-config').addEventListener('change', async (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;
    try {
        const json = JSON.parse(await archivo.text());
        configActual = await saveConfig(json);
        poblarFormularioFiltros();
        poblarFormularioPesos();
        await recalcularTodas();
        await cargarYRenderizarTabla();
        mostrarToast('Configuración importada');
    } catch (err) {
        mostrarToast(`Error al importar configuración: ${err.message}`);
    }
    e.target.value = '';
});

document.getElementById('btn-recuperar-historial').addEventListener('click', async () => {
    if (!confirm('¿Buscar y restaurar propiedades eliminadas que aún estén en el historial de Chrome?')) return;

    const boton = document.getElementById('btn-recuperar-historial');
    boton.disabled = true;
    mostrarToast('Buscando propiedades eliminadas en el historial...', 0);
    try {
        const resultado = await enviarMensaje({ type: MSG.RECUPERAR_DESDE_HISTORIAL });
        if (!resultado?.ok) throw new Error(resultado?.error || 'No fue posible recuperar las propiedades.');
        const resumenFallos = Object.entries(resultado.fallos || {})
            .map(([motivo, cantidad]) => `${cantidad}× ${motivo}`).join('; ');
        mostrarToast(`Recuperación terminada: ${resultado.recuperadas}/${resultado.encontradas} restauradas${resultado.noDisponibles ? `, ${resultado.noDisponibles} no disponibles${resumenFallos ? ` (${resumenFallos})` : ''}` : ''}`, 8000);
        await cargarYRenderizarTabla();
    } catch (error) {
        mostrarToast(`Error al recuperar: ${error.message}`);
    } finally {
        boton.disabled = false;
    }
});

document.getElementById('btn-aplicar-patch-mapeo').addEventListener('click', async () => {
    const origen = document.getElementById('patch-mapeo-origen').value;
    const campo = document.getElementById('patch-mapeo-campo').value;
    if (!confirm(`¿Volver a extraer el campo "${campo}" de todos los registros ${origen}?`)) return;

    const boton = document.getElementById('btn-aplicar-patch-mapeo');
    boton.disabled = true;
    mostrarToast(`Aplicando parche ${origen}/${campo}...`, 0);
    try {
        const resultado = await enviarMensaje({ type: MSG.APLICAR_PATCH_MAPEO, origen, campo });
        if (!resultado?.ok) throw new Error(resultado?.error || 'No fue posible aplicar el parche.');
        mostrarToast(`Parche aplicado: ${resultado.actualizadas}/${resultado.total} actualizadas${resultado.fallidas ? `, ${resultado.fallidas} fallidas` : ''}`);
        await cargarYRenderizarTabla();
    } catch (error) {
        mostrarToast(`Error al aplicar parche: ${error.message}`);
    } finally {
        boton.disabled = false;
    }
});

async function renderLimpieza() {
    const cont = document.getElementById('lista-limpieza');
    cont.innerHTML = '';
}

document.getElementById('btn-limpiar-antiguos').addEventListener('click', async () => {
    const antiguas = await obtenerPropiedadesAntiguas(configActual.limpiezaDiasAntiguedad);
    const cont = document.getElementById('lista-limpieza');
    if (antiguas.length === 0) {
        cont.innerHTML = '<p>No hay registros antiguos para limpiar.</p>';
        return;
    }
    cont.innerHTML = `<p>${antiguas.length} registros serán eliminados:</p>` +
        antiguas.map((p) => `<div>${p.ubicacion_texto ?? p.url}</div>`).join('') +
        `<div class="rv-acciones-fila"><button id="btn-confirmar-limpieza" class="btn btn-peligro">Confirmar eliminación</button></div>`;

    document.getElementById('btn-confirmar-limpieza').onclick = async () => {
        await eliminarPropiedades(antiguas.map((p) => p.id));
        mostrarToast(`${antiguas.length} registros eliminados`);
        cont.innerHTML = '';
        await cargarYRenderizarTabla();
    };
});

/* ------------------------------------------------------------------ */
/* Reporte PDF                                                         */
/* ------------------------------------------------------------------ */

document.getElementById('btn-pdf').addEventListener('click', () => {
    const elegibles = propiedadesCache.filter((p) => cumpleFiltros(p, configActual.filtros));
    const topN = document.getElementById('select-top-n').value;
    const filtrosTexto = [
        `Estrato ≤ ${configActual.filtros.estratoMax}`,
        `Precio ≤ ${formatoCOP(configActual.filtros.precioMax)}`,
        `Piso ≤ ${configActual.filtros.pisoMax}`,
        `Administración ≤ ${formatoCOP(configActual.filtros.administracionMax)}`
    ];
    generarReportePDF(elegibles, {
        filtrosTexto,
        topN: topN ? parseInt(topN, 10) : null,
        totalOriginal: elegibles.length
    });
    mostrarToast('Generando PDF...');
});

document.getElementById('btn-recolectar').addEventListener('click', async () => {
    await enviarMensaje({ type: MSG.INICIAR_RECOLECCION_HISTORIAL });
    mostrarToast('Recolección iniciada en segundo plano');
});

chrome.runtime.onMessage.addListener((mensaje) => {
    if ([MSG.RECOLECCION_COMPLETA, MSG.PROPIEDAD_GUARDADA, MSG.PRECIO_ACTUALIZADO].includes(mensaje?.type)) {
        cargarYRenderizarTabla();
    }
});

/* ------------------------------------------------------------------ */
/* Inicialización                                                      */
/* ------------------------------------------------------------------ */

async function inicializar() {
    inicializarTabs();
    configActual = await loadConfig();
    poblarFormularioFiltros();
    poblarFormularioPesos();
    await cargarYRenderizarTabla();
}

inicializar();
