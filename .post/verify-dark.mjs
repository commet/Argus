import { chromium } from 'playwright';
const BASE = 'http://127.0.0.1:3701';
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1100, height: 950 }, reducedMotion: 'reduce' });
const p = await c.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e).split('\n')[0]));
await p.goto(`${BASE}/guide`, { waitUntil: 'networkidle' });
await p.waitForTimeout(1200);
// flip the app theme the way the Header toggle does
await p.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
await p.waitForTimeout(900);
// read the resolved bg + a dark: utility colour to prove the toggle took
const probe = await p.evaluate(() => {
  const cs = getComputedStyle(document.documentElement);
  const bodyBg = getComputedStyle(document.body).backgroundColor;
  return { warning: cs.getPropertyValue('--warning').trim(), bgHover: cs.getPropertyValue('--bg-hover').trim(), bodyBg };
});
console.log('dark errors:', errs.length, errs.slice(0, 2));
console.log('resolved --warning:', probe.warning, '| --bg-hover:', probe.bgHover, '| body bg:', probe.bodyBg);
await p.screenshot({ path: '.post/dark-guide.png', fullPage: false });
await b.close();
console.log('done');
