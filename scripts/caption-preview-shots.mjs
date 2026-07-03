import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const OUT = path.resolve('.shots/caption-preview');
fs.mkdirSync(OUT, { recursive: true });
const HTML = pathToFileURL(path.resolve('.shots/caption-preview.html')).href;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 700 }, deviceScaleFactor: 2 });

const CAPS = ['intro', '0', '1', '2', '3'];
const WIDTHS = { desktop: 860, mobile: 390 };

for (const [name, w] of Object.entries(WIDTHS)) {
  for (const cap of CAPS) {
    await page.goto(`${HTML}?cap=${cap}&w=${w}`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    const fig = page.locator('#fig');
    await fig.screenshot({ path: `${OUT}/${name}-cap-${cap}.png` });
    console.log(`ok ${name} cap-${cap}`);
  }
}
await browser.close();
console.log('shots ->', OUT);
