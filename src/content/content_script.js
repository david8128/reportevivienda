/**
 * content_script.js
 * Se ejecuta en páginas de fincaraiz.com y metrocuadrado.com.
 * Ver features/02_monitoreo_en_vivo.feature y features/07_confirmacion_datos.feature
 *
 * Nota: se usa import() dinámico (en vez de import estático) porque los content
 * scripts de Manifest V3 se inyectan como scripts clásicos; el import dinámico
 * de recursos declarados en web_accessible_resources sí está soportado.
 */
(async () => {
    const base = chrome.runtime.getURL('shared/');
    const [{ MSG, enviarMensaje }, { esPaginaDeDetalle, extraerPropiedad }, { loadConfig }] = await Promise.all([
        import(base + 'messaging.js'),
        import(base + 'extractors/index.js'),
        import(base + 'config.js')
    ]);

    const POSPONER_HORAS = 24;
    const CLAVE_POSPUESTO = (url) => `rv_pospuesto_${btoa(url).slice(0, 40)}`;

    function estaPospuesto(url) {
        const valor = sessionStorage.getItem(CLAVE_POSPUESTO(url));
        if (!valor) return false;
        return Date.now() < parseInt(valor, 10);
    }
    function posponer(url) {
        sessionStorage.setItem(CLAVE_POSPUESTO(url), String(Date.now() + POSPONER_HORAS * 60 * 60 * 1000));
    }

    function esperar(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /** Espera a que un selector esté presente y visible, con timeout. */
    function esperarSelector(selector, timeoutMs = 5000) {
        return new Promise((resolve) => {
            const inicio = Date.now();
            const chequear = () => {
                const el = document.querySelector(selector);
                if (el && el.offsetWidth > 0 && el.offsetHeight > 0) {
                    resolve(el);
                    return;
                }
                if (Date.now() - inicio > timeoutMs) {
                    resolve(null);
                    return;
                }
                requestAnimationFrame(chequear);
            };
            chequear();
        });
    }

    const SELECTORES_MAPA = [
        '#map', '.leaflet-container', '.mapboxgl-canvas',
        '[class*="map-container"]', '[class*="MapContainer"]', '[data-testid*="map"]',
        'iframe[src*="google.com/maps"]'
    ];

    async function localizarYCapturarMapa() {
        let mapEl = null;
        for (const selector of SELECTORES_MAPA) {
            // eslint-disable-next-line no-await-in-loop
            mapEl = await esperarSelector(selector, 1200);
            if (mapEl) break;
        }
        if (!mapEl) return null;

        await esperar(500); // pequeño margen para que terminen de cargar los tiles

        const rect = mapEl.getBoundingClientRect();
        const respuesta = await enviarMensaje({ type: MSG.SOLICITAR_CAPTURA_MAPA });
        if (!respuesta?.ok) return null;

        return recortarImagen(respuesta.dataUrl, rect);
    }

    function recortarImagen(dataUrl, rect) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const dpr = window.devicePixelRatio || 1;
                const canvas = document.createElement('canvas');
                canvas.width = rect.width;
                canvas.height = rect.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(
                    img,
                    rect.left * dpr, rect.top * dpr, rect.width * dpr, rect.height * dpr,
                    0, 0, rect.width, rect.height
                );
                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = () => resolve(null);
            img.src = dataUrl;
        });
    }

    function mostrarIndicadorGuardado() {
        let el = document.getElementById('rv-indicador-guardado');
        if (!el) {
            el = document.createElement('div');
            el.id = 'rv-indicador-guardado';
            el.textContent = '✓ Guardado';
            document.body.appendChild(el);
        }
        requestAnimationFrame(() => el.classList.add('rv-visible'));
        setTimeout(() => el.classList.remove('rv-visible'), 3000);
    }

    /* ------------------------------------------------------------------ */
    /* Panel flotante de confirmación                                      */
    /* ------------------------------------------------------------------ */

    const PREGUNTAS = [
        {
            campo: 'conjunto_cerrado',
            pregunta: '¿Esta propiedad está dentro de un conjunto cerrado o urbanización con acceso controlado?',
            // También se muestra cuando el dato fue estimado a partir de la descripción
            // (no solo cuando está totalmente sin confirmar), ya que es un criterio clave de filtrado.
            debeMostrarse: (valor, prop) => valor == null || valor === 'sin_confirmar' || prop.campos_estimados?.includes('conjunto_cerrado')
        },
        {
            campo: 'bueno_vivir_arrendar',
            pregunta: '¿Es viable vivir y arrendar una parte de esta propiedad simultáneamente?'
        },
        {
            campo: 'posible_dividir',
            pregunta: '¿Sería posible dividir esta propiedad en dos o más unidades independientes?'
        },
        {
            campo: 'buena_ubicacion',
            pregunta: 'Según la ubicación mostrada, ¿considera que es una buena localización?'
        }
    ];

    function crearPanelConfirmacion(propiedad, propiedadId) {
        if (document.getElementById('rv-panel-confirmacion')) return;

        const panel = document.createElement('div');
        panel.id = 'rv-panel-confirmacion';

        const header = document.createElement('div');
        header.className = 'rv-header';
        header.innerHTML = '<span>ReporteVivienda - Confirmar datos ⚠</span>';
        const botonesHeader = document.createElement('div');
        const btnCerrar = document.createElement('button');
        btnCerrar.textContent = '✕';
        btnCerrar.title = 'Cerrar';
        btnCerrar.onclick = () => panel.remove();
        botonesHeader.appendChild(btnCerrar);
        header.appendChild(botonesHeader);
        panel.appendChild(header);

        const body = document.createElement('div');
        body.className = 'rv-body';

        for (const { campo, pregunta, debeMostrarse } of PREGUNTAS) {
            const valorActual = propiedad[campo];
            const mostrar = debeMostrarse
                ? debeMostrarse(valorActual, propiedad)
                : !(valorActual && valorActual !== 'sin_confirmar');
            if (!mostrar) continue;

            const div = document.createElement('div');
            div.className = 'rv-campo';
            const p = document.createElement('div');
            p.className = 'rv-pregunta';
            p.textContent = pregunta;
            div.appendChild(p);

            if (campo === 'posible_dividir' && propiedad.metros_cuadrados) {
                const sub = document.createElement('div');
                sub.className = 'rv-sub';
                sub.textContent = `Área de referencia: ${propiedad.metros_cuadrados} m²`;
                div.appendChild(sub);
            }
            if (campo === 'buena_ubicacion' && propiedad.ubicacion_texto) {
                const sub = document.createElement('div');
                sub.className = 'rv-sub';
                sub.textContent = propiedad.ubicacion_texto;
                div.appendChild(sub);
            }

            const opciones = document.createElement('div');
            opciones.className = 'rv-opciones';
            const btnSi = crearBotonOpcion('Sí ✓', 'rv-si', () => responder(campo, 'confirmado_si', div));
            const btnNo = crearBotonOpcion('No ✗', 'rv-no', () => responder(campo, 'confirmado_no', div));
            const btnNs = crearBotonOpcion('No sé ?', '', () => responder(campo, 'sin_confirmar', div));
            opciones.append(btnSi, btnNo, btnNs);
            div.appendChild(opciones);
            body.appendChild(div);
        }

        // Campos numéricos estimados (estrato, piso)
        for (const campoNumerico of ['estrato', 'piso']) {
            if (!propiedad.campos_estimados?.includes(campoNumerico)) continue;
            const div = document.createElement('div');
            div.className = 'rv-campo';
            const p = document.createElement('div');
            p.className = 'rv-pregunta';
            p.textContent = `${campoNumerico === 'estrato' ? 'Estrato' : 'Piso'}: ${propiedad[campoNumerico] ?? '?'} (estimado de la descripción)`;
            div.appendChild(p);
            const input = document.createElement('input');
            input.type = 'number';
            input.className = 'rv-input-numero';
            input.value = propiedad[campoNumerico] ?? '';
            input.onchange = () => responder(campoNumerico, parseInt(input.value, 10), div, true);
            div.appendChild(input);
            body.appendChild(div);
        }

        if (!body.hasChildNodes()) return; // nada que confirmar

        panel.appendChild(body);

        const footer = document.createElement('div');
        footer.className = 'rv-footer';
        const btnCerrarTodo = document.createElement('button');
        btnCerrarTodo.textContent = 'Cerrar';
        btnCerrarTodo.onclick = () => panel.remove();
        const btnPosponer = document.createElement('button');
        btnPosponer.textContent = 'Recordar más tarde';
        btnPosponer.onclick = () => { posponer(location.href); panel.remove(); };
        footer.append(btnCerrarTodo, btnPosponer);
        panel.appendChild(footer);

        document.body.appendChild(panel);
        hacerArrastrable(panel, header);

        async function responder(campo, valor, contenedorCampo, esNumerico = false) {
            const cambios = { [campo]: valor };
            if (propiedad.campos_estimados?.includes(campo)) {
                cambios.campos_estimados = propiedad.campos_estimados.filter((c) => c !== campo);
            }
            await enviarMensaje({ type: MSG.CONFIRMAR_CAMPOS, id: propiedadId, cambios });
            if (!esNumerico) {
                contenedorCampo.innerHTML = `<div class="rv-confirmado">✓ Respuesta guardada</div>`;
            }
        }
    }

    function crearBotonOpcion(texto, clase, onClick) {
        const btn = document.createElement('button');
        btn.className = `rv-opcion ${clase}`;
        btn.textContent = texto;
        btn.onclick = onClick;
        return btn;
    }

    function hacerArrastrable(panel, header) {
        let arrastrando = false, offsetX = 0, offsetY = 0;
        header.addEventListener('mousedown', (e) => {
            arrastrando = true;
            offsetX = e.clientX - panel.getBoundingClientRect().left;
            offsetY = e.clientY - panel.getBoundingClientRect().top;
        });
        document.addEventListener('mousemove', (e) => {
            if (!arrastrando) return;
            panel.style.left = `${e.clientX - offsetX}px`;
            panel.style.top = `${e.clientY - offsetY}px`;
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';
            panel.style.position = 'fixed';
        });
        document.addEventListener('mouseup', () => { arrastrando = false; });
    }

    /* ------------------------------------------------------------------ */
    /* Flujo principal                                                     */
    /* ------------------------------------------------------------------ */

    async function iniciar() {
        if (!esPaginaDeDetalle(location.href)) return;

        const config = await loadConfig();
        if (!config.monitoreoEnVivo) return;
        if (estaPospuesto(location.href)) return;

        // Esperar renderizado del mapa antes de extraer ubicación completa
        const mapaImagen = await localizarYCapturarMapa();

        const datos = extraerPropiedad(document, location.href);
        if (mapaImagen) datos.mapa_imagen = mapaImagen;

        const respuesta = await enviarMensaje({ type: MSG.GUARDAR_PROPIEDAD, datos });
        if (!respuesta) return;

        mostrarIndicadorGuardado();

        const tieneCamposPendientes =
            datos.conjunto_cerrado === 'sin_confirmar' ||
            datos.bueno_vivir_arrendar === 'sin_confirmar' ||
            datos.posible_dividir === 'sin_confirmar' ||
            datos.buena_ubicacion === 'sin_confirmar' ||
            (datos.campos_estimados && datos.campos_estimados.length > 0);

        if (tieneCamposPendientes) {
            setTimeout(() => crearPanelConfirmacion(datos, respuesta.id), 1000);
        }
    }

    if (document.readyState === 'complete') {
        iniciar();
    } else {
        window.addEventListener('load', iniciar);
    }
})();
