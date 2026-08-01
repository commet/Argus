/**
 * local-premise-eyes.mjs — look at the premise block with my own eyes.
 *
 *   node scripts/sim/local-premise-eyes.mjs [port]
 *
 * Every claim about the kind chips, the honest counts and the "이 판단이 서 있는
 * 것" heading so far rests on tests I wrote and a sim I built. That proves the
 * harness, not the product. This drives the REAL local app through a real
 * decision and reports what a person would actually see.
 *
 * HEADED chromium on purpose: headless freezes framer-motion, so a headless
 * screenshot of this card is a picture of the animation's first frame.
 * Read-only on any dev server that is already running — it opens its own window
 * and never touches an existing one.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const PORT = process.argv[2] || '3017';
const OUT = 'C:/Users/admin/.claude/jobs/7f50b73d/tmp/premise-eyes';
fs.mkdirSync(OUT, { recursive: true });

const t0 = Date.now();
const log = (...a) => console.log(`[+${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

// heavy-04, the session every fix in this branch was measured on.
const OPENER = '5명짜리 팀의 리더인데, 팀원 한 명이 6개월째 성과가 안 나요. '
  + '두 번 면담했고 개선 계획도 같이 잡았는데 변화가 없어요. 내보내야 하나 고민입니다. '
  + '그 팀원은 작년에 저를 믿고 이직해서 온 사람이라 마음이 많이 무겁습니다.';
const ANSWERS = [
  '개선 계획은 문서로 남겼고, 두 번째 기한이 다음 주에 끝나요.',
  '다른 팀원 두 명이 이미 그 사람 몫까지 하고 있다고 힘들다는 얘기를 꺼냈어요.',
];

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1280, height: 940 }, locale: 'ko-KR' });
page.on('pageerror', (e) => log('pageerror:', String(e).slice(0, 200)));

const shot = async (n) => { await page.screenshot({ path: `${OUT}/${n}` }); log('shot', n); };

/** What the premise block actually says, read off the rendered DOM. */
const readBlock = () => page.evaluate(() => {
  const txt = document.body.innerText;
  const heading = /이 판단이 서 있는 것/.test(txt) ? '이 판단이 서 있는 것'
    : /확인할 가정/.test(txt) ? '확인할 가정' : null;
  const chips = ['가정', '사실', '예측', '내 기준', '열린 질문']
    .filter((k) => new RegExp(`(^|\\n)\\s*${k}\\s*(\\n|$)`).test(txt));
  return {
    heading,
    chips,
    counts: (txt.match(/확인할 가정 \d+개|짚어둔 것 \d+개/g) || []),
    notChecked: /확인 대상 아님/.test(txt),
    myWords: /내가 쓴 말/.test(txt),
    ifWrong: (txt.match(/이게 아니라면/g) || []).length,
    howKnow: /무엇을 보면 아나/.test(txt),
    // The bug this whole branch started from: a numbered list under the words
    // "assumptions to verify" whose rows were the user's own sentences.
    numberedRows: /(^|\n)\s*[123]\s*\n/.test(txt),
  };
});

try {
  await page.goto(`http://localhost:${PORT}/ko/workspace`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForSelector('#workspace-decision-input', { timeout: 90000 });
  await page.waitForTimeout(2000);
  await shot('01-entry.png');

  await page.fill('#workspace-decision-input', OPENER);
  await page.press('#workspace-decision-input', 'Enter');
  log('submitted');

  // The first-thought gate ("검토 전 내 생각") stands between the opener and the
  // analysis. Skipping it is the honest default here: this run is looking at
  // the premise block, and typing a baseline would put words in the record.
  const skip = page.locator('button', { hasText: '건너뛰고 계속' }).first();
  await skip.waitFor({ timeout: 60000 }).catch(() => log('no first-thought gate'));
  if (await skip.count()) { await skip.click().catch(() => {}); log('skipped first-thought gate'); }

  await page.waitForFunction(() => {
    const qi = document.querySelector('input[name="question-answer"]');
    return (qi && !qi.disabled) || document.body.innerText.includes('이 방향으로 정리할까요?');
  }, null, { timeout: 180000, polling: 500 });
  await page.waitForTimeout(2000);
  await shot('02-first-analysis.png');

  for (let i = 0; i < ANSWERS.length; i += 1) {
    const confirm = page.locator('button', { hasText: '맞아요' }).first();
    if (await confirm.count()) { await confirm.click().catch(() => {}); await page.waitForTimeout(1200); }
    const input = page.locator('input[name="question-answer"]');
    if (!(await input.count())) break;
    await input.fill(ANSWERS[i]);
    await page.keyboard.press('Enter');
    log(`answered ${i + 1}`);
    await page.waitForFunction(
      (n) => new RegExp(`${n}개 답변 반영`).test(document.body.innerText),
      i + 1, { timeout: 180000, polling: 600 },
    ).catch(() => log(`no "${i + 1}개 답변 반영" marker — continuing`));
    await page.waitForTimeout(2500);
  }
  await shot('03-after-answers.png');

  // The summary view — this is where the rows became visible in this branch.
  log('SUMMARY:', JSON.stringify(await readBlock()));

  // The peek's own label is "근거 보기"; the expanded card's is "자세히 보기".
  // Naming the wrong one silently produced "no toggle present" and a run that
  // proved nothing about the block it was written to look at.
  const toggle = page.locator('button', { hasText: /근거( 보기|와 계획 보기)/ }).first();
  if (await toggle.count()) {
    await toggle.click().catch(() => {});
    await page.waitForTimeout(1400);
    await shot('04-expanded.png');
    log('EXPANDED:', JSON.stringify(await readBlock()));
  } else {
    log('no 근거와 계획 보기 toggle present');
  }

  const detail = page.locator('button', { hasText: /자세히|근거와 계획/ }).first();
  if (await detail.count()) {
    await detail.click().catch(() => {});
    await page.waitForTimeout(1400);
    await shot('05-detail.png');
    log('DETAIL:', JSON.stringify(await readBlock()));
  }

  const txt = await page.evaluate(() => document.body.innerText);
  fs.writeFileSync(`${OUT}/page-text.txt`, txt, 'utf8');
  log('wrote page-text.txt', txt.length, 'chars');
} catch (e) {
  log('FAILURE:', e.message);
  await shot('99-failure.png').catch(() => {});
  try {
    fs.writeFileSync(`${OUT}/page-text.txt`, await page.evaluate(() => document.body.innerText), 'utf8');
  } catch { /* nothing to save */ }
} finally {
  await browser.close();
  log('done →', OUT);
}
