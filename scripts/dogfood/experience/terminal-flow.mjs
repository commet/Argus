/**
 * Terminal / plugin flow exercise — drives the REAL argus-watch CLI through the
 * decision ledger lifecycle a terminal user actually lives:
 *
 *   scan → (candidate) → seal → due → settle → ledger
 *
 * and shows you exactly what that user sees at each step, plus proves the
 * content lands correctly in the append-only local ledger.
 *
 * The ONE thing this stubs is `scan`'s LLM detection (it reads your Claude Code
 * transcripts and asks a model to spot decisions) — that needs your real
 * conversations and a model call. Everything after the candidate exists —
 * seal, the "그래서, 어떻게 됐어요?" due nudge, settle, the ledger tally, and
 * the append-only guarantee — is the real CLI, run for real.
 *
 *   npm run experience:terminal
 *
 * Works offline and needs no account. Output → a transcript + the resulting
 * ledger + a summary you can read.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { loadLedger } from '../../../tools/argus-watch/lib/ledger.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.resolve(here, '../../../tools/argus-watch/cli.mjs');
const stripAnsi = (s) => s.replace(/\[[0-9;]*m/g, '');

function ts() { return new Date().toISOString().replace(/[:.]/g, '-'); }

function run(cwd, args) {
  let out = '';
  try {
    out = execFileSync('node', [CLI, ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    out = `${e.stdout ?? ''}${e.stderr ?? ''}`;
  }
  return stripAnsi(out).trimEnd();
}

async function main() {
  const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-terminal-'));
  fs.mkdirSync(path.join(workdir, '.argus', 'ledger'), { recursive: true });

  // Seed the ONE candidate that `scan` (LLM) would have harvested from a real
  // conversation. This is the only stubbed step; it is labeled as such.
  const candidate = {
    event: 'harvest', id: 'demo01', project: 'your-project', session: 'sess-demo',
    decided_at: '2026-07-10T09:00:00.000Z',
    decision: '신규 채용을 이번 분기엔 미루고 현재 팀으로 간다',
    quote: '이번 분기 채용은 미루자', type: 'direction', stakes: 'high',
    at: '2026-07-10T09:00:00.000Z',
  };
  fs.writeFileSync(path.join(workdir, '.argus', 'ledger', 'ledger.jsonl'), `${JSON.stringify(candidate)}\n`);

  const transcript = [];
  const record = (title, args) => {
    const output = run(workdir, args);
    transcript.push(`$ argus-watch ${args.join(' ')}\n${output}\n`);
    console.log(`\n$ argus-watch ${args.join(' ')}`);
    console.log(output);
    return output;
  };

  console.log('▶ Terminal decision-ledger lifecycle (real CLI, temp ledger)\n');
  console.log('  (scan/LLM detection is stubbed with one seeded candidate; the rest is real)');

  record('list', ['list']);
  record('seal', ['seal', 'demo01',
    '--check-by', '2026-07-13',
    '--predicate', '채용 미룬 게 3개월 뒤 병목이 안 된다',
    '--falsified-if', '핵심 기능 출시가 인력부족으로 지연되면']);
  record('due', ['due']);
  record('settle', ['settle', 'demo01', 'happened', '--note', '출시 정상, 병목 없었음']);
  record('ledger', ['ledger']);

  // ── Programmatic verification (not stdout-scraping): the append-only ledger
  //    must show the real state transitions and preserve the content. ──
  const ledger = loadLedger(workdir);
  const d = ledger.get('demo01');
  const raw = fs.readFileSync(path.join(workdir, '.argus', 'ledger', 'ledger.jsonl'), 'utf8').trim().split('\n');
  const checks = [
    ['candidate → sealed → settled', d?.status === 'settled'],
    ['outcome recorded as happened', d?.outcome === 'happened'],
    ['bet (predicate) content landed', typeof d?.predicate === 'string' && d.predicate.includes('병목')],
    ['settle note landed', d?.settle_note?.includes('출시 정상') || raw.some((l) => l.includes('출시 정상'))],
    ['append-only: original harvest line untouched', raw[0] === JSON.stringify(candidate)],
    ['append-only: 3 events (harvest+seal+settle)', raw.length === 3],
  ];
  const failed = checks.filter(([, ok]) => !ok);

  const outDir = path.join(here, 'terminal-runs', ts());
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'transcript.txt'), transcript.join('\n'));
  fs.copyFileSync(path.join(workdir, '.argus', 'ledger', 'ledger.jsonl'), path.join(outDir, 'ledger.jsonl'));
  const summary = [
    `# Terminal flow exercise — ${new Date().toISOString()}`,
    '',
    'Real `argus-watch` CLI driven through: candidate → seal → due → settle → ledger.',
    'Only `scan` (LLM decision detection) is stubbed with one seeded candidate.',
    '',
    '## Checks',
    '',
    ...checks.map(([label, ok]) => `- ${ok ? '✓' : '✗'} ${label}`),
    '',
    '## Artifacts',
    '- `transcript.txt` — exactly what a terminal user sees at each command',
    '- `ledger.jsonl` — the resulting append-only ledger',
    '',
    '## What to judge',
    'Read `transcript.txt` as a terminal user would: is each step’s output clear?',
    'Does the "그래서, 어떻게 됐어요?" nudge read well? Is settling one command and obvious?',
  ].join('\n');
  fs.writeFileSync(path.join(outDir, 'summary.md'), summary);
  fs.rmSync(workdir, { recursive: true, force: true });

  console.log(`\n${'─'.repeat(60)}`);
  for (const [label, ok] of checks) console.log(`  ${ok ? '✓' : '✗ FAILED:'} ${label}`);
  console.log(`\nArtifacts → ${outDir}`);
  console.log(failed.length === 0
    ? 'Terminal lifecycle works end to end; content landed in the append-only ledger.'
    : `${failed.length} check(s) failed — see above.`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(2); });
