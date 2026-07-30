/**
 * Rotating-persona production retests of the light path (R3, R4, …).
 * HEADED (headless freezes framer-motion initial opacity — docs/HANDOFF-2026-07-31 §6).
 * Fresh context = anonymous. Usage: node retest-capture-rn.mjs r3|r4
 *
 * Unlike the scripted runs, a non-light gate route or an escalation is captured
 * as a RESULT (screenshot + text dump), not treated as an infra failure.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const RUNS = {
  r3: {
    out: 'C:/Users/admin/.claude/jobs/7f50b73d/tmp/retest-r3',
    prefix: 'r3',
    mobile: true,
    question: '낼 회식인데 걍 빠질까 눈치보이는데 ㅋㅋ',
    answers: ['담주에 발표잇어서 컨디션 챙겨야대', '어 걍 그정도야 별건 없음', '몰라 걍 애매함 ㅋㅋ'],
  },
  r4: {
    out: 'C:/Users/admin/.claude/jobs/7f50b73d/tmp/retest-r4',
    prefix: 'r4',
    mobile: false,
    question:
      '아 요즘 머리가 복잡한데 들어봐. 오늘 저녁에 대학 동기가 보자고 하는데 사실 지난주에도 야근하느라 한 번 미뤘거든. 근데 오늘도 몸이 좀 무겁고 내일 아침 일찍 일어나야 해서 갈까 말까 계속 저울질 중이야. 가면 분명 좋긴 할 텐데 요즘 돈도 아껴야 하고. 아 그리고 그거랑 별개로 요즘 부업을 시작해볼까 진지하게 고민 중이야. 회사 월급만으로는 좀 빠듯해서 주말에 스마트스토어 같은 거 해볼까 싶은데 주변에서는 다 말리더라고. 시간만 쓰고 남는 게 없다고. 근데 또 가만히 있으면 불안하고. 여튼 뭐부터 정리해야 할지 모르겠네. 일단 오늘 저녁 약속부터가 문제긴 해.',
    answers: [
      '아 저녁은 그 친구가 나 때문에 한 번 밀린 거라 이번엔 가야 할 것 같긴 한데, 몸이 무거워서 자꾸 핑계를 찾게 되네',
      '음 내일 일찍 일어나긴 해야 하는데 엄청 이른 건 아니야, 일곱 시 반쯤?',
      '그냥 그 정도야',
    ],
  },
};

const cfg = RUNS[process.argv[2]];
if (!cfg) { console.error('usage: node retest-capture-rn.mjs r3|r4'); process.exit(2); }
fs.mkdirSync(cfg.out, { recursive: true });
console.log(`run=${process.argv[2]} question length=${cfg.question.length} chars, mobile=${cfg.mobile}`);

const t0 = Date.now();
const log = (...a) => console.log(`[+${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

const LIGHT_TA = 'textarea[placeholder="한 줄이면 돼요"]';

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext(
  cfg.mobile
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'ko-KR' }
    : { viewport: { width: 1280, height: 900 }, locale: 'ko-KR' },
);
const page = await context.newPage();
page.on('console', (m) => { if (m.type() === 'error') log('console.error:', m.text().slice(0, 300)); });
page.on('pageerror', (e) => log('pageerror:', String(e).slice(0, 300)));

const shot = async (name) => { await page.screenshot({ path: `${cfg.out}/${cfg.prefix}-${name}` }); log('shot', `${cfg.prefix}-${name}`); };
const bodyText = () => page.evaluate(() => document.body.innerText);
const h2Texts = () => page.$$eval('h2', (hs) => hs.map((h) => h.innerText.trim()));
const buttonTexts = () =>
  page.$$eval('button', (bs) => bs.map((b) => b.innerText.trim().replace(/\s+/g, ' ')).filter(Boolean));

async function audit(label) {
  const r = await page.evaluate(() => {
    const doc = document.documentElement;
    return { hscroll: doc.scrollWidth > doc.clientWidth + 1, sw: doc.scrollWidth, cw: doc.clientWidth };
  });
  log(`AUDIT[${label}] hscroll=${r.hscroll} (${r.sw}/${r.cw})`);
}

async function dumpChecks(label) {
  const txt = await bodyText();
  log(`CHECK[${label}] no "Argus가 찾은 진짜 질문":`, !txt.includes('Argus가 찾은 진짜 질문'));
  log(`CHECK[${label}] no "여기서 마쳐도 돼요":`, !txt.includes('여기서 마쳐도 돼요'));
  log(`CHECK[${label}] buttons:`, JSON.stringify(await buttonTexts()));
  return txt;
}

try {
  // ── 1. entry ──
  await page.goto('https://www.argus.voyage/ko/workspace', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#workspace-decision-input', { timeout: 60000 });
  await page.waitForTimeout(2000);
  await shot('01-entry.png');

  // ── 2. submit → gate ──
  await page.fill('#workspace-decision-input', cfg.question);
  const tSubmit = Date.now();
  await page.press('#workspace-decision-input', 'Enter');
  log('submitted:', cfg.question.slice(0, 60) + (cfg.question.length > 60 ? '…' : ''));

  await page.waitForTimeout(2500);
  await shot('02-reading.png');

  const routed = await page
    .waitForFunction(
      (sel) => {
        if (document.querySelector(sel)) return 'light';
        const t = document.body.innerText;
        if (t.includes('Argus가 찾은 진짜 질문')) return 'heavy';
        if (t.includes('검토 전 내 생각')) return 'heavy-bind';
        return false;
      },
      LIGHT_TA,
      { timeout: 90000, polling: 500 },
    )
    .then((h) => h.jsonValue());
  const tFirstQ = Date.now();
  log(`GATE ROUTED: ${routed} after ${((tFirstQ - tSubmit) / 1000).toFixed(1)}s from submit`);
  await page.waitForTimeout(1500);
  await shot('03-after-gate.png');

  if (routed !== 'light') {
    // A heavy route on these personas is a finding, not an infra failure — dump and stop.
    log('non-light route — capturing state and ending run.');
    const txt = await bodyText();
    console.log(txt.slice(0, 2500));
    await browser.close();
    process.exit(0);
  }

  let txt = await dumpChecks('Q1');
  log('Q1 mirror+headline:', JSON.stringify(await h2Texts()));
  console.log('--- Q1 screen text (first 1300) ---');
  console.log(txt.slice(0, 1300));
  await audit('Q1');

  // ── 3. answer loop ──
  let questionCount = 1;
  let reached = null;
  for (let round = 0; round < cfg.answers.length; round++) {
    const prevQ = (await h2Texts()).join(' | ');
    await page.fill(LIGHT_TA, cfg.answers[round]);
    await page.press(LIGHT_TA, 'Enter');
    log(`answered Q${questionCount}:`, cfg.answers[round]);

    const next = await page
      .waitForFunction(
        ({ sel, prev }) => {
          const btn = [...document.querySelectorAll('button')].find((b) => b.innerText.includes('물어봐 주세요'));
          if (btn) return 'offer';
          if (document.body.innerText.includes('더 큰 얘기네요')) return 'escalate';
          const ta = document.querySelector(sel);
          const h2now = [...document.querySelectorAll('h2')].map((h) => h.innerText.trim()).join(' | ');
          if (ta && !ta.disabled && h2now && h2now !== prev) return 'turn';
          return false;
        },
        { sel: LIGHT_TA, prev: prevQ },
        { timeout: 90000, polling: 500 },
      )
      .then((h) => h.jsonValue());
    await page.waitForTimeout(1500);

    if (next === 'turn') {
      questionCount++;
      await shot(`04-q${questionCount}.png`);
      log(`next question (Q${questionCount}):`, JSON.stringify(await h2Texts()));
    } else {
      reached = next;
      await shot('05-offer-or-esc.png');
      log(`reached "${next}" after ${round + 1} answer(s); question count = ${questionCount}`);
      break;
    }
  }
  if (!reached) throw new Error('no offer/escalation after all answers — still asking questions');

  txt = await dumpChecks(reached);
  log(`${reached} headline(s):`, JSON.stringify(await h2Texts()));
  console.log(`--- ${reached} screen text (first 1500) ---`);
  console.log(txt.slice(0, 1500));
  await audit(reached);

  if (reached === 'escalate') {
    log('escalation screen — capturing as result, not clicking deeper.');
  } else {
    // ── 4. accept → keepsake ──
    const acceptBtn = page.locator('button', { hasText: '물어봐 주세요' }).first();
    log('accepting:', JSON.stringify((await acceptBtn.innerText()).trim()));
    await acceptBtn.click();
    await page.waitForFunction(() => document.body.innerText.includes('이렇게 기억해 둘게요'), { timeout: 60000, polling: 500 });
    await page.waitForTimeout(1800);
    await shot('06-keepsake.png');
    console.log('--- keepsake text (first 1800) ---');
    console.log((await bodyText()).slice(0, 1800));
    await audit('keepsake');
  }

  log('DONE. questions:', questionCount, '| first-beat latency:', ((tFirstQ - tSubmit) / 1000).toFixed(1) + 's', '| terminal:', reached);
  await page.waitForTimeout(2500);
} catch (err) {
  log('FAILURE:', err && err.message ? err.message : err);
  try { await shot('99-failure.png'); } catch {}
  try { console.log((await bodyText()).slice(0, 3000)); } catch {}
  process.exitCode = 1;
} finally {
  await browser.close();
}
