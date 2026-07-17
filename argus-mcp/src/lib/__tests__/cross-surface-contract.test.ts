import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'node:child_process';
import { replayLedger } from '../ledger-replay.js';

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
