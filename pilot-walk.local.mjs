// Visual walkthrough of /method-pilot — screenshots at every step.
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:3778/method-pilot';
const OUT = process.env.OUT ?? '/tmp/shots';
import { mkdirSync } from 'node:fs';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-proxy-server'] });
const page = await browser.newPage({ viewport: { width: 900, height: 1100 } });
const shot = async (name) => { await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true }); console.log('shot', name); };

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('text=말해 주세요', { timeout: 30000 });
await shot('01-listen');

await page.fill('textarea', '새 온보딩을 다음 달까지 완성해서 출시할지, 지금 일부 고객에게 먼저 열지 고민이야. 나는 빨리 반응을 보고 싶어. 팀은 완성도를 걱정하니까.');
await page.click('text=시작');
await page.waitForSelector('text=시작 상태 보존');
await shot('02-baseline');

await page.click('text=이대로 보존');
await page.waitForSelector('text=지금 가장 도움이 되는 한 가지');
await shot('03-coach');

// open the packet to verify L0-L6 compiles in the browser
await page.click('text=컴파일된 prompt packet');
await shot('03b-packet');
await page.click('text=컴파일된 prompt packet'); // close

await page.click('text=데모 시나리오로 보기');
await page.waitForSelector('text=Decision Card 후보');
await shot('04-turn-and-card');

await page.click('text=이대로 채택');
await page.waitForSelector('text=현실에서');
await shot('05-acting');

await page.click('text=지금 미리 귀환 열기');
await page.waitForSelector('text=먼저, 실제로 무슨 일이 있었나요');
await shot('06-return-observe');

await page.fill('textarea', '3일 안에 대상 20명 명단을 확정했고, blocker 3개도 정했다. 개발 1명이 휴가라 일정은 이틀 밀렸다.');
await page.click('text=관찰 기록');
await page.waitForSelector('text=기록을 열기 전에');
await shot('07-return-probe');

await page.fill('textarea', '빨리 반응을 보고 싶어서 좁게 여는 쪽으로 정했던 것 같아');
await page.click('text=기억을 남기고 기록 열기');
await page.waitForSelector('text=이제 — 당시의 기록');
await shot('08-return-reveal');

await page.fill('input[placeholder*="lesson"]', '출시 결정에서는 대상 명단 확정을 결정 당일에 끝낸다');
await page.fill('input[placeholder*="범위"]', '출시/공개 범위 결정');
await page.click('text=귀환 닫기');
await page.waitForTimeout(500);
await shot('09-after-close');

console.log('final state text:', await page.textContent('footer'));
await browser.close();
console.log('WALKTHROUGH COMPLETE');
