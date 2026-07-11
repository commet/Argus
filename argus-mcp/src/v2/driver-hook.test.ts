/**
 * P2-5 — argus-driver SessionStart 훅 spawn e2e.
 *
 * 훅은 감지·안내만 하는 zero-dep 스크립트다. 여기서 고정하는 계약:
 *  ① 바인딩 없는 워크스페이스 = 완전 침묵 (v2 미사용자에게 소음 0)
 *  ② stale LOGBOOK = check_in 재생성 안내 (재생성 두뇌는 서버 하나 — 훅이
 *     직접 렌더하지 않는다)
 *  ③ fresh + due>0 = 건수·절대경로 한 줄 (predicate 본문은 절대 미주입 —
 *     정본 규칙 19)
 *  ④ fresh + due 0 = 침묵 (빈 잔소리 없음)
 *  ⑤ 어떤 파손도 exit 0 (훅이 세션 시작을 막지 않는다)
 * fresh 픽스처는 진짜 renderLogbook으로 만든다 — 훅의 커서/건수 파싱이
 * 렌더러의 실제 출력 형식과 어긋나면 여기가 빨간불이 된다 (문자열 계약을
 * 두 구현이 공유하므로, 대조는 실물로).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderLogbook } from './logbook.js';
import type { BriefState } from './brief.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const HOOK = path.resolve(here, '..', '..', '..', 'argus-driver', 'hooks', 'session-start.js');

const REPO_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const ULID = '01JZXK5N8Q2W4E6R8T0Y2Z4A6B';

let home: string;
let repoDir: string;

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-hook-home-'));
  repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-hook-repo-'));
});
afterEach(() => {
  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(repoDir, { recursive: true, force: true });
});

function run(): string {
  return execFileSync('node', [HOOK], {
    input: JSON.stringify({ cwd: repoDir, hook_event_name: 'SessionStart' }),
    env: { ...process.env, ARGUS_HOME: home },
    encoding: 'utf8',
  });
}

function bind(): void {
  fs.mkdirSync(path.join(repoDir, '.argus'), { recursive: true });
  fs.writeFileSync(path.join(repoDir, '.argus', 'project.json'),
    JSON.stringify({ repository_id: REPO_ID, workspace_id: 'w' }));
}

function writeLedgerLine(eventId: string): void {
  fs.mkdirSync(path.join(home, 'projects', REPO_ID), { recursive: true });
  fs.writeFileSync(path.join(home, 'projects', REPO_ID, 'ledger.jsonl'),
    JSON.stringify({ event_id: eventId, v: 2, event: 'seal' }) + '\n');
}

function freshLogbook(over: Partial<BriefState>): void {
  const brief: BriefState = {
    logical_date: '2026-07-11', due: [], premise_rechecks_due: [], open_questions: [],
    candidates_active: [], candidates_expired: 0, sealed_alive: 0,
    anomalies: 0, skipped_unknown: 0, dropped_corrupt: 0,
    last_event_id: ULID, ...over,
  };
  fs.writeFileSync(path.join(repoDir, '.argus', 'LOGBOOK.md'), renderLogbook(brief, REPO_ID));
}

describe('argus-driver SessionStart 훅 (P2-5)', () => {
  it('① 바인딩 없는 워크스페이스 — 완전 침묵, exit 0', () => {
    expect(run()).toBe('');
  });

  it('② 원장은 있는데 LOGBOOK이 없거나 커서가 낡음 — check_in 재생성 안내', () => {
    bind();
    writeLedgerLine(ULID);
    const stale = run(); // LOGBOOK 부재
    expect(stale).toContain('argus_check_in');
    expect(JSON.parse(stale).hookSpecificOutput.hookEventName).toBe('SessionStart');

    freshLogbook({ last_event_id: '01JZXK5N8Q2W4E6R8T0Y2Z4A6C' }); // 다른 커서
    expect(run()).toContain('argus_check_in');
  });

  it('③ fresh + due 2건 — 건수와 절대 경로만 주입, predicate 본문은 없다', () => {
    bind();
    writeLedgerLine(ULID);
    freshLogbook({
      due: [
        { decision_id: 'a', predicate: 'SECRET-PREDICATE-A', check_by: '2026-07-01', overdue_days: 10, suggest_dismiss: false },
        { decision_id: 'b', predicate: 'SECRET-PREDICATE-B', check_by: '2026-07-02', overdue_days: 9, suggest_dismiss: false },
      ],
    });
    const out = run();
    expect(out).toContain('2건');
    expect(out).toContain('argus_settle');
    expect(out).toContain(path.join(repoDir, '.argus', 'LOGBOOK.md')); // 규칙 18: 경로 1급 표면
    expect(out).not.toContain('SECRET-PREDICATE'); // 규칙 19: 본문 미주입
  });

  it('④ fresh + due 0건 — 침묵 (빈 잔소리 없음)', () => {
    bind();
    writeLedgerLine(ULID);
    freshLogbook({});
    expect(run()).toBe('');
  });

  it('⑤ 원장 0건 + 커서 none — fresh로 인정, 침묵', () => {
    bind();
    freshLogbook({ last_event_id: null }); // 커서 'none', 원장 파일 자체가 없음
    expect(run()).toBe('');
  });

  it('⑤-b 파손 입력(빈 stdin·깨진 원장 줄)에도 exit 0', () => {
    bind();
    fs.mkdirSync(path.join(home, 'projects', REPO_ID), { recursive: true });
    fs.writeFileSync(path.join(home, 'projects', REPO_ID, 'ledger.jsonl'), '{broken json\n');
    const out = execFileSync('node', [HOOK], {
      input: '', env: { ...process.env, ARGUS_HOME: home }, encoding: 'utf8', cwd: repoDir,
    });
    // 깨진 마지막 줄 = event_id 미상 → 커서 대조는 보수적으로 stale 쪽 — 죽지만 않으면 된다
    expect(typeof out).toBe('string');
  });
});
