import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 3 });
await p.goto('http://localhost:3000/voyage-preview', { waitUntil: 'networkidle' });
await p.waitForTimeout(1000);
// second row of the large grid: adrift was row1 col3; wrecked/arrived/verified are row2
await p.screenshot({ path: 'voyage-2.png', clip: { x: 145, y: 380, width: 760, height: 260 } });
console.log('saved');
await b.close();
