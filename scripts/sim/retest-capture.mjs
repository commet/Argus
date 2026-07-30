/**
 * Founder-promised production retest of the light path (가벼운 길).
 * HEADED chromium (headless freezes framer-motion initial opacity —
 * docs/HANDOFF-2026-07-31 §6). Fresh context = anonymous.
 *
 * Captures 01-entry … 06-keepsake PNGs to C:/Users/admin/.claude/jobs/7f50b73d/tmp/retest/
 * and logs timing + textual verifications to stdout.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = 'C:/Users/admin/.claude/jobs/7f50b73d/tmp/retest';
fs.mkdirSync(OUT, { recursive: true });

const t0 = Date.now();
const log = (...a) => console.log(`[+${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

const LIGHT_TA = 'textarea[placeholder="한 줄이면 돼요"]';
const QUESTION = '생일 파티 이후에 집에 갈까?';
const ANSWER_1 = '내일 좀 피곤할까봐. 별일은 없는데';
const ANSWER_N = '응 그냥 그 정도야';

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'ko-KR' });
const page = await context.newPage();
page.on('console', (m) => { if (m.type() === 'error') log('console.error:', m.text().slice(0, 300)); });
page.on('pageerror', (e) => log('pageerror:', String(e).slice(0, 300)));

const shot = async (name) => { await page.screenshot({ path: `${OUT}/${name}` }); log('shot', name); };
const bodyText = () => page.evaluate(() => document.body.innerText);
const buttonTexts = () =>
  page.$$eval('button', (bs) => bs.map((b) => b.innerText.trim().replace(/\s+/g, ' ')).filter(Boolean));
const h2Texts = () => page.$$eval('h2', (hs) => hs.map((h) => h.innerText.trim()));

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
  await page.waitForTimeout(2000); // let entry animations settle
  await shot('01-entry.png');

  // ── 2. submit → gate ──
  await page.fill('#workspace-decision-input', QUESTION);
  const tSubmit = Date.now();
  await page.press('#workspace-decision-input', 'Enter');
  log('submitted:', QUESTION);

  // mid-wait reading state
  await page.waitForTimeout(2500);
  await shot('02-reading.png');
  const readingTxt = await bodyText();
  log('reading-state text sample:', JSON.stringify(readingTxt.slice(0, 400)));

  // wait for the light conversation (or detect heavy/crisis)
  const routed = await page
    .waitForFunction(
      (sel) => {
        if (document.querySelector(sel)) return 'light';
        const t = document.body.innerText;
        if (t.includes('Argus가 찾은 진짜 질문')) return 'heavy';
        return false;
      },
      LIGHT_TA,
      { timeout: 90000, polling: 500 },
    )
    .then((h) => h.jsonValue());
  const tFirstQ = Date.now();
  if (routed !== 'light') throw new Error(`gate routed to "${routed}" instead of light`);
  log(`LIGHT ROUTE — first question after ${((tFirstQ - tSubmit) / 1000).toFixed(1)}s from submit`);
  await page.waitForTimeout(1500); // let the turn card finish animating
  await shot('03-mirror-question.png');

  // textual verification on the first light screen
  let txt = await bodyText();
  let btns = await buttonTexts();
  const h2s = await h2Texts();
  log('Q1 headline(s):', JSON.stringify(h2s));
  log('buttons on screen:', JSON.stringify(btns));
  log('VERIFY no "Argus가 찾은 진짜 질문":', !txt.includes('Argus가 찾은 진짜 질문'));
  log('VERIFY no "여기서 마쳐도 돼요":', !txt.includes('여기서 마쳐도 돼요'));
  const FIXED = ['보내기', '더 깊이 보기', '물어봐 주세요', '괜찮아요', '고쳐도 돼요', '저장', '지금 조금 더 볼래요', '다음에 볼래요', '처음으로', '지금까지 나눈 이야기', '나', 'Me'];
  const optionish = btns.filter((b) => !FIXED.some((f) => b.includes(f)));
  log('VERIFY no option buttons (non-fixed buttons):', JSON.stringify(optionish));
  log('screen text (first 1500):');
  console.log(txt.slice(0, 1500));

  // ── 3. answer loop until the permission ask ──
  let questionCount = 1;
  let answered = 0;
  const answers = [ANSWER_1, ANSWER_N, ANSWER_N, ANSWER_N];
  let reached = null; // 'offer' | 'escalate'
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
      if (round === 0) await shot('04-next.png');
      log(`next question (Q${questionCount}):`, JSON.stringify(await h2Texts()));
    } else {
      reached = next;
      if (round === 0) await shot('04-next.png');
      else await shot('05-offer.png');
      log(`reached "${next}" after ${answered} answer(s); question count = ${questionCount}`);
      break;
    }
  }
  if (!reached) throw new Error(`no offer after ${answered} answers — still asking questions`);
  if (reached === 'escalate') throw new Error('escalation screen appeared instead of the permission ask');

  // offer screen contents
  txt = await bodyText();
  btns = await buttonTexts();
  log('offer headline(s):', JSON.stringify(await h2Texts()));
  log('offer buttons:', JSON.stringify(btns));
  log('offer screen text (first 1200):');
  console.log(txt.slice(0, 1200));

  // ── 4. accept → keepsake ──
  const acceptBtn = page.locator('button', { hasText: '물어봐 주세요' }).first();
  const acceptLabel = (await acceptBtn.innerText()).trim();
  log('clicking accept button:', JSON.stringify(acceptLabel));
  await acceptBtn.click();
  await page.waitForFunction(() => document.body.innerText.includes('이렇게 기억해 둘게요'), { timeout: 60000, polling: 500 });
  await page.waitForTimeout(1800); // keepsake settle animation
  await shot('06-keepsake.png');
  txt = await bodyText();
  log('keepsake full text:');
  console.log(txt.slice(0, 2000));

  log('DONE. total questions:', questionCount, '| first-question latency:', ((tFirstQ - tSubmit) / 1000).toFixed(1) + 's');
  await page.waitForTimeout(2500); // let track() beacons flush
} catch (err) {
  await failDump('99-failure.png', err);
  process.exitCode = 1;
} finally {
  await browser.close();
}
