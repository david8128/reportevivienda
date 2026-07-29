/**
 * copy-libs.js
 * Copia las librerías necesarias (jsPDF UMD) desde node_modules
 * hacia src/libs para que la extensión las cargue localmente
 * (requerido por la Content Security Policy de Manifest V3, que prohíbe CDNs).
 */
const fs = require('fs');
const path = require('path');

const srcLibsDir = path.join(__dirname, '..', 'src', 'libs');
if (!fs.existsSync(srcLibsDir)) {
    fs.mkdirSync(srcLibsDir, { recursive: true });
}

const jspdfSrc = path.join(__dirname, '..', 'node_modules', 'jspdf', 'dist', 'jspdf.umd.min.js');
const jspdfDest = path.join(srcLibsDir, 'jspdf.umd.min.js');

if (fs.existsSync(jspdfSrc)) {
    fs.copyFileSync(jspdfSrc, jspdfDest);
    console.log('jsPDF copiado a src/libs/jspdf.umd.min.js');
} else {
    console.error('No se encontro jsPDF en node_modules. Ejecuta "npm install" primero.');
    process.exit(1);
}
