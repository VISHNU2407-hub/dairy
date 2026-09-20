/* =========================================================
   legacy-delete-flow-test.mjs — regression test for js/ app
   1. Create + unlock a diary (auto-lock armed to fire in ~2s)
   2. Settings → Delete Entire Diary (type DELETE)
   3. Welcome screen must appear and STAY (no cover/lock screen)
   4. Recreate a diary; old password rejected, new works
   ========================================================= */
import http from 'http';
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-core';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ROOT = path.resolve(import.meta.dirname, '..'); // project root (index.html + js/ + css/)
const PORT = 4174;
const URL = 'http://localhost:' + PORT + '/';
const PW = 'test123';

let failures = 0;
function check(name, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ' - ' + name);
  if (!cond) failures++;
}

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
function serve() {
  return http.createServer(function (req, res) {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404); res.end('not found'); return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
}

async function runSetup(page, pw, diaryName) {
  await page.waitForFunction(() =>
    !document.querySelector('#screen-welcome').hidden &&
    !!document.querySelector('#btn-create-my-diary'), { timeout: 8000 });
  await page.evaluate(() => document.querySelector('#btn-create-my-diary').click());
  await page.waitForSelector('#wiz-name', { timeout: 8000 });
  await page.type('#wiz-name', diaryName);
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('#setup-body button')).find(b => b.textContent.trim() === 'Continue').click();
  });
  await page.waitForFunction(() => document.querySelectorAll('#setup-body .pw-input').length >= 2, { timeout: 8000 });
  const pws = await page.$$('#setup-body .pw-input');
  await pws[0].type(pw);
  await pws[1].type(pw);
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('#setup-body button')).find(b => b.textContent.trim() === 'Continue').click();
  });
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll('#setup-body button')).some(b => b.textContent.trim() === 'Create My Diary'), { timeout: 8000 });
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('#setup-body button')).find(b => b.textContent.trim() === 'Create My Diary').click();
  });
  await page.waitForFunction(() => !document.querySelector('#screen-cover').hidden, { timeout: 8000 });
}

async function main() {
  const server = serve();
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });

  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.goto(URL, { waitUntil: 'networkidle0' });

    /* ---------- 1. create + unlock ---------- */
    await runSetup(page, PW, 'Legacy Diary');
    check('legacy diary created, cover shown', true);
    await page.type('#unlock-password', PW);
    await page.click('#btn-unlock');
    await page.waitForSelector('#app:not([hidden])', { timeout: 10000 });
    check('unlocked into app', true);

    /* arm auto-lock to fire ~2s from now (regression trigger) */
    await page.evaluate(() => {
      window.Diary.storage.updateSettings({ autoLockMinutes: 0.033 });
      window.Diary.auth.scheduleAutoLock();
    });

    /* ---------- 2. delete entire diary ---------- */
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('.topnav button')).find(b => b.textContent === 'Settings').click();
    });
    await page.waitForFunction(() => !!document.querySelector('#btn-clear-all'), { timeout: 8000 });
    await page.click('#btn-clear-all');
    await page.waitForSelector('#modal-root .modal', { timeout: 8000 });
    await page.type('#modal-root input[type="text"]', 'DELETE');
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('#modal-root button')).find(b => b.textContent.trim() === 'Delete Forever').click();
    });

    /* ---------- 3. welcome must appear and STAY after auto-lock fires ---------- */
    await page.waitForFunction(() => !document.querySelector('#screen-welcome').hidden, { timeout: 8000 });
    await new Promise(r => setTimeout(r, 3500)); // past the armed auto-lock

    const after = await page.evaluate(() => ({
      welcome: !document.querySelector('#screen-welcome').hidden,
      cover: !document.querySelector('#screen-cover').hidden,
      app: !document.querySelector('#app').hidden,
      createBtn: !!document.querySelector('#btn-create-my-diary'),
      storageEmpty: localStorage.getItem('digitalDiary') === null,
      lockedFlag: window.Diary.auth.isLocked()
    }));
    check('welcome shown after delete', after.welcome);
    check('cover NOT shown after delete (auto-lock waited out)', !after.cover);
    check('app hidden after delete', !after.app);
    check('create button available again', after.createBtn);
    check('localStorage cleared', after.storageEmpty);
    check('auth reset to locked state', after.lockedFlag);

    /* ---------- 4. recreate: new password works, old fails ---------- */
    await page.waitForFunction(() => !document.querySelector('#screen-welcome').hidden, { timeout: 8000 });
    await runSetup(page, 'newpass456', 'Second Diary');
    await page.type('#unlock-password', PW);
    await page.click('#btn-unlock');
    await page.waitForFunction(() =>
      document.querySelector('#lock-error') && document.querySelector('#lock-error').textContent.includes('incorrect'),
      { timeout: 8000 });
    check('old password rejected on new diary', true);
    await page.evaluate(() => { document.querySelector('#unlock-password').value = ''; });
    await page.type('#unlock-password', 'newpass456');
    await page.click('#btn-unlock');
    await page.waitForSelector('#app:not([hidden])', { timeout: 10000 });
    check('new password unlocks new diary', true);

    check('no page JS errors', errors.length === 0);
    if (errors.length) console.log('errors:', errors.slice(0, 3));
  } finally {
    await browser.close();
    server.close();
  }

  if (failures) { console.log(failures + ' check(s) failed'); process.exit(1); }
  console.log('All checks passed.');
}

main().catch(e => { console.error('TEST ERROR:', e.message, e.stack && e.stack.split('\n').slice(1, 4).join(' | ')); process.exit(1); });
