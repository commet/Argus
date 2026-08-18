import { describe, it, expect } from 'vitest';
import { addElement, emptyFrame, makeElement, sealFrame, settleFrame } from '../frame';
import { calibration, scorablePredictions, MIN_SAMPLE } from '../calibration';
import type { CognitiveFrame, SealedConfidence } from '../types';

/**
 * 봉인 시점 예측의 채점 — **화면이 하는 것과 같은 순서로.**
 *
 * 진단에서 나온 것: calibration 은 `frame.confidence` 를 요구하는데 화면이
 * 그걸 한 번도 채우지 않았다. 그래서 M8 은 영원히 "채점할 대상이 없습니다"
 * 였다. 지표는 구현돼 있는데 입력 경로가 없던 것이다.
 *
 * 이 테스트는 그 경로가 실제로 이어졌는지, 그리고 **이어졌다고 해서 아무거나
 * 채점하지는 않는지**를 못박는다.
 */
const at = Date.parse('2026-08-01T00:00:00Z');

function frameWith(id: string, confidence: SealedConfidence | null): CognitiveFrame {
  let f = emptyFrame({ id, userId: null, title: `판단 ${id}`, now: at });
  for (const [axis, text] of [
    ['frame', '지금 성장 국면이라고 보고 있다'],
    ['values', '성장이 이익보다 먼저다'],
    ['premises', '전환율이 지금 수준으로 유지된다'],
    ['falsifier', '전환율이 2% 밑으로 가면 틀린 것이다'],
  ] as const) {
    f = addElement(f, makeElement({ id: `${id}-${axis}`, axis, text, touched: true, now: at }), at);
  }
  const r = sealFrame({ frame: f, confidence, now: at });
  if (!r.ok) throw new Error(r.messages.join(' / '));
  return r.frame;
}

const conf = (value: number, resolvable = true): SealedConfidence => ({
  value,
  about_element_id: 'x-falsifier',
  resolvable,
  resolvable_reason: resolvable ? '' : '무엇을 실패로 볼지 정하지 않았다',
});

const settled = (f: CognitiveFrame, falsifierObserved: boolean) =>
  settleFrame({
    frame: f,
    settlement: {
      falsifier_observed: falsifierObserved,
      observed: falsifierObserved ? '그 일이 일어났다' : '그 일이 일어나지 않았다',
      evidence_ref: `dash:${f.id}`,
      observed_at: '2026-08-10T00:00:00Z',
      retrospective: '',
    },
    now: Date.parse('2026-08-10T00:00:00Z'),
  });

describe('무엇이 채점 대상이 되는가', () => {
  it('예측을 안 적은 판단은 채점하지 않는다 — 안 적은 것이 0점이 되면 안 된다', () => {
    expect(scorablePredictions([settled(frameWith('a', null), false)])).toEqual([]);
  });

  it('정산 전 판단은 채점하지 않는다 — 결과가 없으면 맞췄는지 알 수 없다', () => {
    expect(scorablePredictions([frameWith('b', conf(70))])).toEqual([]);
  });

  it('가릴 수 없다고 표시한 예측은 분모에서 빠진다 (M6 정의)', () => {
    expect(scorablePredictions([settled(frameWith('c', conf(70, false)), false)])).toEqual([]);
  });

  it('반증 조건이 관찰됐다 = 판단이 틀렸다 — 방향을 뒤집지 않는다', () => {
    expect(scorablePredictions([settled(frameWith('d', conf(80)), true)])[0].outcome).toBe(0);
    expect(scorablePredictions([settled(frameWith('e', conf(80)), false)])[0].outcome).toBe(1);
  });

  it('0~100 을 0~1 로 옮기고 범위를 벗어나면 자른다', () => {
    expect(scorablePredictions([settled(frameWith('f', conf(70)), false)])[0].forecast).toBeCloseTo(0.7);
    expect(scorablePredictions([settled(frameWith('g', conf(150)), false)])[0].forecast).toBe(1);
  });
});

describe('표본이 모자라면 숫자를 내지 않는다', () => {
  it('한 건도 없으면 그렇게 말한다', () => {
    const r = calibration([]);
    expect(r.state).toBe('unknown');
    expect(r.reason).toContain('채점할 대상이 없습니다');
  });

  it(`임계(${MIN_SAMPLE}건) 미만이면 "아직 모릅니다" 다 — 몇 건인지도 밝힌다`, () => {
    const frames = Array.from({ length: MIN_SAMPLE - 1 }, (_, i) => settled(frameWith(`h${i}`, conf(70)), i % 2 === 0));
    const r = calibration(frames);
    expect(r.state).toBe('unknown');
    expect(r.reason).toContain('아직 모릅니다');
    expect(r.sample).toBe(MIN_SAMPLE - 1);
  });

  it('임계를 넘으면 채점하고, 근거 케이스를 함께 준다', () => {
    const frames = Array.from({ length: MIN_SAMPLE }, (_, i) => settled(frameWith(`i${i}`, conf(70)), i % 2 === 0));
    const r = calibration(frames);
    expect(r.state).toBe('measured');
    expect(r.sample).toBe(MIN_SAMPLE);
    expect(r.case_refs).toHaveLength(MIN_SAMPLE);
  });
});

describe('채점 대상이 사람이 아니라 예측임을 문장이 밝힌다 (Zero-Judgment)', () => {
  const frames = Array.from({ length: MIN_SAMPLE }, (_, i) => settled(frameWith(`j${i}`, conf(70)), i % 2 === 0));
  const r = calibration(frames);

  it('주어가 예측이다', () => {
    expect(r.subject_sentence).toContain('예측');
    expect(r.subject_sentence).toContain('어떤 사람인지에 대한 평가가 아닙니다');
  });

  it('사람에 대한 등급·성향 어휘가 없다', () => {
    const text = `${r.subject_sentence ?? ''} ${r.reason ?? ''}`;
    for (const banned of ['당신은', '성향', '등급', '점수가 높은 편', '결정자']) {
      expect(text, `금지 어휘 "${banned}"`).not.toContain(banned);
    }
  });
});

describe('잘 맞춘 예측과 못 맞춘 예측이 다른 숫자를 받는다', () => {
  const n = MIN_SAMPLE;
  // 90% 라고 하고 다 맞은 경우 vs 90% 라고 하고 다 틀린 경우.
  const confident = Array.from({ length: n }, (_, i) => settled(frameWith(`k${i}`, conf(90)), false));
  const wrong = Array.from({ length: n }, (_, i) => settled(frameWith(`l${i}`, conf(90)), true));

  it('확신대로 맞으면 신뢰도가 0에 가깝다', () => {
    const r = calibration(confident);
    expect(r.state).toBe('measured');
    expect(r.reliability ?? 1).toBeLessThan(0.02);
  });

  it('확신대로 틀리면 신뢰도가 크게 벌어진다', () => {
    const r = calibration(wrong);
    expect(r.reliability ?? 0).toBeGreaterThan(0.5);
  });

  it('두 경우의 Brier 가 뚜렷이 다르다', () => {
    expect((calibration(wrong).brier ?? 0) - (calibration(confident).brier ?? 0)).toBeGreaterThan(0.5);
  });
});
