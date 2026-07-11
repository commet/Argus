/**
 * v2 내구 원장 테스트 — II-D(집·발견)와 II-E(락·정직한 읽기)의 수용 기준.
 *
 * 전부 임시 ARGUS_HOME에서 돈다 — 실제 ~/.argus는 절대 건드리지 않는다.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  acquireLock,
  appendEvent,
  argusHome,
  LedgerBusyError,
  ledgerPath,
  lookupRepository,
  readLedger,
  readRegistry,
  registerRepository,
  registryPath,
} from './ledger.js';

let home: string;
let repoDir: string;

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-v2-home-'));
  repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-v2-repo-'));
  fs.mkdirSync(path.join(repoDir, '.git'), { recursive: true });
});
afterEach(() => {
  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(repoDir, { recursive: true, force: true });
});

const gitCommonDir = () => path.join(repoDir, '.git');

function sampleEvent(repositoryId: string, overrides: Record<string, unknown> = {}) {
  return {
    event_id: '01JZXK5N8Q2W4E6R8T0Y2Z4A6B',
    v: 2,
    producer_version: '2.0.0-p1',
    repository_id: repositoryId,
    workspace_id: '9b2fd3a1-6c7e-4a2b-8d1f-2e3a4b5c6d7e',
    session_id: 's-1',
    occurred_at: '2026-07-11T10:30:00Z',
    logical_date: '2026-07-11',
    tz: 'Asia/Seoul',
    idempotency_key: 'k-1',
    event: 'harvest',
    decision_id: 'q3-cutover',
    text: { value: '세션 저장은 postgres로 간다', provenance: 'elicited_user' },
    ...overrides,
  };
}

describe('registry — 발견 메커니즘 (II-D)', () => {
  it('registers with a generated UUID, idempotently, keyed by realpath', () => {
    const id1 = registerRepository(home, gitCommonDir());
    const id2 = registerRepository(home, gitCommonDir());
    expect(id1).toBe(id2);
    expect(id1).toMatch(/^[0-9a-f-]{36}$/);
    expect(lookupRepository(home, gitCommonDir())).toBe(id1);
  });

  it('resolves through a symlinked worktree path to the same repository', () => {
    const id = registerRepository(home, gitCommonDir());
    const link = path.join(os.tmpdir(), `argus-v2-link-${process.pid}`);
    try {
      fs.symlinkSync(gitCommonDir(), link);
      expect(lookupRepository(home, link)).toBe(id); // 실경로 기준 — symlink 무관
    } finally {
      fs.rmSync(link, { force: true });
    }
  });

  it('returns null when unmapped — never auto-creates (명시적 바인딩만)', () => {
    expect(lookupRepository(home, gitCommonDir())).toBeNull();
    expect(fs.existsSync(registryPath(home))).toBe(false); // lookup은 부작용 0
  });

  it('refuses to rebind an existing path to a different repository_id', () => {
    registerRepository(home, gitCommonDir(), '3f2504e0-4f89-41d3-9a0c-0305e82c3301');
    expect(() => registerRepository(home, gitCommonDir(), '9b2fd3a1-6c7e-4a2b-8d1f-2e3a4b5c6d7e'))
      .toThrow(/REGISTRY_CONFLICT/);
  });

  it('refuses a corrupt registry loudly instead of guessing', () => {
    fs.mkdirSync(home, { recursive: true });
    fs.writeFileSync(registryPath(home), '{"version":99}', 'utf8');
    expect(() => readRegistry(home)).toThrow(/unexpected shape/);
  });

  it('ARGUS_HOME overrides the default home (테스트 격리 계약)', () => {
    expect(argusHome({ ARGUS_HOME: '/x/y' } as NodeJS.ProcessEnv)).toBe('/x/y');
    expect(argusHome({} as NodeJS.ProcessEnv)).toBe(path.join(os.homedir(), '.argus'));
  });
});

describe('append → read 왕복 (내구 원장)', () => {
  it('roundtrips a valid event and preserves append order as canon', () => {
    const id = registerRepository(home, gitCommonDir());
    appendEvent(home, id, sampleEvent(id, { idempotency_key: 'k-1' }));
    // seal은 harvest의 text 키를 가지면 안 된다 (strictObject) — 빼고 조립.
    const { text: _harvestOnly, ...base } = sampleEvent(id, { idempotency_key: 'k-2' });
    appendEvent(home, id, {
      ...base, event: 'seal',
      predicate: { value: 'cutover downtime < 5 min', provenance: 'elicited_user' },
      check_by: { value: '2026-08-01', provenance: 'elicited_user' },
    });
    const r = readLedger(home, id);
    expect(r.events.map((e) => e.event)).toEqual(['harvest', 'seal']); // append 순서 = 정본
    expect(r.skipped_unknown).toBe(0);
    expect(r.dropped_corrupt).toBe(0);
  });

  it('rejects an invalid event loudly and appends nothing', () => {
    const id = registerRepository(home, gitCommonDir());
    expect(() => appendEvent(home, id, sampleEvent(id, { text: 'bare string — no provenance' })))
      .toThrow(/INVALID_EVENT/);
    expect(fs.existsSync(ledgerPath(home, id))).toBe(false);
  });

  it('rejects a repository_id mismatch (다른 집에 붙이려는 이벤트)', () => {
    const id = registerRepository(home, gitCommonDir());
    const other = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
    expect(() => appendEvent(home, id, sampleEvent(other))).toThrow(/REPOSITORY_MISMATCH/);
  });

  it('counts unknown events and corrupt lines SEPARATELY (II-E 분리 계상)', () => {
    const id = registerRepository(home, gitCommonDir());
    appendEvent(home, id, sampleEvent(id));
    fs.appendFileSync(ledgerPath(home, id), '{"event":"from_the_future","v":3}\n'); // 미지
    fs.appendFileSync(ledgerPath(home, id), '{"event":"harvest","v":2,"broken\n'); // 파손 JSON
    fs.appendFileSync(ledgerPath(home, id), JSON.stringify({ ...sampleEvent(id), decision_id: '' }) + '\n'); // 아는 이벤트, 깨진 shape
    const r = readLedger(home, id);
    expect(r.events).toHaveLength(1);
    expect(r.skipped_unknown).toBe(1);
    expect(r.dropped_corrupt).toBe(2);
  });
});

describe('쓰기 락 (II-E — fail-open의 의도적 반대)', () => {
  it('refuses with LEDGER_BUSY while a live process holds the lock', () => {
    const id = registerRepository(home, gitCommonDir());
    const lock = acquireLock(home, id); // 내 pid = 살아있는 보유자
    try {
      expect(() => appendEvent(home, id, sampleEvent(id))).toThrow(LedgerBusyError);
    } finally {
      lock.release();
    }
    // 락이 풀리면 같은 append가 성공한다 — 거절은 상태이지 파멸이 아니다.
    appendEvent(home, id, sampleEvent(id));
    expect(readLedger(home, id).events).toHaveLength(1);
  });

  it('steals a stale lock only after confirming the holder pid is dead', () => {
    const id = registerRepository(home, gitCommonDir());
    fs.mkdirSync(path.dirname(ledgerPath(home, id)), { recursive: true });
    fs.writeFileSync(
      ledgerPath(home, id) + '.lock',
      JSON.stringify({ nonce: 'dead', pid: 3_999_999, started_at: '2026-07-11T00:00:00Z' }),
    );
    appendEvent(home, id, sampleEvent(id)); // 죽은 보유자 → 탈취 → 성공
    expect(readLedger(home, id).events).toHaveLength(1);
  });

  it('release only removes its own lock (nonce mismatch leaves a foreign lock alone)', () => {
    const id = registerRepository(home, gitCommonDir());
    const lock = acquireLock(home, id);
    // 남이 락을 갈아치운 상황을 재현
    fs.writeFileSync(
      ledgerPath(home, id) + '.lock',
      JSON.stringify({ nonce: 'foreign', pid: process.pid, started_at: '2026-07-11T00:00:00Z' }),
    );
    lock.release();
    expect(fs.existsSync(ledgerPath(home, id) + '.lock')).toBe(true); // 남의 락은 존중
    fs.rmSync(ledgerPath(home, id) + '.lock');
  });

  it('runs the transition guard inside the lock; a throwing guard appends nothing', () => {
    const id = registerRepository(home, gitCommonDir());
    appendEvent(home, id, sampleEvent(id, { idempotency_key: 'k-1' }));
    const seen: number[] = [];
    expect(() =>
      appendEvent(home, id, sampleEvent(id, { idempotency_key: 'k-2' }), (prior) => {
        seen.push(prior.events.length);
        throw new Error('ALREADY_SETTLED: guard says no');
      }),
    ).toThrow(/ALREADY_SETTLED/);
    expect(seen).toEqual([1]); // guard는 replay 결과를 받았다 (락 안 순서 준수)
    expect(readLedger(home, id).events).toHaveLength(1); // append는 없었다
  });
});
