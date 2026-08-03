import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
mkdirSync('/tmp/shots2', { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-proxy-server'] });

async function walk(name, opts) {
  const ctx = await browser.newContext({ viewport: opts.viewport, colorScheme: opts.scheme });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:3779/method-pilot', { waitUntil: 'networkidle' });
  await page.waitForSelector('text=말해 주세요', { timeout: 30000 });
  await page.fill('textarea', '새 온보딩을 다음 달까지 완성해서 출시할지, 지금 일부 고객에게 먼저 열지 고민이야. 나는 빨리 반응을 보고 싶어.');
  await page.click('text=시작');
  await page.waitForSelector('text=시작 상태 보존');
  await page.click('text=이대로 보존');
  await page.waitForSelector('text=데모 시나리오로 보기');
  await page.click('text=데모 시나리오로 보기');
  await page.waitForSelector('text=Decision Card 후보');
  await page.screenshot({ path: `/tmp/shots2/${name}-card.png`, fullPage: true });
  await page.click('text=이대로 채택');
  await page.waitForSelector('text=현실에서');
  await page.screenshot({ path: `/tmp/shots2/${name}-acting.png`, fullPage: true });
  console.log('done', name);
  await ctx.close();
}

await walk('dark', { viewport: { width: 900, height: 1100 }, scheme: 'dark' });
await walk('mobile', { viewport: { width: 390, height: 844 }, scheme: 'light' });
await browser.close();
console.log('VISUAL PASS COMPLETE');
