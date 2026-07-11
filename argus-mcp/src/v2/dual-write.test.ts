/**
 * P1 수술 2단계 검증 — 실제 argus_seal/argus_settle 툴 핸들러가 v1 원장을
 * 정본으로 유지하면서 v2 내구 원장에도 같은 사건을 남기는지, 끝에서 끝까지.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { init } from '../tools/init-config.js';
import { seal } from '../tools/seal.js';
import { settle } from '../tools/settle.js';
import { loadState } from './reducer.js';
import { mapSealProvenance } from './dual-write.js';

let home: string;
let repoDir: string;
let argusDir: string;
let savedHome: string | undefined;

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-dw-home-'));
  repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-dw-repo-'));
  fs.mkdirSync(path.join(repoDir, '.git'), { recursive: true });
  argusDir = path.join(repoDir, '.argus');
  savedHome = process.env['ARGUS_HOME'];
  process.env['ARGUS_HOME'] = home;
});
afterEach(() => {
  if (savedHome === undefined) delete process.env['ARGUS_HOME'];
  else process.env['ARGUS_HOME'] = savedHome;
  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(repoDir, { recursive: true, force: true });
});

interface ToolData { [k: string]: unknown; v2_write?: { written: boolean; repository_id?: string; reason?: string; error?: string } }
async function call(tool: { handler: (a: Record<string, unknown>) => Promise<unknown> }, args: Record<string, unknown>): Promise<ToolData> {
  const res = (await tool.handler(args)) as { structuredContent: { ok: boolean; data: ToolData; message?: string } };
  expect(res.structuredContent.ok, JSON.stringify(res.structuredContent)).toBe(true);
  return res.structuredContent.data;
}

describe('argus_seal/settle → v2 dual-write (v1 정본 유지)', () => {
  it('seal lands in BOTH ledgers; settle closes the decision in both', async () => {
    await call(init, { argus_dir: argusDir });
    const sealed = await call(seal, {
      argus_dir: argusDir, id: 'dw-1',
      predicate: 'cutover downtime < 5 min', check_by: '2099-01-01',
      predicate_owner: 'user', basis: 'judgment',
    });
    expect(sealed.v2_write).toMatchObject({ written: true });
    // v1 원장 (정본) — 그대로
    expect(fs.readFileSync(path.join(argusDir, 'ledger', 'ledger.jsonl'), 'utf8')).toContain('"seal"');
    // v2 내구 원장 — 같은 사건, 하향 provenance
    const repoId = sealed.v2_write!.repository_id!;
    const afterSeal = loadState(home, repoId);
    expect(afterSeal.decisions.get('dw-1')?.state).toBe('sealed');
    expect(afterSeal.decisions.get('dw-1')?.predicate?.provenance).toBe('host_reported'); // elicit 없는 'user'

    const settled = await call(settle, {
      argus_dir: argusDir, id: 'dw-1', outcome: 'held', what_happened: 'downtime 3m 40s',
    });
    expect(settled.v2_write).toMatchObject({ written: true });
    expect(loadState(home, repoId).decisions.get('dw-1')?.state).toBe('settled');
    expect(loadState(home, repoId).anomalies).toEqual([]);
  });

  it('without argus_init binding: v1 seal succeeds, v2_write declines with the init pointer', async () => {
    // init 없이 바로 seal — v1은 그대로 성공해야 한다 (파괴 없는 추가).
    const sealed = await call(seal, {
      argus_dir: argusDir, id: 'dw-2',
      predicate: 'works without v2 binding', check_by: '2099-01-01',
      predicate_owner: 'ai_surfaced',
    });
    expect(sealed['status']).toBe('sealed'); // v1 무영향
    expect(sealed.v2_write?.written).toBe(false);
    expect(sealed.v2_write?.reason).toMatch(/argus_init/); // 침묵이 아니라 안내
  });

  it('mapSealProvenance: elicit Keep만 elicited_user, 나머지는 위로 위조 금지', () => {
    expect(mapSealProvenance('user', true)).toBe('elicited_user');
    expect(mapSealProvenance('user', false)).toBe('host_reported');
    expect(mapSealProvenance('ai_surfaced', false)).toBe('ai_surfaced');
    expect(mapSealProvenance(undefined, false)).toBe('host_reported');
  });
});
