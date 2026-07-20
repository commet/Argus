/**
 * The Layer-2 deterministic detector must catch a passing prediction, a surfacing
 * outcome, and a load-bearing assumption from NATURAL sentences (KO + EN) — and
 * stay silent on flat chatter, questions, and commands. Because it is rules, these
 * cases pin it: "plausible" cannot masquerade as "correct" (LLM-glue invariant).
 */
import { describe, it, expect } from 'vitest';
import { detectSignals } from '../detect-signals.js';

const kinds = (t: string, openPredicates: string[] = []) =>
  new Set(detectSignals(t, { openPredicates }).map((s) => s.kind));

describe('detectSignals — prediction (sense 1)', () => {
  it('catches EN checkable claims (future ∧ measurable/completion)', () => {
    expect(kinds('I think we will ship the app to TestFlight by Friday.')).toContain('prediction');
    expect(kinds('Churn should drop below 3% once we launch the new onboarding.')).toContain('prediction');
    expect(kinds('This hire will get us to weekly deploys within 2 months.')).toContain('prediction');
  });

  it('catches KO checkable claims', () => {
    expect(kinds('이번 채용으로 배포가 주 1회로 빨라질 거예요.')).toContain('prediction');
    expect(kinds('가격을 올려도 이탈률은 5% 아래로 유지될 겁니다.')).toContain('prediction');
    expect(kinds('다음 분기까지 매출 20% 성장할 것으로 예상합니다.')).toContain('prediction');
  });

  it('returns the user\'s OWN words as the span, never a fabrication', () => {
    const sig = detectSignals('We will hit 1,000 signups by March 1.')[0];
    expect(sig.kind).toBe('prediction');
    expect(sig.span).toBe('We will hit 1,000 signups by March 1.');
    expect(sig.cues).toContain('future');
  });

  it('does NOT fire on a bare future with nothing checkable', () => {
    expect(kinds('I will think about it.')).not.toContain('prediction');
    expect(kinds('그건 나중에 생각해볼게요.')).not.toContain('prediction');
  });

  it('does NOT fire on a plain question or command', () => {
    expect(kinds('Which database should we use?')).not.toContain('prediction');
    expect(kinds('Run the test suite and show me the output.')).not.toContain('prediction');
    expect(kinds('오늘 날씨 어때?')).not.toContain('prediction');
  });
});

describe('detectSignals — outcome (sense 2)', () => {
  const OPEN = ['서버 이전 후에도 다운타임은 없다', 'this hire gets us to weekly deploys'];

  it('catches a surfacing result that matches an OPEN prediction (KO + EN)', () => {
    expect(kinds('아 그 서버 이전은 결국 무중단으로 잘 끝났어요.', OPEN)).toContain('outcome');
    expect(kinds('Turns out the hire really did get us to weekly deploys.', OPEN)).toContain('outcome');
  });

  it('stays SILENT on past-tense chatter with no matching open prediction', () => {
    expect(kinds('아 어제 점심은 결국 국밥으로 잘 먹었어요.', OPEN)).not.toContain('outcome');
    expect(kinds('It turned out fine, thanks for asking.', OPEN)).not.toContain('outcome');
  });

  it('stays SILENT when there are no open predicates at all (the floor)', () => {
    expect(kinds('아 그 서버 이전은 결국 무중단으로 잘 끝났어요.', [])).not.toContain('outcome');
  });
});

describe('detectSignals — assumption (sense 3)', () => {
  it('catches a load-bearing premise (conditional ∧ consequential)', () => {
    expect(kinds('This only works as long as the vendor API stays under 200ms.')).toContain('assumption');
    expect(kinds('배포를 주 1회로 늘리는 건 새 채용이 6월까지 온보딩된다는 전제로 가능해요.')).toContain('assumption');
  });

  it('does NOT fire on a throwaway reason with nothing checkable', () => {
    expect(kinds('I skipped lunch because I was tired.')).not.toContain('assumption');
    expect(kinds('피곤해서 그냥 집에 갔어요.')).not.toContain('assumption');
  });
});

describe('detectSignals — hygiene', () => {
  it('returns [] for empty / trivial input', () => {
    expect(detectSignals('')).toEqual([]);
    expect(detectSignals('ok')).toEqual([]);
    expect(detectSignals('  ')).toEqual([]);
  });

  it('caps the number of signals (a turn is not a form to harvest)', () => {
    const many = Array.from({ length: 10 }, (_, i) => `We will ship feature ${i} by Friday.`).join(' ');
    expect(detectSignals(many, { max: 3 }).length).toBeLessThanOrEqual(3);
  });

  it('can surface more than one SENSE from one turn', () => {
    const t = 'We will cut churn below 3% by Q3, as long as the new pricing holds.';
    const k = kinds(t);
    expect(k).toContain('prediction');
    expect(k).toContain('assumption');
  });
});
