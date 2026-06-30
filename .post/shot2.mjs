import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3100';
const browser = await chromium.launch();

async function shot(name, url, { full = false, settle = 1200, hoverText = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1500 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).split('\n')[0]));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(settle);
  if (hoverText) {
    try { await page.getByText(hoverText, { exact: false }).first().hover({ timeout: 3000 }); await page.waitForTimeout(300); } catch { /* */ }
  }
  await page.screenshot({ path: `.post/shot2-${name}.png`, fullPage: full });
  console.log(`[${name}] errors=${errors.length}`, errors.slice(0, 3));
  await ctx.close();
}

await shot('settings', `${BASE}/settings`, { full: true });
await shot('guide', `${BASE}/guide`, { full: true });
// foundry with a button hovered → proves the .ds-showcase hover lift fires.
await shot('foundry-hover', `${BASE}/design/foundry`, { hoverText: '항해 시작' });

await browser.close();
console.log('done');
