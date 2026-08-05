/**
 * 공개 표면 도달 검사 — 매 PR마다 도는 가장 싼 가드.
 *
 * 무엇을 막는가: **로그아웃한 사람이 갈 수 있어야 하는 화면이 조용히 죽는 것.**
 * 2026-07-29까지 이 리포는 테스트 3,900여 개가 초록인 채로 공유 기능이 18일,
 * 팀 기능이 10일 죽어 있었다. 둘 다 "코드는 맞고 응답이 틀린" 부류였고, 코드를
 * 읽는 어떤 테스트도 볼 수 없는 자리였다. 실제로 열어봐야 보인다.
 *
 * 이 스크립트는 LLM을 호출하지 않는다 — 비용 0, 40초 내외. 그래서 매 PR에 붙일 수
 * 있고, 붙어 있는 한 "본선이 열리는가"는 다시는 조용히 죽지 않는다.
 *
 * 검사하는 것:
 *   · 공개 경로가 200 으로 열리는가
 *   · 열려야 할 곳에 로그인 벽이 없는가 (봉인까지 가는 본선 + 귀환이 도착하는 곳)
 *   · 막혀야 할 곳(계정 기능)에는 벽이 있는가 — 반대 방향도 회귀다
 *   · 페이지 에러(throw)가 없는가
 *
 * 검사하지 않는 것(정직하게): 화면의 내용이 옳은지, 흐름이 완주되는지. 그건
 * `scripts/e2e/anon-loop.mjs` 의 몫이고 LLM 비용이 든다.
 *
 * 사용법:
 *   ARGUS_BASE_URL=https://argus.voyage node scripts/e2e/public-surfaces.mjs
 */
import { chromium } from '@playwright/test';
import { playwrightExecutablePath } from '../lib/playwright-executable.mjs';

const BASE = (process.env.ARGUS_BASE_URL ?? 'https://argus.voyage').replace(/\/$/, '');
const LOCALE = process.env.ARGUS_LOCALE ?? 'ko';

/** `wall: false` = 로그인 없이 열려야 한다. `wall: true` = 계정 기능이라 막혀야 한다. */
const ROUTES = [
  { path: '', label: '랜딩', wall: false },
  { path: '/workspace', label: '본선 — 봉인까지 가는 곳', wall: false },
  { path: '/project', label: '귀환·정산이 도착하는 곳', wall: false },
  { path: '/tools/review', label: '문서 검수', wall: false },
  { path: '/settings', label: '설정', wall: false },
  { path: '/guide', label: '가이드', wall: false },
  { path: '/login', label: '로그인', wall: false },
  { path: '/agents', label: 'AI 검토자 (계정 기능)', wall: true },
  { path: '/teams', label: '팀 (계정 기능)', wall: true },
];

/** AuthGuard 가 렌더하는 문구들. 하나라도 보이면 그 화면은 벽 뒤다. */
const WALL_MARKERS = ['로그인이 필요해요', 'need an account', 'needs an account', '다시 오셨네요', 'Welcome back'];

const failures = [];
const browser = await chromium.launch({ headless: true, executablePath: playwrightExecutablePath() });
const ctx = await browser.newContext({ locale: `${LOCALE}-KR`, viewport: { width: 1280, height: 900 } });
/** Same declaration as the main context — a share-link visit is still a machine.
 *  Keep in sync with SYNTHETIC_RUN_KEY (src/lib/analytics.ts). */
await ctx.addInitScript(() => {
  try {
    sessionStorage.setItem('argus:synthetic', '1');
    localStorage.setItem('argus:synthetic', '1');
  } catch { /* storage unavailable */ }
});
const page = await ctx.newPage();

const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push({ url: page.url(), detail: String(e).slice(0, 200) }));

console.log(`공개 표면 검사 — ${BASE} (${LOCALE})\n`);

for (const r of ROUTES) {
  const url = `${BASE}/${LOCALE}${r.path}`;
  const before = pageErrors.length;
  let status = 0;
  try {
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    status = res?.status() ?? 0;
    await page.waitForTimeout(3000); // 클라이언트 렌더 + AuthGuard 판정까지
  } catch (e) {
    failures.push(`${r.path || '/'} — 열리지 않음: ${e.message.slice(0, 80)}`);
    console.log(`🔴 NAV  ${r.path || '/'}  ${r.label}`);
    continue;
  }

  const text = await page.evaluate(() => document.body.innerText).catch(() => '');
  const walled = WALL_MARKERS.some((m) => text.includes(m));
  const newErrors = pageErrors.length - before;

  if (status !== 200) failures.push(`${r.path || '/'} — HTTP ${status}`);
  if (r.wall && !walled) failures.push(`${r.path || '/'} — 계정 기능인데 벽이 없다 (누구나 들어간다)`);
  if (!r.wall && walled) failures.push(`${r.path || '/'} — 로그인 벽이 생겼다 (${r.label})`);
  if (newErrors > 0) failures.push(`${r.path || '/'} — 페이지 에러 ${newErrors}건`);

  const icon = (status === 200 && r.wall === walled && newErrors === 0) ? '🟢' : '🔴';
  console.log(`${icon} ${String(status).padEnd(3)} ${walled ? '🔒' : '  '} ${(r.path || '/').padEnd(16)} ${r.label}`);
}

await browser.close();

console.log('');
if (pageErrors.length) {
  console.log(`페이지 에러 ${pageErrors.length}건:`);
  for (const e of pageErrors.slice(0, 5)) console.log(`  ! ${e.url}\n    ${e.detail}`);
}

if (failures.length) {
  console.error(`\n🔴 ${failures.length}건 실패:`);
  for (const f of failures) console.error(`  · ${f}`);
  console.error('\n로그아웃한 방문자가 본선에 못 들어가거나, 계정 기능이 열려 있다.');
  process.exit(1);
}
console.log(`🟢 공개 표면 ${ROUTES.length}개 전부 정상 (벽 위치까지 의도대로).`);
process.exit(0);
