import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const PORT = process.env.PORT || '3210';
const BASE = `http://localhost:${PORT}`;
const OUT = process.env.SHOT_OUT || path.resolve('.shots/voyage-caps');
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

const VIEWS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, isMobile: false },
  { name: 'mobile', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
];
const CAPS = ['intro', '0', '1', '2', '3'];

for (const v of VIEWS) {
  const ctx = await browser.newContext({ viewport: v.viewport, isMobile: v.isMobile, hasTouch: v.hasTouch });
  const page = await ctx.newPage();
  for (const cap of CAPS) {
    try {
      await page.goto(`${BASE}/ko?cap=${cap}`, { waitUntil: 'load', timeout: 25000 });
      await page.waitForTimeout(1100);
      const fig = page.locator('figure').first();
      await fig.screenshot({ path: `${OUT}/${v.name}-cap-${cap}.png` });
      console.log(`ok ${v.name} cap-${cap}`);
    } catch (e) {
      console.log(`! ${v.name} cap-${cap}: ${String(e.message).split('\n')[0]}`);
    }
  }
  // Trail centering check — full-viewport screenshot at the Trail section.
  try {
    await page.goto(`${BASE}/ko`, { waitUntil: 'load', timeout: 25000 });
    await page.waitForTimeout(900);
    const top = await page.evaluate(() => {
      const el = document.querySelector('#navigate');
      return el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : 0;
    });
    await page.evaluate((t) => window.scrollTo({ top, behavior: 'instant' }), top);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/${v.name}-trail.png` });
    console.log(`ok ${v.name} trail`);
  } catch (e) {
    console.log(`! ${v.name} trail: ${String(e.message).split('\n')[0]}`);
  }
  await ctx.close();
}

await browser.close();
console.log('shots ->', OUT);
