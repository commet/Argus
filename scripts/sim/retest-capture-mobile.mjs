/**
 * MOBILE production retest of the light path — iPhone-class emulation.
 * HEADED (headless freezes framer-motion initial opacity — docs/HANDOFF-2026-07-31 §6).
 * viewport 390x844, dpr 3, isMobile, hasTouch. Fresh context = anonymous.
 *
 * Captures m01…m06 PNGs to C:/Users/admin/.claude/jobs/7f50b73d/tmp/retest-mobile/
 * and runs a layout audit (horizontal scroll + tap targets < 44px) on every screen.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = 'C:/Users/admin/.claude/jobs/7f50b73d/tmp/retest-mobile';
fs.mkdirSync(OUT, { recursive: true });

const t0 = Date.now();
const log = (...a) => console.log(`[+${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

const LIGHT_TA = 'textarea[placeholder="한 줄이면 돼요"]';
const QUESTION = '주말에 부모님 댁 갈까 고민되네';
const ANSWER_1 = '한동안 못 뵈어서 가고 싶긴 한데, 주말에 좀 쉬고 싶기도 해서';
const ANSWER_N = '아니, 특별한 일정은 없어';

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  locale: 'ko-KR',
});
const page = await context.newPage();
page.on('console', (m) => { if (m.type() === 'error') log('console.error:', m.text().slice(0, 300)); });
page.on('pageerror', (e) => log('pageerror:', String(e).slice(0, 300)));

const shot = async (name) => { await page.screenshot({ path: `${OUT}/${name}` }); log('shot', name); };
const bodyText = () => page.evaluate(() => document.body.innerText);
const h2Texts = () => page.$$eval('h2', (hs) => hs.map((h) => h.innerText.trim()));

/** Layout audit: horizontal scroll + interactive elements under 44px. */
async function audit(label) {
  const r = await page.evaluate(() => {
    const doc = document.documentElement;
    const hscroll = doc.scrollWidth > doc.clientWidth + 1;
    const small = [...document.querySelectorAll('button, a, [role="button"]')]
      .map((el) => {
        const b = el.getBoundingClientRect();
        return {
          tag: el.tagName,
          text: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 40).replace(/\s+/g, ' '),
          w: Math.round(b.width),
          h: Math.round(b.height),
        };
      })
      .filter((x) => x.w > 0 && x.h > 0 && (x.h < 44 || x.w < 44));
    return { hscroll, scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, small };
  });
  log(`AUDIT[${label}] hscroll=${r.hscroll} (scrollWidth=${r.scrollWidth}, clientWidth=${r.clientWidth})`);
  if (r.small.length) log(`AUDIT[${label}] tap<44px:`, JSON.stringify(r.small));
  else log(`AUDIT[${label}] tap targets all >=44px`);
}

async function failDump(name, err) {
  log('FAILURE:', err && err.message ? err.message : err);
  try { await shot(name); } catch {}
  try {
    const txt = await bodyText();
    log('--- body innerText at failure (first 3000 chars) ---');
    console.log(txt.slice(0, 3000));
  } catch {}
}

try {
  // ── 1. entry ──
  await page.goto('https://www.argus.voyage/ko/workspace', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#workspace-decision-input', { timeout: 60000 });
  await page.waitForTimeout(2000);
  await shot('m01-entry.png');
  await audit('entry');

  // ── 2. submit → gate ──
  await page.fill('#workspace-decision-input', QUESTION);
  const tSubmit = Date.now();
  await page.press('#workspace-decision-input', 'Enter');
  log('submitted:', QUESTION);

  await page.waitForTimeout(2500);
  await shot('m02-reading.png');

  const routed = await page
    .waitForFunction(
      (sel) => {
        if (document.querySelector(sel)) return 'light';
        if (document.body.innerText.includes('Argus가 찾은 진짜 질문')) return 'heavy';
        return false;
      },
      LIGHT_TA,
      { timeout: 90000, polling: 500 },
    )
    .then((h) => h.jsonValue());
  const tFirstQ = Date.now();
  if (routed !== 'light') throw new Error(`gate routed to "${routed}" instead of light`);
  log(`LIGHT ROUTE — first question after ${((tFirstQ - tSubmit) / 1000).toFixed(1)}s from submit`);
  await page.waitForTimeout(1500);
  await shot('m03-mirror-question.png');
  await audit('mirror-question');
  log('Q1 headline(s):', JSON.stringify(await h2Texts()));

  // ── 3. answer loop until the permission ask ──
  let questionCount = 1;
  let answered = 0;
  const answers = [ANSWER_1, ANSWER_N, ANSWER_N, ANSWER_N];
  let reached = null;
  for (let round = 0; round < answers.length; round++) {
    const prevQ = (await h2Texts()).join(' | ');
    await page.fill(LIGHT_TA, answers[round]);
    await page.press(LIGHT_TA, 'Enter');
    answered++;
    log(`answered Q${questionCount}:`, answers[round]);

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
      if (round === 0) { await shot('m04-next.png'); await audit('next-question'); }
      log(`next question (Q${questionCount}):`, JSON.stringify(await h2Texts()));
    } else {
      reached = next;
      if (round === 0) { await shot('m04-next.png'); await audit('offer'); }
      else { await shot('m05-offer.png'); await audit('offer'); }
      log(`reached "${next}" after ${answered} answer(s); question count = ${questionCount}`);
      break;
    }
  }
  if (!reached) throw new Error(`no offer after ${answered} answers — still asking questions`);
  if (reached === 'escalate') throw new Error('escalation screen appeared instead of the permission ask');

  log('offer headline(s):', JSON.stringify(await h2Texts()));
  log('offer screen text (first 1200):');
  console.log((await bodyText()).slice(0, 1200));

  // ── 4. accept → keepsake ──
  const acceptBtn = page.locator('button', { hasText: '물어봐 주세요' }).first();
  log('tapping accept button:', JSON.stringify((await acceptBtn.innerText()).trim()));
  await acceptBtn.click();
  await page.waitForFunction(() => document.body.innerText.includes('이렇게 기억해 둘게요'), { timeout: 60000, polling: 500 });
  await page.waitForTimeout(1800);
  await shot('m06-keepsake.png');
  await audit('keepsake');
  log('keepsake full text:');
  console.log((await bodyText()).slice(0, 2000));

  // scroll to the accumulating record for a readability look (bottom of page)
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(800);
  await shot('m06b-keepsake-record.png');
  await audit('keepsake-record');

  log('DONE. total questions:', questionCount, '| first-question latency:', ((tFirstQ - tSubmit) / 1000).toFixed(1) + 's');
  await page.waitForTimeout(2500); // let track() beacons flush
} catch (err) {
  await failDump('m99-failure.png', err);
  process.exitCode = 1;
} finally {
  await browser.close();
}
