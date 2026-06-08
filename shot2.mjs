import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 3 });
await p.goto('http://localhost:3000/voyage-preview', { waitUntil: 'networkidle' });
await p.waitForTimeout(1000);
// clip the large detail row (6 big cards)
await p.screenshot({ path: 'voyage-detail.png', clip: { x: 145, y: 150, width: 760, height: 260 } });
console.log('detail shot saved');
await b.close();
