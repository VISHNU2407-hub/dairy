/* =========================================================
   scripts/verify-website.cjs
   Loads both promo pages in headless Chrome and verifies:
   - intro (index.html): logo, Windows + Android buttons,
     link to features page and web app
   - features.html: screenshots, thumbnail switcher, sections
   and saves a full-page screenshot of each to /tmp.
   ========================================================= */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = 9224;
const CHROME_PATHS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'
];

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  const chromePath = CHROME_PATHS.find((p) => fs.existsSync(p));
  if (!chromePath) throw new Error('Chrome not found');
  const chrome = spawn(chromePath, [
    '--headless=new', '--remote-debugging-port=' + PORT,
    '--window-size=1280,900', '--allow-file-access-from-files',
    '--no-first-run', '--disable-gpu', 'about:blank'
  ], { stdio: 'ignore' });

  try {
    let page = null;
    for (let i = 0; i < 60 && !page; i++) {
      await sleep(300);
      try {
        const list = await fetch('http://127.0.0.1:' + PORT + '/json/list').then((r) => r.json());
        page = list.find((t) => t.type === 'page');
      } catch (e) { /* not ready */ }
    }
    if (!page) throw new Error('Chrome page target not found');

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let id = 0;
    const pending = new Map();
    const consoleErrors = [];
    function send(method, params) {
      return new Promise((resolve, reject) => {
        const mid = ++id;
        pending.set(mid, { resolve, reject });
        ws.send(JSON.stringify({ id: mid, method, params: params || {} }));
      });
    }
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const p = pending.get(msg.id); pending.delete(msg.id);
        msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        consoleErrors.push(msg.params.exceptionDetails.text + ' @ line ' + (msg.params.exceptionDetails.lineNumber + 1));
      }
    };
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('WS failed')); });
    await send('Runtime.enable');
    await send('Page.enable');

    async function visit(file) {
      await send('Page.navigate', { url: 'file:///' + path.resolve(file).replace(/\\/g, '/') });
      await sleep(2200);
      consoleErrors.length = 0;
    }
    async function evaljs(expression) {
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error('eval failed: ' + r.exceptionDetails.text);
      return r.result.value;
    }
    async function fullShot(out) {
      const dims = await evaljs('({h: document.body.scrollHeight})');
      await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: Math.min(dims.h, 8000), deviceScaleFactor: 1, mobile: false });
      await sleep(500);
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
      await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    }
    const brokenImgs = `Array.prototype.slice.call(document.images)
      .filter(function(i){ return i.complete && i.naturalWidth === 0; })
      .map(function(i){ return i.src.split('/').pop(); })`;

    /* ---------- 1. intro page ---------- */
    await visit('website/index.html');
    const intro = await evaljs(`({
      logoLoaded: (function(){ var i=document.querySelector('.logo'); return !!i && i.naturalWidth > 0; })(),
      winBtn: !!document.querySelector('a.btn-win[href*="releases/latest/download/DigitalDiary-Setup.exe"]'),
      apkBtn: !!document.querySelector('a.btn-android[href*="digital-diary-1.0.0.apk"]'),
      webLink: !!document.querySelector('a.btn-web[href*="./app/"]'),
      featuresLink: !!document.querySelector('footer a[href*="features.html"]'),
      broken: ${brokenImgs},
      h1: (document.querySelector('h1') || {}).textContent || null
    })`);
    await fullShot('/tmp/intro-full.png');

    /* ---------- 2. features page ---------- */
    await visit('website/features.html');
    const feats = await evaljs(`({
      title: document.title,
      imgCount: document.images.length,
      broken: ${brokenImgs},
      thumbCount: document.querySelectorAll('.shot-thumbs button').length,
      sections: ['features','how','download','faq'].filter(function(id){ return !!document.getElementById(id); }).length,
      homeLink: !!document.querySelector('.nav-brand[href="./"]')
    })`);
    await evaljs(`document.querySelectorAll('.shot-thumbs button')[5].click(); "clicked"`);
    await sleep(400);
    const after = await evaljs(`({
      src: (document.getElementById('shot-main-img') || {}).src || '',
      caption: (document.getElementById('shot-caption') || {}).textContent || ''
    })`);
    await fullShot('/tmp/features-full.png');

    const introOk = intro.logoLoaded && intro.winBtn && intro.apkBtn && intro.webLink &&
      intro.featuresLink && intro.broken.length === 0 && intro.h1 === 'Digital Diary';
    const featsOk = feats.broken.length === 0 && feats.thumbCount === 9 && feats.sections === 4 &&
      feats.homeLink && /calendar\.png/.test(after.src) && /Calendar/.test(after.caption);

    console.log('--- intro page ---');
    console.log(JSON.stringify(intro, null, 2));
    console.log('--- features page ---');
    console.log(JSON.stringify(feats, null, 2));
    console.log('switcher:', JSON.stringify(after));
    console.log('console errors:', consoleErrors.length ? consoleErrors.join(' | ') : '(none)');
    console.log('screens: /tmp/intro-full.png, /tmp/features-full.png');
    console.log((introOk && featsOk) ? 'WEBSITE CHECK: PASS' : 'WEBSITE CHECK: FAIL');
    process.exitCode = (introOk && featsOk) ? 0 : 1;
    ws.close();
  } finally {
    try { chrome.kill(); } catch (e) { /* done */ }
  }
}

main().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
