import { describe, it, expect } from 'vitest';
import {
  DECISION_SIGMA,
  MIN_READINGS,
  SLACK_RATIO,
  readNumber,
  readingFrom,
  watchBlocks,
  watchStatus,
  watchToBinding,
  watchToCusumPrior,
  watchToPortfolioPrior,
  type WatchSetup,
} from '../watch';
import { appendReading, assessPremise, makePremise, premiseIdentityKey, referenceFrom, returnTriggers } from '../premise';
import { emptyFrame, sealFrame, addElement, makeElement } from '../frame';

const good = (): WatchSetup => ({
  what: '전환율',
  where: '대시보드 A',
  normal: '3%',
  wobble: '0.2%p',
  broken: '2%',
  why: '2% 밑이면 광고비가 안 빠집니다',
});

describe('사람 말 → 임계', () => {
  it('멀쩡한 답에는 막는 것이 없다', () => {
    expect(watchBlocks(good())).toEqual([]);
  });

  it('막는 이유를 한 번에 다 준다 — 하나씩 튕기지 않는다', () => {
    const blocks = watchBlocks({ what: '', where: '', normal: '가나다', wobble: '', broken: '', why: '' });
    expect(blocks.length).toBeGreaterThan(3);
  });

  it('숫자가 아닌 값은 0으로 메우지 않고 막는다', () => {
    expect(readNumber('가나다')).toBeNaN();
    expect(readNumber('3%')).toBe(3);
    expect(watchBlocks({ ...good(), normal: '보통' }).join(' ')).toContain('숫자가 아닙니다');
  });

  it('깨진 값이 평소 출렁임 안에 있으면 만들지 않는다 — 소음과 구별되지 않는다', () => {
    const w = { ...good(), normal: '3', wobble: '1', broken: '2.5' };
    expect(watchBlocks(w).join(' ')).toContain('평소 출렁임');
    expect(watchToCusumPrior(w)).toBeNull();
  });

  it('평소 값과 깨진 값이 같으면 만들지 않는다', () => {
    expect(watchBlocks({ ...good(), broken: '3%' }).join(' ')).toContain('언제 깨진 건지');
  });

  it('근거 없는 임계는 만들지 않는다 — 나중에 검토할 수 없다', () => {
    expect(watchToCusumPrior({ ...good(), why: '  ' })).toBeNull();
  });

  it('탐지기 하나만으로는 contested 에서 멈춘다 — 두 번째 판정이 있어야 shaken 이다', () => {
    // 이건 결함이 아니라 설계다. 한쪽만 말한 것을 "무너졌다"로 적으면
    // 사용자는 두 판정이 엇갈렸다는 사실을 못 본다.
    const prior = watchToPortfolioPrior(good());
    expect(prior?.target).toBe(3);
    expect(prior?.scale).toBeCloseTo(1);
    expect(prior?.shareRate).toBeGreaterThan(0);
    expect(prior?.rationale).toContain('이 데이터에서 나온 값이 아님');
  });

  it('막힌 답으로는 포트폴리오 사전 믿음도 만들지 않는다', () => {
    expect(watchToPortfolioPrior({ ...good(), why: '' })).toBeNull();
  });

  it('관례를 코드에 숨기지 않고 근거 문장에 적어 남긴다', () => {
    const prior = watchToCusumPrior(good());
    expect(prior?.target).toBe(3);
    expect(prior?.slack).toBeCloseTo(Math.abs(3 - 2) * SLACK_RATIO);
    expect(prior?.decisionInterval).toBeCloseTo(0.2 * DECISION_SIGMA);
    expect(prior?.rationale).toContain('광고비');
    expect(prior?.rationale).toContain('이 데이터에서 나온 값이 아님');
  });

  it('임계는 근거와 함께만 산다 (binding)', () => {
    const b = watchToBinding(good());
    expect(b.threshold_owner).toBe('user');
    expect(b.threshold_rationale.length).toBeGreaterThan(0);
  });
});

describe('판독 — 못 본 것을 봤다고 하지 않는다', () => {
  it('값을 안 적으면 unread 이고 이유가 남는다', () => {
    const r = readingFrom(good(), { value: '   ', observedAt: '2026-08-01T00:00:00Z' });
    expect(r.verdict).toBe('unread');
    expect(r.value).toBeNull();
    expect(r.unread_reason).toBeTruthy();
  });

  it('한 건만 보고 판정을 부르지 않는다 — 판정은 계열 전체가 한다', () => {
    const r = readingFrom(good(), { value: '0.1%', observedAt: '2026-08-01T00:00:00Z' });
    expect(r.verdict).toBe('holds');
  });
});

describe('모자라면 모자란다고 말한다', () => {
  it('0건·부족·충분이 서로 다른 말을 받는다', () => {
    expect(watchStatus(0)).toContain('아직 본 값이 없습니다');
    expect(watchStatus(MIN_READINGS - 1)).toContain('아직 모른다');
    expect(watchStatus(MIN_READINGS)).toContain('판정합니다');
  });
});

describe('끝까지 이어지는가 — 감시 설정에서 판단이 깨어나기까지', () => {
  const iso = (d: number) => `2026-08-${String(d).padStart(2, '0')}T00:00:00Z`;

  it('전제가 무너지면 그것을 참조한 봉인된 판단이 깨어난다', () => {
    const w = good();
    let p = makePremise({
      id: 'p1',
      userId: null,
      text: '전환율이 지금 수준으로 유지된다',
      bindings: [watchToBinding(w)],
      cusumPrior: watchToCusumPrior(w),
      portfolioPrior: watchToPortfolioPrior(w),
      now: 0,
    });

    // 전제를 참조하는 봉인된 판단 하나. 전부 사람이 직접 친 문장이다
    // (aiDraft 없음 · touched) — 그래야 이해 게이트가 걸리지 않는다.
    let f = emptyFrame({ id: 'f1', userId: null, title: '광고비를 두 배로 올린다', now: 1 });
    for (const [axis, text] of [
      ['frame', '지금 성장 국면이라고 보고 있다'],
      ['values', '성장이 이익보다 먼저다'],
      ['premises', '전환율이 지금 수준으로 유지된다'],
      ['falsifier', '전환율이 2% 밑으로 가면 틀린 것이다'],
    ] as const) {
      f = addElement(f, makeElement({ id: `${axis}-1`, axis, text, touched: true, now: 1 }), 1);
    }
    const sealed = sealFrame({ frame: f, now: 1 });
    if (!sealed.ok) throw new Error(`봉인이 막혔다: ${sealed.messages.join(' / ')}`);
    p = referenceFrom(p, f.id, 1);

    // 아직 아무것도 안 봤으면 깨우지 않는다 — 과발화 금지.
    expect(returnTriggers([p], [sealed.frame])).toEqual([]);

    // 전환율이 계속 떨어진다.
    for (const [i, v] of ['2.4%', '2.1%', '1.8%', '1.6%', '1.5%'].entries()) {
      p = appendReading(p, readingFrom(w, { value: v, observedAt: iso(i + 2) }), i + 2);
    }
    expect(assessPremise(p).stance).toBe('shaken');

    const triggers = returnTriggers([p], [sealed.frame]);
    expect(triggers).toHaveLength(1);
    expect(triggers[0].wake_frame_ids).toEqual(['f1']);
  });

  it('사전 믿음이 없으면 판정하지 않는다 — unread 는 holds 가 아니다', () => {
    let p = makePremise({ id: 'p2', userId: null, text: '전환율 유지', now: 0 });
    for (const [i, v] of ['1%', '0.5%', '0.2%'].entries()) {
      p = appendReading(p, readingFrom(good(), { value: v, observedAt: iso(i + 1) }), i + 1);
    }
    expect(assessPremise(p).stance).toBe('unread');
    expect(returnTriggers([p], [])).toEqual([]);
  });
});

describe('같은 전제를 쓴 판단들이 한꺼번에 깨어난다 (M2·M3 가 가능해진 이유)', () => {
  const iso = (d: number) => `2026-08-${String(d).padStart(2, '0')}T00:00:00Z`;

  const sealedFrame = (id: string, title: string, premiseText: string) => {
    let f = emptyFrame({ id, userId: null, title, now: 1 });
    for (const [axis, text] of [
      ['frame', `${title} 라는 국면으로 보고 있다`],
      ['values', '성장이 이익보다 먼저다'],
      ['premises', premiseText],
      ['falsifier', '그 숫자가 절반이 되면 틀린 것이다'],
    ] as const) {
      f = addElement(f, makeElement({ id: `${id}-${axis}`, axis, text, touched: true, now: 1 }), 1);
    }
    const r = sealFrame({ frame: f, now: 1 });
    if (!r.ok) throw new Error(r.messages.join(' / '));
    return r.frame;
  };

  it('띄어쓰기·대소문자가 달라도 같은 전제로 묶인다 — premises-core 의 정규화를 쓴다', () => {
    expect(premiseIdentityKey('전환율이  지금 수준으로 유지된다 ')).toBe(
      premiseIdentityKey('전환율이 지금 수준으로 유지된다'),
    );
  });

  it('전제 하나가 흔들리면 그것을 참조한 봉인된 판단이 전부 깨어난다', () => {
    const text = '전환율이 지금 수준으로 유지된다';
    const f1 = sealedFrame('f1', '광고비를 두 배로 올린다', text);
    const f2 = sealedFrame('f2', '영업을 두 명 더 뽑는다', `${text} `); // 공백만 다름

    const w = good();
    let p = makePremise({
      id: 'p1', userId: null, text,
      bindings: [watchToBinding(w)],
      cusumPrior: watchToCusumPrior(w),
      portfolioPrior: watchToPortfolioPrior(w),
      now: 0,
    });
    // 화면이 봉인 때 하는 것과 같은 연결.
    for (const f of [f1, f2]) {
      const el = f.elements.find((e) => e.axis === 'premises');
      if (el && premiseIdentityKey(el.text) === premiseIdentityKey(p.text)) p = referenceFrom(p, f.id, 1);
    }
    expect(p.referenced_by).toEqual(['f1', 'f2']);

    for (const [i, v] of ['2.4%', '2.1%', '1.8%', '1.6%', '1.5%'].entries()) {
      p = appendReading(p, readingFrom(w, { value: v, observedAt: iso(i + 2) }), i + 2);
    }
    const t = returnTriggers([p], [f1, f2]);
    expect(t).toHaveLength(1);
    expect(t[0].wake_frame_ids.sort()).toEqual(['f1', 'f2']);
  });

  it('미판독은 전제를 깨우지 않는다 — 못 본 것은 "괜찮다"도 "깨졌다"도 아니다', () => {
    const w = good();
    let p = makePremise({
      id: 'p2', userId: null, text: '전환율 유지',
      bindings: [watchToBinding(w)], cusumPrior: watchToCusumPrior(w),
      portfolioPrior: watchToPortfolioPrior(w), now: 0,
    });
    p = referenceFrom(p, 'f1', 1);
    for (const i of [0, 1, 2, 3, 4]) {
      p = appendReading(p, readingFrom(w, { value: '', unreadReason: '대시보드가 안 열렸다', observedAt: iso(i + 2) }), i + 2);
    }
    expect(assessPremise(p).stance).toBe('unread');
    expect(returnTriggers([p], [sealedFrame('f1', '광고비를 올린다', '전환율 유지')])).toEqual([]);
  });
});
