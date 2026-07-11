/**
 * P1 수술 1단계 검증 — argus_init 툴이 v2 바인딩을 실제로 수행하는지.
 * 실제 툴 핸들러를 그대로 호출한다 (v1 동작 보존 + v2 병기 둘 다 확인).
 * ARGUS_HOME 환경변수로 내구 홈을 임시 디렉토리로 돌린다.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { init } from '../tools/init-config.js';
import { lookupRepository } from './ledger.js';

let home: string;
let repoDir: string;
let savedHome: string | undefined;

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-wire-home-'));
  repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-wire-repo-'));
  fs.mkdirSync(path.join(repoDir, '.git'), { recursive: true });
  savedHome = process.env['ARGUS_HOME'];
  process.env['ARGUS_HOME'] = home;
});
afterEach(() => {
  if (savedHome === undefined) delete process.env['ARGUS_HOME'];
  else process.env['ARGUS_HOME'] = savedHome;
  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(repoDir, { recursive: true, force: true });
});

interface InitData {
  initialized: boolean;
  v2: { bound: boolean; repository_id?: string; workspace_id?: string; newly_registered?: boolean; reason?: string; v1_migration?: unknown[] };
}

async function runInit(argusDir: string): Promise<InitData> {
  const res = await init.handler({ argus_dir: argusDir });
  const sc = res.structuredContent as { ok: boolean; data: InitData };
  expect(sc.ok).toBe(true); // v1 계약: init은 성공한다
  return sc.data;
}

describe('argus_init ↔ v2 바인딩 배선 (파괴 없는 추가)', () => {
  it('inside a git repo: v1 init still works AND v2 binds to the durable home', async () => {
    const argusDir = path.join(repoDir, '.argus');
    const data = await runInit(argusDir);
    // v1 동작 보존
    expect(data.initialized).toBe(true);
    expect(fs.existsSync(path.join(argusDir, 'ledger'))).toBe(true);
    // v2 병기
    expect(data.v2.bound).toBe(true);
    expect(data.v2.newly_registered).toBe(true);
    expect(lookupRepository(home, path.join(repoDir, '.git'))).toBe(data.v2.repository_id);
    // 재실행 멱등 — 같은 id
    const again = await runInit(argusDir);
    expect(again.v2.repository_id).toBe(data.v2.repository_id);
    expect(again.v2.newly_registered).toBe(false);
  });

  it('outside any git repo: v1 init unchanged, v2 declines with an honest reason', async () => {
    const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-wire-bare-'));
    try {
      const data = await runInit(path.join(bare, '.argus'));
      expect(data.initialized).toBe(true); // v1은 git 없이도 동작 — 그대로
      expect(data.v2.bound).toBe(false);
      expect(data.v2.reason).toMatch(/git/); // 침묵이 아니라 사유
    } finally {
      fs.rmSync(bare, { recursive: true, force: true });
    }
  });

  it('discovers and migrates a v1 ledger during init, reporting it (not source_missing noise)', async () => {
    const argusDir = path.join(repoDir, '.argus');
    const v1src = path.join(argusDir, 'ledger', 'ledger.jsonl');
    fs.mkdirSync(path.dirname(v1src), { recursive: true });
    fs.writeFileSync(v1src, JSON.stringify({ v: 1, id: 'old', event: 'harvest', decision: 'x' }) + '\n');
    const data = await runInit(argusDir);
    expect(data.v2.v1_migration).toEqual([
      expect.objectContaining({ action: 'copied', lines: 1 }),
    ]); // source_missing 잡음은 걸러지고 실제 이전만 보고된다
  });
});
