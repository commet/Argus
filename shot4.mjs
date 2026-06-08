import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 3 });
await p.goto('http://localhost:3000/voyage-preview', { waitUntil: 'networkidle' });
await p.waitForTimeout(1000);
// adrift = large grid row1 col3 (right side)
await p.screenshot({ path: 'voyage-adrift.png', clip: { x: 690, y: 175, width: 360, height: 235 } });
console.log('saved');
await b.close();
