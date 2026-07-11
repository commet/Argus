/**
 * BriefState 파생 테스트 — "due는 파생 상태"(II-A)와 공정 큐(규칙 9)의 수용 기준.
 * 전부 순수 함수 검증 — fs 없음. 상태는 reduce()로 만든 진짜 LedgerState를 쓴다
 * (손으로 조립한 가짜 상태는 reducer와 어긋나도 안 잡힌다).
 */
import { describe, expect, it } from 'vitest';
import type { ArgusEvent } from './events.js';
import { reduce } from './reducer.js';
import { deriveBrief, pickDueFairly, type DueItem } from './brief.js';

let seq = 0;
function ev(event: string, fields: Record<string, unknown>): ArgusEvent {
  seq += 1;
  return {
    event_id: `01JZXK5N8Q2W4E6R8T0Y2W${String(seq).padStart(4, '0')}`,
    v: 2, producer_version: '2.0.0-p1',
    repository_id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
    workspace_id: '9b2fd3a1-6c7e-4a2b-8d1f-2e3a4b5c6d7e',
    session_id: 's-1', occurred_at: '2026-07-01T00:00:00Z', logical_date: '2026-07-01',
    tz: 'Asia/Seoul', idempotency_key: `k-${seq}`, event, ...fields,
  } as ArgusEvent;
}
const u = (value: string) => ({ value, provenance: 'elicited_user' as const });

function loaded(events: ArgusEvent[]) {
  return { ...reduce(events), skipped_unknown: 0, dropped_corrupt: 0, last_event_id: events.length ? events[events.length - 1].event_id : null };
}

function sealedDecision(id: string, checkBy: string): ArgusEvent[] {
  return [
    ev('harvest', { decision_id: id, text: u('t') }),
    ev('seal', { decision_id: id, predicate: u(`predicate-${id}`), check_by: u(checkBy) }),
  ];
}

describe('deriveBrief — due 파생 (II-A: 이벤트가 아니라 계산)', () => {
  it('splits sealed decisions into due (check_by <= today) and alive', () => {
    const b = deriveBrief(loaded([
      ...sealedDecision('past', '2026-07-01'),
      ...sealedDecision('today', '2026-07-10'),
      ...sealedDecision('future', '2026-08-01'),
    ]), '2026-07-10');
    expect(b.due.map((d) => d.decision_id)).toEqual(['past', 'today']); // check_by 오름차순
    expect(b.due[0].overdue_days).toBe(9);
    expect(b.due[1].overdue_days).toBe(0);
    expect(b.sealed_alive).toBe(1);
  });

  it('an active snooze hides a due item until the date passes, and 2 snoozes suggest dismiss', () => {
    const events = [
      ...sealedDecision('d1', '2026-07-01'),
      ev('snooze', { decision_id: 'd1', until: '2026-07-15' }),
      ev('snooze', { decision_id: 'd1', until: '2026-07-20' }),
    ];
    expect(deriveBrief(loaded(events), '2026-07-10').due).toEqual([]); // 잠듦
    const after = deriveBrief(loaded(events), '2026-07-20'); // until 도래 → 다시 due
    expect(after.due).toHaveLength(1);
    expect(after.due[0].suggest_dismiss).toBe(true); // 제안 플래그일 뿐 — 자동 dismiss 없음
  });

  it('settled/dismissed decisions never appear as due', () => {
    const b = deriveBrief(loaded([
      ...sealedDecision('done', '2026-07-01'),
      ev('settle', { decision_id: 'done', outcome: u('held') }),
    ]), '2026-07-10');
    expect(b.due).toEqual([]);
    expect(b.sealed_alive).toBe(0);
  });

  it('premise recheck comes due from last_recheck, or from added_on when never checked', () => {
    const b = deriveBrief(loaded([
      ev('premise_add', { premise_id: 'never', kind: 'fact', text: u('한 번도 확인 안 됨'), recheck_cadence_days: 7 }),
      ev('premise_add', { premise_id: 'checked', kind: 'fact', text: u('확인된 적 있음'), recheck_cadence_days: 7 }),
      ev('premise_recheck', { premise_id: 'checked', result: 'holds' }), // logical_date 2026-07-01
      ev('premise_add', { premise_id: 'fresh', kind: 'fact', text: u('아직 안 도래'), recheck_cadence_days: 30 }),
      ev('premise_add', { premise_id: 'q1', kind: 'question', text: u('열린 질문') }),
    ]), '2026-07-10');
    expect(b.premise_rechecks_due.map((p) => p.premise_id).sort()).toEqual(['checked', 'never']); // 둘 다 07-08 도래
    expect(b.premise_rechecks_due[0].due_since).toBe('2026-07-08');
    expect(b.open_questions).toEqual([{ premise_id: 'q1', text: '열린 질문' }]);
  });

  it('candidates expire by derivation at 14 days and are COUNTED, not silently gone', () => {
    const mk = (id: string, extra: Record<string, unknown> = {}) =>
      ev('candidate_created', { candidate_id: id, kind: 'claim', quote: 'q', quote_speaker: 'user',
        verification: 'host_reported', source: 'debrief', ...extra });
    const events = [mk('old'), mk('live'), mk('sleeping')];
    // old만 15일 전 생성으로 조작
    (events[0] as unknown as { logical_date: string }).logical_date = '2026-06-25';
    events.push(ev('candidate_action', { candidate_id: 'sleeping', action: 'snooze', snooze_until: '2026-08-01' }));
    const b = deriveBrief(loaded(events), '2026-07-10');
    expect(b.candidates_active.map((c) => c.candidate_id)).toEqual(['live']);
    expect(b.candidates_expired).toBe(1); // 사라진 게 아니라 셌다
  });

  it('carries honesty counters and the projection cursor through', () => {
    const events = sealedDecision('d1', '2026-08-01');
    const l = loaded(events);
    l.skipped_unknown = 2;
    l.dropped_corrupt = 1;
    const b = deriveBrief(l, '2026-07-10');
    expect(b.skipped_unknown).toBe(2);
    expect(b.dropped_corrupt).toBe(1);
    expect(b.last_event_id).toBe(events[events.length - 1].event_id);
  });
});

describe('pickDueFairly — 공정 큐 (규칙 9: 기아 방지)', () => {
  const d = (id: string, checkBy: string): DueItem =>
    ({ decision_id: id, predicate: 'p', check_by: checkBy, overdue_days: 0, suggest_dismiss: false });

  it('① never-shown wins, oldest check_by first, with 외 N건', () => {
    const due = [d('new-young', '2026-07-05'), d('new-old', '2026-07-01'), d('seen', '2026-06-01')];
    const r = pickDueFairly(due, new Map([['seen', '2026-07-09']]));
    expect(r.pick?.decision_id).toBe('new-old'); // seen은 이미 표시됨 — 최고령이라도 양보
    expect(r.others).toBe(2);
  });

  it('② all shown → least-recently-shown wins; ③ tie → oldest check_by', () => {
    const due = [d('a', '2026-07-05'), d('b', '2026-07-01'), d('c', '2026-06-01')];
    const shown = new Map([['a', '2026-07-01'], ['b', '2026-07-01'], ['c', '2026-07-09']]);
    const r = pickDueFairly(due, shown);
    expect(r.pick?.decision_id).toBe('b'); // a·b 동률(07-01) → check_by 최고령 b
  });

  it('starvation ends: the item shown yesterday loses to the one shown last week', () => {
    // v1의 실패 사례: check_by 정렬만 쓰면 최고령 1건이 매일 이겨 나머지가 영원히 굶는다.
    const due = [d('hog', '2026-06-01'), d('starved', '2026-07-01')];
    const shown = new Map([['hog', '2026-07-09'], ['starved', '2026-07-02']]);
    expect(pickDueFairly(due, shown).pick?.decision_id).toBe('starved');
  });

  it('empty due → null pick, zero others (빈 잔소리는 표현 자체가 불가)', () => {
    expect(pickDueFairly([], new Map())).toEqual({ pick: null, others: 0 });
  });
});
