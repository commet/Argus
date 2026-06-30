import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3100';
const browser = await chromium.launch();

async function shot(name, url, { motion = 'reduce', scrollTo = null, full = false, settle = 1400 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1400 }, reducedMotion: motion, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).split('\n')[0]));
  await page.goto(url, { waitUntil: 'networkidle' });
  if (scrollTo) {
    try { await page.getByText(scrollTo, { exact: false }).first().scrollIntoViewIfNeeded({ timeout: 4000 }); } catch { /* keep top */ }
  }
  await page.waitForTimeout(settle);
  await page.screenshot({ path: `.post/shot-${name}.png`, fullPage: full });
  console.log(`[${name}] errors=${errors.length}`, errors.slice(0, 3));
  await ctx.close();
}

// Hero film — reduced-motion MUST show the resolved Draft beat (t=15800), not blank t=0.
await shot('hero-reduce', `${BASE}/`, { scrollTo: 'Argus · 제품 미리보기' });
// Hero film — animation on: a mid-beat (non-blank) frame proves the clock runs.
await shot('hero-motion', `${BASE}/`, { motion: 'no-preference', scrollTo: 'Argus · 제품 미리보기', settle: 5000 });
// Voyage film inside Act2 — reduced-motion holds t=18600.
await shot('voyage-reduce', `${BASE}/`, { scrollTo: '항적 The Trail' });
await shot('voyage-motion', `${BASE}/`, { motion: 'no-preference', scrollTo: '항적 The Trail', settle: 8000 });
// Design routes — must render (no login wall, no global header).
await shot('foundry', `${BASE}/design/foundry`, { full: true });
await shot('workspace', `${BASE}/design/workspace`, { full: true });
// Landing top — confirm SirenHero unaffected.
await shot('landing-top', `${BASE}/`);

await browser.close();
console.log('done');
