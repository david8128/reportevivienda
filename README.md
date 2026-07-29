# ReporteVivienda

Extensión de Chrome (Manifest V3, en español) que recopila, analiza y puntúa
anuncios de vivienda de **FincaRaiz** y **MetroCuadrado** para generar un
reporte en PDF con las mejores opciones según tus propios criterios.

> ⚠️ Proyecto personal/educativo. Este software **no** está afiliado ni
> respaldado por FincaRaiz, MetroCuadrado ni Google. Úsalo respetando los
> Términos de Servicio de cada sitio web.

## ✨ Características

- **Recolección desde el historial**: procesa en segundo plano (headless,
  vía `chrome.offscreen`) todas las URLs de detalle de propiedad visitadas
  en FincaRaiz y MetroCuadrado.
- **Monitoreo en vivo**: si tienes la opción activada, cada vez que abres una
  nueva pestaña de detalle de propiedad, la extensión la captura y guarda
  automáticamente.
- **Extracción estructurada** de: metros cuadrados, precio, tipo de inmueble
  (casa/apartamento), valor de administración, estrato, conjunto cerrado,
  parqueadero, ascensor, piso, ubicación (texto + captura del mapa
  renderizado), y teléfonos de contacto.
- **Inferencia desde la descripción**: cuando un dato no está en un campo
  explícito, se intenta inferir del texto libre del anuncio y se marca como
  *estimado* hasta que el usuario lo confirme.
- **Panel de confirmación en la página**: preguntas rápidas (Sí/No/No sé)
  sobre si el inmueble es apto para vivir y arrendar a la vez, si se podría
  dividir en más unidades, si la ubicación es buena y si está en conjunto
  cerrado.
- **Dashboard de configuración** (`chrome://extensions` → *Detalles* →
  *Opciones de la extensión*): filtros (estrato máximo, precio máximo, piso
  máximo, administración máxima, etc.), pesos del sistema de puntuación,
  tabla de propiedades, pendientes de confirmación, historial de cambios de
  precio, importación/exportación y limpieza de datos antiguos.
- **Sistema de puntuación configurable**: cada propiedad recibe un puntaje
  calculado a partir de los filtros y pesos definidos por el usuario (no de
  valores fijos), y el reporte se ordena de mayor a menor puntaje.
- **Reporte en PDF**: portada con filtros aplicados, una ficha por propiedad
  (con mapa, precio/m², evaluación y teléfonos) y un resumen ejecutivo con
  las mejores opciones.
- **100% local**: toda la información se guarda en IndexedDB y
  `chrome.storage.local` del navegador; no se envía a ningún servidor.

## 🧱 Estructura del proyecto

```
features/          Especificaciones Gherkin (BDD) del comportamiento esperado
mappings/           Mapeos de selectores CSS/XPath por sitio y por campo
src/
  background/       Service worker (MV3) - recolección, cola, mensajería
  content/          Content script inyectado en fincaraiz.com / metrocuadrado.com
  offscreen/        Documento offscreen para el scraping headless
  popup/            Popup de la barra de herramientas
  dashboard/         Configuración, tabla de propiedades y generación de PDF
  shared/           Módulos compartidos (config, db, scorer, extractors, pdf)
  icons/            Íconos de la extensión
  libs/             Librerías de terceros empaquetadas localmente (jsPDF)
```

## 🚀 Instalación (modo desarrollador)

1. Clona este repositorio.
2. Instala las dependencias y copia las librerías necesarias:
   ```bash
   npm install
   npm run setup-libs
   ```
3. Abre `chrome://extensions` en Chrome/Edge.
4. Activa el **Modo de desarrollador**.
5. Haz clic en **Cargar extensión sin empaquetar** y selecciona la carpeta
   `src/`.

## ⚙️ Uso

1. Abre el popup de la extensión y pulsa **Recopilar desde historial** para
   procesar en segundo plano las propiedades ya visitadas.
2. Activa **Monitoreo en vivo** para capturar automáticamente cada nueva
   página de detalle que visites.
3. Abre el **Dashboard** para ajustar filtros y pesos de puntuación, revisar
   la tabla de propiedades, confirmar campos pendientes y generar el
   **reporte PDF**.

## 🛠️ Requisitos de desarrollo

- [Volta](https://volta.sh/) (gestiona Node.js/npm de forma reproducible) o
  Node.js LTS instalado manualmente.
- Google Chrome o cualquier navegador basado en Chromium compatible con
  Manifest V3.

## 🤝 Contribuir

Las contribuciones son bienvenidas mediante *issues* y *pull requests*. Antes
de contribuir, ten en cuenta que este proyecto se distribuye bajo una
licencia **copyleft** (ver abajo): cualquier trabajo derivado distribuido
también debe publicarse bajo los mismos términos.

## 📄 Licencia

Este proyecto está licenciado bajo la **GNU General Public License v3.0**
(GPL-3.0-or-later). Consulta el archivo [LICENSE](LICENSE) para el texto
completo.

En resumen (esto no sustituye al texto legal de la licencia):

- Puedes usar, estudiar, modificar y redistribuir este software libremente.
- Si distribuyes una versión modificada, debes publicar su código fuente
  bajo la misma licencia GPL-3.0.
- El software se ofrece **sin ninguna garantía**.
