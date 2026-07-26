import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { replayLedger } from '../ledger-replay.js';
import { appendLedger } from '../ledger-append.js';

const execFileP = promisify(execFile);

/**
 * 교차-표면 계약 (§9.7 O2 exit: 같은 이벤트 fixture → 플러그인/MCP/statusline
 * 동일 해석).
 *
 * The ledger FILE is shared, but until O2 the reducers were four independent
 * implementations that drifted (O2 방0 inventory found five live divergences:
 * unstamped plugin events counted as MCP corruption; MCP `defer` invisible to
 * the statusline and the session reminder; `happened` vs `held` outcome
 * buckets; `ts` vs `at` timestamps). This fixture is the drift NET: one golden
 * ledger containing every cross-surface shape, replayed by all three brains,
 * asserting they answer the SAME three questions — what is due, what is
 * settled, what is corrupt. A new event type added to one brain without the
 * others turns this red.
 *
 * The plugin brains are exercised as REAL child processes (their actual CLI
 * contract), not re-implementations.
 */

const REPO_ROOT = path.resolve(process.cwd(), '..');
const STATUSLINE = path.join(REPO_ROOT, 'argus-plugin-v2', 'statusline', 'index.js');
const CHECK_CONTRACTS = path.join(REPO_ROOT, 'argus-plugin-v2', 'scripts', 'check-contracts.js');

// Fixture dates are absolute and far in the past/future so "today" — real for
// the plugin brains, parameterized for the MCP — reads them identically.
const ALPHA_TEXT = 'alpha ships before the deadline';
const BETA_TEXT = 'beta metric stays under budget';
const GAMMA_TEXT = 'gamma keeps the old vendor';

function goldenLedger(): string[] {
  return [
    // alpha — sealed, past check_by, never settled → DUE on every surface
    JSON.stringify({ v: 1, ts: '2020-01-01T00:00:00Z', id: 'alpha', event: 'harvest', decision: ALPHA_TEXT, quote: ALPHA_TEXT }),
    JSON.stringify({ v: 1, ts: '2020-01-01T00:00:00Z', id: 'alpha', event: 'seal', predicate: ALPHA_TEXT, check_by: '2020-02-01' }),
    // an OLD unstamped plugin wake on alpha — decision state must not move, nobody may call it corrupt
    JSON.stringify({ id: 'alpha', event: 'wake', lean_before: 'ship', lean_after: 'ship', at: '2020-01-02T00:00:00Z' }),
    // beta — was due, then MCP still_pending re-armed it into the far future → NOT due anywhere
    JSON.stringify({ v: 1, ts: '2020-01-01T00:00:00Z', id: 'beta', event: 'harvest', decision: BETA_TEXT, quote: BETA_TEXT }),
    JSON.stringify({ v: 1, ts: '2020-01-01T00:00:00Z', id: 'beta', event: 'seal', predicate: BETA_TEXT, check_by: '2020-02-01' }),
    JSON.stringify({ v: 1, ts: '2020-02-01T00:00:00Z', id: 'beta', event: 'defer', from: '2020-02-01', check_by: '2099-01-01' }),
    // gamma — settled by the PLUGIN in its legacy shape (outcome happened, at-only) → silent everywhere, bucketed as held by the MCP
    JSON.stringify({ v: 1, ts: '2020-01-01T00:00:00Z', id: 'gamma', event: 'harvest', decision: GAMMA_TEXT, quote: GAMMA_TEXT }),
    JSON.stringify({ v: 1, ts: '2020-01-01T00:00:00Z', id: 'gamma', event: 'seal', predicate: GAMMA_TEXT, check_by: '2020-02-01' }),
    JSON.stringify({ id: 'gamma', event: 'settle', outcome: 'happened', at: '2020-02-02T00:00:00Z' }),
    // one genuinely corrupt line — the ONLY thing allowed to count as corruption
    '{ this is not json',
  ];
}

let repo: string;
let greetedConfig: string;

beforeAll(() => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-xsurface-'));
  fs.mkdirSync(path.join(repo, '.argus', 'ledger'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.argus', 'ledger', 'ledger.jsonl'), goldenLedger().join('\n') + '\n');
  greetedConfig = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-xsurface-cfg-'));
  fs.writeFileSync(path.join(greetedConfig, 'argus-greeted'), 'test\n');
});
afterAll(() => {
  fs.rmSync(repo, { recursive: true, force: true });
  fs.rmSync(greetedConfig, { recursive: true, force: true });
});

const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');

describe('교차-표면 계약 — 세 두뇌, 같은 대답', () => {
  it('MCP replay: alpha만 due, gamma는 held로 버킷, 손상은 깨진 줄 1개뿐', () => {
    const s = replayLedger(path.join(repo, '.argus'), '2026-07-17');
    expect(s.overdue.map((o) => o.id)).toEqual(['alpha']);
    expect(s.contracts.get('beta')?.status).toBe('sealed');
    expect(s.contracts.get('beta')?.check_by).toBe('2099-01-01');
    expect(s.contracts.get('gamma')?.status).toBe('settled');
    expect(s.stats.total_settled).toBe(1);
    expect(s.stats.held).toBe(1);
    expect(s.integrity.dropped_lines).toBe(1); // the broken line — and ONLY it
  });

  it('statusline: 같은 원장에서 alpha만 OVERDUE로 올리고 beta·gamma는 침묵', () => {
    const r = spawnSync(process.execPath, [STATUSLINE], {
      input: JSON.stringify({ model: { display_name: 'X' }, workspace: { current_dir: repo }, context_window: { used_percentage: 10 } }),
      encoding: 'utf8',
      env: { ...process.env, COLUMNS: '160' },
    });
    expect(r.status).toBe(0);
    const out = strip(r.stdout);
    expect(out).toContain('OVERDUE');
    expect(out).toContain('alpha ships');
    expect(out).not.toContain('beta metric'); // deferred — the new date is honored
    expect(out).not.toContain('gamma keeps'); // settled — silent
    expect(out).not.toContain('×2'); // exactly ONE due, not two
  });

  it('check-contracts(세션 알림): 같은 원장에서 alpha 1건만 정산 안내', () => {
    const r = spawnSync(process.execPath, [CHECK_CONTRACTS], {
      cwd: repo,
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_CONFIG_DIR: greetedConfig },
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('alpha ships');
    expect(r.stdout).toMatch(/1 decision contract|결정 계약/);
    expect(r.stdout).not.toContain('beta metric');
    expect(r.stdout).not.toMatch(/외 \d+건| 2 /); // one due, not more
  });
});

/**
 * 쓰기 규율 계약 (O2 방3) — 플러그인 CLI는 정본 writer(ledger-append.ts)의
 * 규율(스탬프·torn-tail heal·O_APPEND·락)을 자기완결로 이식해 갖는다. 런타임
 * 위임은 기각됐으므로(콜드 npx/오프라인에서 봉인 실패 + 폴백 writer = 경로 2개),
 * 이 블록이 두 writer의 규율 동등성을 기계로 고정한다 — 어느 한쪽만 고치면
 * 여기가 빨개진다.
 */
describe('쓰기 규율 계약 — 두 writer, 같은 규율 (O2 방3)', () => {
  const CLI = path.join(REPO_ROOT, 'argus-plugin-v2', 'scripts', 'decision-ledger.js');
  const AUTH = ['--authorization-ref', 'test:explicit-user-action'];

  function pluginRepo(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-wparity-'));
    fs.mkdirSync(path.join(dir, '.argus'), { recursive: true });
    return dir;
  }
  const readLines = (dir: string) =>
    fs.readFileSync(path.join(dir, '.argus', 'ledger', 'ledger.jsonl'), 'utf8');

  it('스탬프 동형: 두 writer 모두 v·ts를 찍고, 개행으로 끝나며, 전 줄이 파스된다', async () => {
    const repo = pluginRepo();
    const r = spawnSync(process.execPath, [CLI, 'record', '--predicate', 'the pipeline stays under budget', '--id', 'wp1', '--check-by', '2099-01-01', ...AUTH], { cwd: repo, encoding: 'utf8' });
    expect(r.status).toBe(0);
    const cliRaw = readLines(repo);
    expect(cliRaw.endsWith('\n')).toBe(true);
    expect(cliRaw.includes('\r')).toBe(false);
    const cliEvents = cliRaw.trim().split('\n').map((l) => JSON.parse(l) as Record<string, unknown>);
    for (const ev of cliEvents) {
      expect(ev['v']).toBe(1);
      expect(typeof ev['ts']).toBe('string');
    }

    const mcpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-wparity-mcp-'));
    await appendLedger(mcpDir, [{ id: 'wp1', event: 'seal', predicate: 'the pipeline stays under budget', check_by: '2099-01-01' }], '2026-07-17T00:00:00.000Z');
    const mcpRaw = fs.readFileSync(path.join(mcpDir, 'ledger', 'ledger.jsonl'), 'utf8');
    expect(mcpRaw.endsWith('\n')).toBe(true);
    const mcpEv = JSON.parse(mcpRaw.trim()) as Record<string, unknown>;
    expect(mcpEv['v']).toBe(1);
    expect(typeof mcpEv['ts']).toBe('string');
    // 둘 다 상대 replay에서 깨끗하다 (교차 소비 가능 = 규율 동형의 정의)
    expect(replayLedger(path.join(repo, '.argus'), '2026-07-17').integrity.dropped_lines).toBe(0);
    expect(replayLedger(mcpDir, '2026-07-17').integrity.dropped_lines).toBe(0);
  });

  it('torn-tail heal: 개행 없는 손상 꼬리 뒤에 CLI가 append해도 새 이벤트는 살아남는다 (손상은 그 한 줄뿐)', () => {
    const repo = pluginRepo();
    const ledgerDir = path.join(repo, '.argus', 'ledger');
    fs.mkdirSync(ledgerDir, { recursive: true });
    fs.writeFileSync(path.join(ledgerDir, 'ledger.jsonl'), '{"torn cras'); // 종결자 없는 조각
    const r = spawnSync(process.execPath, [CLI, 'record', '--predicate', 'the recovery path actually works', '--id', 'heal1', '--check-by', '2099-01-01', ...AUTH], { cwd: repo, encoding: 'utf8' });
    expect(r.status).toBe(0);
    const s = replayLedger(path.join(repo, '.argus'), '2026-07-17');
    expect(s.integrity.dropped_lines).toBe(1); // 찢긴 조각 그 한 줄만
    expect(s.contracts.get('heal1')?.status).toBe('sealed'); // 새 이벤트는 무사
  });

  it('동시 쓰기: 5개 CLI가 같은 원장에 동시에 써도 한 줄도 섞이거나 사라지지 않는다 (락)', async () => {
    const repo = pluginRepo();
    await Promise.all(
      [1, 2, 3, 4, 5].map((n) =>
        execFileP(process.execPath, [CLI, 'record', '--predicate', `concurrent write number ${n} lands intact`, '--id', `con${n}`, '--check-by', '2099-01-01', ...AUTH], { cwd: repo }),
      ),
    );
    const s = replayLedger(path.join(repo, '.argus'), '2026-07-17');
    expect(s.integrity.dropped_lines).toBe(0);
    const sealed = [1, 2, 3, 4, 5].filter((n) => s.contracts.get(`con${n}`)?.status === 'sealed');
    expect(sealed.length).toBe(5);
    const ids = readLines(repo).trim().split('\n').map((line) => (JSON.parse(line) as { id: string }).id);
    for (let n = 1; n <= 5; n += 1) {
      const first = ids.indexOf(`con${n}`);
      expect(ids[first + 1]).toBe(`con${n}`);
    }
  });
});
