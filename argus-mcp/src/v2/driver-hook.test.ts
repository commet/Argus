/**
 * P2-5 — SessionStart 훅 spawn e2e (구 argus-driver, O3 방1에서 argus 플러그인으로 흡수).
 *
 * 훅은 감지·안내만 하는 zero-dep 스크립트다. 여기서 고정하는 계약:
 *  ① 바인딩 없는 워크스페이스 = 완전 침묵 (v2 미사용자에게 소음 0)
 *  ② stale LOGBOOK = check_in 재생성 안내 (재생성 두뇌는 서버 하나 — 훅이
 *     직접 렌더하지 않는다)
 *  ③ fresh + due>0 = 침묵 — due 발화는 check-contracts 훅이 단독 소유 (O3 방2:
 *     같은 SessionStart에서 두뇌 둘이 세면 같은 due가 두 줄로 도착한다)
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
const HOOK = path.resolve(here, '..', '..', '..', 'argus-plugin-v2', 'hooks', 'session-start.js');

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
    logical_date: '2026-07-11', due: [], unsealed_net: [], premise_rechecks_due: [], open_questions: [],
    candidates_active: [], candidates_expired: 0, sealed_alive: 0,
    anomalies: 0, skipped_unknown: 0, dropped_corrupt: 0,
    last_event_id: ULID, ...over,
  };
  fs.writeFileSync(path.join(repoDir, '.argus', 'LOGBOOK.md'), renderLogbook(brief, REPO_ID));
}

describe('플러그인 SessionStart 훅 (P2-5, 구 driver)', () => {
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

  it('③ fresh + due 2건 — 침묵: due 발화는 check-contracts 훅이 단독 소유 (O3 방2)', () => {
    // 과거엔 여기서 건수+경로를 주입했다. 병합 플러그인에선 같은 SessionStart에
    // check-contracts.js가 두 평면(프로젝트 v1 UNION 내구 원장)을 접어 due를
    // 발화하므로, 이 훅도 세면 같은 due가 두 줄로 도착한다(over-fire). 이 훅의
    // 몫은 LOGBOOK 신선도(②)·첫 안내·수확 큐까지다.
    bind();
    writeLedgerLine(ULID);
    freshLogbook({
      due: [
        { decision_id: 'a', predicate: 'SECRET-PREDICATE-A', check_by: '2026-07-01', overdue_days: 10, suggest_dismiss: false },
        { decision_id: 'b', predicate: 'SECRET-PREDICATE-B', check_by: '2026-07-02', overdue_days: 9, suggest_dismiss: false },
      ],
    });
    expect(run()).toBe('');
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

  it('⑥ 수확 opt-in 없음 — 큐 파일조차 만들지 않는다 (opt-in 전 흔적 0)', () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-hook-data-'));
    fs.writeFileSync(path.join(dataDir, 'welcome-shown'), 'shown\n'); // 온보딩 격리 — 이 테스트는 수확만
    try {
      const out = execFileSync('node', [HOOK], {
        input: JSON.stringify({ cwd: repoDir, session_id: 'sess-1', transcript_path: '/t/s.jsonl' }),
        env: { ...process.env, ARGUS_HOME: home, CLAUDE_PLUGIN_DATA: dataDir },
        encoding: 'utf8',
      });
      expect(out).toBe('');
      expect(fs.existsSync(path.join(dataDir, 'harvest-queue.json'))).toBe(false);
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it('⑦ opt-in 인입은 멱등이고, 훅이 쓴 큐를 src queue.ts가 그대로 클레임한다 (파일 계약)', async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-hook-data-'));
    fs.writeFileSync(path.join(dataDir, 'welcome-shown'), 'shown\n'); // 온보딩 격리
    try {
      fs.mkdirSync(home, { recursive: true });
      fs.writeFileSync(path.join(home, 'config.json'), JSON.stringify({ harvest: { opt_in: true } }));
      const runHook = (sessionId: string) => execFileSync('node', [HOOK], {
        input: JSON.stringify({ cwd: repoDir, session_id: sessionId, transcript_path: `/t/${sessionId}.jsonl` }),
        env: { ...process.env, ARGUS_HOME: home, CLAUDE_PLUGIN_DATA: dataDir },
        encoding: 'utf8',
      });

      expect(runHook('sess-1')).toBe(''); // 자기 세션만 있는 큐 — 대기 안내 없음 (자기 제외)
      runHook('sess-1'); // 멱등 — 중복 인입 없음
      const { readQueue, claim } = await import('./queue.js');
      expect(readQueue(dataDir).items).toHaveLength(1);

      // 다음 세션이 뜨면: 이전 세션 항목이 "대기 중"으로 보이고, 처리 단계가 클레임 가능
      const out2 = runHook('sess-2');
      expect(out2).toContain('자동 포착할 기록 1건이 대기 중');
      expect(out2).not.toContain('lease'); // 훅은 확인만 — 클레임 안 함
      const claimed = claim(dataDir, new Date().toISOString(), 600_000, 'proc-1');
      expect(claimed?.item_id).toBe('harvest-sess-1'); // 교차 구현: 훅이 쓴 항목을 queue.ts가 잠근다
      expect(claimed?.transcript_path).toBe('/t/sess-1.jsonl');
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it('⑧ opt-in이어도 CLAUDE_PLUGIN_DATA 없으면 침묵 (저장처 없는 인입 금지)', () => {
    fs.mkdirSync(home, { recursive: true });
    fs.writeFileSync(path.join(home, 'config.json'), JSON.stringify({ harvest: { opt_in: true } }));
    const env = { ...process.env, ARGUS_HOME: home };
    delete (env as Record<string, unknown>)['CLAUDE_PLUGIN_DATA'];
    const out = execFileSync('node', [HOOK], {
      input: JSON.stringify({ cwd: repoDir, session_id: 's', transcript_path: '/t/s.jsonl' }),
      env, encoding: 'utf8',
    });
    expect(out).toBe('');
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

describe('첫 실행 안내 (온보딩)', () => {
  it('설치 첫 세션엔 안내가 뜨고, 마커가 생겨 다음부터는 침묵', () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-hook-welcome-'));
    try {
      const run1 = execFileSync('node', [HOOK], {
        input: JSON.stringify({ cwd: repoDir }),
        env: { ...process.env, ARGUS_HOME: home, CLAUDE_PLUGIN_DATA: dataDir },
        encoding: 'utf8',
      });
      expect(run1).toContain('Argus가 연결되었습니다');
      expect(run1).toContain('별도 초기화 명령은 필요하지 않습니다');
      expect(run1).not.toContain('argus_seal');
      expect(run1).not.toContain('argus_init');
      expect(run1).toContain('이번 한 번만'); // 1회 약속
      expect(fs.existsSync(path.join(dataDir, 'welcome-shown'))).toBe(true);

      // 두 번째 세션 — 마커 존재 → 완전 침묵 (잔소리 금지)
      const run2 = execFileSync('node', [HOOK], {
        input: JSON.stringify({ cwd: repoDir }),
        env: { ...process.env, ARGUS_HOME: home, CLAUDE_PLUGIN_DATA: dataDir },
        encoding: 'utf8',
      });
      expect(run2).toBe('');
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it('CLAUDE_PLUGIN_DATA 없으면 안내를 내지 않는다 (매 세션 반복 방지)', () => {
    const env = { ...process.env, ARGUS_HOME: home };
    delete (env as Record<string, unknown>)['CLAUDE_PLUGIN_DATA'];
    const out = execFileSync('node', [HOOK], {
      input: JSON.stringify({ cwd: repoDir }), env, encoding: 'utf8',
    });
    expect(out).toBe('');
  });
});
