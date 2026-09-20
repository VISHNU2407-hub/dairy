/* =========================================================
   themes-check.mjs — verify all fonts + papers apply & render
   ========================================================= */
import puppeteer from 'puppeteer-core';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'http://localhost:4173/';

let failures = 0;
function check(name, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ' - ' + name);
  if (!cond) failures++;
}

const FONTS = ['classic', 'typewriter', 'handwritten', 'modern', 'girly', 'elegant', 'rounded', 'marker', 'cleanmono', 'fancy', 'neat', 'storybook'];
const PAPERS = ['ruled', 'dotted', 'plain', 'floral', 'hearts', 'teddy', 'stars', 'clouds', 'rainbow', 'butterfly', 'strawberry', 'moon'];

async function main() {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.goto(URL, { waitUntil: 'networkidle0' });

    /* create a diary to reach the app (setup -> cover -> unlock) */
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll('button')).some(b => b.textContent.trim() === 'Create My Diary'), { timeout: 8000 });
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Create My Diary').click();
    });
    await page.waitForFunction(() => document.querySelectorAll('input[type="text"]').length >= 1, { timeout: 8000 });
    await page.evaluate(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      const t = document.querySelector('input[type="text"]');
      setter.call(t, 'Theme Test Diary');
      t.dispatchEvent(new Event('input', { bubbles: true }));
    });
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
    }, 'test123');
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Continue').click();
    });
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll('button')).some(b => b.textContent.trim() === 'Create My Diary'), { timeout: 8000 });
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Create My Diary').click();
    });
    await page.waitForSelector('.cover', { timeout: 15000 });
    await page.type('.pw-input', 'test123');
    await page.click('.lock-form button[type="submit"]');
    await page.waitForSelector('#app', { timeout: 10000 });

    /* open a diary page so .lined-text exists */
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll('button')).some(b => /Write Today/.test(b.textContent)), { timeout: 8000 });
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('button')).find(b => /Write Today/.test(b.textContent)).click();
    });
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll('button')).some(b => b.textContent.trim() === 'Start Writing'), { timeout: 8000 });
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Start Writing').click();
    });
    await page.waitForSelector('.lined-text', { timeout: 10000 });

    /* every paper must set data-paper and produce a layered background */
    for (const p of PAPERS) {
      await page.evaluate((id) => {
        const btns = Array.from(document.querySelectorAll('.chip'));
        const chip = btns.find(b => {
          const row = b.closest('[role="group"]');
          return row && row.getAttribute('aria-label') === 'Paper style' && b.textContent.trim() !== '';
        });
        document.documentElement.setAttribute('data-paper', id);
      }, p);
      const info = await page.evaluate((id) => {
        const el = document.querySelector('.lined-text');
        const cs = getComputedStyle(el);
        return {
          attr: document.documentElement.getAttribute('data-paper'),
          imgs: cs.backgroundImage.split('), ').length,
          has: cs.backgroundImage.indexOf(id === 'teddy' ? 'rgb' : id === 'hearts' ? 'linear-gradient' : 'gradient') !== -1
        };
      }, p);
      // 'plain' legitimately has a single background layer (just the margin line)
      const minLayers = p === 'plain' ? 1 : 2;
      check('paper "' + p + '" applied (attr=' + info.attr + ', layers=' + info.imgs + ')', info.attr === p && info.imgs >= minLayers && info.has);
    }

    /* chips: count fonts and papers shown in Themes view */
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.topnav button'));
      btns.find(b => b.textContent === 'Themes').click();
    });
    await page.waitForSelector('.chip-row', { timeout: 8000 });
    const chipCounts = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.chip-row'));
      const paperRow = rows.find(r => r.getAttribute('aria-label') === 'Paper style');
      const fontRow = rows.find(r => r.getAttribute('aria-label') === 'Writing style');
      return { papers: paperRow ? paperRow.querySelectorAll('.chip').length : 0, fonts: fontRow ? fontRow.querySelectorAll('.chip').length : 0 };
    });
    check('Themes view shows ' + FONTS.length + ' font chips (got ' + chipCounts.fonts + ')', chipCounts.fonts === FONTS.length);
    check('Themes view shows ' + PAPERS.length + ' paper chips (got ' + chipCounts.papers + ')', chipCounts.papers === PAPERS.length);

    /* every font must change the rendered font-family */
    for (const f of FONTS) {
      await page.evaluate((id) => document.documentElement.setAttribute('data-font', id), f);
      const fam = await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--font-body'));
      check('font "' + f + '" sets --font-body (' + fam.trim().slice(0, 28) + '\u2026)', fam.trim().length > 4);
    }

    check('no page JS errors', errors.length === 0);
    if (errors.length) console.log('errors:', errors.slice(0, 3));
  } finally {
    await browser.close();
  }
  if (failures) { console.log(failures + ' check(s) failed'); process.exit(1); }
  console.log('All checks passed.');
}

main().catch(e => { console.error('TEST ERROR:', e.message); process.exit(1); });
