import { describe, it, expect } from 'vitest';
import {
  verdictFromTap,
  tapFromVerdict,
  chooseCheckpointType,
  deriveExpectation,
  derivePrimaryCheckpoint,
  nextAmbiguityHandle,
  checkpointExpectation,
  isCheckpointDue,
  armCheckpointSilence,
  CHECKPOINT_SILENCE_CAP_DAYS,
  type ReturnTap,
} from '../checkpoint-core';
import type { Predicate, ReturnHandle } from '@/stores/types';

const TAPS: ReturnTap[] = ['mostly_right', 'missed', 'mixed', 'unclear'];

describe('verdictFromTap — deterministic 4-tap → verdict (§7.2)', () => {
  it('mostly_right keys off expectation (occur→happened, not_occur→avoided)', () => {
    expect(verdictFromTap('mostly_right', 'occur')).toBe('happened');
    expect(verdictFromTap('mostly_right', 'not_occur')).toBe('avoided');
  });
  it('missed is a judgment-layer miss regardless of direction', () => {
    expect(verdictFromTap('missed', 'occur')).toBe('missed');
    expect(verdictFromTap('missed', 'not_occur')).toBe('missed');
  });
  it('mixed→partial, unclear→unknown', () => {
    expect(verdictFromTap('mixed', 'occur')).toBe('partial');
    expect(verdictFromTap('unclear', 'occur')).toBe('unknown');
  });
});

describe('tap ⇄ verdict round-trips for every tap and expectation', () => {
  for (const expectation of ['occur', 'not_occur'] as const) {
    for (const tap of TAPS) {
      it(`${tap} @ ${expectation} round-trips`, () => {
        const v = verdictFromTap(tap, expectation);
        expect(tapFromVerdict(v, expectation)).toBe(tap);
      });
    }
  }
  it('a verdict contradicting the expectation reads as missed (legacy display)', () => {
    // happened when we expected NOT to occur = the read missed
    expect(tapFromVerdict('happened', 'not_occur')).toBe('missed');
    expect(tapFromVerdict('avoided', 'occur')).toBe('missed');
  });
  it('pending has no tap', () => {
    expect(tapFromVerdict('pending', 'occur')).toBeNull();
  });
});

describe('chooseCheckpointType — deterministic routing (§4.6)', () => {
  const base = { returnHandleKind: 'manual' as const, hasLinkedPremise: false, hasExplicitThresholdOrCondition: false, primaryRiskIsReaction: false };
  it('date/metric handle → outcome', () => {
    expect(chooseCheckpointType({ ...base, returnHandleKind: 'date' })).toBe('outcome');
    expect(chooseCheckpointType({ ...base, returnHandleKind: 'metric' })).toBe('outcome');
  });
  it('reaction risk → reaction', () => {
    expect(chooseCheckpointType({ ...base, primaryRiskIsReaction: true })).toBe('reaction');
  });
  it('linked premise → evidence', () => {
    expect(chooseCheckpointType({ ...base, hasLinkedPremise: true })).toBe('evidence');
  });
  it('explicit threshold → standard', () => {
    expect(chooseCheckpointType({ ...base, hasExplicitThresholdOrCondition: true })).toBe('standard');
  });
  it('fallback is drift (never forced outcome → fake precision)', () => {
    expect(chooseCheckpointType(base)).toBe('drift');
  });
});

describe('deriveExpectation (§3.1)', () => {
  it('governing bet expects to occur', () => {
    expect(deriveExpectation('governing_idea', '신제품이 분기 내 손익분기를 넘는다')).toBe('occur');
  });
  it('a risk phrased as something to avoid → not_occur', () => {
    expect(deriveExpectation('risk', 'CFO의 반대를 피한다')).toBe('not_occur');
    expect(deriveExpectation('risk', '대량 이탈을 방지한다')).toBe('not_occur');
    expect(deriveExpectation('risk', 'We steer clear of a churn spike')).toBe('not_occur');
  });
  it('a risk checked for materializing → occur (default)', () => {
    expect(deriveExpectation('risk', 'CFO가 가격 단계에서 비용에 반대한다')).toBe('occur');
  });
});

function pred(over: Partial<Predicate> = {}): Predicate {
  return { id: 'p1', text: '신제품이 분기 내 손익분기를 넘는다', source: 'governing_idea', ...over };
}

describe('derivePrimaryCheckpoint (§12 Phase 0)', () => {
  it('null when there are no predicates', () => {
    expect(derivePrimaryCheckpoint({ predicates: [], check_in_at: undefined })).toBeNull();
  });
  it('auto-constructs from the governing bet + a date handle', () => {
    const cp = derivePrimaryCheckpoint({ predicates: [pred({ id: 'risk1', source: 'risk' }), pred()], check_in_at: '2026-09-01T00:00:00Z' });
    expect(cp).not.toBeNull();
    expect(cp!.predicate_id).toBe('p1');               // governing bet chosen over the risk
    expect(cp!.return_handle).toEqual({ kind: 'date', value: '2026-09-01T00:00:00Z', auto_due: true });
    expect(cp!.type).toBe('outcome');                  // date handle → outcome
    expect(cp!.expectation).toBe('occur');
    expect(cp!.authorship).toBe('ai_suggested');
  });
  it('falls back to a manual handle when no check_in_at (drift type, not fake outcome)', () => {
    const cp = derivePrimaryCheckpoint({ predicates: [pred()], check_in_at: undefined });
    expect(cp!.return_handle.kind).toBe('manual');
    expect(cp!.type).toBe('drift');
  });
  it('a carried seed wins (authorship + handle)', () => {
    const cp = derivePrimaryCheckpoint(
      { predicates: [pred()], check_in_at: '2026-09-01' },
      { authorship: 'user_authored', return_handle: { kind: 'event', value: '이사회 후', auto_due: false }, check_prompt: '이사회가 승인하나' },
    );
    expect(cp!.authorship).toBe('user_authored');
    expect(cp!.return_handle.kind).toBe('event');
    expect(cp!.check_prompt).toBe('이사회가 승인하나');
  });
  it('prefers the user-owned line over an AI governing premise', () => {
    const cp = derivePrimaryCheckpoint({
      predicates: [
        pred({ id: 'ai', text: 'AI가 짚은 전제', authored: 'ai_surfaced' }),
        pred({ id: 'mine', text: '내가 확정한 판단', source: 'user_lean', authored: 'user' }),
      ],
      check_in_at: '2026-09-01T00:00:00Z',
    });
    expect(cp!.predicate_id).toBe('mine');
    expect(cp!.check_prompt).toBe('내가 확정한 판단');
    expect(cp!.authorship).toBe('user_authored');
  });
});

describe('nextAmbiguityHandle (§7.3) + defensive expectation', () => {
  it('extends a prior date handle by the reponder cadence', () => {
    const h = nextAmbiguityHandle({ kind: 'date', value: '2026-09-01', auto_due: true }, '2026-09-05');
    expect(h.kind).toBe('date');
    expect(h.value > '2026-09-01').toBe(true);
    expect(h.auto_due).toBe(true);
  });
  it('runs from today when there is no prior date handle', () => {
    const h = nextAmbiguityHandle(undefined, '2026-09-05');
    expect(h.value > '2026-09-05').toBe(true);
  });
  it('legacy contract without expectation reads as occur', () => {
    expect(checkpointExpectation({ primary_checkpoint: undefined })).toBe('occur');
  });
});

describe('isCheckpointDue + armCheckpointSilence — non-date handles never sleep forever (§9.2)', () => {
  const dateHandle = (v: string): ReturnHandle => ({ kind: 'date', value: v, auto_due: true });
  const eventHandle = (): ReturnHandle => ({ kind: 'event', value: '이사회 후', auto_due: false });

  it('a date handle is due when its date has arrived', () => {
    expect(isCheckpointDue({ return_handle: dateHandle('2026-09-01') }, '2026-08-31')).toBe(false);
    expect(isCheckpointDue({ return_handle: dateHandle('2026-09-01') }, '2026-09-01')).toBe(true);
  });

  it('an UN-armed non-date handle is never due (never nags before its time)', () => {
    expect(isCheckpointDue({ return_handle: eventHandle() }, '2027-01-01')).toBe(false);
  });

  it('arming a non-date handle sets a silence cap; it becomes due only after the cap', () => {
    const armed = armCheckpointSilence(eventHandle(), '2026-07-06');
    expect(armed.silence_until).toBeTruthy();
    // not due before the cap …
    expect(isCheckpointDue({ return_handle: armed }, '2026-07-20')).toBe(false);
    // … due once the cap (today + 30) is reached
    expect(isCheckpointDue({ return_handle: armed }, '2026-08-05')).toBe(true);
  });

  it('the cap is CHECKPOINT_SILENCE_CAP_DAYS out', () => {
    const armed = armCheckpointSilence(eventHandle(), '2026-07-06', CHECKPOINT_SILENCE_CAP_DAYS);
    expect(armed.silence_until!.slice(0, 10)).toBe('2026-08-05'); // 2026-07-06 + 30
  });

  it('a date auto_due handle is not armed (it fires on its own); arming is idempotent', () => {
    const d = dateHandle('2026-09-01');
    expect(armCheckpointSilence(d, '2026-07-06')).toBe(d);          // unchanged
    const armed = armCheckpointSilence(eventHandle(), '2026-07-06');
    expect(armCheckpointSilence(armed, '2026-08-01')).toBe(armed);  // already armed → unchanged
  });

  it('derivePrimaryCheckpoint arms a manual handle when today is passed', () => {
    const cp = derivePrimaryCheckpoint({ predicates: [pred()], check_in_at: undefined }, undefined, '2026-07-06');
    expect(cp!.return_handle.kind).toBe('manual');
    expect(cp!.return_handle.silence_until).toBeTruthy(); // born armed → will surface, never sleeps
  });
});
