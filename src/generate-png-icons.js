#!/usr/bin/env node
/**
 * generate-png-icons.js
 * Genera los PNG de iconos de la extensión (16/48/128) sin dependencias externas,
 * usando zlib (incluido en Node) para la compresión DEFLATE de los chunks IDAT.
 * Dibuja un cuadrado azul redondeado con una casa blanca simple (píxel a píxel).
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const CRC_TABLE = (() => {
    const table = [];
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[n] = c >>> 0;
    }
    return table;
})();

function crc32(buf) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
        crc = CRC_TABLE[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
    const typeBuf = Buffer.from(type, 'ascii');
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(data.length, 0);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

/** Genera un buffer PNG RGBA a partir de una función pixelAt(x, y) -> [r,g,b,a]. */
function encodePNG(size, pixelAt) {
    const width = size, height = size;
    const raw = Buffer.alloc((width * 4 + 1) * height);
    let offset = 0;
    for (let y = 0; y < height; y++) {
        raw[offset++] = 0; // filtro "none" por scanline
        for (let x = 0; x < width; x++) {
            const [r, g, b, a] = pixelAt(x, y);
            raw[offset++] = r; raw[offset++] = g; raw[offset++] = b; raw[offset++] = a;
        }
    }
    const idatData = zlib.deflateSync(raw);

    const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;  // bit depth
    ihdr[9] = 6;  // color type RGBA
    ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

    return Buffer.concat([
        signature,
        chunk('IHDR', ihdr),
        chunk('IDAT', idatData),
        chunk('IEND', Buffer.alloc(0))
    ]);
}

const AZUL = [26, 115, 232, 255];
const AZUL_CLARO = [100, 181, 246, 255];
const BLANCO = [255, 255, 255, 255];
const VERDE = [52, 168, 83, 255];
const TRANSPARENTE = [0, 0, 0, 0];

function dentroDeRadio(x, y, size, r) {
    // Determina si (x,y) cae dentro del cuadrado con esquinas redondeadas de radio r
    const corners = [[r, r], [size - r - 1, r], [r, size - r - 1], [size - r - 1, size - r - 1]];
    for (const [cx, cy] of corners) {
        const enEsquinaX = (x < r) || (x > size - r - 1);
        const enEsquinaY = (y < r) || (y > size - r - 1);
        if (enEsquinaX && enEsquinaY) {
            const dx = x - cx, dy = y - cy;
            if (dx * dx + dy * dy > r * r) return false;
        }
    }
    return true;
}

function pixelIcono(size) {
    const r = Math.round(size * 0.16);
    // Casa: triángulo (techo) + rectángulo (cuerpo), centrados
    const techoBaseY = Math.round(size * 0.42);
    const techoTopY = Math.round(size * 0.14);
    const casaLeft = Math.round(size * 0.22);
    const casaRight = size - casaLeft;
    const cuerpoBottom = Math.round(size * 0.82);
    const centroX = size / 2;

    return (x, y) => {
        if (!dentroDeRadio(x, y, size, r)) return TRANSPARENTE;

        // Cuerpo de la casa (rectángulo blanco)
        if (y >= techoBaseY && y <= cuerpoBottom && x >= casaLeft && x <= casaRight) {
            return BLANCO;
        }
        // Techo (triángulo blanco): desde el pico central hasta la base
        if (y >= techoTopY && y < techoBaseY) {
            const progreso = (y - techoTopY) / (techoBaseY - techoTopY);
            const anchoMitad = progreso * (centroX - casaLeft + size * 0.06);
            if (x >= centroX - anchoMitad && x <= centroX + anchoMitad) {
                return BLANCO;
            }
        }
        return AZUL;
    };
}

const sizes = [16, 48, 128];
const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

for (const size of sizes) {
    const png = encodePNG(size, pixelIcono(size));
    const dest = path.join(iconsDir, `icon${size}.png`);
    fs.writeFileSync(dest, png);
    console.log(`Generado: ${dest} (${png.length} bytes)`);
}
