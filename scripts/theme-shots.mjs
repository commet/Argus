// Light/dark screenshot harness for the visual color/token batches.
// Usage: node scripts/theme-shots.mjs <label>  (server must be running on PORT)
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const PORT = process.env.PORT || '3848';
const label = process.argv[2] || 'shot';
const BASE = `http://localhost:${PORT}`;
const outDir = `.shots/${label}`;
mkdirSync(outDir, { recursive: true });

// Surfaces reachable without auth/LLM that exercise the affected chrome.
const SURFACES = [
  { name: 'landing', url: `${BASE}/?lang=ko` },
  { name: 'agents', url: `${BASE}/agents?lang=ko` },
  { name: 'workspace', url: `${BASE}/workspace?lang=ko` },
  { name: 'boss', url: `${BASE}/boss?lang=ko` },
  { name: 'reframe', url: `${BASE}/workspace?step=reframe&lang=ko` },
];

const browser = await chromium.launch();
for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1600 }, deviceScaleFactor: 1 });
  await ctx.addInitScript((t) => {
    try { localStorage.setItem('argus-theme', t); } catch {}
  }, theme);
  const page = await ctx.newPage();
  for (const s of SURFACES) {
    try {
      await page.goto(s.url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${outDir}/${s.name}-${theme}.png`, fullPage: false });
      console.log(`ok  ${s.name}-${theme}`);
    } catch (e) {
      console.log(`ERR ${s.name}-${theme}: ${e.message.split('\n')[0]}`);
    }
  }
  await ctx.close();
}
await browser.close();
console.log(`done → ${outDir}`);
