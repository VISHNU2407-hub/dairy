/* =========================================================
   scripts/verify-shots.cjs
   Decodes each screenshot PNG (unfiltering all 5 filter
   types) and reports color diversity + luminance spread,
   so blank/broken captures are caught automatically.
   ========================================================= */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let pos = 8, w = 0, h = 0, idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * 4 + 1;
  const px = Buffer.alloc(w * h * 4);
  const paeth = (a, b, c) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < h; y++) {
    const f = raw[y * stride];
    const row = raw.subarray(y * stride + 1, (y + 1) * stride);
    for (let x = 0; x < w * 4; x++) {
      const left = x >= 4 ? px[y * w * 4 + x - 4] : 0;
      const up = y > 0 ? px[(y - 1) * w * 4 + x] : 0;
      const ul = y > 0 && x >= 4 ? px[(y - 1) * w * 4 + x - 4] : 0;
      let v = row[x];
      if (f === 1) v = (v + left) & 0xff;
      else if (f === 2) v = (v + up) & 0xff;
      else if (f === 3) v = (v + ((left + up) >> 1)) & 0xff;
      else if (f === 4) v = (v + paeth(left, up, ul)) & 0xff;
      px[y * w * 4 + x] = v;
    }
  }
  return { w, h, px };
}

const DIR = 'website/assets/shots';
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.png'));
let allOk = true;

for (const f of files) {
  const { w, h, px } = decodePNG(fs.readFileSync(path.join(DIR, f)));
  const colors = new Set();
  let minLum = 255, maxLum = 0;
  for (let i = 0; i < px.length; i += 16) { // sample every 4th pixel
    colors.add((px[i] << 16) | (px[i + 1] << 8) | px[i + 2]);
    const lum = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
    if (lum < minLum) minLum = lum;
    if (lum > maxLum) maxLum = lum;
  }
  const ok = colors.size > 200 && (maxLum - minLum) > 60;
  if (!ok) allOk = false;
  console.log(
    (ok ? ' OK ' : 'BAD ') + f.padEnd(18),
    w + 'x' + h,
    'colors:' + String(colors.size).padStart(6),
    'lum:' + Math.round(minLum) + '-' + Math.round(maxLum)
  );
}
console.log(allOk ? '\nALL SCREENSHOTS LOOK GOOD' : '\nSOME SCREENSHOTS LOOK SUSPECT — inspect manually');
process.exit(allOk ? 0 : 1);
