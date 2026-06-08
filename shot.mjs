import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 1600 }, deviceScaleFactor: 2 });
await p.goto('http://localhost:3000/voyage-preview', { waitUntil: 'networkidle' });
await p.waitForTimeout(1200);
await p.screenshot({ path: 'voyage.png', fullPage: true });
console.log('shot saved');
await b.close();
