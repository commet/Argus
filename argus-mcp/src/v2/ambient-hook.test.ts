/**
 * ambient-nudge 훅 (UserPromptSubmit) spawn e2e.
 *
 * 창업자 컨셉 (2026-07-15): 사용자가 주요 작업을 프롬프팅하고 기다리는 동안
 * due 항목 하나를 물어 판단을 되먹인다. 이 테스트가 고정하는 계약 — 발사
 * 게이트가 형태보다 먼저다 (스파인 미러 조항):
 *
 *  ① 바인딩 없음 = 침묵 (v2 미사용자에게 소음 0)
 *  ② fresh + due 0건 = 침묵 (빈 잔소리 없음)
 *  ③ fresh + due>0 = 발사: 건수·지침만, predicate/전제 본문 미주입 (규칙 19),
 *     전제는 자유 텍스트 강제 (다지선다 crux는 fork)
 *  ④ 같은 세션 재프롬프트 = 침묵 (세션당 1회)
 *  ⑤ 다른 세션이라도 4시간 내 = 침묵 / 4시간 지나면 재발사
 *  ⑥ stale LOGBOOK = 침묵 (뒤처진 숫자로 nudge하지 않는다)
 *  ⑦ opt-out(~/.argus/config.json ambient.opt_out) = 침묵
 *  ⑧ 쿨다운 기판(CLAUDE_PLUGIN_DATA) 없음 = 침묵 (상한 없는 nudge 금지)
 *  ⑨ 열린 질문만 있고 due 0건 = 침묵 (열어둔 질문의 재개봉은 방아쇠가 아니다)
 *  ⑩ 상태 파일 파손 = 이력 없음으로 취급하고 발사, exit 0
 *
 * fresh 픽스처는 진짜 renderLogbook으로 만든다 — 훅의 커서/건수 파싱이
 * 렌더러의 실제 출력 형식과 어긋나면 여기가 빨간불이 된다.
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
const HOOK = path.resolve(here, '..', '..', '..', 'argus-driver', 'hooks', 'ambient-nudge.js');

const REPO_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const ULID = '01JZXK5N8Q2W4E6R8T0Y2Z4A6B';
const PREDICATE_BODY = '경쟁사보다 우리가 먼저 출시한다'; // 절대 주입되면 안 되는 본문
const PREMISE_BODY = '기준금리가 2026년 내내 3.5%로 유지된다';

let home: string;
let repoDir: string;
let dataDir: string;

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-amb-home-'));
  repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-amb-repo-'));
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-amb-data-'));
});
afterEach(() => {
  for (const d of [home, repoDir, dataDir]) fs.rmSync(d, { recursive: true, force: true });
});

function run(sessionId = 'sess-1', envOver: Record<string, string | undefined> = {}): string {
  const env: Record<string, string | undefined> = {
    ...process.env, ARGUS_HOME: home, CLAUDE_PLUGIN_DATA: dataDir, ...envOver,
  };
  for (const k of Object.keys(env)) { if (env[k] === undefined) delete env[k]; }
  return execFileSync('node', [HOOK], {
    input: JSON.stringify({ cwd: repoDir, session_id: sessionId, hook_event_name: 'UserPromptSubmit' }),
    env: env as NodeJS.ProcessEnv,
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
    logical_date: '2026-07-15', due: [], unsealed_net: [], premise_rechecks_due: [], open_questions: [],
    candidates_active: [], candidates_expired: 0, sealed_alive: 0,
    anomalies: 0, skipped_unknown: 0, dropped_corrupt: 0,
    last_event_id: ULID, ...over,
  };
  fs.writeFileSync(path.join(repoDir, '.argus', 'LOGBOOK.md'), renderLogbook(brief, REPO_ID));
}

const DUE_FIXTURE: Partial<BriefState> = {
  due: [{ decision_id: 'd1', predicate: PREDICATE_BODY, check_by: '2026-07-14', overdue_days: 1, suggest_dismiss: false }],
  premise_rechecks_due: [{ premise_id: 'p1', text: PREMISE_BODY, due_since: '2026-07-13' }],
};

const parseCtx = (out: string): string =>
  out ? (JSON.parse(out).hookSpecificOutput.additionalContext as string) : '';

describe('ambient-nudge 훅 (UserPromptSubmit)', () => {
  it('① 바인딩 없는 워크스페이스 = 완전 침묵', () => {
    expect(run()).toBe('');
  });

  it('② fresh + due 0건 = 침묵 (빈 잔소리 없음)', () => {
    bind(); writeLedgerLine(ULID); freshLogbook({});
    expect(run()).toBe('');
  });

  it('③ fresh + due>0 = 발사 — 건수·형태 규칙만, 본문 미주입 (규칙 19)', () => {
    bind(); writeLedgerLine(ULID); freshLogbook(DUE_FIXTURE);
    const ctx = parseCtx(run());
    expect(ctx).toContain('정산할 예측 1건');
    expect(ctx).toContain('다시 확인할 전제 1건');
    expect(ctx).toContain('argus_check_in'); // 내용은 서버에서 — 두뇌 하나
    expect(ctx).toContain('자유 텍스트'); // 전제 질문의 fork 금지 형태 규칙
    expect(ctx).toContain('한 번에 하나');
    // MCP 미연결 열화 규칙 (e2e run C 실측: 도구 없는 지침은 주입 의심을 유발)
    expect(ctx).toContain('조용히 무시');
    expect(ctx).toContain('플러그인 훅'); // 출처 자기 명시
    // argus_dir 절대경로 주입 (e2e run E' 실측: 경로를 추측에 맡기면 빈
    // 기본 원장을 읽고 due 0건 — 규칙 18: 경로는 1급 표면)
    expect(ctx).toContain(path.join(repoDir, '.argus'));
    expect(ctx).not.toContain(PREDICATE_BODY); // untrusted 본문은 절대 미주입
    expect(ctx).not.toContain(PREMISE_BODY);
  });

  it('④ 같은 세션 재프롬프트 = 침묵 (세션당 1회)', () => {
    bind(); writeLedgerLine(ULID); freshLogbook(DUE_FIXTURE);
    expect(run('sess-1')).not.toBe('');
    expect(run('sess-1')).toBe('');
  });

  it('⑤ 다른 세션 4시간 내 = 침묵, 4시간 지나면 재발사', () => {
    bind(); writeLedgerLine(ULID); freshLogbook(DUE_FIXTURE);
    expect(run('sess-1')).not.toBe('');
    expect(run('sess-2')).toBe(''); // 세션이 달라도 쿨다운
    const statePath = path.join(dataDir, 'ambient-state.json');
    const st = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    fs.writeFileSync(statePath, JSON.stringify({ ...st, last_fired_at: Date.now() - 5 * 3600_000 }));
    expect(run('sess-2')).not.toBe('');
  });

  it('⑥ stale LOGBOOK = 침묵 (뒤처진 숫자로 nudge하지 않는다)', () => {
    bind(); writeLedgerLine('01JZXK5N8Q2W4E6R8T0Y2Z4A6C'); // 원장이 한 발 앞섬
    freshLogbook(DUE_FIXTURE); // 커서는 ULID — 불일치
    expect(run()).toBe('');
  });

  it('⑦ opt-out 설정 = 침묵', () => {
    bind(); writeLedgerLine(ULID); freshLogbook(DUE_FIXTURE);
    fs.writeFileSync(path.join(home, 'config.json'), JSON.stringify({ ambient: { opt_out: true } }));
    expect(run()).toBe('');
  });

  it('⑧ CLAUDE_PLUGIN_DATA 없음 = 침묵 (상한 없는 nudge 금지)', () => {
    bind(); writeLedgerLine(ULID); freshLogbook(DUE_FIXTURE);
    expect(run('sess-1', { CLAUDE_PLUGIN_DATA: undefined })).toBe('');
  });

  it('⑨ 열린 질문만 있고 due 0건 = 침묵 (재개봉은 방아쇠가 아니다)', () => {
    bind(); writeLedgerLine(ULID);
    freshLogbook({ open_questions: [{ premise_id: 'q1', text: '요금제를 연내 확정할 것인가' }] });
    expect(run()).toBe('');
  });

  it('⑩ 상태 파일 파손 = 이력 없음으로 취급하고 발사 (exit 0)', () => {
    bind(); writeLedgerLine(ULID); freshLogbook(DUE_FIXTURE);
    fs.writeFileSync(path.join(dataDir, 'ambient-state.json'), '{corrupt');
    expect(run()).not.toBe('');
    // 발사 후 상태는 복구되어 있다 (다음 게이트가 정상 작동)
    expect(() => JSON.parse(fs.readFileSync(path.join(dataDir, 'ambient-state.json'), 'utf8'))).not.toThrow();
  });

  // ── 적대 케이스 — 어떤 파손도 사용자의 턴을 막거나 nudge 폭주로 새지 않는다 ──

  it('⑪ LOGBOOK이 쓰레기 바이트 = 침묵, exit 0', () => {
    bind(); writeLedgerLine(ULID);
    fs.writeFileSync(path.join(repoDir, '.argus', 'LOGBOOK.md'), '\x00\x01garbage no cursor here');
    expect(run()).toBe('');
  });

  it('⑫ project.json 파손 = 침묵, exit 0', () => {
    fs.mkdirSync(path.join(repoDir, '.argus'), { recursive: true });
    fs.writeFileSync(path.join(repoDir, '.argus', 'project.json'), '{not json');
    writeLedgerLine(ULID);
    expect(run()).toBe('');
  });

  it('⑬ stdin 빈 입력 = 침묵, exit 0', () => {
    bind(); writeLedgerLine(ULID); freshLogbook(DUE_FIXTURE);
    const out = execFileSync('node', [HOOK], {
      input: '', env: { ...process.env, ARGUS_HOME: home, CLAUDE_PLUGIN_DATA: dataDir } as NodeJS.ProcessEnv, encoding: 'utf8',
      // cwd가 페이로드에 없으면 process.cwd()로 폴백 — 바인딩 없는 곳이므로 침묵
      cwd: home,
    });
    expect(out).toBe('');
  });

  it('⑭ stdin이 JSON이 아님 = 페이로드 무시하고도 안전 (침묵 또는 정상 발사, 절대 비정상 종료 없음)', () => {
    bind(); writeLedgerLine(ULID); freshLogbook(DUE_FIXTURE);
    const out = execFileSync('node', [HOOK], {
      input: 'garbage{{{not json',
      env: { ...process.env, ARGUS_HOME: home, CLAUDE_PLUGIN_DATA: dataDir } as NodeJS.ProcessEnv,
      encoding: 'utf8', cwd: repoDir, // cwd 폴백이 바인딩된 repo → due가 보이면 발사도 정상
    });
    // 계약은 "exit 0 + 유효한 출력(무 또는 JSON)"이다.
    if (out !== '') expect(() => JSON.parse(out)).not.toThrow();
  });

  it('⑮ session_id 부재 = 발사는 되고, 시간 쿨다운이 세션 가드를 대신한다', () => {
    bind(); writeLedgerLine(ULID); freshLogbook(DUE_FIXTURE);
    const runNoSession = () => execFileSync('node', [HOOK], {
      input: JSON.stringify({ cwd: repoDir }), // session_id 없음
      env: { ...process.env, ARGUS_HOME: home, CLAUDE_PLUGIN_DATA: dataDir } as NodeJS.ProcessEnv,
      encoding: 'utf8',
    });
    expect(runNoSession()).not.toBe('');
    expect(runNoSession()).toBe(''); // 4시간 시간 쿨다운이 잡는다
  });

  it('⑯ 원장 마지막 줄 파손 = 보수적으로 침묵 (뒤처졌을 가능성이 있는 숫자로 nudge하지 않는다)', () => {
    bind();
    fs.mkdirSync(path.join(home, 'projects', REPO_ID), { recursive: true });
    fs.writeFileSync(path.join(home, 'projects', REPO_ID, 'ledger.jsonl'), '{corrupt last line\n');
    freshLogbook(DUE_FIXTURE); // 커서 ULID ↔ 원장 판독 불능(null) → 불일치 → 침묵
    expect(run()).toBe('');
  });
});
