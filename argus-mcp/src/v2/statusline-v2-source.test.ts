/**
 * P2-2 스모크 — v1 statusline이 v2 내구 원장을 읽는지, 실제 스크립트를
 * spawn해서 끝에서 끝까지 검증한다 (P0 스파이크 ① 판정의 이행: "데이터
 * 소스만 교체"). 리포 밖(published 패키지)에는 플러그인이 없으므로 skip.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const STATUSLINE = path.resolve(here, '..', '..', '..', 'argus-plugin-v2', 'statusline', 'index.js');
const hasPlugin = fs.existsSync(STATUSLINE);

let home: string;
let repoDir: string;
const REPO_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-sl-home-'));
  repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-sl-repo-'));
  fs.mkdirSync(path.join(repoDir, '.git'), { recursive: true });
});
afterEach(() => {
  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(repoDir, { recursive: true, force: true });
});

function run(cwd: string): string {
  return execFileSync('node', [STATUSLINE], {
    input: JSON.stringify({ workspace: { current_dir: cwd }, model: { display_name: 'T' } }),
    env: { ...process.env, ARGUS_HOME: home, COLUMNS: '140' },
    encoding: 'utf8',
  });
}

function bindWorkspace(): void {
  fs.mkdirSync(path.join(repoDir, '.argus'), { recursive: true });
  fs.writeFileSync(path.join(repoDir, '.argus', 'project.json'),
    JSON.stringify({ repository_id: REPO_ID, workspace_id: 'w' }));
  fs.mkdirSync(path.join(home, 'projects', REPO_ID), { recursive: true });
}

const env2 = (over: Record<string, unknown>) => JSON.stringify({
  event_id: '01JZXK5N8Q2W4E6R8T0Y2Z4A6B', v: 2, producer_version: 't',
  repository_id: REPO_ID, workspace_id: '9b2fd3a1-6c7e-4a2b-8d1f-2e3a4b5c6d7e',
  session_id: 's', occurred_at: '2026-07-01T00:00:00Z', logical_date: '2026-07-01',
  tz: 'UTC', idempotency_key: `k-${String(over['event'])}-${String(over['decision_id'])}`, ...over,
});
const u = (value: string) => ({ value, provenance: 'host_reported' });

describe.skipIf(!hasPlugin)('statusline이 v2 내구 원장을 읽는다 (P2-2)', () => {
  it('바인딩된 워크스페이스: v2 봉인의 지난 확인일이 OVERDUE로 뜬다', () => {
    bindWorkspace();
    fs.writeFileSync(path.join(home, 'projects', REPO_ID, 'ledger.jsonl'),
      env2({ event: 'seal', decision_id: 'v2-due', predicate: u('내구 원장에서 왔다'), check_by: u('2026-01-01') }) + '\n');
    const out = run(repoDir);
    expect(out).toContain('OVERDUE');
    expect(out).toContain('내구 원장에서 왔다');
  });

  it('v1 스냅샷(ledger.v1.jsonl)의 옛 결정도 같은 화면에 접힌다', () => {
    bindWorkspace();
    fs.writeFileSync(path.join(home, 'projects', REPO_ID, 'ledger.v1.jsonl'), [
      JSON.stringify({ v: 1, id: 'old', event: 'harvest', decision: '스냅샷의 옛 봉인' }),
      JSON.stringify({ v: 1, id: 'old', event: 'seal', predicate: '스냅샷의 옛 봉인', check_by: '2026-01-02' }),
    ].join('\n') + '\n');
    const out = run(repoDir);
    expect(out).toContain('OVERDUE');
    expect(out).toContain('스냅샷의 옛 봉인');
  });

  it('v2 settle은 due를 지우고, 활성 snooze는 그날까지 침묵시킨다', () => {
    bindWorkspace();
    fs.writeFileSync(path.join(home, 'projects', REPO_ID, 'ledger.jsonl'), [
      env2({ event: 'seal', decision_id: 'a', predicate: u('정산된 것'), check_by: u('2026-01-01') }),
      env2({ event: 'settle', decision_id: 'a', outcome: { value: 'held', provenance: 'host_reported' } }),
      env2({ event: 'seal', decision_id: 'b', predicate: u('잠든 것'), check_by: u('2026-01-01') }),
      env2({ event: 'snooze', decision_id: 'b', until: '2099-01-01' }),
    ].join('\n') + '\n');
    const out = run(repoDir);
    expect(out).not.toContain('OVERDUE'); // 정산됨 + 잠듦 — 빈 잔소리 없음
  });

  it('바인딩 없는 리포는 기존 v1 경로 그대로 (파괴 없는 추가)', () => {
    fs.mkdirSync(path.join(repoDir, '.argus', 'ledger'), { recursive: true });
    fs.writeFileSync(path.join(repoDir, '.argus', 'ledger', 'ledger.jsonl'), [
      JSON.stringify({ v: 1, id: 'legacy', event: 'harvest', decision: '레거시 경로 봉인' }),
      JSON.stringify({ v: 1, id: 'legacy', event: 'seal', predicate: '레거시 경로 봉인', check_by: '2026-01-03' }),
    ].join('\n') + '\n');
    const out = run(repoDir);
    expect(out).toContain('OVERDUE');
    expect(out).toContain('레거시 경로 봉인');
  });
});
