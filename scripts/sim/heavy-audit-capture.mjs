/**
 * HEAVY-PATH production capture audit — https://www.argus.voyage
 * HEADED chromium (headless freezes framer-motion — docs/HANDOFF-2026-07-31 §6).
 * Fresh anonymous context. Usage: node heavy-audit-capture.mjs desktop|mobile
 *
 * PNGs → C:/Users/admin/.claude/jobs/7f50b73d/tmp/heavy-audit/  (d- / m- prefix)
 * Per-screen audit JSON lines to stdout.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const MODE = process.argv[2] === 'mobile' ? 'mobile' : 'desktop';
const P = MODE === 'mobile' ? 'm' : 'd';
const OUT = 'C:/Users/admin/.claude/jobs/7f50b73d/tmp/heavy-audit';
fs.mkdirSync(OUT, { recursive: true });

const t0 = Date.now();
const log = (...a) => console.log(`[${P}+${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

const OPENER = '스타트업에서 이직 오퍼를 받았어. 연봉은 40% 올려준대. 지금 회사는 3년차인데 고민돼';
const FREE_ANSWERS = [
  '연봉보다 지금 회사에서 성장이 정체된 느낌이 큰 게 진짜 이유야. 새 회사는 시리즈 B라 기회는 있어 보여',
  '지금 팀 사람들과는 잘 맞는 편인데, 옮기는 곳 문화는 잘 몰라',
  '6개월 안에 후회하지 않을 자신은 반반 정도야',
  '조건은 서면으로 받은 상태고, 답은 다음 주까지 줘야 해',
];

const NAMES_RE = '규민|다은|현우|서연|혜연|민서|수진|하윤|도윤|정민|승현';

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext(
  MODE === 'mobile'
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'ko-KR' }
    : { viewport: { width: 1280, height: 900 }, locale: 'ko-KR' },
);
const page = await context.newPage();
page.on('console', (m) => { if (m.type() === 'error') log('console.error:', m.text().slice(0, 250)); });
page.on('pageerror', (e) => log('pageerror:', String(e).slice(0, 250)));

const shot = async (name) => { await page.screenshot({ path: `${OUT}/${P}-${name}` }); log('shot', `${P}-${name}`); };
const bodyText = () => page.evaluate(() => document.body.innerText);

/** Full per-screen audit — returns one JSON blob. */
async function audit(label) {
  const r = await page.evaluate((namesRe) => {
    const doc = document.documentElement;
    const txt = document.body.innerText;
    const qInput = document.querySelector('input[name="question-answer"]');
    let qVisible = null, qRect = null;
    if (qInput) {
      const sec = qInput.closest('section') || qInput;
      const b = sec.getBoundingClientRect();
      qRect = { top: Math.round(b.top), bottom: Math.round(b.bottom), vh: window.innerHeight };
      qVisible = b.top >= -4 && b.top < window.innerHeight - 80; // question head reachable without scroll
    }
    // phase bands
    const bands = ['짚어보기', '작성', '확인'].map((b) => txt.includes(b));
    // toggle
    const toggleEls = [...document.querySelectorAll('button, span')].filter((e) => e.childElementCount < 4 && /근거와 계획 보기/.test(e.textContent || ''));
    const hasToggle = txt.includes('근거와 계획 보기');
    const hasCounts = /계획 \d+단계|확인할 가정 \d+개/.test(txt);
    // emoji scan (exclude compass letters etc.) — grab context
    const emojiMatches = [];
    const re = /\p{Extended_Pictographic}/gu;
    let mm;
    while ((mm = re.exec(txt)) && emojiMatches.length < 8) {
      emojiMatches.push(txt.slice(Math.max(0, mm.index - 18), mm.index + 20).replace(/\n/g, '⏎'));
    }
    // korean personal names
    const nameRe = new RegExp(namesRe, 'g');
    const nameHits = [];
    let nm;
    while ((nm = nameRe.exec(txt)) && nameHits.length < 8) {
      nameHits.push(txt.slice(Math.max(0, nm.index - 15), nm.index + 18).replace(/\n/g, '⏎'));
    }
    // functional reviewer labels
    const labels = {};
    for (const l of ['전문 검토', '근거 확인', '위험 검토', '종합 정리']) labels[l] = (txt.match(new RegExp(l, 'g')) || []).length;
    return {
      hscroll: doc.scrollWidth - doc.clientWidth,
      scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth,
      scrollY: Math.round(window.scrollY),
      qVisible, qRect,
      bands: { 짚어보기: bands[0], 작성: bands[1], 확인: bands[2] },
      toggle: { present: hasToggle, counts: hasCounts, n: toggleEls.length },
      draftWord: txt.includes('초안'),
      emojiMatches, nameHits, labels,
      reflectBar: txt.includes('방금 답변을 반영하고 있어요'),
      reflectPill: txt.includes('방금 답변 반영 중'),
      freshClaim: txt.includes('현재까지의 내용으로 잡은 방향'),
      reflectedN: (txt.match(/(\d+)개 답변 반영/) || [])[1] ?? null,
    };
  }, NAMES_RE);
  log(`AUDIT[${label}]`, JSON.stringify(r));
  return r;
}

async function dumpText(label, n = 2600) {
  const txt = await bodyText();
  log(`TEXT[${label}] ---`);
  console.log(txt.slice(0, n));
  log(`--- end TEXT[${label}]`);
}

/** One state read for the driver loop. */
const readState = () => page.evaluate(() => {
  const txt = document.body.innerText;
  const btn = (t, exact) => [...document.querySelectorAll('button')].some((b) => {
    const s = b.innerText.trim().replace(/\s+/g, ' ');
    return exact ? s === t : s.includes(t);
  });
  const qi = document.querySelector('input[name="question-answer"]');
  return {
    lightTa: !!document.querySelector('textarea[placeholder="한 줄이면 돼요"]'),
    heavy: txt.includes('Argus가 찾은 진짜 질문'),
    question: !!qi && !qi.disabled,
    framingConfirm: txt.includes('이 방향으로 정리할까요?'),
    reviewStart: btn('검토 시작'),
    prepSummary: btn('이 방향으로 정리하기'),
    verifyGate: btn('정리하기', true) || btn('확인 없이 모두 반영하고 정리하기'),
    mixDone: txt.includes('정리 끝났어요'),
    mixing: txt.includes('정리하고 있어요'),
    synthesizing: txt.includes('검토 결과를 종합하고 있어요'),
    teamWorking: txt.includes('팀이 분석하고 있어요'),
    loginWall: (txt.includes('로그인하면 하루') || txt.includes('로그인이 잠시 풀렸어요') || txt.includes('Log in to keep using')),
    crisis: txt.includes('전문가와') && txt.includes('상담'),
    errorish: txt.includes('다시 시도') && !txt.includes('복사 실패'),
    reflecting: txt.includes('방금 답변을 반영하고 있어요') || txt.includes('방금 답변 반영 중'),
  };
});

async function answerQuestion(idx) {
  // Prefer free text for rounds 0..3; if an option-only card, click option 1.
  const text = FREE_ANSWERS[Math.min(idx, FREE_ANSWERS.length - 1)];
  const input = page.locator('input[name="question-answer"]');
  await input.fill(text);
  await page.keyboard.press('Enter');
  log(`answered Q${idx + 1} (free text):`, text);
}

async function failDump(err) {
  log('FAILURE:', err && err.message ? err.message : err);
  try { await shot('99-failure.png'); } catch {}
  try { console.log((await bodyText()).slice(0, 3000)); } catch {}
}

try {
  // ── 1. entry ──
  await page.goto('https://www.argus.voyage/ko/workspace', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#workspace-decision-input', { timeout: 60000 });
  await page.waitForTimeout(2200);
  await shot('01-entry.png');
  await audit('entry');

  // ── 2. submit → loading ──
  await page.fill('#workspace-decision-input', OPENER);
  const tSubmit = Date.now();
  await page.press('#workspace-decision-input', 'Enter');
  log('submitted opener');
  await page.waitForTimeout(2500);
  await shot('02-loading.png');
  await audit('loading');

  // ── 3. route gate ──
  const routed = await page.waitForFunction(() => {
    if (document.body.innerText.includes('Argus가 찾은 진짜 질문')) return 'heavy';
    if (document.querySelector('textarea[placeholder="한 줄이면 돼요"]')) return 'light';
    return false;
  }, null, { timeout: 120000, polling: 500 }).then((h) => h.jsonValue());
  log(`ROUTED: ${routed} after ${((Date.now() - tSubmit) / 1000).toFixed(1)}s`);
  if (routed !== 'heavy') {
    await page.waitForTimeout(1500);
    await shot('03-LIGHT-ROUTE.png');
    await dumpText('light-route');
    throw new Error('routed LIGHT instead of heavy — captured as finding');
  }

  // wait for first question or framing confirm to settle
  await page.waitForFunction(() => {
    const qi = document.querySelector('input[name="question-answer"]');
    return (qi && !qi.disabled) || document.body.innerText.includes('이 방향으로 정리할까요?');
  }, null, { timeout: 120000, polling: 500 });
  await page.waitForTimeout(1800);
  await shot('03-analysis.png');
  await audit('analysis-v0');
  await dumpText('analysis-v0');

  // expanded-analysis capture (근거와 계획 보기), if present
  const toggle = page.locator('button', { hasText: '근거와 계획 보기' }).first();
  if (await toggle.count()) {
    try {
      await toggle.click({ timeout: 3000 });
      await page.waitForTimeout(900);
      await shot('03b-analysis-detail.png');
      const expanded = await page.evaluate(() => {
        const txt = document.body.innerText;
        return { steps: txt.includes('단계'), assumptions: txt.includes('확인할 가정'), summaryOnly: txt.includes('요약만 보기') };
      });
      log('toggle-expand result:', JSON.stringify(expanded));
      const collapse = page.locator('button', { hasText: '요약만 보기' }).first();
      if (await collapse.count()) await collapse.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(400);
    } catch (e) { log('toggle interaction failed:', e.message); }
  } else log('no 근거와 계획 보기 toggle on v0 screen');

  // ── driver loop ──
  let answers = 0;
  let postAnswerCaptured = 0;
  let teamShot = false, crewShot = false, verifyShot = false, prepShot = false;
  let mixClicked = false, reviewClicked = false;
  const DEADLINE = Date.now() + 18 * 60 * 1000;
  let lastActivity = Date.now();

  while (Date.now() < DEADLINE) {
    const s = await readState();

    if (s.loginWall) {
      await page.waitForTimeout(800);
      await shot('10-login-wall.png');
      await audit('login-wall');
      await dumpText('login-wall', 1500);
      log('LOGIN WALL reached — stopping here per instructions');
      break;
    }
    if (s.crisis) { log('crisis surface — unexpected'); await shot('98-crisis.png'); break; }

    if (s.framingConfirm) {
      await shot(`03c-framing-confirm.png`);
      const ok = page.locator('button', { hasText: '맞아요' }).first();
      if (await ok.count()) { await ok.click(); log('framing confirmed (맞아요)'); lastActivity = Date.now(); }
      await page.waitForTimeout(1500);
      continue;
    }

    if (s.question && answers < 4) {
      // capture the question screen for round 2 (state 6)
      if (answers === 1) { await shot('06a-q2.png'); await audit('q2'); }
      if (answers >= 2) { await audit(`q${answers + 1}`); }
      await answerQuestion(answers);
      answers++;
      lastActivity = Date.now();
      // ── state 4: IMMEDIATELY after answering ──
      if (postAnswerCaptured < 2) {
        await shot(answers === 1 ? '04-post-answer-immediate.png' : '06b-post-answer2-immediate.png');
        const a = await audit(answers === 1 ? 'post-answer-immediate' : 'post-answer2-immediate');
        // second beat 1.2s later — reflect state should be showing
        await page.waitForTimeout(1200);
        await shot(answers === 1 ? '04b-post-answer-1s.png' : '06b2-post-answer2-1s.png');
        await audit(answers === 1 ? 'post-answer-1.2s' : 'post-answer2-1.2s');
        postAnswerCaptured++;
      }
      // wait for the next state (updated analysis = question reappears or next surface)
      await page.waitForFunction(() => {
        const t = document.body.innerText;
        const qi = document.querySelector('input[name="question-answer"]');
        return (qi && !qi.disabled)
          || t.includes('이 방향으로 정리할까요?')
          || [...document.querySelectorAll('button')].some((b) => /검토 시작|이 방향으로 정리하기/.test(b.innerText))
          || t.includes('정리 끝났어요');
      }, null, { timeout: 150000, polling: 600 }).catch(() => log('WARN: next state timeout after answer', answers));
      await page.waitForTimeout(1800);
      if (answers === 1) { await shot('05-updated-analysis.png'); await audit('updated-analysis-v1'); await dumpText('updated-analysis-v1', 2200); }
      if (answers === 2) { await shot('06c-updated2.png'); await audit('updated-analysis-v2'); }
      continue;
    }

    if (s.question && answers >= 4) {
      // enough Q&A — use skip toward team if available, else answer again
      const skip = page.locator('button', { hasText: '건너뛰고 팀 투입' }).first();
      if (await skip.count()) { await skip.click(); log('clicked 건너뛰고 팀 투입'); }
      else { await answerQuestion(answers); answers++; }
      lastActivity = Date.now();
      await page.waitForTimeout(2500);
      continue;
    }

    if (s.reviewStart && !reviewClicked) {
      await page.waitForTimeout(1000);
      if (!teamShot) { await shot('07-team-plan.png'); await audit('team-plan'); await dumpText('team-plan', 2600); teamShot = true; }
      const start = page.locator('button', { hasText: '검토 시작' }).first();
      await start.click();
      reviewClicked = true;
      lastActivity = Date.now();
      log('clicked 검토 시작');
      await page.waitForTimeout(4000);
      continue;
    }

    if ((s.teamWorking || s.synthesizing) && !crewShot) {
      await page.waitForTimeout(2000);
      await shot('07b-crew-working.png');
      await audit('crew-working');
      await dumpText('crew-working', 2200);
      crewShot = true;
      lastActivity = Date.now();
      continue;
    }

    if (s.verifyGate) {
      if (!verifyShot) {
        await page.waitForTimeout(1200);
        await shot('08-verification-gate.png');
        await audit('verification-gate');
        await dumpText('verification-gate', 2600);
        verifyShot = true;
      }
      const wrap = page.locator('button').filter({ hasText: /^정리하기$/ }).first();
      const override = page.locator('button', { hasText: '확인 없이 모두 반영하고 정리하기' }).first();
      if (await wrap.count()) { await wrap.click(); log('clicked 정리하기 (verification gate)'); }
      else if (await override.count()) { await override.click(); log('clicked 확인 없이 모두 반영하고 정리하기'); }
      mixClicked = true;
      lastActivity = Date.now();
      await page.waitForTimeout(3000);
      continue;
    }

    if (s.prepSummary && !s.reviewStart && !mixClicked) {
      if (!prepShot) { await shot('07c-prep-summary.png'); await audit('prep-summary'); prepShot = true; }
      const mix = page.locator('button', { hasText: '이 방향으로 정리하기' }).first();
      await mix.click();
      mixClicked = true;
      lastActivity = Date.now();
      log('clicked 이 방향으로 정리하기');
      await page.waitForTimeout(3000);
      continue;
    }

    if (s.mixing || s.synthesizing) {
      if (Date.now() - lastActivity > 8000) { await shot('09a-mix-loading.png'); await audit('mix-loading'); lastActivity = Date.now(); }
      await page.waitForTimeout(2500);
      continue;
    }

    if (s.mixDone) {
      await page.waitForTimeout(2000);
      await shot('09-mix-done.png');
      await audit('mix-done');
      await dumpText('mix-done', 3200);
      // scroll to bottom for the full write-up
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(900);
      await shot('09b-mix-done-bottom.png');
      await audit('mix-done-bottom');
      log('MIX REACHED — journey complete');
      break;
    }

    if (Date.now() - lastActivity > 210000) {
      log('STALL: no recognized state change for 3.5min — dumping');
      await shot('97-stall.png');
      await dumpText('stall', 3000);
      break;
    }
    await page.waitForTimeout(1400);
  }

  log(`DONE mode=${MODE} answers=${answers}`);
  await page.waitForTimeout(2500); // flush beacons
} catch (err) {
  await failDump(err);
  process.exitCode = 1;
} finally {
  await browser.close();
}
