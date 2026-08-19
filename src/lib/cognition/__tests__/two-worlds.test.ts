import { describe, it, expect } from 'vitest';
import { addElement, emptyFrame, liveElements, makeElement, recordReading, sealFrame } from '../frame';
import { reconcileWorld, retractCrossing, worldTrajectory } from '../world';
import { isSamePremiseText } from '../premise';
import { readingFrom, watchToBinding, type WatchSetup } from '../watch';
import type { CognitiveFrame } from '../types';

/**
 * 두 세계를 실제로 넘나들 수 있는가 — **화면이 하는 것과 같은 순서로.**
 *
 * 창업자 요구: 매트릭스 안에 갇히지도, 밖에 갇히지도 않고 자유롭게 넘나드는 Neo.
 * 데이터로 옮기면 이렇다 — 문장은 프레임 안에서 태어나고, 현실이 확인해 주면
 * 건너가고, 그 근거를 물리면 **되돌아온다.** 한 방향 승격만 있으면 그건
 * 넘나듦이 아니라 다른 감옥이다.
 *
 * 진단에서 나온 것: `recordReading`·`retractCrossing`·`worldTrajectory` 가
 * 시뮬레이터에서만 불리고 있었다 — 즉 사용자는 이 기제를 쓸 수 없었다.
 * 이 테스트는 화면이 그 셋을 실제로 이어 쓰는 순서를 그대로 재현한다.
 */
const watch = (): WatchSetup => ({
  what: '전환율',
  where: '대시보드 A',
  normal: '3%',
  wobble: '0.2%p',
  broken: '2%',
  why: '2% 밑이면 광고비가 안 빠집니다',
});

const PREMISE = '전환율이 지금 수준으로 유지된다';

function sealedFrame(): CognitiveFrame {
  let f = emptyFrame({ id: 'f1', userId: null, title: '광고비를 두 배로 올린다', now: 1 });
  for (const [axis, text] of [
    ['frame', '지금 성장 국면이라고 보고 있다'],
    ['values', '성장이 이익보다 먼저다'],
    ['premises', PREMISE],
    ['falsifier', '전환율이 2% 밑으로 가면 틀린 것이다'],
  ] as const) {
    f = addElement(f, makeElement({ id: `f1-${axis}`, axis, text, touched: true, now: 1 }), 1);
  }
  const r = sealFrame({ frame: f, now: 1 });
  if (!r.ok) throw new Error(r.messages.join(' / '));
  return r.frame;
}

/** 화면의 onArmWatch 와 같은 것 — 봉인 뒤에 결박을 건다. */
function arm(f: CognitiveFrame, w: WatchSetup): CognitiveFrame {
  const binding = watchToBinding(w);
  return {
    ...f,
    elements: f.elements.map((el) =>
      el.axis === 'premises' && isSamePremiseText(el.text, PREMISE) ? { ...el, bindings: [binding] } : el,
    ),
  };
}

const premiseEl = (f: CognitiveFrame) => liveElements(f).find((e) => e.axis === 'premises')!;

describe('두 세계 — 건너가고, 되돌아온다', () => {
  it('태어날 때는 프레임 안이다 — 스스로 선언해서 건널 수 없다', () => {
    const f = sealedFrame();
    expect(premiseEl(f).world).toBe('in_frame');
    expect(premiseEl(f).crossings).toEqual([]);
  });

  it('봉인 뒤에도 결박을 걸 수 있다 — 잠기는 것은 문장이지 현실 접촉이 아니다', () => {
    const f = arm(sealedFrame(), watch());
    expect(premiseEl(f).bindings).toHaveLength(1);
    expect(premiseEl(f).text).toBe(PREMISE); // 문장은 그대로
  });

  it('값을 읽으면 건넌다', () => {
    const w = watch();
    const f = recordReading(arm(sealedFrame(), w), readingFrom(w, { value: '2.4%', observedAt: '2026-08-02T00:00:00Z' }), 2);
    expect(premiseEl(f).world).toBe('reality_contact');
    expect(premiseEl(f).crossings).toHaveLength(1);
  });

  it('못 읽으면 건너지 않는다 — 미판독은 접촉이 아니다', () => {
    const w = watch();
    const f = recordReading(
      arm(sealedFrame(), w),
      readingFrom(w, { value: '', unreadReason: '대시보드가 안 열렸다', observedAt: '2026-08-02T00:00:00Z' }),
      2,
    );
    expect(premiseEl(f).world).toBe('in_frame');
    expect(premiseEl(f).crossings).toEqual([]);
    // 판독 자체는 원장에 남는다 — 못 본 것도 사실이다.
    expect(f.readings).toHaveLength(1);
  });

  it('결박이 없으면 판독이 와도 건너지 않는다 — 아무 숫자나 증거가 되지 않는다', () => {
    const w = watch();
    const f = recordReading(sealedFrame(), readingFrom(w, { value: '2.4%', observedAt: '2026-08-02T00:00:00Z' }), 2);
    expect(premiseEl(f).world).toBe('in_frame');
  });

  it('근거를 물리면 되돌아온다 — 한 방향뿐이면 넘나듦이 아니라 다른 감옥이다', () => {
    const w = watch();
    let f = recordReading(arm(sealedFrame(), w), readingFrom(w, { value: '2.4%', observedAt: '2026-08-02T00:00:00Z' }), 2);
    expect(premiseEl(f).world).toBe('reality_contact');

    const el = premiseEl(f);
    f = {
      ...f,
      elements: f.elements.map((x) =>
        x.id !== el.id
          ? x
          : reconcileWorld({
              ...x,
              crossings: x.crossings.map((c) => retractCrossing(c, '2026-08-05T00:00:00Z', '지표를 잘못 읽었다')),
            }),
      ),
    };
    expect(premiseEl(f).world).toBe('in_frame');
    // 증거를 지우지 않는다 — 물린 사실이 원장에 남는다.
    expect(premiseEl(f).crossings[0].retraction_reason).toBe('지표를 잘못 읽었다');
  });

  it('사유 없이는 무를 수 없다', () => {
    const w = watch();
    const f = recordReading(arm(sealedFrame(), w), readingFrom(w, { value: '2.4%', observedAt: '2026-08-02T00:00:00Z' }), 2);
    const c = premiseEl(f).crossings[0];
    expect(retractCrossing(c, '2026-08-05T00:00:00Z', '   ')).toEqual(c);
  });

  it('오간 자취가 남는다 — 갔다가 돌아온 것이 보인다', () => {
    const w = watch();
    let f = recordReading(arm(sealedFrame(), w), readingFrom(w, { value: '2.4%', observedAt: '2026-08-02T00:00:00Z' }), 2);
    const el = premiseEl(f);
    f = {
      ...f,
      elements: f.elements.map((x) =>
        x.id !== el.id
          ? x
          : reconcileWorld({
              ...x,
              crossings: x.crossings.map((c) => retractCrossing(c, '2026-08-05T00:00:00Z', '지표를 잘못 읽었다')),
            }),
      ),
    };
    const traj = worldTrajectory(premiseEl(f).crossings);
    expect(traj.map((t) => t.to)).toEqual(['reality_contact', 'in_frame']);
    expect(traj[1].cause).toBe('retraction');
  });

  it('물린 뒤 새 근거가 오면 다시 건넌다 — 문이 잠기지 않는다', () => {
    const w = watch();
    let f = recordReading(arm(sealedFrame(), w), readingFrom(w, { value: '2.4%', observedAt: '2026-08-02T00:00:00Z' }), 2);
    const el = premiseEl(f);
    f = {
      ...f,
      elements: f.elements.map((x) =>
        x.id !== el.id
          ? x
          : reconcileWorld({
              ...x,
              crossings: x.crossings.map((c) => retractCrossing(c, '2026-08-05T00:00:00Z', '지표를 잘못 읽었다')),
            }),
      ),
    };
    expect(premiseEl(f).world).toBe('in_frame');

    f = recordReading(f, readingFrom(w, { value: '2.2%', observedAt: '2026-08-07T00:00:00Z' }), 7);
    expect(premiseEl(f).world).toBe('reality_contact');
    expect(worldTrajectory(premiseEl(f).crossings).map((t) => t.to)).toEqual([
      'reality_contact',
      'in_frame',
      'reality_contact',
    ]);
  });
});
