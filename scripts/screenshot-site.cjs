/* =========================================================
   scripts/screenshot-site.cjs
   Drives the real Electron app over the DevTools protocol:
   creates a demo diary, seeds realistic entries, navigates
   every view and saves PNG screenshots for the promo site.

   Output: website/assets/shots/*.png
   Run:    node scripts/screenshot-site.cjs
   ========================================================= */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = 9223;
const OUT = 'website/assets/shots';
const ELECTRON_EXE = path.join('node_modules', 'electron', 'dist', 'electron.exe');

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const electron = spawn(ELECTRON_EXE, ['.', '--remote-debugging-port=' + PORT], {
    cwd: process.cwd(), stdio: 'ignore'
  });

  try {
    let page = null;
    for (let i = 0; i < 60 && !page; i++) {
      await sleep(300);
      try {
        const list = await fetch('http://127.0.0.1:' + PORT + '/json/list').then((r) => r.json());
        page = list.find((t) => t.type === 'page' && /dist[\/\\]index\.html/.test(t.url));
      } catch (e) { /* not up yet */ }
    }
    if (!page) throw new Error('Electron page target not found');
    await run(page.webSocketDebuggerUrl);
  } finally {
    try { electron.kill(); } catch (e) { /* already gone */ }
  }
}

async function run(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
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
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error.message));
      else p.resolve(msg.result);
    }
  };
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('WS connect failed')); });

  /* ---------- helpers ---------- */
  async function evaljs(expression) {
    const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (res.exceptionDetails) throw new Error('page eval failed: ' + (res.exceptionDetails.text || ''));
    return res.result ? res.result.value : undefined;
  }
  function click(sel) {
    return evaljs('(function(){var el=document.querySelector(' + JSON.stringify(sel) + ');if(!el)return "missing";el.click();return "ok";})()');
  }
  function fill(sel, val) {
    return evaljs('(function(){var el=document.querySelector(' + JSON.stringify(sel) + ');if(!el)return "missing";' +
      'var set=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,"value").set;' +
      'set.call(el,' + JSON.stringify(val) + ');el.dispatchEvent(new Event("input",{bubbles:true}));return "ok";})()');
  }
  async function shot(name) {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(res.data, 'base64'));
    console.log('  shot:', name);
  }
  async function step(label, fn) {
    try {
      const r = await fn();
      if (typeof r === 'string' && r !== 'ok') console.log('  WARN', label, '->', r);
      else console.log('  ok:', label);
    } catch (e) { console.log('  WARN', label, '->', e.message); }
  }

  /* ---------- session ---------- */
  await send('Page.enable');
  await send('Runtime.enable');

  // consistent desktop viewport, 1.5x for crisp promo images
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1.5, mobile: false });

  // 1. fresh start -> welcome screen
  await evaljs('localStorage.clear(); "cleared"');
  await send('Page.reload', {});
  await sleep(1500);
  await shot('welcome');

  // 2. walk the setup wizard
  await step('open setup', () => click('.welcome-card .btn-primary'));
  await sleep(500);
  await step('diary name', () => fill('input[aria-label="Diary name"]', 'Aurora'));
  await step('user name', () => fill('input[aria-label="Display name (optional)"]', 'Alex'));
  await step('step1 continue', () => click('.setup-actions .btn-primary'));
  await sleep(400);
  await step('password', () => fill('input[aria-label="Create password"]', 'demo12345'));
  await step('password confirm', () => fill('input[aria-label="Confirm password"]', 'demo12345'));
  await step('step2 continue', () => click('.setup-actions .btn-primary'));
  await sleep(400);
  await step('create diary', () => click('.setup-actions .btn-primary'));
  await sleep(1000); // PBKDF2 (100k iterations) + cover render

  // 3. lock screen
  await shot('cover');

  // 4. seed realistic entries into storage (keeps settings/auth intact)
  const seeded = await evaljs(SEED_ENTRIES_SRC);
  console.log('  seeded entries:', seeded);
  await send('Page.reload', {});
  await sleep(1500);

  // 5. unlock
  await step('unlock', async () => {
    await fill('input[aria-label="Diary password"]', 'demo12345');
    await sleep(150);
    return click('.lock-form button[type="submit"]');
  });
  await sleep(1500);
  await shot('home');

  // 6. today's entry (read view)
  await step('open today', () => click('.home-greeting .btn-primary'));
  await sleep(700);
  await shot('entry');

  // 7. edit mode (chips, details, tags)
  await step('edit mode', () => click('.page-tools .btn-primary'));
  await sleep(700);
  await shot('entry-edit');

  // 8. calendar
  await step('calendar', async () => { await click('button[data-view="calendar"]'); await sleep(700); });
  await shot('calendar');

  // 9. entries list
  await step('entries', () => click('button[data-view="entries"]'));
  await sleep(700);
  await shot('entries');

  // 10. search with a query
  await step('search view', () => click('button[data-view="search"]'));
  await sleep(500);
  await step('search query', () => fill('#app-main input[type="search"], #app-main input[type="text"]', 'rain'));
  await sleep(700);
  await shot('search');

  // 11. themes
  await step('themes', () => click('button[data-view="themes"]'));
  await sleep(700);
  await shot('themes');

  // 12. phone-width home
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await step('home mobile', () => click('button[data-view="home"]'));
  await sleep(700);
  await shot('home-mobile');

  ws.close();
  console.log('Done. Screenshots in ' + OUT + '/');
}

/* ---------------- seed data ---------------- */
const SEED_ENTRIES_SRC = `(function(){
  var raw = JSON.parse(localStorage.getItem('digitalDiary'));
  if (!raw) return 'no diary';
  function iso(off){ var d=new Date(); d.setDate(d.getDate()-off);
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  function stamp(off){ var d=new Date(); d.setDate(d.getDate()-off); d.setHours(21,15,0,0); return d.toISOString(); }
  function mk(o){
    return { id:'demo'+o.off, date:iso(o.off), title:o.title, mood:o.mood, weather:o.weather,
      location:o.location||'', content:o.content, tags:o.tags||[], favorite:!!o.fav,
      energy:o.energy, sleep:o.sleep||'', highlights:o.high||'', gratitude:o.grat||'',
      page:o.page, createdAt:stamp(o.off), updatedAt:stamp(o.off) };
  }
  var list = [
    mk({ off:0, page:6, title:'A slow Sunday reset', mood:'calm', weather:'cloudy', location:'Home',
      energy:7, sleep:'8', tags:['rest','family','reading'], fav:true,
      content:'Woke up without an alarm for the first time in weeks. Made pancakes, read by the window while the clouds rolled in, and called Mom in the afternoon.\\n\\nDays like this remind me that doing "nothing" is sometimes exactly the something I need.',
      high:'Long breakfast\\nFinished my book\\nEvening walk',
      grat:'Quiet morning coffee\\nTime with family\\nA good book' }),
    mk({ off:1, page:5, title:'Rain on the window', mood:'tired', weather:'rainy', location:'Home',
      energy:5, sleep:'7', tags:['rain','work'],
      content:'Long day at work, but the rain made the evening feel soft. Ordered soup, watched the drops race down the glass, and went to bed early. Not every day needs to be productive.' }),
    mk({ off:3, page:4, title:'Presentation day!', mood:'excited', weather:'sunny', location:'Office',
      energy:9, sleep:'6', tags:['work','milestone'], fav:true,
      content:'The quarterly presentation went better than I hoped. My proposal got approved on the spot, and the team celebrated with cake in the break room.\\n\\nMonths of preparation, finally paying off.',
      high:'Proposal approved\\nCake with the team\\nBoss said "great job"' }),
    mk({ off:6, page:3, title:'Park with the kids', mood:'happy', weather:'sunny', location:'Riverside Park',
      energy:8, sleep:'8', tags:['family','weekend'],
      content:'Picnic by the river. We flew a kite until the wind died down, then got ice cream from the cart near the bridge. Simple, golden afternoon.' }),
    mk({ off:10, page:2, title:'Midweek grumble', mood:'neutral', weather:'stormy', location:'Office',
      energy:4, sleep:'5', tags:['work'],
      content:'Meetings all day, storm on the way home, and my umbrella gave up on me. Writing this down so future me remembers: bad days end too.' }),
    mk({ off:14, page:1, title:'Started a journal again', mood:'motivated', weather:'sunny', location:'Home',
      energy:7, sleep:'7', tags:['journaling','fresh-start'], fav:true,
      content:'Day one of writing every evening. No rules about length or quality — just show up and be honest. Here is to remembering my own life.' })
  ];
  raw.entries = {};
  list.forEach(function(e){ raw.entries[e.date] = e; });
  raw.settings.pageCounter = 7;
  localStorage.setItem('digitalDiary', JSON.stringify(raw));
  return list.length;
})()`;

main().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
