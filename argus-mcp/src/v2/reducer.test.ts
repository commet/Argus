/**
 * v2 reducer 테스트 — 상태 전이표(II-A)와 멱등 정밀 계약(II-E)의 수용 기준.
 *
 * 구조: (1) 정상 여정 fold, (2) 불법 전이 전수 거절(코드 확인),
 * (3) 멱등 — 중복 재시도는 append 없이 기존 이벤트 반환, 다른 payload는
 * IDEMPOTENCY_CONFLICT, (4) reduce는 총함수 — 과거의 불법은 anomalies로 계상.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ArgusEvent } from './events.js';
import { readLedger, registerRepository } from './ledger.js';
import {
  appendEventGuarded,
  judgeTransition,
  loadState,
  payloadHash,
  reduce,
  TransitionError,
} from './reducer.js';

// ── 이벤트 조립기 (테스트 전용 — ULID·key를 순번으로 찍는다) ──

let seq = 0;
function ev(event: string, fields: Record<string, unknown>, key?: string): ArgusEvent {
  seq += 1;
  const n = String(seq).padStart(4, '0');
  return {
    event_id: `01JZXK5N8Q2W4E6R8T0Y2Z${n.replace(/[^0-9A-HJKMNP-TV-Z]/g, '0')}`.slice(0, 26).padEnd(26, '0'),
    v: 2,
    producer_version: '2.0.0-p1',
    repository_id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
    workspace_id: '9b2fd3a1-6c7e-4a2b-8d1f-2e3a4b5c6d7e',
    session_id: 's-1',
    occurred_at: '2026-07-11T10:30:00Z',
    logical_date: '2026-07-11',
    tz: 'Asia/Seoul',
    idempotency_key: key ?? `k-${seq}`,
    event,
    ...fields,
  } as ArgusEvent;
}

const u = (value: string) => ({ value, provenance: 'elicited_user' as const });
const D = 'q3-cutover';

function journey(): ArgusEvent[] {
  return [
    ev('harvest', { decision_id: D, text: u('postgres로 간다') }),
    ev('seal', { decision_id: D, predicate: u('cutover downtime < 5 min'), check_by: u('2026-08-01') }),
    ev('premise_add', { premise_id: 'p-1', decision_id: D, kind: 'premise', text: u('TTL은 UTC 기준') }),
    ev('amend', { decision_id: D, check_by: u('2026-08-15') }),
    ev('snooze', { decision_id: D, until: '2026-08-16' }),
    ev('settle', { decision_id: D, outcome: u('held'), note: '3m 40s' }),
  ];
}

describe('reduce — 정상 여정 fold', () => {
  it('folds harvest→seal→amend→snooze→settle into a settled decision', () => {
    const s = reduce(journey());
    const d = s.decisions.get(D)!;
    expect(d.state).toBe('settled');
    expect(d.check_by?.value).toBe('2026-08-15'); // amend 반영
    expect(d.snooze_count).toBe(1);
    expect(d.outcome?.value).toBe('held');
    expect(s.premises.get('p-1')?.resolved).toBe(false);
    expect(s.anomalies).toEqual([]); // 가드가 돌았던 원장은 anomaly 0 — 이게 정상
  });

  it('folds the candidate lifecycle and keeps created_on for derived expiry', () => {
    const s = reduce([
      ev('candidate_created', { candidate_id: 'c-1', kind: 'decision', quote: 'postgres로 가기로 했다',
        quote_speaker: 'user', verification: 'host_reported', source: 'debrief' }),
      ev('candidate_surfaced', { candidate_id: 'c-1', surface: 'brief' }),
      ev('candidate_action', { candidate_id: 'c-1', action: 'promote', promoted_to: { kind: 'decision', id: D } }),
    ]);
    const c = s.candidates.get('c-1')!;
    expect(c.state).toBe('promoted');
    expect(c.created_on).toBe('2026-07-11'); // expired(14일) 파생의 기준점
    expect(c.promoted_to).toEqual({ kind: 'decision', id: D });
  });

  it('folds sync outbox: abandoned allows a manual re-pending (규칙 12)', () => {
    const sid = '01JZXK5N8Q2W4E6R8T0Y2Z4A6B';
    const s = reduce([
      ev('sync_pending', { source_event_id: sid }),
      ev('sync_attempted', { source_event_id: sid, attempt: 1, last_error: 'ECONNRESET' }),
      ev('sync_abandoned', { source_event_id: sid, reason: 'gave up' }),
      ev('sync_pending', { source_event_id: sid }), // 수동 재개
    ]);
    expect(s.sync.get(sid)?.state).toBe('pending');
    expect(s.anomalies).toEqual([]);
  });
});

describe('judgeTransition — 불법 전이는 코드 있는 명시 거절 (II-A)', () => {
  const cases: { name: string; setup: ArgusEvent[]; next: ArgusEvent; code: string }[] = [
    { name: 'settle after settle', setup: journey(),
      next: ev('settle', { decision_id: D, outcome: u('missed') }), code: 'ALREADY_SETTLED' },
    { name: 'amend after settle', setup: journey(),
      next: ev('amend', { decision_id: D, check_by: u('2026-09-01') }), code: 'ALREADY_SETTLED' },
    { name: 'seal after settle', setup: journey(),
      next: ev('seal', { decision_id: D, predicate: u('12345678'), check_by: u('2026-09-01') }), code: 'ALREADY_SETTLED' },
    { name: 'settle without seal', setup: [ev('harvest', { decision_id: D, text: u('x') })],
      next: ev('settle', { decision_id: D, outcome: u('held') }), code: 'NOT_SEALED' },
    { name: 'settle unknown decision', setup: [],
      next: ev('settle', { decision_id: 'ghost', outcome: u('held') }), code: 'UNKNOWN_DECISION' },
    { name: 'double harvest', setup: [ev('harvest', { decision_id: D, text: u('x') })],
      next: ev('harvest', { decision_id: D, text: u('y') }), code: 'DECISION_EXISTS' },
    { name: 'dismiss after dismiss', setup: [
        ev('harvest', { decision_id: D, text: u('x') }), ev('dismiss', { decision_id: D })],
      next: ev('dismiss', { decision_id: D }), code: 'ALREADY_DISMISSED' },
    { name: 'premise_resolve twice', setup: [
        ev('premise_add', { premise_id: 'p-1', kind: 'fact', text: u('x') }),
        ev('premise_resolve', { premise_id: 'p-1', resolution: u('끝') })],
      next: ev('premise_resolve', { premise_id: 'p-1', resolution: u('또') }), code: 'ALREADY_RESOLVED' },
    { name: 'candidate_action on dropped', setup: [
        ev('candidate_created', { candidate_id: 'c-1', kind: 'claim', quote: 'q', quote_speaker: 'user',
          verification: 'host_reported', source: 'user' }),
        ev('candidate_action', { candidate_id: 'c-1', action: 'drop' })],
      next: ev('candidate_action', { candidate_id: 'c-1', action: 'drop' }), code: 'CANDIDATE_TERMINAL' },
    { name: 'bearing_set reusing a closed id', setup: [
        ev('bearing_set', { bearing_id: 'b-1', heading: u('h'), remaining: [] }),
        ev('bearing_arrived', { bearing_id: 'b-1' })],
      next: ev('bearing_set', { bearing_id: 'b-1', heading: u('h2'), remaining: [] }), code: 'BEARING_TERMINAL' },
    { name: 'sync_attempted after succeeded', setup: [
        ev('sync_pending', { source_event_id: '01JZXK5N8Q2W4E6R8T0Y2Z4A6B' }),
        ev('sync_succeeded', { source_event_id: '01JZXK5N8Q2W4E6R8T0Y2Z4A6B' })],
      next: ev('sync_attempted', { source_event_id: '01JZXK5N8Q2W4E6R8T0Y2Z4A6B', attempt: 2 }), code: 'SYNC_TERMINAL' },
  ];

  for (const c of cases) {
    it(`rejects ${c.name} with ${c.code}`, () => {
      const state = reduce(c.setup);
      try {
        judgeTransition(state, c.next);
        throw new Error('expected TransitionError, got acceptance');
      } catch (e) {
        expect(e).toBeInstanceOf(TransitionError);
        expect((e as TransitionError).code).toBe(c.code);
      }
    });
  }
});

describe('멱등 정밀 계약 (II-E)', () => {
  it('payloadHash ignores event_id/occurred_at but sees payload changes', () => {
    const a = ev('dismiss', { decision_id: D }, 'same-key');
    const b = { ...a, event_id: '01JZXK5N8Q2W4E6R8T0Y2Z9999', occurred_at: '2026-07-11T11:00:00Z' };
    expect(payloadHash(a)).toBe(payloadHash(b as ArgusEvent)); // 재시도가 새로 찍는 둘은 무시
    const c = { ...a, reason: 'changed' };
    expect(payloadHash(a)).not.toBe(payloadHash(c as ArgusEvent));
  });

  it('duplicate retry is accepted as duplicate; different payload conflicts', () => {
    const first = ev('harvest', { decision_id: D, text: u('x') }, 'same-key');
    const state = reduce([first]);
    const retry = { ...first, event_id: '01JZXK5N8Q2W4E6R8T0Y2Z9998', occurred_at: '2026-07-11T12:00:00Z' };
    expect(judgeTransition(state, retry as ArgusEvent)).toBe('duplicate');
    const conflicting = { ...retry, text: u('DIFFERENT') };
    expect(() => judgeTransition(state, conflicting as ArgusEvent)).toThrow(/IDEMPOTENCY_CONFLICT/);
  });
});

describe('원장 결합 — appendEventGuarded (lock→replay→guard→append)', () => {
  let home: string;
  let repoDir: string;
  let repoId: string;

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-v2-red-'));
    repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-v2-redrepo-'));
    fs.mkdirSync(path.join(repoDir, '.git'), { recursive: true });
    repoId = registerRepository(home, path.join(repoDir, '.git'), '3f2504e0-4f89-41d3-9a0c-0305e82c3301');
  });
  afterEach(() => {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(repoDir, { recursive: true, force: true });
  });

  it('appends fresh events, short-circuits duplicates, rejects illegal transitions', () => {
    const harvest = ev('harvest', { decision_id: D, text: u('postgres로 간다') }, 'harvest:q3:1');
    expect(appendEventGuarded(home, repoId, harvest).appended).toBe(true);

    // 동일 key+동일 payload 재시도 — append 없이 기존 이벤트 재구성 반환.
    const retry = { ...harvest, event_id: '01JZXK5N8Q2W4E6R8T0Y2Z9997', occurred_at: '2026-07-11T13:00:00Z' };
    const dup = appendEventGuarded(home, repoId, retry);
    expect(dup.appended).toBe(false);
    expect(dup.event.event_id).toBe(harvest.event_id); // 기존 것 — 재시도의 새 id가 아니라
    expect(readLedger(home, repoId).events).toHaveLength(1); // 원장은 한 줄

    // 불법 전이는 TransitionError 그대로 — append 0.
    expect(() => appendEventGuarded(home, repoId,
      ev('settle', { decision_id: D, outcome: u('held') }))).toThrow(/NOT_SEALED/);
    expect(readLedger(home, repoId).events).toHaveLength(1);
  });

  it('loadState carries honest counters through (skipped/dropped)', () => {
    appendEventGuarded(home, repoId, ev('harvest', { decision_id: D, text: u('x') }));
    const ledger = path.join(home, 'projects', repoId, 'ledger.jsonl');
    fs.appendFileSync(ledger, '{"event":"from_the_future"}\n');
    const s = loadState(home, repoId);
    expect(s.decisions.get(D)?.state).toBe('harvested');
    expect(s.skipped_unknown).toBe(1);
    expect(s.dropped_corrupt).toBe(0);
  });
});

describe('reduce는 총함수 — 과거의 불법은 anomalies로 계상 (조용한 skip 금지)', () => {
  it('counts an out-of-order settle instead of throwing or silently applying', () => {
    const bad = [
      ev('harvest', { decision_id: D, text: u('x') }),
      ev('settle', { decision_id: D, outcome: u('held') }), // seal 없이 — 가드 없던 시절의 흔적 가정
    ];
    const s = reduce(bad);
    expect(s.decisions.get(D)?.state).toBe('harvested'); // 불법 이벤트는 적용되지 않았다
    expect(s.anomalies).toHaveLength(1);
    expect(s.anomalies[0].code).toBe('NOT_SEALED');
  });
});
