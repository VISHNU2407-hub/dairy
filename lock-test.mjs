/* =========================================================
   lock-test.mjs — verifies the lock gate in the React app
   1. Seeds a locked diary (password: test123) into localStorage
   2. Reloads the app: ONLY the cover must render
   3. Wrong password -> error, still locked
   4. Correct password -> app shell renders with the entry text
   5. Lock button returns to the cover, entry text unmounts
   ========================================================= */
import puppeteer from 'puppeteer-core';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'http://localhost:4173/';
const PW = 'test123';

let failures = 0;
function check(name, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ' - ' + name);
  if (!cond) failures++;
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu']
  });

  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.goto(URL, { waitUntil: 'networkidle0' });

    /* ---------- 1. seed a locked diary ---------- */
    await page.evaluate(async (pw) => {
      function hexToBytes(hex) {
        const out = new Uint8Array(hex.length / 2);
        for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
        return out;
      }
      function randomHex(bytes) {
        const arr = new Uint8Array(bytes);
        crypto.getRandomValues(arr);
        return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
      }
      const salt = randomHex(16);
      const enc = new TextEncoder();
      const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
      const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: hexToBytes(salt), iterations: 100000, hash: 'SHA-256' }, key, 256);
      const hash = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
      const blob = {
        version: 1,
        settings: {
          diaryName: 'Test Diary', userName: 'Tester', theme: 'classic', font: 'classic',
          paperStyle: 'ruled', autoLockMinutes: 15, createdAt: new Date().toISOString(),
          pageCounter: 2,
          auth: { algo: 'pbkdf2-sha256', salt: salt, hash: hash, iterations: 100000 }
        },
        entries: {
          '2026-09-19': {
            id: 'e1', date: '2026-09-19', title: 'A past day', mood: 'happy', weather: '',
            location: 'Home', content: 'Hello diary, this is a secret entry.', tags: ['test'],
            favorite: false, energy: 7, sleep: '7', highlights: '', gratitude: '',
            page: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
          }
        }
      };
      localStorage.setItem('digitalDiary', JSON.stringify(blob));
    }, PW);

    /* ---------- 2. reload: only the cover must render ---------- */
    await page.goto(URL, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.cover-title', { timeout: 8000 });

    const lockedState = await page.evaluate(() => ({
      body: document.body.innerText,
      hasCover: !!document.querySelector('.cover'),
      hasApp: !!document.querySelector('#app'),
      hasEntryText: document.body.innerText.includes('secret entry'),
      scrollHeight: document.documentElement.scrollHeight,
      innerHeight: window.innerHeight
    }));
    check('cover is shown when locked', lockedState.hasCover);
    check('app shell NOT in DOM when locked', !lockedState.hasApp);
    check('entry text NOT in DOM when locked', !lockedState.hasEntryText);
    check('nothing to scroll on locked screen (1 screen)', lockedState.scrollHeight <= lockedState.innerHeight + 160);

    /* ---------- 3. wrong password ---------- */
    await page.type('.pw-input', 'wrongpass');
    await page.click('.lock-form button[type="submit"]');
    await page.waitForFunction(() => document.querySelector('.form-error') && document.querySelector('.form-error').textContent.includes('incorrect'), { timeout: 8000 });
    const stillLocked = await page.evaluate(() => ({
      hasApp: !!document.querySelector('#app'),
      hasCover: !!document.querySelector('.cover')
    }));
    check('wrong password rejected', stillLocked.hasCover && !stillLocked.hasApp);

    /* ---------- 4. correct password ---------- */
    await page.evaluate(() => { document.querySelector('.pw-input').value = ''; });
    await page.type('.pw-input', PW);
    await page.click('.lock-form button[type="submit"]');
    await page.waitForSelector('#app', { timeout: 10000 });
    const unlocked = await page.evaluate(() => ({
      hasApp: !!document.querySelector('#app'),
      hasCover: !!document.querySelector('.cover'),
      hasEntryText: document.body.innerText.includes('secret entry'),
      greeting: document.body.innerText.includes('Good')
    }));
    check('app renders after correct password', unlocked.hasApp && !unlocked.hasCover);
    check('entry content readable after unlock (Home list)', unlocked.hasEntryText || unlocked.greeting);

    /* open the entry from Entries view */
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.topnav button'));
      btns.find(b => b.textContent === 'Entries').click();
    });
    await page.waitForSelector('.entry-item', { timeout: 8000 });
    await page.click('.entry-item');
    await page.waitForSelector('.diary-page', { timeout: 8000 });
    const pageState = await page.evaluate(() => ({
      hasText: document.body.innerText.includes('secret entry'),
      title: (document.querySelector('.p-title-view') || {}).textContent || ''
    }));
    check('diary page shows entry after unlock', pageState.hasText && pageState.title === 'A past day');

    /* ---------- 5. lock again ---------- */
    await page.evaluate(() => {
      const lockBtn = document.querySelector('#app .btn-lock');
      lockBtn.click();
    });
    await page.waitForFunction(() => !!document.querySelector('.cover') && !document.querySelector('#app'), { timeout: 8000 });
    const relocked = await page.evaluate(() => ({
      hasCover: !!document.querySelector('.cover'),
      hasApp: !!document.querySelector('#app'),
      hasEntryText: document.body.innerText.includes('secret entry')
    }));
    check('lock returns to cover', relocked.hasCover && !relocked.hasApp);
    check('entry text gone after lock', !relocked.hasEntryText);

    check('no page JS errors', errors.length === 0);
    if (errors.length) console.log('errors:', errors.slice(0, 3));
  } finally {
    await browser.close();
  }

  if (failures) { console.log(failures + ' check(s) failed'); process.exit(1); }
  console.log('All checks passed.');
}

main().catch(e => { console.error('TEST ERROR:', e.message); process.exit(1); });
