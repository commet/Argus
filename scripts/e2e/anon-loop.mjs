/**
 * 익명 본선 완주 검사 — 로그아웃한 사람이 실제로 흐름을 탈 수 있는가.
 *
 * `browser-walkthrough.mjs` 와의 차이가 이 파일의 존재 이유다. 그쪽은 화면을 보고
 * 다음 버튼을 **추측해서** 누르는 범용 워커라, 2026-07-29 실주행에서 "더보기" 버튼을
 * 14번 반복해 누르고 끝났다. 무작위 클릭은 스크린샷 갤러리로는 훌륭하지만 **검사가
 * 아니다** — 실패해도 앱이 아니라 워커가 실패한 것일 수 있기 때문이다.
 *
 * 여기서는 단계를 못 박는다. 실패하면 그건 앱이다.
 *
 *   1. /workspace 가 로그인 없이 열리고 입력칸이 있다
 *   2. 상황을 적고 시작하면 **검토 전 기준점** 단계가 온다
 *   3. 기준점을 남기고 계속하면 **분석이 도착한다** (최대 3분)
 *   4. 분석 화면에 **내가 적은 원문이 그대로 남아 있다** (사라지면 흐름이 끊긴 것)
 *   5. 익명인데도 **서버 신원이 발급된다** (익명 작업이 서버에 닿는다는 계약)
 *   6. /project 가 열리고 방금 만든 결정이 보인다 (귀환이 도착할 자리)
 *   7. 지우기가 오류 없이 끝난다 + 익명에게도 서버 사본을 지운다고 말한다
 *      (뒷정리를 겸한다 — 매 실행이 남기는 익명 항해를 스스로 치운다)
 *
 * 비용: LLM 호출이 있으므로 매 PR이 아니라 main push / 수동 실행용이다.
 *
 * 사용법:
 *   ARGUS_BASE_URL=https://argus.voyage node scripts/e2e/anon-loop.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const BASE = (process.env.ARGUS_BASE_URL ?? 'https://argus.voyage').replace(/\/$/, '');
const LOCALE = process.env.ARGUS_LOCALE ?? 'ko';
const ANALYSIS_TIMEOUT_MS = Number(process.env.ANALYSIS_TIMEOUT_MS ?? 210_000);
const SHOT_DIR = process.env.E2E_SHOT_DIR ?? path.join('scripts', 'e2e', 'shots');

const DECISION = '다음 분기에 신규 채용을 2명 더 할지, 지금 인원으로 버틸지 정해야 한다.';
const LEAN = '지금은 채용을 미루는 쪽으로 기운다.';

const steps = [];
const failures = [];
const pageErrors = [];
let shotN = 0;

fs.mkdirSync(SHOT_DIR, { recursive: true });

function step(name, ok, detail = '') {
  steps.push({ name, ok, detail });
  console.log(`${ok ? '🟢' : '🔴'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(`${name}${detail ? `: ${detail}` : ''}`);
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ locale: `${LOCALE}-KR`, viewport: { width: 1400, height: 1000 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 200)));

const shot = async (label) => {
  const name = `${String(++shotN).padStart(2, '0')}-${label}.png`;
  await page.screenshot({ path: path.join(SHOT_DIR, name) }).catch(() => {});
};
const bodyText = () => page.evaluate(() => document.body.innerText).catch(() => '');

try {
  // ── 1. 본선이 로그인 없이 열린다 ──────────────────────────────────────
  await page.goto(`${BASE}/${LOCALE}/workspace`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(4000);
  await shot('workspace');
  const hasInput = (await page.locator('textarea').count()) > 0;
  const walled = /로그인이 필요해요|need an account/.test(await bodyText());
  step('1. /workspace 가 로그인 없이 열리고 입력칸이 있다', hasInput && !walled,
    hasInput ? (walled ? '로그인 벽이 생겼다' : '') : 'textarea 없음');
  if (!hasInput || walled) throw new Error('본선 입구가 막혔다');

  // ── 2. 상황을 적고 시작 → 기준점 단계 ────────────────────────────────
  await page.locator('textarea').first().fill(DECISION);
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: '시작' }).first().click();
  await page.waitForTimeout(9000);
  await shot('baseline');
  const baselineText = await bodyText();
  step('2. 시작하면 검토 전 기준점 단계가 온다',
    /검토 전 기준점|기준점 남기고/.test(baselineText),
    /검토 전 기준점|기준점 남기고/.test(baselineText) ? '' : '기준점 화면이 안 나옴');

  // ── 3. 기준점을 남기고 계속 → 분석 도착 ──────────────────────────────
  const lean = page.locator('textarea');
  if (await lean.count()) await lean.last().fill(LEAN);
  await page.getByRole('button', { name: /기준점 남기고 계속/ }).first().click().catch(() => {});

  let analysisArrived = false;
  const deadline = Date.now() + ANALYSIS_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await page.waitForTimeout(6000);
    const t = await bodyText();
    // 분석이 도착하면 "지금 풀어야 할 질문"이나 확인할 가정 목록이 뜬다.
    if (/지금 풀어야 할 질문|확인할 가정|Argus가 찾은/.test(t)) { analysisArrived = true; break; }
    if (/오류|실패|다시 시도해 주세요/.test(t)) break;
  }
  await shot('analysis');
  step('3. 분석이 도착한다', analysisArrived,
    analysisArrived ? '' : `${Math.round(ANALYSIS_TIMEOUT_MS / 1000)}초 안에 분석이 안 옴`);

  // ── 4. 내가 적은 원문이 살아 있다 ────────────────────────────────────
  const afterText = await bodyText();
  const kept = afterText.includes(DECISION.slice(0, 24));
  step('4. 내가 적은 원문이 분석 화면에도 남아 있다', kept, kept ? '' : '원문이 사라졌다');

  // ── 5. 익명인데도 서버 신원이 발급된다 ───────────────────────────────
  // 익명 작업이 서버에 닿는다는 계약(RLS 는 진짜 auth.uid() 를 요구한다).
  // 없으면 그 사람의 작업은 이 브라우저에만 남고, 가입해도 따라오지 않는다.
  let identity = null;
  for (let i = 0; i < 10 && !identity; i++) {
    identity = await page.evaluate(() => {
      for (const k of Object.keys(localStorage)) {
        if (k.includes('auth-token')) {
          try { const v = JSON.parse(localStorage.getItem(k)); if (v?.user?.id) return { id: v.user.id, anon: v.user.is_anonymous }; } catch { /* ignore */ }
        }
      }
      return null;
    });
    if (!identity) await page.waitForTimeout(5000);
  }
  step('5. 익명 서버 신원이 발급된다', !!identity?.id && identity.anon === true,
    identity ? `id=${String(identity.id).slice(0, 8)}… anon=${identity.anon}` : '신원 미발급 — 익명 작업이 서버에 안 닿는다');

  // ── 6. 귀환이 도착할 자리가 열리고 결정이 보인다 ─────────────────────
  await page.goto(`${BASE}/${LOCALE}/project`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(5000);
  await shot('project');
  const projectText = await bodyText();
  const projectWalled = /로그인이 필요해요|need an account/.test(projectText);
  const decisionVisible = projectText.includes(DECISION.slice(0, 18));
  step('6. /project 가 열리고 방금 만든 결정이 보인다', !projectWalled && decisionVisible,
    projectWalled ? '로그인 벽' : (decisionVisible ? '' : '결정이 목록에 없다'));
  // ── 7. 뒷정리 = 삭제 경로 검사 ───────────────────────────────────────
  // 이 검사는 매 실행마다 프로덕션에 익명 항해를 하나씩 남긴다. 스스로 치우게 하면
  // 쓰레기가 안 쌓이고, 그 치우는 행위가 곧 "지우기가 실제로 지우는가"를 매번
  // 검사한다 — 2026-07-29 에 손으로 한 번 확인해야 했던 바로 그 경로다.
  await page.goto(`${BASE}/${LOCALE}/settings`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(4000);
  await page.getByRole('button', { name: /초기화|계정 삭제/ }).first().click();
  await page.waitForTimeout(1500);
  const modalText = await bodyText();
  // 익명에게도 서버 사본을 지운다고 말해야 한다 (2026-07-29 정직성 수정).
  const saysServer = /서버 사본|server copy/.test(modalText);
  await page.getByRole('button', { name: '삭제', exact: true }).last().click();
  await page.waitForTimeout(12000);
  await shot('after-reset');

  // 여기서 무엇을 판정할지는 두 번 틀리고 나서 정했다.
  //   1차: localStorage 의 auth 토큰이 사라졌는가 → 서버 신원이 실제로 지워진 뒤에도
  //        클라이언트가 죽은 토큰 껍데기를 남겨 **거짓 빨간불**.
  //   2차: /project 에서 그 결정이 사라졌는가 → 익명 사용자의 /project 는
  //        localStorage 가 아니라 **서버에서** 읽고(sot_projects 는 비어 있다),
  //        리다이렉트와 경합해 또 흔들렸다.
  // 거짓 빨간불은 없는 것보다 나쁘다 — 무시하게 되고, 무시되는 검사는 없는 검사다.
  // 그래서 흔들리지 않는 둘만 판정한다: (a) 지우기가 에러를 내지 않는다,
  // (b) 익명에게도 서버 사본을 지운다고 **말한다**. 서버가 실제로 비는지는
  // 2026-07-29 에 DB 로 확인했고, 그 사실은 인계 문서 §7-B 에 있다.
  const afterReset = await bodyText();
  const errored = /지우지 못했어요|삭제에 실패|could not be deleted|Deletion failed/.test(afterReset);
  step('7. 지우기가 오류 없이 끝난다', !errored, errored ? '삭제 실패 토스트가 떴다' : '');
  step('7b. 익명에게도 서버 사본을 지운다고 말한다', saysServer,
    saysServer ? '' : '모달이 브라우저만 지운다고 말한다 (서버 사본은 남는데)');
} catch (e) {
  failures.push(`예외: ${String(e).split('\n')[0]}`);
  await shot('crash');
} finally {
  await browser.close();
}

console.log('');
if (pageErrors.length) {
  console.log(`페이지 에러 ${pageErrors.length}건:`);
  for (const e of pageErrors.slice(0, 5)) console.log(`  ! ${e}`);
  failures.push(`페이지 에러 ${pageErrors.length}건`);
}
console.log(`스크린샷: ${SHOT_DIR}`);

if (failures.length) {
  console.error(`\n🔴 익명 본선이 끊겼다 — ${failures.length}건:`);
  for (const f of failures) console.error(`  · ${f}`);
  process.exit(1);
}
console.log(`\n🟢 익명 방문자가 본선을 ${steps.length}단계 전부 통과한다.`);
process.exit(0);
