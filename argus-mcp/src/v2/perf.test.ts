/**
 * P4-2 — Matrix Performance 행: "10k·100k 이벤트 replay/brief/resource 시간
 * 측정 + SessionStart latency budget 준수".
 *
 * 이 테스트의 목적은 **측정이 존재하고 CI마다 실측이 남는 것**이다. 캡은
 * 의도적으로 관대하다 — CI 머신 편차로 인한 가짜 빨간불(flaky)은 측정의
 * 신뢰를 죽이므로, 캡은 "구조적 회귀(선형→제곱, 우발적 전체 재파싱)"만
 * 잡는 굵은 그물이고, 미세 추세는 로그로 관찰한다. 스펙의 처방도 같다:
 * 느려지면 원장 구조를 바꾸지 말고 last_event_id 스냅샷 캐시를 추가하라.
 *
 * 100k는 CI 상주가 아니라 Release Gate 1회 벤치 몫 — 같은 제너레이터를
 * EVENTS 환경변수로 키워 수동 실행한다: ARGUS_PERF_EVENTS=100000 vitest run perf
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadState } from './reducer.js';
import { deriveBrief } from './brief.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const HOOK = path.resolve(here, '..', '..', '..', 'argus-driver', 'hooks', 'session-start.js');

const N = Number(process.env['ARGUS_PERF_EVENTS'] ?? 10_000);
const REPO_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

// Crockford ULID 시간 prefix 흉내 — 사전순 = 시간순이면 충분 (진짜 ulid()는
// 10k 루프에서 호출 비용이 커서, 형식만 맞춘 결정론 id를 쓴다).
const CROCK = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function seqUlid(n: number): string {
  let s = '';
  let x = n;
  for (let i = 0; i < 26; i++) { s = CROCK[x % 32]! + s; x = Math.floor(x / 32); }
  return s;
}

let home: string;
let repoDir: string;

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-perf-home-'));
  repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-perf-repo-'));
  fs.mkdirSync(path.join(repoDir, '.argus'), { recursive: true });
  fs.writeFileSync(path.join(repoDir, '.argus', 'project.json'),
    JSON.stringify({ repository_id: REPO_ID, workspace_id: 'w' }));

  // N 이벤트 원장: 결정 절반은 seal+settle(터미널), 절반은 seal만(살아있음).
  const lines: string[] = [];
  let seq = 0;
  const env = (event: string, fields: Record<string, unknown>) => {
    seq += 1;
    return JSON.stringify({
      event_id: seqUlid(seq), v: 2, producer_version: 'perf',
      repository_id: REPO_ID, workspace_id: '9b2fd3a1-6c7e-4a2b-8d1f-2e3a4b5c6d7e',
      session_id: 's', occurred_at: '2026-07-01T00:00:00Z', logical_date: '2026-07-01',
      tz: 'UTC', idempotency_key: `k${seq}`, event, ...fields,
    });
  };
  const u = (value: string) => ({ value, provenance: 'host_reported' });
  for (let i = 0; lines.length < N; i++) {
    lines.push(env('seal', { decision_id: `d-${i}`, predicate: u(`predicate ${i}`), check_by: u('2026-06-01') }));
    if (i % 2 === 0 && lines.length < N) {
      lines.push(env('settle', { decision_id: `d-${i}`, outcome: u('held') }));
    }
  }
  fs.mkdirSync(path.join(home, 'projects', REPO_ID), { recursive: true });
  fs.writeFileSync(path.join(home, 'projects', REPO_ID, 'ledger.jsonl'), lines.join('\n') + '\n');
});
afterEach(() => {
  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(repoDir, { recursive: true, force: true });
});

describe(`성능 측정 — ${N} 이벤트 (Matrix Performance 행)`, () => {
  it('replay(loadState) + brief 파생 시간이 측정되고 굵은 캡 안에 있다', () => {
    const t0 = performance.now();
    const state = loadState(home, REPO_ID);
    const tReplay = performance.now() - t0;

    const t1 = performance.now();
    const brief = deriveBrief(state, '2026-07-11');
    const tBrief = performance.now() - t1;

    // 실측 로그 — CI 로그가 추세 관찰의 데이터가 된다.
    console.log(`[perf] events=${N} replay=${tReplay.toFixed(1)}ms brief=${tBrief.toFixed(1)}ms ` +
      `decisions=${state.decisions.size} due=${brief.due.length}`);

    expect(state.dropped_corrupt).toBe(0); // 제너레이터 자가검증
    expect(state.decisions.size).toBeGreaterThan(N / 3);
    // 굵은 그물: 10k에 5s/1s면 구조적 회귀(제곱 복잡도 류)만 걸린다.
    expect(tReplay).toBeLessThan(5_000 * (N / 10_000));
    expect(tBrief).toBeLessThan(1_000 * (N / 10_000));
  });

  it('SessionStart 훅은 큰 원장에서도 latency budget 안에 돈다 (규칙 4)', () => {
    const t0 = performance.now();
    const out = execFileSync('node', [HOOK], {
      input: JSON.stringify({ cwd: repoDir }),
      env: { ...process.env, ARGUS_HOME: home },
      encoding: 'utf8',
    });
    const tHook = performance.now() - t0;
    console.log(`[perf] hook spawn+run on ${N}-event ledger: ${tHook.toFixed(1)}ms`);

    expect(out).toContain('argus_check_in'); // LOGBOOK 부재 → stale 안내가 정상 동작
    // budget: 2s (spawn 오버헤드 포함 굵은 캡 — 훅 자체는 마지막 줄만 읽는다).
    expect(tHook).toBeLessThan(2_000);
  });
});
