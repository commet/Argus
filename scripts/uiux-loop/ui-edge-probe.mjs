/**
 * UI 엣지/에러 상태 probe — 해피패스 캡처가 구조적으로 피하는 곳.
 * 유일 심각버그(429 freeze)가 살던 자리. 실패 경로를 강제로 밟는다.
 *
 * 3 케이스:
 *   E1. 분석 LLM 호출 강제 실패(500) — 우아한 에러 vs 무한 스피너/freeze
 *   E2. 분석 중 새로고침 — 상태 복구 vs 흔적 없이 초기화
 *   E3. 완주 없이 연속: 봉인 전 새 결정 시작 — 잔재/충돌
 * 각 케이스는 신선한 컨텍스트. 결과는 콘솔 + gallery-edge/*.png.
 *
 * 사용: node scripts/uiux-loop/ui-edge-probe.mjs
 * 전제: dev 서버 실행.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dir, 'gallery-edge');
const BASE = 'http://localhost:3000';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function setTextarea(page, text) {
  const ta = page.locator('textarea').first();
  await ta.click();
  await ta.fill(text);
}
async function clickByText(page, text, opts = {}) {
  const b = page.getByRole('button', { name: text, exact: !!opts.exact }).first();
  await b.click({ timeout: 8000 });
}
async function toBind(page, problem) {
  await page.goto(`${BASE}/ko/workspace?e2e-no-anim=1`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('textarea', { timeout: 20000 });
  await setTextarea(page, problem);
  await clickByText(page, '시작', { exact: true });
  await page.waitForFunction(() => document.body.innerText.includes('밧줄'), null, { timeout: 20000 });
  await setTextarea(page, '딱히 정한 건 없어');
  await clickByText(page, '1일 ·').catch(() => {});
  await clickByText(page, '묶고 계속');
}
const findings = [];

async function main() {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();

  // ── E1. 분석 LLM 호출 강제 실패 ──
  {
    const ctx = await browser.newContext({ viewport: { width: 960, height: 900 } });
    const page = await ctx.newPage();
    page.setDefaultTimeout(15000);
    let hits = 0;
    await page.route('**/api/llm**', async (route) => {
      hits++;
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'forced failure (edge probe)' }) });
    });
    try {
      await toBind(page, '신제품 출시를 3분기로 미룰지 지금 강행할지 고민이야');
      // 분석이 시작됐지만 LLM이 500. 15초 관찰.
      await sleep(15000);
      const body = await page.evaluate(() => document.body.innerText);
      await page.screenshot({ path: join(OUT, 'E1-llm-500.png'), fullPage: true });
      const spinnerStuck = /꾸리는 중|읽는 중|분석|잠시만|불러오|생각하|Loading|팀을/.test(body)
        && !/오류|에러|실패|다시 시도|문제가|잠깐 실패|error/i.test(body);
      const hasErrorUI = /오류|에러|실패|다시 시도|문제가 생|잠깐|error/i.test(body);
      findings.push({
        case: 'E1 분석 LLM 500', hits,
        verdict: hasErrorUI ? '✅ 에러 UI 노출' : (spinnerStuck ? '🔴 무한 스피너/freeze(에러 안내 없음)' : '△ 불명확'),
        bodyHead: body.replace(/\s+/g, ' ').slice(0, 260),
      });
    } catch (e) {
      await page.screenshot({ path: join(OUT, 'E1-llm-500-threw.png'), fullPage: true }).catch(() => {});
      findings.push({ case: 'E1 분석 LLM 500', hits, verdict: '🔴 예외로 흐름 중단: ' + e.message.slice(0, 120) });
    }
    await ctx.close();
  }

  // ── E2. 분석 중 새로고침 (상태 복구) ──
  {
    const ctx = await browser.newContext({ viewport: { width: 960, height: 900 } });
    const page = await ctx.newPage();
    page.setDefaultTimeout(15000);
    try {
      await toBind(page, '핵심 고객사 계약을 갱신할지 조건을 재협상할지');
      await sleep(3000); // 분석 스트리밍 도중
      await page.reload({ waitUntil: 'domcontentloaded' });
      await sleep(3000);
      const body = await page.evaluate(() => document.body.innerText);
      await page.screenshot({ path: join(OUT, 'E2-refresh-midflow.png'), fullPage: true });
      const backToStart = /어떤 상황인가요|한 줄만/.test(body) && !/밧줄|질문 [0-9]|진짜 질문/.test(body);
      const recovered = /밧줄|질문 [0-9]|진짜 질문|이어서|계속하기|중단된/.test(body);
      findings.push({
        case: 'E2 분석중 새로고침',
        verdict: recovered ? '✅ 진행 복구/이어가기' : (backToStart ? '🟠 흔적 없이 처음으로(입력 유실)' : '△ 불명확'),
        bodyHead: body.replace(/\s+/g, ' ').slice(0, 220),
      });
    } catch (e) {
      findings.push({ case: 'E2 분석중 새로고침', verdict: '🔴 예외: ' + e.message.slice(0, 120) });
    }
    await ctx.close();
  }

  // ── E3. 봉인 전 새 결정 시작 (잔재/충돌) ──
  {
    const ctx = await browser.newContext({ viewport: { width: 960, height: 900 } });
    const page = await ctx.newPage();
    page.setDefaultTimeout(15000);
    try {
      await toBind(page, '사무실을 확장 이전할지 재택을 유지할지');
      await sleep(4000);
      // 분석 도중/직후 워크스페이스를 다시 열어 새 상황 입력을 시도
      await page.goto(`${BASE}/ko/workspace?e2e-no-anim=1`, { waitUntil: 'domcontentloaded' });
      await sleep(2500);
      const body = await page.evaluate(() => document.body.innerText);
      await page.screenshot({ path: join(OUT, 'E3-new-before-seal.png'), fullPage: true });
      const canStartNew = /어떤 상황인가요|한 줄만|시작/.test(body);
      const resumePrompt = /이어서|계속하기|중단된|이전 결정|돌아가기/.test(body);
      findings.push({
        case: 'E3 봉인전 재진입',
        verdict: resumePrompt ? '✅ 이어가기/중단복구 안내' : (canStartNew ? '△ 새 입력 가능(이전 진행 잔재 확인 필요)' : '🟠 불명확'),
        bodyHead: body.replace(/\s+/g, ' ').slice(0, 220),
      });
    } catch (e) {
      findings.push({ case: 'E3 봉인전 재진입', verdict: '🔴 예외: ' + e.message.slice(0, 120) });
    }
    await ctx.close();
  }

  await browser.close();
  writeFileSync(join(OUT, 'edge-findings.json'), JSON.stringify(findings, null, 2));
  console.log('\n██████ UI 엣지/에러 probe 결과 ██████');
  for (const f of findings) {
    console.log('\n■ ' + f.case + (f.hits != null ? `  (api hits: ${f.hits})` : ''));
    console.log('  판정:', f.verdict);
    if (f.bodyHead) console.log('  화면:', f.bodyHead);
  }
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
