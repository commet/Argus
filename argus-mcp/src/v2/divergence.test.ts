/**
 * M-잔여-1 — v1↔v2 브리프 발산 감지 (읽기 전환 준비).
 * 계약: check_in이 매 호출마다 due id 집합의 대칭차를 병기한다.
 * 관찰 기간 동안 diverged=false가 이어지는 것이 읽기 전환의 조건.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { init } from '../tools/init-config.js';
import { seal } from '../tools/seal.js';
import { checkIn } from '../tools/check-in.js';
import { contextFor, sealV2 } from './bridge.js';

let home: string;
let repoDir: string;
let argusDir: string;
let savedHome: string | undefined;

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-dv-home-'));
  repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-dv-repo-'));
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

async function call(tool: { handler: (a: Record<string, unknown>) => Promise<unknown> }, args: Record<string, unknown>) {
  const res = (await tool.handler(args)) as { structuredContent: { ok: boolean; data: Record<string, unknown> } };
  expect(res.structuredContent.ok, JSON.stringify(res.structuredContent)).toBe(true);
  return res.structuredContent.data;
}

type Divergence = {
  comparable: boolean; v1_due?: number; v2_due?: number;
  only_v1?: string[]; only_v2?: string[]; diverged?: boolean;
};

describe('check_in의 v2_divergence 병기', () => {
  it('정상 dual-write 경로: due가 양쪽에 같아 diverged=false', async () => {
    await call(init, { argus_dir: argusDir });
    await call(seal, {
      argus_dir: argusDir, id: 'dv-1', predicate: 'both ledgers agree', check_by: '2026-07-10',
      predicate_owner: 'user', today_override: '2026-07-01',
    });
    const data = await call(checkIn, { argus_dir: argusDir, today_override: '2026-07-11' });
    const dv = data['v2_divergence'] as Divergence;
    expect(dv.comparable).toBe(true);
    expect(dv.v1_due).toBe(1);
    expect(dv.v2_due).toBe(1);
    expect(dv.diverged).toBe(false);
  });

  it('due 0건 경로에도 병기된다 (분모 없는 관찰 방지)', async () => {
    await call(init, { argus_dir: argusDir });
    const data = await call(checkIn, { argus_dir: argusDir, today_override: '2026-07-11' });
    const dv = data['v2_divergence'] as Divergence;
    expect(dv.comparable).toBe(true);
    expect(dv).toMatchObject({ v1_due: 0, v2_due: 0, diverged: false });
  });

  it('강제 발산(v2에만 존재하는 due)이 only_v2로 드러난다', async () => {
    const initData = await call(init, { argus_dir: argusDir });
    const repoId = (initData['v2'] as { repository_id: string }).repository_id;
    expect(repoId).toBeTruthy();
    // v1을 우회해 v2에만 봉인 — 실제로 일어나면 안 되는 상태를 인위 재현
    const ctx = contextFor({
      home, gitCommonDir: path.join(repoDir, '.git'), workspaceArgusDir: argusDir,
      sessionId: 's-dv', producerVersion: 't', today: '2026-07-01',
    });
    sealV2(ctx, {
      decisionId: 'v2-only',
      predicate: { value: 'v2 원장에만 존재하는 봉인', provenance: 'elicited_user' },
      checkBy: { value: '2026-07-05', provenance: 'elicited_user' },
    });
    const data = await call(checkIn, { argus_dir: argusDir, today_override: '2026-07-11' });
    const dv = data['v2_divergence'] as Divergence;
    expect(dv.diverged).toBe(true);
    expect(dv.only_v2).toContain('v2-only');
    expect(dv.only_v1).toEqual([]);
  });
});
