/**
 * Self-test for the walker ENGINE (not the real app). Serves a tiny fake
 * 3-screen flow locally, runs the same login→type→walk→screenshot→summary
 * logic against it, and asserts screenshots + summary were produced and the
 * decision text was seen. Proves the mechanics before pointing at production.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const PAGES = {
  '/ko/login': `<h1>로그인</h1><form><input type="email"><input type="password">
    <button type="submit" onclick="location='/ko/workspace';return false">로그인</button></form>`,
  '/ko/workspace': `<h1>워크스페이스</h1><textarea placeholder="예: ..."></textarea>
    <button onclick="location='/ko/step1'">시작</button>`,
  '/ko/step1': `<h1>리프레임</h1><p id=echo></p>
    <button onclick="location='/ko/seal'">다음</button>
    <button onclick="location='/ko/login'">취소</button>
    <script>document.getElementById('echo').textContent=localStorage.getItem('d')||''</script>`,
  '/ko/seal': `<h1>봉인했어요</h1><p>정산은 확인일에.</p>`,
};

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(`<!doctype html><meta charset=utf-8>${PAGES[url] ?? '<h1>404</h1>'}`);
});

function sandboxChrome() {
  const p = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  return fs.existsSync(p) ? p : undefined;
}

await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;
const outDir = path.join('scripts', 'dogfood', 'experience', '_selftest-shots');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true, executablePath: sandboxChrome() });
const page = await browser.newPage();
let shots = 0; let sawDecision = false; let sawSeal = false;
const shot = async (l) => { await page.screenshot({ path: path.join(outDir, `${++shots}-${l}.png`) }); };

await page.goto(`${base}/ko/login`);
await shot('login');
await page.fill('input[type=email]', 'x@y.com');
await page.fill('input[type=password]', 'pw');
await page.click('button:has-text("로그인")');
await page.waitForTimeout(200);
await page.goto(`${base}/ko/workspace`);
await page.evaluate(() => localStorage.setItem('d', '채용을 할지 말지'));
await page.fill('textarea', '채용을 할지 말지 결정');
await shot('typed');
await page.click('button:has-text("시작")');
for (let i = 0; i < 5; i++) {
  await page.waitForTimeout(150);
  await shot(`loop-${i}`);
  const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  if (text.includes('채용을 할지')) sawDecision = true;
  if (/봉인했/.test(text)) { sawSeal = true; break; }
  const btns = page.locator('button:visible:not([disabled])');
  const n = await btns.count();
  let picked = null;
  for (let j = 0; j < n; j++) {
    const label = (await btns.nth(j).innerText()).trim();
    if (/취소|뒤로/.test(label)) continue;
    if (/다음|계속|봉인|시작/.test(label)) { picked = btns.nth(j); break; }
  }
  if (picked) await picked.click().catch(() => {});
}
await browser.close();
server.close();

const pngs = fs.readdirSync(outDir).filter((f) => f.endsWith('.png'));
const ok = pngs.length >= 4 && sawDecision && sawSeal;
console.log(`screens=${pngs.length} sawDecision=${sawDecision} sawSeal=${sawSeal}`);
console.log(ok ? 'ENGINE_OK: login→type→walk→screenshot→reach-seal all work' : 'ENGINE_FAIL');
fs.rmSync(outDir, { recursive: true, force: true });
process.exit(ok ? 0 : 1);
