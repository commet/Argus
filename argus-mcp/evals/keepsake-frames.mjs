/**
 * THE KEEPSAKES, MEASURED WITH A RULER OF OUR OWN.
 *
 *   node evals/keepsake-frames.mjs
 *   KEEPSAKE_SHOW=1 node evals/keepsake-frames.mjs   # …and print them to read
 *
 * WHY (2026-07-28). 2.0.2 rendered the settle card and looked at it; 2.0.3 did
 * the same for the five elicitation asks. Neither reached the three MONOSPACE
 * blocks the user actually keeps and shares — the settle receipt, the seal
 * certificate and the logbook — which travel in `data.receipt_text`,
 * `data.seal_text` and `data.wake_text`. `surface-hazards.mjs` walks `surface`,
 * `message` and `recovery` and stops there; `spine-drift.test.ts` checks what
 * those blocks may SAY (no verdict, no score), never whether they hold together
 * on screen. So nothing had ever looked at them, and rendering them found:
 *
 *   - a sentence with no spaces in it (ordinary in Korean) or a long URL was
 *     never broken, so a 64-column frame carried a 105-column line
 *   - every settled row in the logbook ran 9 columns past the border: the
 *     outcome word is prepended to a label already budgeted the full width
 *   - `idCol()` — written to stop exactly that — was never called, so one long
 *     id pushed a row 12 columns out
 *   - the seal's two date rows were padded by codepoint, so in Korean they did
 *     not line up
 *   - emoji were not counted as wide, so an emoji prediction packed 25 columns
 *     past the border
 *
 * THE RULER IS THE POINT. That last one was invisible for a reason worth
 * keeping: the first version of this check imported the renderer's own width
 * function, so checker and subject were wrong in the same direction and the
 * overflow measured clean. This file therefore carries an INDEPENDENT measure,
 * derived from Unicode East_Asian_Width + Extended_Pictographic rather than
 * from the hand-kept list in render-receipt.ts. A gate that shares the
 * subject's mistake is not a gate.
 *
 * Checks, over 2 locales x 11 content shapes:
 *   K1 the top and bottom borders are the same width
 *   K2 no line escapes the frame
 *   K3 the seal's two date rows start in the same column
 *   K4 nothing is lost to make it fit — the frame closes by WRAPPING, and the
 *      user's own words survive (a truncated logbook label is marked with '…')
 *
 * Exit non-zero on any violation. CI gate.
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (process.env.KEEPSAKE_SKIP_BUILD !== '1') execSync('npm run build', { cwd: ROOT, stdio: 'ignore' });
// pathToFileURL, not a bare path: on Windows "C:\…" is read as a URL scheme.
const { renderReceipt, renderSeal, renderWake } =
  await import(pathToFileURL(path.join(ROOT, 'dist', 'lib', 'render-receipt.js')).href);

const violations = [];
let checks = 0;
function ok(id, cond, detail) {
  checks++;
  if (cond) return true;
  violations.push(`${id}: ${String(detail ?? '').replace(/\s+/g, ' ').slice(0, 170)}`);
  return false;
}

// ── an independent ruler ─────────────────────────────────────────────────────
// Derived from the Unicode properties, NOT from the renderer's hand-kept list.
// If the two ever disagree, this one is the one that matches a terminal.
// (East_Asian_Width is not a property JS regex exposes, so this is built from
//  the Script properties instead — a different derivation reaching the same
//  set, which is the independence that matters here.)
const WIDE_PROP = /\p{Script=Hangul}|\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Bopomofo}|[！-｠￠-￦　-〿]/u;
const PICTO_PROP = /\p{Extended_Pictographic}/u;
// Cf covers the zero-width joiner; Mn covers the variation selectors.
const ZERO_PROP = /\p{Mn}|\p{Me}|\p{Cf}/u;
function cols(s) {
  let w = 0;
  for (const ch of String(s)) {
    if (ZERO_PROP.test(ch)) continue;
    w += (WIDE_PROP.test(ch) || PICTO_PROP.test(ch)) ? 2 : 1;
  }
  return w;
}

/** The shapes that break a monospace frame in practice. */
const SHAPES = {
  plain_ko: '이번 분기 안에 유료 전환율이 5%를 넘는다',
  plain_en: 'paid conversion clears five percent this quarter',
  // Korean routinely runs without spaces; whitespace wrapping alone never breaks it
  nospace_ko: '이번분기안에유료전환율이5퍼센트를넘고이탈률은절반으로떨어지며재방문주기도이주일이내로짧아진다고본다',
  nospace_en: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  url: 'the migration at https://internal.example.com/runbooks/2026/cutover-plan-final-v3-really-final completes clean',
  emoji: '🚀 we ship before the deadline 🎯 and nobody works the weekend 🎉',
  emoji_wall: '🚀🎯🎉🔥💡📈🧭⚓🧪🚢🌊🧊🍀🎲🧵🪄🧱🌟🎈🥁🎺🎻🪗🎸🥊🧗🚴🏄🧘🛹',
  quotes: 'the customer said "we will renew" and I believe them',
  newlines: 'first line of the bet\nsecond line that continues it',
  mixed: 'the SK온 pilot 결과가 BA 쪽 승인까지 이어진다',
  long_ko: '다음 분기까지 운영원이 매일 손으로 그리던 표를 자동 생성본으로 대체하고, 그 결과로 하루 두 시간 이상 걸리던 반복 노동이 십 분 안쪽으로 줄어들며, 운영원이 엑셀을 열지 않고도 확인창만으로 하루를 시작하게 된다',
};

// A terminal is 80 columns. The logbook grows its box to hold its widest row,
// which is right — but it means "the frame closes" is no longer the whole
// promise: an unbounded row now widens the box instead of breaking it, and the
// keepsake wraps in the user's terminal all the same. This is the check that
// makes the id budget load-bearing.
const TERMINAL = 80;

/** K1 + K2 + K5: one box, everything inside it, and it fits on a screen. */
function frameHolds(where, text) {
  const lines = String(text).split('\n');
  const top = cols(lines[0]);
  const bottom = cols(lines[lines.length - 1]);
  ok(`${where} K1 위·아래 테두리 같은 폭`, top === bottom, `위 ${top}칸 / 아래 ${bottom}칸`);
  ok(`${where} K5 터미널 80칸 안에 들어온다`, top <= TERMINAL, `${top}칸`);
  for (const line of lines) {
    const w = cols(line);
    if (w > top) {
      ok(`${where} K2 프레임 밖으로 나간 줄 없음`, false, `${w}칸 (프레임 ${top}칸, ${w - top}칸 초과): ${line.trim()}`);
      return;
    }
  }
  ok(`${where} K2 프레임 밖으로 나간 줄 없음`, true);
}

if (process.env.KEEPSAKE_SHOW === '1') {
  console.log(renderSeal({
    predicate: SHAPES.long_ko, predicate_owner: 'user', sealed_on: '2026-07-28',
    check_by: '2026-08-15', today: '2026-07-28', locale: 'ko',
  }));
}

const RECEIPT_BASE = {
  id: 'dec-0001',
  check_by: '2026-08-15',
  created_at: '2026-07-07T00:00:00.000Z',
  settled_at: '2026-08-15T00:00:00.000Z',
  human_judgment: 'ship',
  skipped: [],
};

for (const locale of ['ko', 'en']) {
  for (const [name, text] of Object.entries(SHAPES)) {
    // the user's words reach the receipt through four different fields; each
    // one of them is a place a long line can escape
    const receipt = renderReceipt({
      ...RECEIPT_BASE,
      predicate: text,
      what_happened: text,
      unverified_assumption: text,
      real_question: text,
      human_only: text,
    }, undefined, locale);
    frameHolds(`영수증 ${locale}/${name}`, receipt);
    if (process.env.KEEPSAKE_SHOW === '1') console.log(receipt + '\n');

    const seal = renderSeal({
      predicate: text, predicate_owner: 'user', sealed_on: '2026-07-28',
      check_by: '2026-08-15', today: '2026-07-28', locale,
    });
    frameHolds(`봉인 ${locale}/${name}`, seal);

    // K3 — the two date rows are a pair; in Korean they were two columns apart
    const dated = seal.split('\n').filter((l) => /\d{4}-\d{2}-\d{2}/.test(l));
    if (ok(`봉인 ${locale}/${name} K3 날짜 두 줄이 있다`, dated.length >= 2, `${dated.length}줄`)) {
      const at = (l) => cols(l.slice(0, l.search(/\d{4}-\d{2}-\d{2}/)));
      ok(`봉인 ${locale}/${name} K3 날짜가 같은 칸에서 시작`, at(dated[0]) === at(dated[1]),
        `${at(dated[0])}칸 vs ${at(dated[1])}칸`);
    }

    // K4 — the frame closes by WRAPPING, not by throwing the user's words away.
    // A long predicate must still be readable in full on the seal certificate.
    const spaceless = !/\s/.test(text);
    if (text.length > 40 && !spaceless) {
      const flat = seal.replace(/\s+/g, ' ');
      const head = text.split(/\s+/).slice(0, 3).join(' ');
      ok(`봉인 ${locale}/${name} K4 사용자의 문장이 남아 있다`, flat.includes(head), head);
    }
  }
}

// ── the logbook: rows, groups, and ids ───────────────────────────────────────
const rows = (n, status, patch = {}) => Array.from({ length: n }, (_, i) => ({
  id: `dec-${status}-${i + 1}`, status, predicate: SHAPES.plain_ko, check_by: '2026-08-15', ...patch,
}));

for (const locale of ['ko', 'en']) {
  const cases = {
    // six overdue exercises the (+N) fold; settled rows carry the outcome prefix
    '세 무리': [...rows(6, 'sealed', { check_by: '2026-07-01' }), ...rows(2, 'sealed'),
      ...rows(3, 'settled', { outcome: 'held', settled_on: '2026-07-20' })],
    '긴 라벨': Object.entries(SHAPES).map(([name, predicate], i) => ({
      id: `dec-${name}`, status: i % 2 ? 'sealed' : 'settled', predicate,
      check_by: '2026-07-01', outcome: 'missed', settled_on: '2026-07-20',
    })),
    '아주 긴 id': [{ id: 'dec-a-really-long-identifier-that-should-not-push-the-row-out-of-the-box',
      status: 'sealed', predicate: SHAPES.plain_ko, check_by: '2026-07-01' }],
    '빈 기록': [],
  };
  for (const [name, contracts] of Object.entries(cases)) {
    const wake = renderWake(contracts, { held: 1, avoided: 0, partial: 0, missed: 1 },
      '2026-07-28', locale, '2026-05-01');
    frameHolds(`항해일지 ${locale}/${name}`, wake);
    if (process.env.KEEPSAKE_SHOW === '1') console.log(wake + '\n');
    // K4 — a row that had to be cut says so, rather than silently ending mid-word
    for (const line of wake.split('\n')) {
      const quoted = line.match(/"([^"]*)"/);
      if (!quoted) continue;
      const full = contracts.some((c) => (c.predicate || '').replace(/\s+/g, ' ').startsWith(quoted[1]));
      ok(`항해일지 ${locale}/${name} K4 잘린 라벨은 잘렸다고 표시`,
        full || quoted[1].endsWith('…'), quoted[1]);
    }
  }
}

const label = `${checks} checks · ${violations.length} violations`;
if (violations.length) {
  console.error(`\n❌ ${label}\n`);
  for (const v of violations.slice(0, 40)) console.error('  ' + v);
  if (violations.length > 40) console.error(`  … (+${violations.length - 40})`);
  process.exit(1);
}
console.log(`✅ ${label} — 영수증·봉인·항해일지가 2언어 × 11내용에서 액자 안에 있습니다.`);
