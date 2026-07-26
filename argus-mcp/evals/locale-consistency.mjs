/**
 * Locale consistency sweep — the fundamental check behind the localization fix.
 * Drives a FULL session (many tools, in order) entirely in Korean, and another
 * entirely in English, against the real built server, and asserts that EVERY
 * surface stays in the session's language start to finish — no mid-session flip,
 * no English UI copy leaking into a Korean surface (or vice versa).
 *
 * "Leak" = a run of >=2 consecutive Latin words of UI prose in a Korean surface
 * (tool identifiers like argus_capture, ids, numbers, .ics are allowed — those
 * are technical tokens, not copy). Symmetrically, Hangul in an English surface.
 *
 *   npm run locale
 *
 * Exit non-zero on any leak. This is what proves the fix is fundamental (every
 * tool's voice follows the user's), not just patched on check_in.
 */
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist', 'index.js');
const HANGUL = /[가-힣]/;

// Tokens that are legitimately non-Korean in a Korean surface: tool handles,
// ids, dates/numbers, file extensions, callback markers.
function stripTechnical(s) {
  return s
    // The branded receipt line is deliberately NEVER localized (plugin + CLAUDE.md
    // contract: "keep the branded AI VERDICT line unchanged") — not a leak.
    .replace(/AI VERDICT ON THIS DECISION/g, ' ')
    .replace(/argus_[a-z_]+/g, ' ')
    .replace(/\bview=("?)[a-z_]+\1/g, ' ')
    .replace(/[a-z0-9_]+:[a-z0-9_-]+/gi, ' ')     // id:handle style
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')       // dates
    .replace(/\.(ics|jsonl|md|json)\b/g, ' ')
    .replace(/[0-9.%<>()"'`\-—:,/]+/g, ' ');
}

// English prose leak: >=2 consecutive Latin words (each >=2 letters).
const EN_PROSE = /\b[A-Za-z]{2,}(?:\s+[A-Za-z]{2,})+/;

function analyze(surface, expect) {
  const stripped = stripTechnical(surface);
  if (expect === 'ko') {
    const m = stripped.match(EN_PROSE);
    return m ? { leak: true, detail: `English prose in Korean surface: "${m[0].slice(0, 60)}"` } : { leak: false };
  }
  // expect en: Hangul presence is a leak.
  return HANGUL.test(surface) ? { leak: true, detail: `Korean in English surface: "${(surface.match(/[가-힣].{0,20}/) || [''])[0]}"` } : { leak: false };
}

async function connect(dir, locale) {
  const client = new Client({ name: 'locale-sweep', version: '1' }, { capabilities: {} });
  // Force a non-Korean OS env so the ONLY Korean signal is the user's content —
  // exactly the founder's case (English laptop, Korean words). If the voice
  // still follows the content, the fix is real.
  const env = { ...process.env, NODE_ENV: 'test', ARGUS_DIR: dir, LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' };
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [DIST], env }));
  return client;
}

const T = '2026-07-02';

// A full session's worth of calls. `text` marks which are the language-bearing
// content the user typed; every RESULTING surface must match `lang`.
function koScript(id) {
  return [
    ['argus_open_decision', { id, decision: '결제 시스템을 12월에 교체할지 말지', stakes: 'high', reversibility: 'one_way_door', status_quo: '현행 시스템 유지', today_override: T }],
    ['argus_premises', { id, op: 'add', today_override: T, premises: [{ text: '마이그레이션 다운타임이 5분을 넘지 않는다', kind: 'open_question', source: 'user' }] }],
    ['argus_seal', { id, predicate: '전환 후 첫 주 결제 실패율이 0.5% 아래로 유지된다', check_by: '2026-10-02', predicate_owner: 'user', today_override: T }],
    ['argus_check_in', { today_override: '2026-07-26' }],
    ['argus_patterns', { view: 'decision_context', id }],
    ['argus_patterns', { view: 'all' }],
    ['argus_settle', { id, outcome: 'held', outcome_source: 'user_stated', what_happened: '실패율 0.3%로 안정적으로 유지됐다', today_override: '2026-10-03' }],
    ['argus_patterns', { view: 'receipt', id }],
    ['argus_recall', { today_override: '2026-10-03' }],
  ];
}
function enScript(id) {
  return [
    ['argus_open_decision', { id, decision: 'whether to migrate the billing system in December', stakes: 'high', reversibility: 'one_way_door', status_quo: 'keep the current system', today_override: T }],
    ['argus_premises', { id, op: 'add', today_override: T, premises: [{ text: 'migration downtime stays under five minutes', kind: 'open_question', source: 'user' }] }],
    ['argus_seal', { id, predicate: 'payment failure rate stays below 0.5% in the first week after cutover', check_by: '2026-10-02', predicate_owner: 'user', today_override: T }],
    ['argus_check_in', { today_override: '2026-07-26' }],
    ['argus_patterns', { view: 'decision_context', id }],
    ['argus_settle', { id, outcome: 'held', outcome_source: 'user_stated', what_happened: 'failure rate held at 0.3%', today_override: '2026-10-03' }],
    ['argus_patterns', { view: 'receipt', id }],
  ];
}

async function runSession(lang, script) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `argus-loc-${lang}-`));
  const client = await connect(dir, lang);
  const findings = [];
  let n = 0;
  for (const [tool, args] of script) {
    const res = await client.callTool({ name: tool, arguments: { argus_dir: dir, ...args } });
    let env; try { env = JSON.parse(res.content[0].text); } catch { env = {}; }
    const surface = env.surface ?? env.message ?? '';
    n++;
    if (!surface) continue;
    const { leak, detail } = analyze(surface, lang);
    const mark = leak ? '✗ LEAK' : '✓';
    console.log(`  ${mark} [${lang}] ${tool.padEnd(20)} ${surface.slice(0, 54).replace(/\n/g, ' ')}`);
    if (leak) findings.push({ tool, detail, surface });
  }
  await client.close();
  fs.rmSync(dir, { recursive: true, force: true });
  return findings;
}

async function main() {
  if (!fs.existsSync(DIST)) { console.error('Build first: npm run build'); process.exit(2); }
  console.log('Locale consistency sweep — full session, one language, no leaks\n');
  console.log('Korean session (English OS env — only the content is Korean):');
  const koFindings = await runSession('ko', koScript('loc-ko'));
  console.log('\nEnglish session:');
  const enFindings = await runSession('en', enScript('loc-en'));

  const all = [...koFindings, ...enFindings];
  console.log(`\n${'─'.repeat(60)}`);
  if (all.length === 0) {
    console.log('✅ Every surface stayed in its session language start to finish. No leaks.');
    process.exit(0);
  }
  console.log(`❌ ${all.length} locale leak(s):`);
  for (const f of all) {
    console.log(`  - ${f.tool}: ${f.detail}`);
    console.log(`    surface: ${f.surface.slice(0, 120).replace(/\n/g, ' ')}`);
  }
  process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(2); });
