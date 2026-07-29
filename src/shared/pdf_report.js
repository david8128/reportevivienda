/**
 * pdf_report.js
 * Generación del reporte PDF de propiedades usando jsPDF (cargado como script
 * clásico global en dashboard.html -> window.jspdf.jsPDF).
 * Ver features/06_reporte_pdf.feature
 */
import { calcularPrecioM2 } from './scorer.js';

const COP = (valor) => valor != null ? `$${Math.round(valor).toLocaleString('es-CO')}` : 'No disponible';
const MEDALLAS = ['🥇', '🥈', '🥉'];

function formatearFecha(fecha) {
    return new Intl.DateTimeFormat('es-CO', { year: 'numeric', month: 'long', day: 'numeric' }).format(fecha);
}

function nombreCampoAmigable(campo) {
    const nombres = {
        precio: 'Precio', metros_cuadrados: 'Metros cuadrados', tipo: 'Tipo de inmueble',
        administracion: 'Administración', estrato: 'Estrato', piso: 'Piso',
        parqueadero: 'Parqueadero', ascensor: 'Ascensor', conjunto_cerrado: 'Conjunto cerrado',
        ubicacion_texto: 'Ubicación'
    };
    return nombres[campo] || campo;
}

function agregarPortada(doc, propiedades, filtrosTexto, opciones) {
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFillColor(26, 115, 232);
    doc.rect(0, 0, pageWidth, 45, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text('Reporte de Propiedades', pageWidth / 2, 20, { align: 'center' });
    doc.setFontSize(13);
    doc.text('ReporteVivienda', pageWidth / 2, 30, { align: 'center' });

    doc.setTextColor(30, 30, 30);
    doc.setFontSize(11);
    let y = 60;
    doc.text(`Fecha de generación: ${formatearFecha(new Date())}`, 15, y); y += 8;

    if (opciones.topN) {
        doc.text(`Top ${opciones.topN} de ${opciones.totalOriginal} propiedades encontradas`, 15, y);
    } else {
        doc.text(`${propiedades.length} propiedades encontradas`, 15, y);
    }
    y += 10;

    doc.setFont(undefined, 'bold');
    doc.text('Filtros aplicados:', 15, y);
    doc.setFont(undefined, 'normal');
    y += 7;
    for (const linea of filtrosTexto) {
        doc.text(`• ${linea}`, 18, y);
        y += 6;
    }
}

function agregarFichaPropiedad(doc, propiedad, posicion) {
    doc.addPage();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 15;

    const medalla = posicion <= 3 ? ` ${MEDALLAS[posicion - 1]}` : '';
    doc.setFillColor(245, 247, 250);
    doc.rect(0, 0, pageWidth, 28, 'F');
    doc.setTextColor(26, 115, 232);
    doc.setFontSize(18);
    doc.text(`#${posicion}${medalla}  Puntuación: ${propiedad.puntuacion ?? 0}`, 15, 15);
    doc.setFontSize(11);
    doc.setTextColor(90, 90, 90);
    doc.text(`${(propiedad.tipo || 'Tipo desconocido').toUpperCase()} · ${propiedad.origen}`, 15, 23);
    y = 36;

    doc.setTextColor(20, 20, 20);
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Precio', 15, y);
    doc.setFont(undefined, 'normal');
    y += 6;
    const precioM2 = calcularPrecioM2(propiedad);
    doc.text(`Valor: ${COP(propiedad.precio)}    Precio/m²: ${precioM2 ? COP(precioM2) : 'N/D'}    Administración: ${COP(propiedad.administracion)}`, 15, y);
    y += 10;

    doc.setFont(undefined, 'bold');
    doc.text('Características', 15, y);
    doc.setFont(undefined, 'normal');
    y += 6;
    doc.text(
        `M²: ${propiedad.metros_cuadrados ?? 'N/D'}    Estrato: ${propiedad.estrato ?? 'N/D'}    Piso: ${propiedad.piso ?? 'N/D'}`,
        15, y
    ); y += 6;
    doc.text(
        `Parqueadero: ${propiedad.parqueadero ? 'Sí' : 'No'}    Ascensor: ${propiedad.ascensor ? 'Sí' : 'No'}`,
        15, y
    ); y += 10;

    doc.setFont(undefined, 'bold');
    doc.text('Evaluación', 15, y);
    doc.setFont(undefined, 'normal');
    y += 6;
    const respuesta = (v) => v === 'confirmado_si' ? 'Sí' : v === 'confirmado_no' ? 'No'
        : v === 'si' ? 'Sí (estimado) ⚠' : v === 'no' ? 'No (estimado) ⚠' : 'Sin confirmar ⚠';
    doc.text(`Conjunto cerrado: ${respuesta(propiedad.conjunto_cerrado)}`, 15, y); y += 6;
    doc.text(`Viable vivir + arrendar: ${respuesta(propiedad.bueno_vivir_arrendar)}`, 15, y); y += 6;
    doc.text(`Posibilidad de dividir: ${respuesta(propiedad.posible_dividir)}`, 15, y); y += 6;
    doc.text(`Buena ubicación: ${respuesta(propiedad.buena_ubicacion)}`, 15, y); y += 10;

    doc.setFont(undefined, 'bold');
    doc.text('Contacto', 15, y);
    doc.setFont(undefined, 'normal');
    y += 6;
    if (propiedad.telefonos?.length) {
        doc.text(propiedad.telefonos.join(', '), 15, y);
    } else {
        doc.text('Teléfono no disponible - ver anuncio original', 15, y);
    }
    y += 10;

    // Mapa
    if (propiedad.mapa_imagen) {
        try {
            doc.setFont(undefined, 'bold');
            doc.text('Ubicación', 15, y);
            y += 4;
            doc.addImage(propiedad.mapa_imagen, 'PNG', 15, y, 80, 50);
            doc.setFont(undefined, 'normal');
            doc.setFontSize(10);
            doc.text(propiedad.ubicacion_texto || '', 100, y + 10, { maxWidth: 90 });
            y += 55;
        } catch (e) {
            doc.text(`Ubicación: ${propiedad.ubicacion_texto || 'No disponible'}`, 15, y);
            y += 8;
        }
    } else {
        doc.setFont(undefined, 'bold');
        doc.text('Ubicación', 15, y);
        doc.setFont(undefined, 'normal');
        y += 6;
        doc.text(propiedad.ubicacion_texto || 'No disponible', 15, y);
        y += 8;
    }

    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    const url = propiedad.url.length > 90 ? propiedad.url.slice(0, 87) + '...' : propiedad.url;
    doc.textWithLink(url, 15, y + 4, { url: propiedad.url });
    y += 10;

    if (propiedad.campos_estimados?.length) {
        doc.setFontSize(9);
        doc.setTextColor(150, 100, 0);
        const campos = propiedad.campos_estimados.map(nombreCampoAmigable).join(', ');
        doc.text(`* Valores estimados de la descripción, sin confirmar: ${campos}`, 15, y, { maxWidth: pageWidth - 30 });
    }
}

function agregarResumenEjecutivo(doc, propiedades) {
    doc.addPage();
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFontSize(16);
    doc.setTextColor(26, 115, 232);
    doc.text('Resumen ejecutivo', 15, 15);

    doc.setFontSize(9);
    doc.setTextColor(20, 20, 20);
    const columnas = ['#', 'Dirección', 'Precio', 'M²', 'Puntuación', 'Teléfono'];
    const anchos = [10, 65, 35, 15, 25, 35];
    let y = 26;
    let x = 15;
    doc.setFont(undefined, 'bold');
    columnas.forEach((c, i) => { doc.text(c, x, y); x += anchos[i]; });
    doc.setFont(undefined, 'normal');
    y += 6;

    propiedades.slice(0, 30).forEach((p, idx) => {
        if (y > 280) { doc.addPage(); y = 15; }
        x = 15;
        const fila = [
            String(idx + 1),
            (p.ubicacion_texto || 'N/D').slice(0, 38),
            COP(p.precio),
            String(p.metros_cuadrados ?? 'N/D'),
            String(p.puntuacion ?? 0),
            p.telefonos?.[0] || 'N/D'
        ];
        fila.forEach((valor, i) => { doc.text(String(valor), x, y); x += anchos[i]; });
        y += 6;
    });

    // Gráfico de barras simple: top 10 puntuaciones
    const top10 = propiedades.slice(0, 10);
    if (top10.length) {
        y += 10;
        if (y > 240) { doc.addPage(); y = 20; }
        doc.setFont(undefined, 'bold');
        doc.text('Top 10 - Puntuaciones', 15, y);
        y += 8;
        const maxPuntuacion = Math.max(...top10.map((p) => p.puntuacion || 0), 1);
        const anchoMax = pageWidth - 60;
        top10.forEach((p, idx) => {
            const anchoBarra = Math.max(2, (p.puntuacion / maxPuntuacion) * anchoMax);
            doc.setFillColor(26, 115, 232);
            doc.rect(45, y - 4, anchoBarra, 5, 'F');
            doc.setFont(undefined, 'normal');
            doc.setFontSize(8);
            doc.text(`#${idx + 1}`, 15, y);
            doc.text(String(p.puntuacion ?? 0), 47 + anchoBarra, y);
            y += 7;
        });
    }
}

/**
 * Genera el reporte PDF y dispara la descarga.
 * @param {Array} propiedades - Propiedades ya filtradas y ordenadas por puntuación.
 * @param {Object} opciones - { filtrosTexto: string[], topN: number|null, totalOriginal: number }
 */
export function generarReportePDF(propiedadesOriginales, opciones = {}) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });

    const totalOriginal = opciones.totalOriginal ?? propiedadesOriginales.length;
    const propiedades = opciones.topN ? propiedadesOriginales.slice(0, opciones.topN) : propiedadesOriginales;
    const filtrosTexto = opciones.filtrosTexto || [];

    agregarPortada(doc, propiedades, filtrosTexto, { ...opciones, totalOriginal });

    propiedades.forEach((p, idx) => agregarFichaPropiedad(doc, p, idx + 1));

    if (propiedades.length > 0) {
        agregarResumenEjecutivo(doc, propiedades);
    }

    const fechaArchivo = new Date().toISOString().slice(0, 10);
    doc.save(`reporte_propiedades_${fechaArchivo}.pdf`);
}
