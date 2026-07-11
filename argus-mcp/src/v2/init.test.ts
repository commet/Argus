/** initV2 테스트 — 명시적 바인딩·멱등 재실행·v1 자동 발견 이전의 수용 기준. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initV2 } from './init.js';
import { ledgerPath, lookupRepository } from './ledger.js';
import { loadState } from './reducer.js';
import { contextFor, sealV2 } from './bridge.js';

let home: string;
let repoDir: string;

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-init-home-'));
  repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-init-repo-'));
  fs.mkdirSync(path.join(repoDir, '.git'), { recursive: true });
});
afterEach(() => {
  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(repoDir, { recursive: true, force: true });
});

const argsFor = () => ({
  home, gitCommonDir: path.join(repoDir, '.git'),
  workspaceArgusDir: path.join(repoDir, '.argus'),
});

describe('initV2 — 바인딩과 멱등', () => {
  it('registers once, then re-runs return the SAME ids (멱등)', () => {
    const first = initV2(argsFor());
    const again = initV2(argsFor());
    expect(first.newly_registered).toBe(true);
    expect(again.newly_registered).toBe(false);
    expect(again.repository_id).toBe(first.repository_id);
    expect(again.workspace_id).toBe(first.workspace_id);
    expect(lookupRepository(home, path.join(repoDir, '.git'))).toBe(first.repository_id);
  });

  it('does NOT pre-create an empty ledger — the first event does', () => {
    const r = initV2(argsFor());
    expect(fs.existsSync(ledgerPath(home, r.repository_id))).toBe(false);
    // 첫 이벤트가 파일을 만든다 (설치됨 ≠ 결정 있음의 구분 보존).
    const ctx = contextFor({ ...argsFor(), sessionId: 's', producerVersion: 'v', today: '2026-07-11' });
    sealV2(ctx, { decisionId: 'd', predicate: { value: '12345678', provenance: 'elicited_user' }, checkBy: { value: '2026-08-01', provenance: 'elicited_user' } });
    expect(fs.existsSync(ledgerPath(home, r.repository_id))).toBe(true);
  });

  it('reports missing v1 sources honestly instead of omitting them', () => {
    const r = initV2(argsFor());
    expect(r.v1_migration).toHaveLength(2); // 후보 2곳 전부 보고
    expect(r.v1_migration.every((m) => m.action === 'source_missing')).toBe(true);
  });
});

describe('initV2 — v1 자동 발견 이전 (II-F)', () => {
  it('finds <project>/.argus/ledger/ledger.jsonl, copies it, and v2 reads the old decision', () => {
    const v1src = path.join(repoDir, '.argus', 'ledger', 'ledger.jsonl');
    fs.mkdirSync(path.dirname(v1src), { recursive: true });
    fs.writeFileSync(v1src, [
      JSON.stringify({ v: 1, ts: '2026-06-01T00:00:00Z', id: 'legacy', event: 'harvest', decision: '옛 결정' }),
      JSON.stringify({ v: 1, ts: '2026-06-01T00:01:00Z', id: 'legacy', event: 'seal', predicate: '옛 예측 12345678', check_by: '2026-08-01' }),
    ].join('\n') + '\n');

    const r = initV2(argsFor());
    const migrated = r.v1_migration.find((m) => m.source === v1src);
    expect(migrated).toMatchObject({ action: 'copied', lines: 2 });
    expect(fs.readFileSync(v1src, 'utf8')).toContain('옛 결정'); // 원본 무접촉

    const state = loadState(home, r.repository_id);
    expect(state.decisions.get('legacy')?.state).toBe('sealed'); // 이전 즉시 v2가 읽는다
    // 재실행 = no-op
    expect(initV2(argsFor()).v1_migration.find((m) => m.source === v1src)?.action).toBe('already_migrated');
  });

  it('finds ~/.argus/ledger/ledger.jsonl (the second spec candidate) too', () => {
    const v1home = path.join(home, 'ledger', 'ledger.jsonl');
    fs.mkdirSync(path.dirname(v1home), { recursive: true });
    fs.writeFileSync(v1home, JSON.stringify({ v: 1, id: 'h', event: 'harvest', decision: 'x' }) + '\n');
    const r = initV2(argsFor());
    expect(r.v1_migration.find((m) => m.source === v1home)?.action).toBe('copied');
    expect(loadState(home, r.repository_id).decisions.has('h')).toBe(true);
  });
});
