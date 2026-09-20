/* =========================================================
   delete-flow-test.mjs — verifies delete-diary → recreate flow
   1. Seed + unlock a diary
   2. Settings → Delete Entire Diary (type DELETE)
   3. Welcome screen ("Create My Diary") must appear — NOT the cover
   4. Create a new diary with a new password, unlock works
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

/* Walk the 3-step setup wizard: name → password → theme */
async function runSetup(page, pw, diaryName) {
  await page.waitForFunction(() => document.querySelectorAll('input[type="text"]').length >= 1, { timeout: 8000 });
  await page.evaluate((name) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    const t = document.querySelector('input[type="text"]');
    setter.call(t, name);
    t.dispatchEvent(new Event('input', { bubbles: true }));
  }, diaryName);
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Continue').click();
  });
  await page.waitForFunction(() => document.querySelectorAll('.pw-input').length >= 1, { timeout: 8000 });
  await page.evaluate((pw) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    document.querySelectorAll('.pw-input').forEach(i => {
      setter.call(i, pw);
      i.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }, pw);
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Continue').click();
  });
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll('button')).some(b => b.textContent.trim() === 'Create My Diary'), { timeout: 8000 });
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Create My Diary').click();
  });
  await page.waitForSelector('.cover', { timeout: 15000 });
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

    /* ---------- 1. seed + unlock ---------- */
    await page.evaluate((pw) => {
      localStorage.setItem('digitalDiary', JSON.stringify({
        version: 1,
        settings: {
          diaryName: 'Old Diary', userName: '', theme: 'midnight', font: 'classic',
          paperStyle: 'ruled', autoLockMinutes: 15, createdAt: new Date().toISOString(),
          pageCounter: 1,
          auth: { algo: 'fnv', salt: 'ab', hash: 'cd-ef', rounds: 3000 }
        },
        entries: {}
      }));
    }, PW);
    await page.goto(URL, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.cover', { timeout: 8000 });
    check('cover shown for seeded diary', true);

    // fnv auth won't verify — replace with real unlock by creating auth via the app's own code path
    await page.evaluate(() => { localStorage.removeItem('digitalDiary'); });
    await page.goto(URL, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.welcome-card', { timeout: 8000 });

    /* ---------- create first diary through the UI ---------- */
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      btns.find(b => b.textContent.trim() === 'Create My Diary').click();
    });
    await runSetup(page, PW, 'Fresh Diary');
    check('created first diary, cover shown', true);

    /* ---------- 2. unlock ---------- */
    await page.type('.pw-input', PW);
    await page.click('.lock-form button[type="submit"]');
    await page.waitForSelector('#app', { timeout: 10000 });
    check('unlocked into app', true);

    /* ---------- 3. settings → delete entire diary ---------- */
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.topnav button'));
      btns.find(b => b.textContent === 'Settings').click();
    });
    await page.waitForFunction(() => document.body.innerText.includes('Delete Entire Diary'), { timeout: 8000 });
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      btns.find(b => b.textContent.trim() === 'Delete Entire Diary').click();
    });
    await page.waitForSelector('.modal', { timeout: 8000 });
    check('delete confirmation modal opened', true);
    await page.type('.modal input[type="text"]', 'DELETE');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.modal button'));
      btns.find(b => b.textContent.trim() === 'Delete Forever').click();
    });

    /* ---------- 4. must land on Welcome, NOT the cover ---------- */
    await page.waitForFunction(() =>
      !!document.querySelector('.welcome-card') && !document.querySelector('.cover'), { timeout: 8000 });
    const afterDelete = await page.evaluate(() => ({
      hasWelcome: !!document.querySelector('.welcome-card'),
      hasCover: !!document.querySelector('.cover'),
      hasCreateBtn: Array.from(document.querySelectorAll('button')).some(b => b.textContent.trim() === 'Create My Diary'),
      storageEmpty: localStorage.getItem('digitalDiary') === null
    }));
    check('welcome screen shown after delete', afterDelete.hasWelcome);
    check('lock cover NOT shown after delete', !afterDelete.hasCover);
    check('create button available again', afterDelete.hasCreateBtn);
    check('localStorage cleared', afterDelete.storageEmpty);

    /* ---------- 5. create a new diary with a new password ---------- */
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      btns.find(b => b.textContent.trim() === 'Create My Diary').click();
    });
    await runSetup(page, 'newpass456', 'Second Diary');

    /* ---------- 6. old password must fail, new must work ---------- */
    await page.type('.pw-input', PW);
    await page.click('.lock-form button[type="submit"]');
    await page.waitForFunction(() =>
      document.querySelector('.form-error') && document.querySelector('.form-error').textContent.includes('incorrect'),
      { timeout: 8000 });
    check('old password rejected on new diary', true);
    await page.evaluate(() => { document.querySelector('.pw-input').value = ''; });
    await page.type('.pw-input', 'newpass456');
    await page.click('.lock-form button[type="submit"]');
    await page.waitForSelector('#app', { timeout: 10000 });
    check('new password unlocks new diary', true);

    check('no page JS errors', errors.length === 0);
    if (errors.length) console.log('errors:', errors.slice(0, 3));
  } finally {
    await browser.close();
  }

  if (failures) { console.log(failures + ' check(s) failed'); process.exit(1); }
  console.log('All checks passed.');
}

main().catch(e => { console.error('TEST ERROR:', e.message); process.exit(1); });
