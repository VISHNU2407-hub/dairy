/* =========================================================
   scripts/generate-icons.js
   Draws the Digital Diary book icon (brown rounded tile +
   open book pages + ribbon bookmark) with per-pixel math,
   then writes every icon/splash asset the project needs:

     - electron/icons/icon.ico   (multi-size Windows icon)
     - electron/icons/icon.png   (512)
     - assets/icon.png           (1024, for @capacitor/assets)
     - assets/splash.png         (2732, for @capacitor/assets)
     - assets/splash-dark.png    (2732, for @capacitor/assets)
     - website/assets/*.png      (favicons, logos)

   No dependencies — uses only zlib for PNG deflate.

   Run:  node scripts/generate-icons.js
   ========================================================= */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/* ---------------- png encoder ---------------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG(w, h, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const stride = w * 4 + 1;
  const raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    raw[y * stride] = 0; // filter: none
    rgba.copy(raw, y * stride + 1, y * w * 4, (y + 1) * w * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

/* ---------------- ico encoder (png-compressed entries) ---------------- */
function encodeICO(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(entries.length, 4);
  const dir = Buffer.alloc(16 * entries.length);
  let offset = 6 + 16 * entries.length;
  entries.forEach((e, i) => {
    const o = i * 16;
    dir[o] = e.size >= 256 ? 0 : e.size;
    dir[o + 1] = e.size >= 256 ? 0 : e.size;
    dir[o + 2] = 0; dir[o + 3] = 0;
    dir.writeUInt16LE(1, o + 4);  // planes
    dir.writeUInt16LE(32, o + 6); // bpp
    dir.writeUInt32LE(e.data.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += e.data.length;
  });
  return Buffer.concat([header, dir].concat(entries.map((e) => e.data)));
}

/* ---------------- icon artwork ---------------- */
function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
function lerp(a, b, t) { return a + (b - a) * t; }

function sdRoundRect(px, py, r) {
  // rounded square centered at 0.5,0.5 with half-size 0.5
  const qx = Math.abs(px - 0.5) - 0.5 + r;
  const qy = Math.abs(py - 0.5) - 0.5 + r;
  const outX = Math.max(qx, 0);
  const outY = Math.max(qy, 0);
  return Math.min(Math.max(qx, qy), 0) + Math.sqrt(outX * outX + outY * outY) - r;
}

// page geometry (normalized)
const BOOK = {
  xL: 0.17, xR: 0.83, cx: 0.5,
  topSpine: 0.385, topEdge: 0.315,
  botSpine: 0.700, botEdge: 0.635
};

function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
const TILE_TOP = hex('#7a4e2d');
const TILE_BOT = hex('#472b17');
const PAGE = hex('#fffdf7');
const PAGE_BOT = hex('#efe4d0');
const LINE = hex('#d9c9ae');
const SPINE = hex('#d7c7ae');
const RIBBON = hex('#a8402f');

// sample the icon at normalized coords (u,v in [0,1)); returns [r,g,b,a]
function sampleDiary(u, v) {
  const sdf = sdRoundRect(u, v, 0.225);
  if (sdf > 0.002) return [0, 0, 0, 0]; // outside tile (fast reject)

  // tile gradient + soft highlight
  let t = clamp01(v);
  let r = lerp(TILE_TOP[0], TILE_BOT[0], t);
  let g = lerp(TILE_TOP[1], TILE_BOT[1], t);
  let b = lerp(TILE_TOP[2], TILE_BOT[2], t);
  const hd = Math.sqrt((u - 0.30) * (u - 0.30) + (v - 0.22) * (v - 0.22));
  const hi = Math.max(0, 1 - hd / 0.85) * 26;
  r = Math.min(255, r + hi); g = Math.min(255, g + hi); b = Math.min(255, b + hi);

  // which page (if any)?
  const inLeft = u >= BOOK.xL && u <= BOOK.cx;
  const inRight = u > BOOK.cx && u <= BOOK.xR;
  if (inLeft || inRight) {
    const tt = inLeft ? (BOOK.cx - u) / (BOOK.cx - BOOK.xL) : (u - BOOK.cx) / (BOOK.xR - BOOK.cx);
    const curve = tt * tt;
    const yTop = lerp(BOOK.topSpine, BOOK.topEdge, curve);
    const yBot = lerp(BOOK.botSpine, BOOK.botEdge, curve);
    if (v >= yTop && v <= yBot) {
      // page shading: slightly darker toward bottom
      const shade = clamp01((v - yTop) / (yBot - yTop)) * 0.35;
      r = lerp(PAGE[0], PAGE_BOT[0], shade);
      g = lerp(PAGE[1], PAGE_BOT[1], shade);
      b = lerp(PAGE[2], PAGE_BOT[2], shade);

      // spine shadow
      const dSpine = Math.abs(u - BOOK.cx);
      if (dSpine < 0.035) {
        const k = (1 - dSpine / 0.035) * 0.55;
        r = lerp(r, SPINE[0], k); g = lerp(g, SPINE[1], k); b = lerp(b, SPINE[2], k);
      }

      // ribbon bookmark (right page only), swallowtail cut at bottom
      const rcL = BOOK.cx + 0.09, rcR = BOOK.cx + 0.155, rc = BOOK.cx + 0.1225;
      if (inRight && u >= rcL && u <= rcR) {
        const halfW = (rcR - rcL) / 2;
        const yMax = 0.555 + 0.045 * (Math.abs(u - rc) / halfW);
        if (v <= yMax) {
          return [RIBBON[0], RIBBON[1], RIBBON[2], 255];
        }
      }

      // text lines following the page curve
      const uu = (v - yTop) / (yBot - yTop);
      if (tt >= 0.18 && tt <= 0.90 && !inRight) { // lines on left page only (ribbon side stays clean)
        const band = (uu >= 0.30 && uu <= 0.355) || (uu >= 0.46 && uu <= 0.515) || (uu >= 0.62 && uu <= 0.675);
        if (band) {
          r = LINE[0]; g = LINE[1]; b = LINE[2];
        }
      }
      return [Math.round(r), Math.round(g), Math.round(b), 255];
    }
  }
  return [Math.round(r), Math.round(g), Math.round(b), 255];
}

/* ---------------- renderer ---------------- */
// opts: size, bg ({r,g,b} | null), iconFrac (icon size / canvas size)
function render(size, opts) {
  const bg = opts.bg || null;
  const frac = opts.iconFrac || 1;
  const I = Math.round(size * frac);
  const ox = (size - I) / 2;
  const oy = (size - I) / 2;
  const buf = Buffer.alloc(size * size * 4);
  const SS = 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;
          let pr, pg, pb, pa;
          if (px >= ox && px < ox + I && py >= oy && py < oy + I) {
            const s = sampleDiary((px - ox) / I, (py - oy) / I);
            pr = s[0]; pg = s[1]; pb = s[2]; pa = s[3];
          } else { pr = 0; pg = 0; pb = 0; pa = 0; }
          if (bg) {
            const af = pa / 255;
            r += bg.r * (1 - af) + pr * af;
            g += bg.g * (1 - af) + pg * af;
            b += bg.b * (1 - af) + pb * af;
            a += 255;
          } else {
            r += pr; g += pg; b += pb; a += pa;
          }
        }
      }
      const n = SS * SS;
      const o = (y * size + x) * 4;
      buf[o] = Math.round(r / n);
      buf[o + 1] = Math.round(g / n);
      buf[o + 2] = Math.round(b / n);
      buf[o + 3] = Math.round(a / n);
    }
  }
  return buf;
}

const CREAM = { r: 0xf7, g: 0xf1, b: 0xe5 };
const DARK = { r: 0x24, g: 0x16, b: 0x10 };

function savePNG(file, size, opts) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, encodePNG(size, size, render(size, opts)));
  console.log('  wrote', file, '(' + size + 'x' + size + ')');
}

console.log('Generating Digital Diary icons...');

/* windows ico */
const icoSizes = [16, 24, 32, 48, 64, 128, 256];
const ico = encodeICO(icoSizes.map((s) => ({ size: s, data: encodePNG(s, s, render(s, {})) })));
fs.mkdirSync('electron/icons', { recursive: true });
fs.writeFileSync('electron/icons/icon.ico', ico);
console.log('  wrote electron/icons/icon.ico (' + icoSizes.join(', ') + ')');

/* electron png */
savePNG('electron/icons/icon.png', 512, {});

/* capacitor assets */
savePNG('assets/icon.png', 1024, {});
savePNG('assets/splash.png', 2732, { bg: CREAM, iconFrac: 0.35 });
savePNG('assets/splash-dark.png', 2732, { bg: DARK, iconFrac: 0.35 });

/* website assets */
savePNG('website/assets/logo-512.png', 512, {});
savePNG('website/assets/logo-192.png', 192, {});
savePNG('website/assets/apple-touch-icon.png', 180, {});
savePNG('website/assets/favicon-32.png', 32, {});
savePNG('website/assets/favicon-16.png', 16, {});

console.log('Done.');
