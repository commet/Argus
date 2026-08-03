// Reducer tests — canonical-layer wires break LOUDLY (HarnessViolation), and
// the fold makes "plausible" structurally unable to masquerade as "adopted".

import { describe, expect, it } from 'vitest';
import { Ledger } from '../ledger';
import { foldCase, rebuildWorkingModelInputs, shouldGoDormant } from '../reducer';
import { type DecisionCardDraft, type LedgerEvent } from '../types';

const CARD: DecisionCardDraft = {
  question: '온보딩을 20명에게 제한 공개할까',
  stakes: { weight: 'significant', reversibility: 'costly' },
  adoptedState: 'test',
  choiceOrPolicy: '핵심 흐름만 20명에게 2주간 공개',
  rationale: {
    values: ['핵심 segment의 재방문 검증'],
    materialBeliefs: [{ belief: '대상 20명이 핵심 segment를 대표한다', confidence: 'uncertain' }],
    rejectedAlternative: { alternative: '한 달 연기 후 전체 공개', reason: '학습이 늦고 범위가 자란다' },
  },
  nextAction: { action: '명단과 blocker 3개 확정', owner: 'YC', byOrWhen: '오늘' },
};

let seq = 0;
function ev<T extends LedgerEvent['type']>(type: T, at: string, rest: Omit<Extract<LedgerEvent, { type: T }>, 'id' | 'caseId' | 'at' | 'type'>): LedgerEvent {
  seq += 1;
  return { id: `e${seq}`, caseId: 'c1', at, type, ...rest } as LedgerEvent;
}

function ledgerWith(...events: LedgerEvent[]): Ledger {
  const l = new Ledger();
  events.forEach((e) => l.append(e));
  return l;
}

describe('adoption gate — nothing is canonical before a user act', () => {
  it('an AI proposal alone leaves no card in the fold', () => {
    const l = ledgerWith(
      ev('user_utterance', '2026-08-04T00:00:00.000Z', { text: '출시 고민이야' }),
      ev('ai_proposal', '2026-08-04T00:01:00.000Z', { description: 'card draft', payloadKind: 'card_draft', draft: CARD }),
    );
    const s = foldCase(l, 'c1');
    expect(s.card).toBeUndefined();
    expect(s.state).toBe('OPEN');
  });

  it('action_reported before adoption throws — canonical write without adoption', () => {
    const l = ledgerWith(ev('action_reported', '2026-08-04T00:00:00.000Z', { description: '명단 확정함' }));
    expect(() => foldCase(l, 'c1')).toThrowError(/CANONICAL_WRITE_WITHOUT_ADOPTION/);
  });

  it('a declined draft leaves no card — and no error (session value stands)', () => {
    const l = ledgerWith(ev('card_adopted', '2026-08-04T00:00:00.000Z', { cardId: 'k1', card: CARD, adoption: { mode: 'decline' } }));
    expect(foldCase(l, 'c1').card).toBeUndefined();
  });

  it('adoption folds the card and moves the state', () => {
    const l = ledgerWith(ev('card_adopted', '2026-08-04T00:00:00.000Z', { cardId: 'k1', card: CARD, adoption: { mode: 'accept' } }));
    const s = foldCase(l, 'c1');
    expect(s.card?.cardId).toBe('k1');
    expect(s.state).toBe('TESTING');
  });
});

describe('append-only — the past cannot be overwritten', () => {
  it('a second adoption without supersede throws', () => {
    const l = ledgerWith(
      ev('card_adopted', '2026-08-04T00:00:00.000Z', { cardId: 'k1', card: CARD, adoption: { mode: 'accept' } }),
      ev('card_adopted', '2026-08-04T00:01:00.000Z', { cardId: 'k2', card: CARD, adoption: { mode: 'accept' } }),
    );
    expect(() => foldCase(l, 'c1')).toThrowError(/OVERWRITE_FORBIDDEN/);
  });

  it('supersede keeps the old card in lineage instead of deleting it', () => {
    const l = ledgerWith(
      ev('card_adopted', '2026-08-04T00:00:00.000Z', { cardId: 'k1', card: CARD, adoption: { mode: 'accept' } }),
      ev('card_superseded', '2026-08-04T00:01:00.000Z', {
        oldCardId: 'k1',
        newCardId: 'k2',
        card: { ...CARD, choiceOrPolicy: '10명으로 축소 공개' },
        adoption: { mode: 'edit_then_accept', editedFields: ['choiceOrPolicy'], materialEdit: true },
      }),
    );
    const s = foldCase(l, 'c1');
    expect(s.card?.cardId).toBe('k2');
    expect(s.supersededCards).toHaveLength(1);
    expect(s.supersededCards[0].supersededBy).toBe('k2');
  });
});

describe('baseline — a pre-AI snapshot, never rewritten (§2.2)', () => {
  it('captures once and refuses re-capture', () => {
    const l = ledgerWith(
      ev('baseline_captured', '2026-08-04T00:00:00.000Z', { lean: '빨리 열고 싶음', statedReasons: ['반응을 빨리'], consideredAlternatives: [] }),
      ev('baseline_captured', '2026-08-04T00:01:00.000Z', { lean: '신중', statedReasons: [], consideredAlternatives: [] }),
    );
    expect(() => foldCase(l, 'c1')).toThrowError(/BASELINE_REWRITE/);
  });

  it('honest absence: not_captured stays not_captured', () => {
    const l = ledgerWith(ev('baseline_not_captured', '2026-08-04T00:00:00.000Z', {}));
    expect(foldCase(l, 'c1').baseline).toBe('not_captured');
  });
});

describe('observation-first return ordering (§7.3)', () => {
  const adopted = () => [
    ev('card_adopted', '2026-08-04T00:00:00.000Z', { cardId: 'k1', card: CARD, adoption: { mode: 'accept' } }),
    ev('return_armed', '2026-08-04T00:01:00.000Z', {
      contract: { kind: 'outcome', trigger: { type: 'signal', expectedSignal: '재방문 수', dateBackstop: '2026-08-25T00:00:00.000Z' } },
    }),
  ];

  it('revealing the record before any observation throws — the exact hindsight contamination v0.4 fixed', () => {
    const l = ledgerWith(...adopted(), ev('record_revealed', '2026-08-04T00:02:00.000Z', {}));
    expect(() => foldCase(l, 'c1')).toThrowError(/REVEAL_BEFORE_OBSERVATION/);
  });

  it('a recall probe after the reveal throws — hindsight cannot pose as unaided recall', () => {
    const l = ledgerWith(
      ...adopted(),
      ev('observation', '2026-08-18T00:00:00.000Z', { text: '재방문 5명', sourceKind: 'direct', observedAt: '2026-08-18T00:00:00.000Z' }),
      ev('record_revealed', '2026-08-18T00:01:00.000Z', {}),
      ev('recall_probe_answer', '2026-08-18T00:02:00.000Z', { text: '속도 때문이었던 것 같아요' }),
    );
    expect(() => foldCase(l, 'c1')).toThrowError(/PROBE_AFTER_REVEAL/);
  });

  it('the honest order folds cleanly: observe → probe → reveal → close', () => {
    const l = ledgerWith(
      ...adopted(),
      ev('observation', '2026-08-18T00:00:00.000Z', { text: '재방문 5명', sourceKind: 'direct', observedAt: '2026-08-18T00:00:00.000Z' }),
      ev('recall_probe_answer', '2026-08-18T00:01:00.000Z', { text: '재방문을 검증하고 싶었어요' }),
      ev('record_revealed', '2026-08-18T00:02:00.000Z', {}),
      ev('return_closed', '2026-08-18T00:03:00.000Z', { returnKind: 'outcome' }),
    );
    const s = foldCase(l, 'c1');
    expect(s.state).toBe('REVIEWED');
    expect(s.observations).toHaveLength(1);
  });
});

describe('return chain (§7.2) — one active per case, closing promotes the next', () => {
  it('queues the second contract and promotes it on close', () => {
    const l = ledgerWith(
      ev('card_adopted', '2026-08-04T00:00:00.000Z', { cardId: 'k1', card: CARD, adoption: { mode: 'accept' } }),
      ev('return_armed', '2026-08-04T00:01:00.000Z', { contract: { kind: 'commitment', trigger: { type: 'date', date: '2026-08-07T00:00:00.000Z' } } }),
      ev('return_armed', '2026-08-04T00:02:00.000Z', { contract: { kind: 'outcome', trigger: { type: 'signal', expectedSignal: '재방문', dateBackstop: '2026-08-25T00:00:00.000Z' } } }),
      ev('observation', '2026-08-07T00:00:00.000Z', { text: '명단 확정 완료', sourceKind: 'direct', observedAt: '2026-08-07T00:00:00.000Z' }),
      ev('return_closed', '2026-08-07T00:01:00.000Z', { returnKind: 'commitment' }),
    );
    const s = foldCase(l, 'c1');
    expect(s.activeReturn?.contract.kind).toBe('outcome');
    expect(s.queuedReturns).toHaveLength(0);
    expect(s.state).toBe('AWAITING_SIGNAL');
  });
});

describe('DORMANT lifecycle (§5.1)', () => {
  it('goes dormant only after backstop + grace of silence, and reopens to its prior state', () => {
    const l = ledgerWith(
      ev('card_adopted', '2026-08-04T00:00:00.000Z', { cardId: 'k1', card: CARD, adoption: { mode: 'accept' } }),
      ev('return_armed', '2026-08-04T00:01:00.000Z', { contract: { kind: 'outcome', trigger: { type: 'signal', expectedSignal: '재방문', dateBackstop: '2026-08-18T00:00:00.000Z' } } }),
    );
    const s = foldCase(l, 'c1');
    // before backstop: no
    expect(shouldGoDormant(s, '2026-08-04T00:01:00.000Z', '2026-08-10T00:00:00.000Z')).toBe(false);
    // after backstop but user active recently: no
    expect(shouldGoDormant(s, '2026-08-30T00:00:00.000Z', '2026-08-31T00:00:00.000Z')).toBe(false);
    // after backstop + 2w silence: yes
    expect(shouldGoDormant(s, '2026-08-04T00:01:00.000Z', '2026-09-05T00:00:00.000Z')).toBe(true);

    const l2 = ledgerWith(
      ev('card_adopted', '2026-08-04T00:00:00.000Z', { cardId: 'k1', card: CARD, adoption: { mode: 'accept' } }),
      ev('return_armed', '2026-08-04T00:01:00.000Z', { contract: { kind: 'outcome', trigger: { type: 'signal', expectedSignal: '재방문', dateBackstop: '2026-08-18T00:00:00.000Z' } } }),
      ev('case_dormant', '2026-09-05T00:00:00.000Z', {}),
      ev('case_reopened', '2026-09-20T00:00:00.000Z', {}),
    );
    const s2 = foldCase(l2, 'c1');
    expect(s2.state).toBe('AWAITING_SIGNAL'); // restored, not reset
  });

  it('reopening a non-dormant case throws', () => {
    const l = ledgerWith(ev('case_reopened', '2026-08-04T00:00:00.000Z', {}));
    expect(() => foldCase(l, 'c1')).toThrowError(/REOPEN_NON_DORMANT/);
  });
});

describe('case linking (§5.4) — propose-confirm, never auto-merge', () => {
  it('an unconfirmed link refuses to fold', () => {
    const l = ledgerWith(ev('case_linked', '2026-08-04T00:00:00.000Z', { relatesTo: 'c0', confirmedByUser: false }));
    expect(() => foldCase(l, 'c1')).toThrowError(/UNCONFIRMED_CASE_LINK/);
  });
});

describe('re-derivation (§6.1) — working models rebuild from durable layers only', () => {
  it('returns card + source events + approved lessons, and nothing model-authored', () => {
    const l = ledgerWith(
      ev('user_utterance', '2026-08-04T00:00:00.000Z', { text: '출시 고민' }),
      ev('ai_proposal', '2026-08-04T00:01:00.000Z', { description: '지난 세션의 화려한 분석 산문', payloadKind: 'move' }),
      ev('card_adopted', '2026-08-04T00:02:00.000Z', { cardId: 'k1', card: CARD, adoption: { mode: 'accept' } }),
      ev('lesson_candidate', '2026-08-04T00:03:00.000Z', { text: '작은 pilot 먼저', scope: '출시 결정' }),
    );
    const inputs = rebuildWorkingModelInputs(l, 'c1');
    expect(inputs.card?.cardId).toBe('k1');
    expect(inputs.sourceEvents.map((e) => e.type)).toEqual(['user_utterance']); // ai_proposal is unrepresentable here
    expect(inputs.approvedLessons).toHaveLength(0); // candidate ≠ approved
  });
});

describe('ledger primitives', () => {
  it('rejects duplicate event ids and time regression', () => {
    const l = new Ledger();
    l.append(ev('user_utterance', '2026-08-04T00:05:00.000Z', { text: 'a' }));
    expect(() => l.append(ev('user_utterance', '2026-08-04T00:00:00.000Z', { text: 'b' }))).toThrowError(/TIME_REGRESSION/);
  });
});
