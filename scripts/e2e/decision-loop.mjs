/**
 * 결정 루프 완주 검사 — 사람이 **봉인까지** 도달하는가.
 *
 * 이 파일이 왜 이렇게 생겼는지가 제일 중요하다.
 *
 * 2026-07-29 CI 에서 로그인 경로 검사가 빨간불이었는데, 원인은 앱이 아니라
 * 검사기였다. 범용 워커(`browser-walkthrough.mjs`)가 화면을 보고 **다음 버튼을
 * 추측해서** 누르다가 "더보기 메뉴"를 14번 반복하고 한도에 걸렸다. 무작위 클릭은
 * 스크린샷 갤러리로는 훌륭하지만 **검사가 아니다** — 실패해도 앱이 실패한 건지
 * 워커가 실패한 건지 알 수 없기 때문이다. 그런 빨간불은 없는 것보다 나쁘다.
 * 무시하게 되고, 무시되는 검사는 없는 검사다.
 *
 * 그렇다고 완전히 고정된 대본도 못 쓴다. 질문 수도, 갈림 확인이 뜨는지도,
 * 시험 단계의 모양도 그 사람의 답에 따라 달라지기 때문이다.
 *
 * 그래서 **닫힌 상태 집합 + 모르면 큰 소리로 실패**로 짓는다:
 *
 *   · 매 틱마다 화면을 읽고, **미리 이름 붙여둔 상태 목록**과만 대조한다.
 *   · 맞는 상태가 있으면 그 상태에 정해진 단 하나의 행동을 한다.
 *   · **아무것도 안 맞으면 그 자리에서 실패**한다 — 화면 글을 그대로 뱉으면서.
 *
 * 무작위 클릭과의 차이가 여기다. 이 검사기는 자기가 아는 화면에서만 움직이고,
 * 모르는 화면을 만나면 **추측하지 않고 신고한다.** 그래서 빨간불이 뜨면 둘 중
 * 하나로 좁혀진다: (a) 앱이 끊겼거나, (b) 화면이 바뀌었는데 이 목록을 안 고쳤거나.
 * 둘 다 사람이 봐야 하는 사실이고, 어느 쪽인지는 뱉어놓은 화면 글로 즉시 갈린다.
 *
 * ── 무엇을 검사하는가 ────────────────────────────────────────────────────
 *   1. /workspace 가 로그인 없이 열리고 입력칸이 있다
 *   2. 상황을 적고 시작하면 검토 전 기준점 단계가 온다
 *   3. 기준점을 남기면 분석이 도착한다
 *   4. 분석 화면에 내가 적은 원문이 그대로 남아 있다
 *   5. 익명인데도 서버 신원이 발급된다
 *   6. 질문 → 초안 → 시험을 지나 **최종 문서까지 간다**   ← 2026-07-29 신설
 *   7. **봉인 제안이 뜬다** (확인일이 박힌 확정 버튼)      ← 2026-07-29 신설
 *   8. **봉인이 실제로 성사된다** (귀환 약속 문구가 뜬다)  ← 2026-07-29 신설
 *   9. 익명에게는 정직한 고지 + 로그인 유도가 함께 보인다  ← 2026-07-29 신설
 *  10. /project 에 그 결정이 도착해 있다
 *  11. 지우기가 오류 없이 끝나고, 서버 사본도 지운다고 말한다 (뒷정리 겸용)
 *
 * ── 두 모드 ─────────────────────────────────────────────────────────────
 *   anon(기본)  : 위 전부. 마지막 초기화가 이 실행이 만든 익명 항해를 스스로 치운다.
 *   signed-in   : 로그인해서 같은 길을 걷되 **봉인 직전에 멈춘다.**
 *                 이유: 프로젝트를 지우는 UI 가 없어서, 봉인하면 매 실행마다
 *                 도그푸드 계정에 결정이 하나씩 쌓이고 확인일마다 메일이 간다.
 *                 대신 로그인 상태에서만 달라지는 것을 판정한다 —
 *                 봉인 버튼이 확인일과 함께 떠 있고, 익명용 "이 브라우저에
 *                 묶여 있어요" 고지는 **없어야** 한다. 봉인 성사 자체는 익명
 *                 경로가 매번 실제로 검증한다(같은 코드 경로다).
 *
 * 비용: LLM 호출이 여러 번 있다. 매 PR 이 아니라 main push / 수동 실행용.
 *
 * 사용법:
 *   ARGUS_BASE_URL=https://argus.voyage node scripts/e2e/decision-loop.mjs
 *   E2E_MODE=signed-in DOGFOOD_EMAIL=... DOGFOOD_PASSWORD=... node scripts/e2e/decision-loop.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const BASE = (process.env.ARGUS_BASE_URL ?? 'https://argus.voyage').replace(/\/$/, '');
const LOCALE = process.env.ARGUS_LOCALE ?? 'ko';
const MODE = process.env.E2E_MODE === 'signed-in' ? 'signed-in' : 'anon';
// E2E_VIEWPORT=mobile → 폰 화면(390×844)으로 같은 여정 (2026-07-30).
const MOBILE = process.env.E2E_VIEWPORT === 'mobile';
const SHOT_DIR = process.env.E2E_SHOT_DIR ?? path.join('scripts', 'e2e', 'shots', MOBILE ? `${MODE}-mobile` : MODE);
/** 분석 도착까지 (긴 쪽). */
const ANALYSIS_TIMEOUT_MS = Number(process.env.ANALYSIS_TIMEOUT_MS ?? 210_000);
/** 분석 이후 봉인까지의 전체 예산. 넉넉히 — 여기서 시간이 모자라 빨간불이 뜨면 거짓 빨간불이다. */
const MARCH_BUDGET_MS = Number(process.env.MARCH_BUDGET_MS ?? 600_000);
/** 질문에 몇 개까지 실제로 답할지. 그 뒤엔 "그만 묻고 초안" 탈출구를 쓴다. */
const MAX_ANSWERS = Number(process.env.MAX_ANSWERS ?? 3);

const DECISION = '다음 분기에 신규 채용을 2명 더 할지, 지금 인원으로 버틸지 정해야 한다.';
const LEAN = '지금은 채용을 미루는 쪽으로 기운다.';
const ANSWER = '지금 팀은 5명이고, 다음 분기 매출은 확정 계약 기준으로 지금과 비슷할 것 같다.';
const REAL_BET = '다음 분기 매출이 지금 수준을 유지한다.';

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
// acceptDownloads 를 명시한다 — 판단 카드 검사가 "파일이 실제로 온다"를 재는데,
// 기본값에 기대면 Playwright 버전이 바뀌는 날 조용히 검사만 사라진다.
const ctx = await browser.newContext({
  locale: `${LOCALE}-KR`,
  viewport: MOBILE ? { width: 390, height: 844 } : { width: 1400, height: 1000 },
  ...(MOBILE ? { isMobile: true, hasTouch: true, deviceScaleFactor: 3 } : {}),
  acceptDownloads: true,
});
const page = await ctx.newPage();
page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 200)));

const shot = async (label) => {
  const name = `${String(++shotN).padStart(2, '0')}-${label}.png`;
  await page.screenshot({ path: path.join(SHOT_DIR, name), fullPage: false }).catch(() => {});
};
const bodyText = () => page.evaluate(() => document.body.innerText).catch(() => '');

/**
 * 화면에 보이고 눌리는 버튼만 고른다. `getByRole` 은 숨은 것도 잡아서,
 * 접힌 서랍 안의 동명 버튼을 눌러 흐름을 엉뚱한 데로 보낸 적이 있다.
 */
async function clickable(namePattern) {
  const loc = page.getByRole('button', { name: namePattern });
  const n = await loc.count().catch(() => 0);
  for (let i = 0; i < n; i++) {
    const el = loc.nth(i);
    if (await el.isVisible().catch(() => false) && await el.isEnabled().catch(() => false)) return el;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────
// 상태 목록 — 이 검사기가 아는 화면 전부. 위에서부터 먼저 맞는 것 하나만 실행.
//
// 순서가 곧 우선순위다. 봉인이 맨 위인 이유: 봉인 화면에는 다른 버튼도 같이
// 떠 있어서(초안 다시 만들기 등) 아래 상태와 동시에 맞을 수 있는데, 여기까지
// 왔으면 목적지에 도착한 것이므로 다른 데로 새면 안 된다.
// ─────────────────────────────────────────────────────────────────────────
const STATES = [
  {
    id: 'seal_offer',
    // 봉인 종막. 목적지 — 여기서 행진을 멈춘다.
    match: async () => await clickable(/판단 기록 확정|이 원문 그대로 기록|Confirm this judgment|Save exactly as written/),
    act: async () => 'ARRIVED',
  },
  {
    id: 'falsification_finish',
    match: async () => await clickable(/이대로 정하고 마무리|Lock it in/),
    act: async (el) => { await el.click(); return 'ACTED'; },
  },
  {
    id: 'falsification_write_bet',
    // "이 계획이 정말 기대고 있는 한 가지를 당신 말로" — 사용자 소유 필드다.
    // 검사기는 AI 문장을 그대로 쓰지 않고 **직접 적는다**: 그래야 authored:'user'
    // 경로가 실제로 돈다 (척추의 F1 — 사람의 판단이 하중을 받는가).
    match: async () => {
      const box = page.locator('[placeholder*="자발적으로 공유"], [placeholder*="share unprompted"]').first();
      return (await box.count().catch(() => 0)) && await box.isVisible().catch(() => false) ? box : null;
    },
    act: async (box) => {
      await box.fill(REAL_BET);
      await page.waitForTimeout(600);
      const btn = await clickable(/이대로 정하고 마무리|Lock it in/);
      if (btn) { await btn.click(); return 'ACTED'; }
      return 'WAIT';
    },
  },
  {
    id: 'falsification_believe_all',
    match: async () => await clickable(/전부 믿겠어요|I believe all of it/),
    act: async (el) => { await el.click(); return 'ACTED'; },
  },
  {
    id: 'draft_ready',
    // 초안이 도착한 뒤의 갈림. 금색 큰 버튼은 "이해관계자 시점 검토 받기"(LLM 한 번 더)이고,
    // 조용한 링크가 마무리로 가는 길이다. 검사기는 **조용한 쪽**을 고른다:
    //   · LLM 호출을 하나 아끼고,
    //   · 그 길이 시험 단계(Falsification)를 지나므로 **사용자가 자기 말로 적는
    //     real_bet** 경로를 실제로 태운다 — 척추의 F1(사람의 판단이 하중을 받는가).
    // 큰 버튼만 누르는 검사기는 정작 제일 중요한 칸을 건너뛴다.
    match: async () => await clickable(/한 번 더 — 이 계획이 기대고 있는|Optional: name the one bet|검토 건너뛰고 이대로 완성|Skip the review & finalize/),
    act: async (el) => { await el.click(); return 'ACTED'; },
  },
  {
    id: 'test_recover',
    match: async () => await clickable(/최종 문서 다시 만들기|다시 시험하기|Regenerate the document|Run the test again/),
    act: async (el) => { await el.click(); return 'ACTED'; },
  },
  {
    id: 'mix',
    match: async () => await clickable(/이 방향으로 초안 만들기|Create the draft/),
    act: async (el) => { await el.click(); return 'ACTED'; },
  },
  {
    id: 'question',
    // 질문 카드. 답변칸의 name 으로 잡는다 — 2026-07-29 첫 실주행에서 "확인" 버튼으로
    // 잡으려다 실패했다. 그 버튼은 **글자를 입력해야 비로소 렌더된다**(객관식일 때).
    // 없는 것을 기다리면 영원히 안 온다.
    match: async () => {
      const box = page.locator('input[name="question-answer"]').first();
      if (!(await box.count().catch(() => 0))) return null;
      // enabled 까지 봐야 한다. 답을 낸 직후 카드는 `submitted` 로 잠기는데 화면에는
      // 남아 있어서, visible 만 보면 같은 질문에 두 번 답한다.
      const live = await box.isVisible().catch(() => false) && await box.isEnabled().catch(() => false);
      return live ? box : null;
    },
    act: async (box, s) => {
      if (s.answered >= MAX_ANSWERS) {
        const escape = await clickable(/그만 묻고 초안 만들기|건너뛰고 팀 투입|Stop asking|Skip & start/);
        if (escape) { await escape.click(); return 'ACTED'; }
      }
      // 두 답변 경로를 **둘 다** 태운다. 실제 사용자는 대개 보기를 고르고(go(opt)),
      // 가끔 직접 적는다(goText) — 한쪽만 검사하면 다른 쪽이 조용히 죽는다.
      const options = page.locator('[role="group"] button:visible');
      const useChoice = s.answered % 2 === 0 && (await options.count().catch(() => 0)) > 0;
      if (useChoice) {
        await options.first().click();
      } else {
        await box.fill(`${ANSWER} (${s.answered + 1})`);
        await page.waitForTimeout(400);
        const ok = await clickable(/^확인$|^OK$/);
        if (ok) await ok.click(); else await box.press('Enter');
      }
      s.answered += 1;
      return 'ACTED';
    },
  },
  {
    id: 'busy',
    // 일하는 중. 아무것도 누르지 않는다 — 여기서 조바심내며 다른 걸 누르는 게
    // 범용 워커가 길을 잃던 지점이었다.
    match: async () => {
      // **구조적 신호를 먼저 본다.** 상태 바의 취소 버튼은 "AI 가 일하는 동안 항상
      // 닿을 수 있게" 렌더되므로(phase-chrome.tsx), 그게 보이면 진행 중이라는 뜻이다.
      // 2026-07-29 첫 실주행에서 문구 목록("초안 만드는 중")으로 잡으려다 실패했다 —
      // 실제 문구는 단계마다 다르고("초안을 작성하고 있어요", "팀이 분석하고 있어요"…)
      // 목록을 쫓아다니면 문구가 하나 늘 때마다 검사기가 거짓 빨간불을 낸다.
      if (await clickable(/^취소$|^Cancel$/)) return true;
      if ((await page.locator('.animate-spin:visible').count().catch(() => 0)) > 0) return true;
      const t = await bodyText();
      return /하고 있어요|만드는 중|작성 중|분석 중|Drafting|Analyzing|Synthesizing|Thinking/.test(t) ? true : null;
    },
    act: async () => 'WAIT',
  },
];

/** 앱이 스스로 끊겼다고 말하는 화면. 상태 목록보다 먼저 본다. */
const BROKEN = /다시 시도해 주세요|막혔어요|Please try again|Hit a snag|분석에 실패/;

/**
 * 무료 한도 소진. **앱이 끊긴 것이 아니다** — 오히려 앱은 정직하게 처리했다
 * (적은 글을 그대로 두고, 다 썼다고 말하고, 로그인을 권한다).
 *
 * 이걸 빨간불로 신고하면 안 되는 이유: 검사가 못 돈 것과 앱이 고장난 것을 같은
 * 색으로 칠하면, 진짜 고장이 왔을 때 아무도 안 본다. 2026-07-29 에 이 검사기를
 * 40분간 네 번 돌려 익명 한도(IP당 하루 30콜 ≈ 결정 2~3개)를 소진하고 나서 정했다.
 *
 * 그래서 별도 종료 코드(3)로 나가고, CI 에서는 경고로만 남긴다.
 */
const QUOTA = /무료 체험을 모두 사용했어요|하루 50회까지|Free trial used up|You've used your free/;

/** 한도 소진으로 검사를 접는다. 앱 실패(1)와 다른 코드(3)로 나간다. */
function outOfQuota() {
  console.log('');
  console.log('🟡 무료 한도 소진 — 앱이 끊긴 게 아니라 이 IP 의 오늘 몫을 다 썼다.');
  console.log('   앱은 정직하게 처리했다: 적은 글을 그대로 두고, 다 썼다고 말하고, 로그인을 권한다.');
  console.log('   되돌리려면 Vercel 환경변수 ANON_DAILY_LIMIT 를 올리거나, 내일 다시 돌린다.');
  console.log(`   스크린샷: ${SHOT_DIR}`);
  process.exit(3);
}

/**
 * 봉인에 도착할 때까지 행진한다. 아는 화면에서만 움직이고, 모르면 실패한다.
 */
async function marchToSeal() {
  const s = { answered: 0 };
  const deadline = Date.now() + MARCH_BUDGET_MS;
  let idleTicks = 0;
  let busyTicks = 0;
  let lastState = '';

  while (Date.now() < deadline) {
    const text = await bodyText();
    if (QUOTA.test(text)) { await shot('quota'); outOfQuota(); }
    if (BROKEN.test(text)) {
      await shot('broken');
      return { ok: false, why: `앱이 오류를 표시했다: ${(text.match(BROKEN) ?? [''])[0]}` };
    }

    let matched = null;
    for (const st of STATES) {
      const hit = await st.match().catch(() => null);
      if (hit) { matched = { st, hit }; break; }
    }

    if (!matched) {
      idleTicks += 1;
      // 서너 틱 정도는 렌더 사이 빈 순간일 수 있다. 그 이상이면 진짜 모르는 화면이다.
      if (idleTicks >= 5) {
        await shot('unknown-state');
        return {
          ok: false,
          why: '아는 화면이 하나도 안 나온다 (흐름이 여기서 끊겼거나, 화면이 바뀌었는데 '
            + 'STATES 목록을 안 고쳤다). 아래는 그 화면의 글이다.',
          dump: text.slice(0, 1200),
        };
      }
      await page.waitForTimeout(4000);
      continue;
    }
    idleTicks = 0;

    if (matched.st.id !== lastState) {
      console.log(`   → ${matched.st.id}`);
      lastState = matched.st.id;
      await shot(matched.st.id);
    }

    // 'busy' 에 눌러앉는 것을 실패로 본다. 2026-07-29 실주행에서 흐름은 이미
    // 끝났는데(완성된 문서까지 떴는데) 화면 어딘가의 스피너 때문에 계속 busy 로
    // 읽혀 600초를 조용히 태우고 "시간 초과"라고만 신고했다. 그건 사실이지만
    // 쓸모가 없다 — 진짜 사실은 "봉인 화면이 안 떴다"였고, 화면 글을 뱉었으면
    // 1분 만에 알 수 있었다. 초안 생성이 오래 걸리므로 넉넉히 4분을 준다.
    busyTicks = matched.st.id === 'busy' ? busyTicks + 1 : 0;
    if (busyTicks >= 40) {
      await shot('stuck-busy');
      return {
        ok: false,
        why: '4분 넘게 "일하는 중"으로만 읽힌다. 진짜 작업 중일 수도 있지만, 흐름은 끝났는데 '
          + '스피너가 남아 그렇게 보이는 경우가 있었다 (실측). 아래는 그때 화면이다.',
        dump: (await bodyText()).slice(0, 1200),
      };
    }

    const outcome = await matched.st.act(matched.hit, s);
    if (outcome === 'ARRIVED') return { ok: true, answered: s.answered };
    await page.waitForTimeout(outcome === 'WAIT' ? 6000 : 4000);
  }
  await shot('march-timeout');
  return { ok: false, why: `${Math.round(MARCH_BUDGET_MS / 1000)}초 안에 봉인 화면까지 못 갔다 (마지막 상태: ${lastState || '없음'})` };
}

try {
  // ── 0. signed-in 모드면 먼저 로그인 ──────────────────────────────────
  if (MODE === 'signed-in') {
    const email = process.env.DOGFOOD_EMAIL;
    const password = process.env.DOGFOOD_PASSWORD;
    if (!email || !password) {
      console.error('E2E_MODE=signed-in 인데 DOGFOOD_EMAIL / DOGFOOD_PASSWORD 가 없다.');
      process.exit(2);
    }
    await page.goto(`${BASE}/${LOCALE}/login`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(3000);
    const emailField = page.locator('input[type=email]').first();
    const pwField = page.locator('input[type=password]').first();
    const hasForm = (await emailField.count()) > 0 && (await pwField.count()) > 0;
    step('0. 이메일·비밀번호 로그인 폼이 실제로 있다', hasForm,
      hasForm ? '' : 'Google 버튼만 있고 이메일 가입 경로가 없다');
    if (!hasForm) throw new Error('로그인 폼 없음');
    await emailField.fill(email);
    await pwField.fill(password);
    await page.locator('button:has-text("로그인"), button:has-text("Log in"), button:has-text("Sign in"), button[type=submit]').first()
      .click({ timeout: 8000 }).catch(() => page.keyboard.press('Enter'));
    await page.waitForTimeout(9000);
    await shot('after-login');
    const stillLogin = /\/login/.test(page.url());
    step('0b. 로그인이 성사된다', !stillLogin, stillLogin ? '로그인 페이지에 그대로 머문다' : '');
    if (stillLogin) throw new Error('로그인 실패');
  }

  // ── 1. 본선이 열린다 ─────────────────────────────────────────────────
  await page.goto(`${BASE}/${LOCALE}/workspace`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(4000);
  await shot('workspace');
  const hasInput = (await page.locator('textarea').count()) > 0;
  const walled = /로그인이 필요해요|need an account/.test(await bodyText());
  step('1. /workspace 가 열리고 입력칸이 있다', hasInput && !walled,
    hasInput ? (walled ? '로그인 벽이 생겼다' : '') : 'textarea 없음');
  if (!hasInput || walled) throw new Error('본선 입구가 막혔다');

  // ── 2. 상황을 적고 시작 → 기준점 단계 ────────────────────────────────
  await page.locator('textarea').first().fill(DECISION);
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: '시작' }).first().click();
  await page.waitForTimeout(9000);
  await shot('baseline');
  const baselineText = await bodyText();
  const sawBaseline = /검토 전 기준점|기준점 남기고/.test(baselineText);
  step('2. 시작하면 검토 전 기준점 단계가 온다', sawBaseline, sawBaseline ? '' : '기준점 화면이 안 나옴');

  // ── 3. 기준점을 남기고 계속 → 분석 도착 ──────────────────────────────
  const lean = page.locator('textarea');
  if (await lean.count()) await lean.last().fill(LEAN);
  await page.getByRole('button', { name: /기준점 남기고 계속/ }).first().click().catch(() => {});

  let analysisArrived = false;
  const deadline = Date.now() + ANALYSIS_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await page.waitForTimeout(6000);
    const t = await bodyText();
    if (QUOTA.test(t)) { await shot('quota'); outOfQuota(); }
    // 분석 도착 판정은 **질문 카드가 실제로 있는지**까지 본다. 문구만 보면
    // 한도 소진 화면처럼 흐름이 되감긴 경우에도 초록이 뜬다 (2026-07-29 실측).
    const hasCard = (await page.locator('input[name="question-answer"]').count().catch(() => 0)) > 0;
    if (hasCard || /지금 풀어야 할 질문|확인할 가정|Argus가 찾은/.test(t)) { analysisArrived = true; break; }
    if (BROKEN.test(t)) break;
  }
  await shot('analysis');
  step('3. 분석이 도착한다', analysisArrived,
    analysisArrived ? '' : `${Math.round(ANALYSIS_TIMEOUT_MS / 1000)}초 안에 분석이 안 옴`);
  if (!analysisArrived) throw new Error('분석 미도착');

  // ── 4. 내가 적은 원문이 살아 있다 ────────────────────────────────────
  const kept = (await bodyText()).includes(DECISION.slice(0, 24));
  step('4. 내가 적은 원문이 분석 화면에도 남아 있다', kept, kept ? '' : '원문이 사라졌다');

  // ── 5. 서버 신원 ─────────────────────────────────────────────────────
  let identity = null;
  for (let i = 0; i < 10 && !identity; i++) {
    identity = await page.evaluate(() => {
      for (const k of Object.keys(localStorage)) {
        if (k.includes('auth-token')) {
          try { const v = JSON.parse(localStorage.getItem(k)); if (v?.user?.id) return { id: v.user.id, anon: !!v.user.is_anonymous }; } catch { /* ignore */ }
        }
      }
      return null;
    });
    if (!identity) await page.waitForTimeout(5000);
  }
  if (MODE === 'anon') {
    step('5. 익명 서버 신원이 발급된다', !!identity?.id && identity.anon === true,
      identity ? `id=${String(identity.id).slice(0, 8)}… anon=${identity.anon}` : '신원 미발급 — 익명 작업이 서버에 안 닿는다');
  } else {
    step('5. 로그인 신원이 익명이 아니다', !!identity?.id && identity.anon === false,
      identity ? `id=${String(identity.id).slice(0, 8)}… anon=${identity.anon}` : '신원 없음');
  }

  // ── 6. 봉인까지 행진 ─────────────────────────────────────────────────
  console.log('\n▶ 봉인까지 행진 (아는 화면에서만 움직인다)');
  const march = await marchToSeal();
  step('6. 질문 → 초안 → 시험을 지나 최종 문서까지 간다', march.ok,
    march.ok ? `질문 ${march.answered}개에 답함` : march.why);
  if (!march.ok) {
    if (march.dump) console.error(`\n── 멈춘 화면 ──\n${march.dump}\n──────────────`);
    throw new Error('봉인까지 못 감');
  }

  // ── 7. 봉인 제안의 모양 ──────────────────────────────────────────────
  await shot('seal-offer');
  const offerText = await bodyText();
  // 확인일이 실제로 박혀 있어야 한다. 날짜 없는 "확정"은 귀환 약속이 아니다.
  const hasDate = /확정 · .*에 확인|check on /.test(offerText);
  const isWitness = /이 원문 그대로 기록|Save exactly as written/.test(offerText);
  step('7. 봉인 제안에 확인일이 박혀 있다', hasDate || isWitness,
    isWitness ? '증인 모드(확인일 없는 기록)로 떴다' : (hasDate ? '' : '확정 버튼에 날짜가 없다'));

  // ── 7b. 봉인 전 확인 표면 — 추적될 전제를 보고 뺄 수 있다 (2026-07-30) ──
  // 서랍을 열어 "확인일에 함께 볼 전제" 목록을 확인하고, 하나를 ×로 뺀 뒤
  // 그 문장을 기억해 둔다. 봉인 후 /project 추적 목록에 **그 문장이 없어야**
  // deny 배선이 산 것이다 — 화면에서 사라지는 것만 보면 절반이다.
  let deniedPremise = '';
  let editedSentence = '';
  {
    const drawerBtn = await clickable(/돌아올 때·함께 볼 항목 설정|함께 보관할 항목 보기|Set the return|See what will be kept/);
    if (drawerBtn) { await drawerBtn.click(); await page.waitForTimeout(1200); }
    const removeBtns = page.getByRole('button', { name: /이 전제 추적하지 않기|do not track this premise/ });
    const nPremises = await removeBtns.count().catch(() => 0);
    await shot('seal-drawer');
    if (nPremises === 0) {
      // 이번 실행의 분석이 술어와 겹치지 않는 가정을 안 냈을 수 있다 — 그건 앱
      // 고장이 아니므로 빨간불이 아니다. 다만 조용히 초록으로 두지 않고 말한다.
      console.log('   🟡 7b. 이번 실행에는 술어 밖 추적 전제가 없어 deny 배선을 못 쟀다 (앱 고장 아님)');
    } else {
      const firstItem = removeBtns.first();
      deniedPremise = (await firstItem.locator('xpath=../span[1]').innerText().catch(() => '')).split('\n')[0].trim();
      if (!deniedPremise) {
        // 형제 span 을 못 읽으면 li 전체에서 추출
        deniedPremise = (await firstItem.locator('xpath=..').innerText().catch(() => '')).split('\n')[0].replace(/×$/, '').trim();
      }
      await firstItem.click();
      await page.waitForTimeout(800);
      // 두 번 틀리고 배운 단정 (2026-07-30):
      //   1차: 개수 감소 → 풀이 캡(5)보다 크면 다음 후보가 들어와 개수 유지 (정상 동작)
      //   2차: 페이지 전체에서 문장 부재 → 같은 화면의 **완성 문서 본문**에 비슷한
      //        문장이 살아 있어 거짓 빨간불
      // 그래서 **서랍 목록 항목들만** 읽는다 — 재는 사실은 "뺀 그 문장이 이
      // 목록에서 사라졌는가" 하나다.
      const listedNow = await page
        .locator('li', { has: page.getByRole('button', { name: /이 전제 추적하지 않기|do not track this premise/ }) })
        .allInnerTexts().catch(() => []);
      const key7b = deniedPremise.slice(0, 16);
      const gone = key7b.length >= 8 && !listedNow.some((t) => t.includes(key7b));
      step('7b. 봉인 서랍에서 추적 전제를 ×로 뺄 수 있다', gone,
        gone ? `뺀 문장: "${deniedPremise.slice(0, 30)}…"` : `뺀 문장이 목록에 그대로 있다: "${key7b}…"`);

      // ── 7c. 종이 봉인 순간에 보인다 (2026-07-30 — 숨은 opt-in → 보이는 opt-out)
      // 실측 22건 중 켜진 종 0건의 원인은 스위치가 /project 에 숨어 있던 것.
      // 이제 서랍의 premise 줄마다 종이 기본 켬으로 보여야 한다.
      const bellsOn = await page.getByRole('button', { name: /이 전제 알림 끄기|mute alerts for this premise/ }).count().catch(() => 0);
      step('7c. 추적 전제의 종이 기본 켬으로 보인다', bellsOn >= 1,
        bellsOn >= 1 ? `켜진 종 ${bellsOn}개` : '서랍에 종이 없다 — 서버 감시가 또 숨었다');

      // ── 7d. 인라인 수정 — 고쳐 쓰면 그 자리에서 내 문장이 된다 (2026-07-30)
      const EDITED_SENTENCE = '수정 검증용 전제다. 이 문장은 실주행이 서랍에서 고쳐 썼다.';
      const editBtns = page.getByRole('button', { name: /이 전제 고쳐 쓰기|rewrite this premise/ });
      const nEditable = await editBtns.count().catch(() => 0);
      if (nEditable === 0) {
        console.log('   🟡 7d. 고쳐 쓸 전제 행이 없어 인라인 수정을 못 쟀다');
      } else {
        await editBtns.first().click();
        const editInput = page.getByRole('textbox', { name: /전제 문장 고쳐 쓰기|rewrite this premise/ });
        await editInput.fill(EDITED_SENTENCE);
        await editInput.press('Enter');
        await page.waitForTimeout(600);
        const rows = await page
          .locator('li', { has: page.getByRole('button', { name: /이 전제 추적하지 않기|do not track this premise/ }) })
          .allInnerTexts().catch(() => []);
        const shown = rows.some((t) => t.includes('수정 검증용 전제다') && /내 문장으로 기록|recorded as your words/.test(t));
        step('7d. 서랍에서 전제를 고쳐 쓰면 내 문장으로 표시된다', shown,
          shown ? '' : `고친 문장이 행에 안 보인다: ${rows.map((r) => r.slice(0, 24)).join(' | ')}`);
        if (shown) editedSentence = EDITED_SENTENCE;
      }
    }
  }

  if (MODE === 'signed-in') {
    // 로그인 상태에서만 달라지는 것: 익명용 고지가 없어야 한다.
    const anonNotice = /이 브라우저에 묶여 있어요|tied to this browser/.test(offerText);
    step('8. 로그인 사용자에겐 "이 브라우저에 묶여 있어요" 고지가 안 뜬다', !anonNotice,
      anonNotice ? '로그인했는데 익명 고지가 뜬다' : '');
    // 봉인은 하지 않는다 — 지우는 UI 가 없어 매 실행마다 결정이 쌓인다.
    console.log('\n(signed-in 모드는 여기서 멈춘다 — 봉인 성사는 익명 경로가 매번 검증한다)');
  } else {
    // ── 8. 봉인 성사 ───────────────────────────────────────────────────
    const sealBtn = await clickable(/판단 기록 확정|이 원문 그대로 기록|Confirm this judgment|Save exactly as written/);
    await sealBtn.click();
    await page.waitForTimeout(9000);
    await shot('sealed');
    const sealedText = await bodyText();
    const sealed = /그날 프로젝트 페이지에서 제가 먼저 물어볼게요|다시 묻거나 알림을 만들지 않습니다|bring it up first on the project page|No reminder or follow-up was created/.test(sealedText);
    step('8. 봉인이 실제로 성사된다', sealed, sealed ? '' : '봉인 후 확인 문구가 안 뜬다');

    // ── 8b. 봉인이 저장한 전제에 종이 실제로 켜져 있다 (2026-07-30) ──────
    // 화면(7c)이 보여준 것과 저장소가 같은 사실이어야 한다 — UI 멀쩡 ≠ 데이터 도착.
    const bellStored = await page.evaluate(() => {
      try {
        const raw = localStorage.getItem('sot_decision_items');
        if (!raw) return { n: 0, on: 0 };
        const items = JSON.parse(raw);
        const list = Array.isArray(items) ? items : Object.values(items).flat();
        const premises = list.filter((i) => i && i.type === 'premise' && i.status === 'active');
        return { n: premises.length, on: premises.filter((i) => i.external === true && i.alert && i.alert.mode === 'on_change').length };
      } catch { return { n: -1, on: -1 }; }
    });
    if (bellStored.n === 0) {
      console.log('   🟡 8b. 이번 실행엔 자동 추적 전제가 저장되지 않아 종 상태를 못 쟀다 (7b가 노랑이었으면 정상)');
    } else {
      step('8b. 저장된 추적 전제에 종(external+on_change)이 켜져 있다', bellStored.on >= 1,
        `전제 ${bellStored.n}건 중 종 켜짐 ${bellStored.on}건`);
    }

    // ── 8c. 고쳐 쓴 전제가 이력째로 저장됐다 (2026-07-30) ─────────────────
    // 화면(7d)의 "내 문장으로 기록"이 장식이 아니려면 저장소에 (a) 고친 문장
    // (b) ai_edited_by_user 승격 (c) 지워지지 않은 원문(edits.from)이 있어야 한다.
    if (editedSentence) {
      const editedStored = await page.evaluate((sentence) => {
        try {
          const raw = localStorage.getItem('sot_decision_items');
          if (!raw) return null;
          const items = JSON.parse(raw);
          const list = Array.isArray(items) ? items : Object.values(items).flat();
          const hit = list.find((i) => i && i.text === sentence);
          if (!hit) return null;
          return { authored: hit.authored, from: hit.edits?.[0]?.from ?? '', edits: (hit.edits ?? []).length };
        } catch { return null; }
      }, editedSentence);
      const ok = !!editedStored && editedStored.authored === 'ai_edited_by_user'
        && editedStored.edits >= 1 && editedStored.from.length > 0 && editedStored.from !== editedSentence;
      step('8c. 고쳐 쓴 전제가 이력째로 저장됐다 (원문 보존 + 내 문장 승격)', ok,
        ok ? `원문: "${editedStored.from.slice(0, 24)}…"` : `저장 상태: ${JSON.stringify(editedStored)}`);
    }

    // ── 9. 익명에게 정직한 고지 + 로그인 유도 ──────────────────────────
    // 여기가 그 사람이 처음으로 "지킬 가치가 있는 것"을 손에 쥔 순간이다.
    // 고지 없이 유도만 하면 압박이고, 유도 없이 고지만 하면 막다른 길이다. 둘 다 있어야 한다.
    const honest = /이 브라우저에 묶여 있어요|tied to this browser/.test(sealedText);
    const nudge = /로그인하고 어디서나 이어보기|Sign in to keep this everywhere/.test(sealedText);
    const emailPath = /이메일 남기고|이메일로 가입하기|Leave an email|Sign up with email/.test(sealedText);
    step('9. 익명에게 정직한 고지 + 로그인 유도 + 이메일 가입 경로가 함께 있다',
      honest && nudge && emailPath,
      [honest ? null : '고지 없음', nudge ? null : '로그인 유도 없음', emailPath ? null : '이메일 가입 경로 없음'].filter(Boolean).join(', '));

    // ── 9b. 판단 카드가 실제로 내려온다 ────────────────────────────────
    // "버튼이 있다"가 아니라 "파일이 온다"까지 본다. 캔버스 렌더는 브라우저에서만
    // 도는 코드라 단위 테스트가 닿지 않는 자리다 — 여기서 안 보면 아무도 안 본다.
    const cardBtn = await clickable(/이미지로 저장|Save as image/);
    if (!cardBtn) {
      step('9b. 판단 카드를 이미지로 내려받을 수 있다', false, '버튼이 없다 (봉인 문장이 비어 카드가 안 만들어졌을 수 있다)');
    } else {
      const dl = await Promise.all([
        page.waitForEvent('download', { timeout: 20_000 }).catch(() => null),
        cardBtn.click(),
      ]).then((r) => r[0]);
      const fname = dl?.suggestedFilename() ?? '';
      let bytes = 0;
      if (dl) {
        const p = path.join(SHOT_DIR, fname || 'card.png');
        await dl.saveAs(p).catch(() => {});
        bytes = fs.existsSync(p) ? fs.statSync(p).size : 0;
      }
      // 0바이트도 "내려받았다"로 통과하면 안 된다 — 빈 카드가 정확히 그 모양이다.
      step('9b. 판단 카드를 이미지로 내려받을 수 있다', !!dl && /\.png$/.test(fname) && bytes > 5000,
        dl ? `${fname} · ${bytes}B` : '다운로드가 시작되지 않음');
    }

    // ── 9c/9d. 익명이 공개 링크를 만들고, 그 링크가 남에게 열린다 ──────
    // 만드는 것까지만 보면 반쪽이다. **로그아웃·빈 저장소인 새 브라우저**로 열어야
    // "누구나 열 수 있다"가 사실인지 알 수 있다. 우리 세션이 살아 있는 창에서
    // 열리는 것은 아무것도 증명하지 않는다.
    const sendBtn = await clickable(/^보내기$|^Send$/);
    if (!sendBtn) {
      step('9c. 익명이 공개 링크를 만든다', false, '"보내기" 버튼을 못 찾음');
    } else {
      await sendBtn.click();
      await page.waitForTimeout(2500);
      const linkTab = await clickable(/^링크$|^Link$/);
      if (linkTab) await linkTab.click();
      await page.waitForTimeout(1200);
      const makeBtn = await clickable(/공개 링크 만들기|Create public link/);
      if (!makeBtn) {
        await shot('share-no-button');
        step('9c. 익명이 공개 링크를 만든다', false, '익명에게 링크 만들기 버튼이 안 보인다');
      } else {
        await makeBtn.click();
        await page.waitForTimeout(7000);
        await shot('share-link');
        const url = await page.locator('input[readonly]').first().inputValue().catch(() => '');
        const minted = /\/d\/[A-Za-z0-9_-]{8,}/.test(url);
        step('9c. 익명이 공개 링크를 만든다', minted, minted ? url : `링크가 안 만들어짐 (읽은 값: ${url || '없음'})`);

        if (minted) {
          const fresh = await browser.newContext({ locale: `${LOCALE}-KR` });
          const fp = await fresh.newPage();
          let opened = false;
          let why = '';
          try {
            const res = await fp.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
            await fp.waitForTimeout(3500);
            const t = await fp.evaluate(() => document.body.innerText).catch(() => '');
            const walled = /로그인이 필요해요|need an account/.test(t);
            const missing = /찾을 수 없|not found|404/i.test(t);
            opened = res?.status() === 200 && !walled && !missing && t.length > 200;
            why = walled ? '로그인 벽' : missing ? '404' : `HTTP ${res?.status()} · 본문 ${t.length}자`;
            await fp.screenshot({ path: path.join(SHOT_DIR, '99-shared-link-fresh-browser.png') }).catch(() => {});
          } catch (e) { why = String(e).split('\n')[0]; }
          await fresh.close();
          step('9d. 그 링크가 로그아웃·빈 저장소인 새 브라우저에서 열린다', opened, opened ? '' : why);
        }
      }
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(800);
    }
  }

  // ── 10. 귀환이 도착할 자리 ───────────────────────────────────────────
  await page.goto(`${BASE}/${LOCALE}/project`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(6000);
  await shot('project');
  const projectText = await bodyText();
  const projectWalled = /로그인이 필요해요|need an account/.test(projectText);
  const visible = projectText.includes(DECISION.slice(0, 18));
  step('10. /project 가 열리고 그 결정이 보인다', !projectWalled && visible,
    projectWalled ? '로그인 벽' : (visible ? '' : '결정이 목록에 없다'));

  // ── 10b. deny 가 저장까지 막았다 ─────────────────────────────────────
  // 서랍에서 ×로 뺀 문장이 /project 추적 목록에도 없어야 한다. 2026-07-30 전에는
  // 화면에서만 사라지고 저장소에는 active 로 남았다 — 그 회귀를 여기서 막는다.
  if (MODE === 'anon' && deniedPremise) {
    const key = deniedPremise.slice(0, 16);
    const leaked = key.length >= 8 && projectText.includes(key);
    step('10b. ×로 뺀 전제가 추적 목록에 저장되지 않았다', !leaked,
      leaked ? `뺀 문장이 /project 에 살아 있다: "${key}…"` : '');
  }

  // ── 11. 뒷정리 = 삭제 경로 검사 (익명 전용) ──────────────────────────
  if (MODE === 'anon') {
    await page.goto(`${BASE}/${LOCALE}/settings`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(4000);
    await page.getByRole('button', { name: /초기화|계정 삭제/ }).first().click();
    await page.waitForTimeout(1500);
    const modalText = await bodyText();
    const saysServer = /서버 사본|server copy/.test(modalText);
    await page.getByRole('button', { name: '삭제', exact: true }).last().click();
    await page.waitForTimeout(12000);
    await shot('after-reset');

    // 무엇을 판정할지는 두 번 틀리고 나서 정했다.
    //   1차: auth 토큰이 사라졌는가 → 서버 신원이 지워진 뒤에도 클라이언트가
    //        죽은 토큰 껍데기를 남겨 **거짓 빨간불**.
    //   2차: /project 에서 사라졌는가 → 익명의 /project 는 localStorage 가 아니라
    //        **서버에서** 읽고, 리다이렉트와 경합해 흔들렸다.
    // 그래서 흔들리지 않는 둘만 본다. 서버가 실제로 비는지는 2026-07-29 에 DB 로
    // 확인했고 인계 문서 §7-B 에 있다.
    const afterReset = await bodyText();
    const errored = /지우지 못했어요|삭제에 실패|could not be deleted|Deletion failed/.test(afterReset);
    step('11. 지우기가 오류 없이 끝난다', !errored, errored ? '삭제 실패 토스트가 떴다' : '');
    step('11b. 익명에게도 서버 사본을 지운다고 말한다', saysServer,
      saysServer ? '' : '모달이 브라우저만 지운다고 말한다 (서버 사본은 남는데)');
  }
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
  console.error(`\n🔴 결정 루프(${MODE})가 끊겼다 — ${failures.length}건:`);
  for (const f of failures) console.error(`  · ${f}`);
  process.exit(1);
}
console.log(
  MODE === 'anon'
    ? `\n🟢 익명 방문자가 봉인까지 완주한다 (${steps.length}단계).`
    : `\n🟢 로그인 사용자가 봉인 제안까지 도달한다 (${steps.length}단계, 봉인 성사는 익명 경로가 검증).`,
);
process.exit(0);
