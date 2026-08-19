import { describe, it, expect } from 'vitest';
import {
  adaptiveWindow,
  allInsufficient,
  anyAlert,
  appendReading,
  assessPremise,
  attributedSettlements,
  attributionDrift,
  cusum,
  detectAll,
  disagreement,
  emptyFrame,
  makePremise,
  measureM2,
  measureM3,
  measureM5,
  MIN_PER_SIDE,
  referenceFrom,
  retractCrossing,
  returnTriggers,
  runPortfolio,
  toNumericSeries,
  worldTrajectory,
  type AdwinPrior,
  type AttributedSettlement,
  type CognitiveFrame,
  type Crossing,
  type CusumPrior,
  type PortfolioPrior,
  type SignalReading,
} from '..';

const T0 = Date.parse('2026-08-17T00:00:00Z');
const iso = (offsetHours: number): string => new Date(T0 + offsetHours * 3_600_000).toISOString();

const reading = (value: string | null, offsetHours: number, verdict: SignalReading['verdict'] = 'holds'): SignalReading => ({
  binding_kind: 'metric',
  target: 'conversion',
  value,
  verdict,
  observed_at: iso(offsetHours),
  ...(value === null ? { unread_reason: '네트워크 도달 불가' } : {}),
});

const CUSUM_PRIOR: CusumPrior = {
  target: 3,
  slack: 0.25,
  decisionInterval: 1.5,
  rationale: '탐지하려는 이동폭 0.5%p 의 절반을 여유로, 결정 구간은 그 3배.',
};

const ADWIN_PRIOR: AdwinPrior = {
  delta: 0.05,
  minSplit: 3,
  rationale: 'ADWIN 원논문 관례 범위의 느슨한 쪽 — 파일럿에서는 경보를 놓치는 것보다 보는 편이 낫다.',
};

const PORTFOLIO_PRIOR: PortfolioPrior = {
  learningRate: 1.5,
  shareRate: 0.05,
  target: 3,
  scale: 1,
  rationale: '학습률은 3가설 기준 관례치, 공유율 0.05 는 국면 전환 후 부활에 필요한 최소치.',
};

describe('수치 열 추출 — 미판독을 0으로 강제하지 않는다', () => {
  it('unread 는 값에서 빠지고 따로 세어진다', () => {
    const s = toNumericSeries([reading('3.0', 0), reading(null, 1, 'unread'), reading('3.1', 2)]);
    expect(s.values).toEqual([3.0, 3.1]);
    expect(s.excluded_unread).toBe(1);
    expect(s.excluded_non_numeric).toBe(0);
  });

  it('비수치는 unread 와 다른 사유로 세어진다', () => {
    const s = toNumericSeries([reading('가나다', 0), reading('3.0', 1)]);
    expect(s.values).toEqual([3.0]);
    expect(s.excluded_non_numeric).toBe(1);
  });

  it('저장 순서를 믿지 않고 시각순으로 정렬한다', () => {
    const s = toNumericSeries([reading('9', 5), reading('1', 0), reading('5', 2)]);
    expect(s.values).toEqual([1, 5, 9]);
  });

  it('단위가 붙은 값에서 숫자를 읽는다', () => {
    expect(toNumericSeries([reading('1400원', 0)]).values).toEqual([1400]);
  });
});

describe('CUSUM (Page 1954) — 인용이 아니라 계산', () => {
  it('표본이 3건 미만이면 insufficient — holds 로 적지 않는다', () => {
    const r = cusum(toNumericSeries([reading('3', 0), reading('3', 1)]), CUSUM_PRIOR);
    expect(r.verdict).toBe('insufficient');
    expect(r.statement).toContain('아직 판정하지 않습니다');
  });

  it('목표 근처에 머물면 holds', () => {
    const rs = [0, 1, 2, 3, 4, 5].map((h) => reading(String(3 + (h % 2 === 0 ? 0.05 : -0.05)), h));
    const r = cusum(toNumericSeries(rs), CUSUM_PRIOR);
    expect(r.verdict).toBe('holds');
    expect(r.statistic).toBeLessThanOrEqual(CUSUM_PRIOR.decisionInterval);
  });

  it('한쪽으로 누적 이탈하면 경보하고 시점을 돌려준다', () => {
    const rs = [0, 1, 2, 3, 4, 5, 6, 7].map((h) => reading(String(3 + h * 0.4), h));
    const r = cusum(toNumericSeries(rs), CUSUM_PRIOR);
    expect(r.verdict).toBe('alert');
    expect(r.evidence.change_at_index).toBeGreaterThanOrEqual(0);
    expect(r.evidence.change_at_ref).toContain('conversion@');
  });

  it('아래쪽 이탈도 잡는다 (양방향)', () => {
    const rs = [0, 1, 2, 3, 4, 5, 6, 7].map((h) => reading(String(3 - h * 0.4), h));
    expect(cusum(toNumericSeries(rs), CUSUM_PRIOR).verdict).toBe('alert');
  });

  it('임계를 결과에 항상 동봉한다 (숨긴 임계는 거짓말)', () => {
    const r = cusum(toNumericSeries([reading('3', 0), reading('3', 1), reading('3', 2)]), CUSUM_PRIOR);
    expect(r.threshold).toBe(CUSUM_PRIOR.decisionInterval);
    expect(r.prior).toBe(CUSUM_PRIOR);
  });
});

describe('적응 창 (ADWIN 핵심) — 목표를 몰라도 갈린 지점을 찾는다', () => {
  it('분할당 최소 표본이 안 되면 insufficient', () => {
    const rs = [0, 1, 2].map((h) => reading('3', h));
    expect(adaptiveWindow(toNumericSeries(rs), ADWIN_PRIOR).verdict).toBe('insufficient');
  });

  it('전부 같은 값이면 변화 없음', () => {
    const rs = [0, 1, 2, 3, 4, 5, 6, 7].map((h) => reading('3', h));
    const r = adaptiveWindow(toNumericSeries(rs), ADWIN_PRIOR);
    expect(r.verdict).toBe('holds');
    expect(r.statement).toContain('모두 같은 값');
  });

  it('표본이 짧으면 경계가 공허하다는 사실을 말한다 — holds 로 적지 않는다', () => {
    // Hoeffding 경계는 수천 점 스트림용이다. n=12 에서는 정규화 평균차의 최댓값(1)
    // 보다 경계가 크므로 어떤 변화도 판정할 수 없다. 그 사실을 숨기면 "봤는데
    // 괜찮다"는 거짓말이 된다.
    const rs = [
      ...[0, 1, 2, 3, 4, 5].map((h) => reading('3', h)),
      ...[6, 7, 8, 9, 10, 11].map((h) => reading('9', h)),
    ];
    const r = adaptiveWindow(toNumericSeries(rs), ADWIN_PRIOR);
    expect(r.verdict).toBe('insufficient');
    expect(r.statement).toContain('어떤 변화도 판정할 수 없습니다');
    expect(r.statement).toContain('"괜찮다"가 아닙니다');
  });

  it('표본이 충분하면 수준 변화를 경보하고 갈린 지점을 준다', () => {
    const rs = [
      ...Array.from({ length: 20 }, (_, h) => reading('3', h)),
      ...Array.from({ length: 20 }, (_, h) => reading('9', h + 20)),
    ];
    const r = adaptiveWindow(toNumericSeries(rs), ADWIN_PRIOR);
    expect(r.verdict).toBe('alert');
    expect(r.evidence.change_at_index).toBe(20);
    expect(r.evidence.before).toBeCloseTo(3, 4);
    expect(r.evidence.after).toBeCloseTo(9, 4);
  });

  it('표본이 충분해도 작은 잡음은 경계 안이다 (위양성 확인)', () => {
    const rs = Array.from({ length: 40 }, (_, h) => reading(String(3 + (h % 2 ? 0.01 : -0.01)), h));
    expect(adaptiveWindow(toNumericSeries(rs), ADWIN_PRIOR).verdict).toBe('holds');
  });

  it('두 탐지기는 합의를 요구하지 않는다 — 각자 다른 질문에 답한다', () => {
    const rs = [0, 1, 2, 3, 4, 5, 6, 7].map((h) => reading(String(3 + h * 0.4), h));
    const results = detectAll(rs, { cusum: CUSUM_PRIOR, adwin: ADWIN_PRIOR });
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.method)).toEqual(['cusum', 'adaptive_window']);
  });

  it('전부 insufficient 인 상태를 holds 와 구분한다', () => {
    const results = detectAll([reading('3', 0)], { cusum: CUSUM_PRIOR, adwin: ADWIN_PRIOR });
    expect(allInsufficient(results)).toBe(true);
    expect(anyAlert(results)).toBe(false);
  });
});

describe('포트폴리오 (Herbster-Warmuth fixed-share) — 탐지 없이 추적한다', () => {
  it('표본이 없으면 균등 가중치이고 어느 가설도 앞세우지 않는다', () => {
    const r = runPortfolio([], PORTFOLIO_PRIOR);
    expect(r.weights.holds).toBeCloseTo(1 / 3, 3);
    expect(r.statement).toContain('모른다는 뜻');
  });

  it('목표 근처가 계속되면 holds 가 앞선다', () => {
    const rs = [0, 1, 2, 3, 4, 5, 6, 7].map((h) => reading('3', h));
    const r = runPortfolio(rs, PORTFOLIO_PRIOR);
    expect(r.leader).toBe('holds');
    expect(r.weights.holds).toBeGreaterThan(r.weights.broken);
  });

  it('국면이 바뀌면 선두가 교체된다 — 임계 없이', () => {
    const rs = [
      ...[0, 1, 2, 3, 4, 5].map((h) => reading('3', h)),
      ...[6, 7, 8, 9, 10, 11, 12, 13].map((h) => reading('7', h)),
    ];
    const r = runPortfolio(rs, PORTFOLIO_PRIOR);
    expect(r.leader).not.toBe('holds');
    expect(r.leadership_changes.length).toBeGreaterThan(0);
    expect(r.leadership_changes[0].ref).toContain('conversion@');
  });

  it('공유율이 0이 아니면 어떤 가설도 죽지 않는다 (부활 가능성 보존)', () => {
    const rs = Array.from({ length: 20 }, (_, h) => reading('7', h));
    const r = runPortfolio(rs, PORTFOLIO_PRIOR);
    for (const w of Object.values(r.weights)) expect(w).toBeGreaterThan(0);
  });

  it('공유율 0이면 추적 능력이 사라진다 (이 모수가 왜 존재하는지의 증거)', () => {
    const rs = [
      ...Array.from({ length: 10 }, (_, h) => reading('3', h)),
      ...Array.from({ length: 10 }, (_, h) => reading('7', h + 10)),
    ];
    const withShare = runPortfolio(rs, PORTFOLIO_PRIOR);
    const noShare = runPortfolio(rs, { ...PORTFOLIO_PRIOR, shareRate: 0 });
    // 공유가 있으면 holds 가 최소 가중치를 유지하고, 없으면 0에 붙는다.
    expect(withShare.weights.holds).toBeGreaterThan(noShare.weights.holds);
  });

  it('가중치 합은 항상 1이다', () => {
    const rs = Array.from({ length: 15 }, (_, h) => reading(String(3 + h * 0.3), h));
    const r = runPortfolio(rs, PORTFOLIO_PRIOR);
    const sum = r.weights.holds + r.weights.broken + r.weights.regime_shift;
    expect(Math.abs(sum - 1)).toBeLessThan(0.001);
  });

  it('같은 입력은 같은 궤적을 낸다 (결정론)', () => {
    const rs = Array.from({ length: 12 }, (_, h) => reading(String(3 + (h % 3)), h));
    expect(JSON.stringify(runPortfolio(rs, PORTFOLIO_PRIOR))).toBe(JSON.stringify(runPortfolio(rs, PORTFOLIO_PRIOR)));
  });

  it('탐지기와 엇갈리면 그 사실을 감추지 않는다', () => {
    const rs = Array.from({ length: 12 }, (_, h) => reading('3', h));
    const p = runPortfolio(rs, PORTFOLIO_PRIOR);
    expect(disagreement(true, p)).toContain('탐지기는 경보를 냈지만');
    expect(disagreement(false, p)).toBeNull();
  });
});

describe('지속 전제 — 기록이 시스템이 되는 자리', () => {
  it('임계가 없으면 판정하지 않는다 — 기본 임계를 몰래 끼워넣지 않는다', () => {
    let p = makePremise({ id: 'p1', userId: 'u', text: '전환율이 유지된다', now: T0 });
    for (let h = 0; h < 8; h += 1) p = appendReading(p, reading('9', h), T0);
    const a = assessPremise(p);
    expect(a.stance).toBe('unread');
    expect(a.statement).toContain('임계는 기계가 정할 수 없으므로');
  });

  it('판독이 모자라면 holds 가 아니라 unread', () => {
    let p = makePremise({ id: 'p2', userId: 'u', text: 'x', cusumPrior: CUSUM_PRIOR, now: T0 });
    p = appendReading(p, reading('3', 0), T0);
    const a = assessPremise(p);
    expect(a.stance).toBe('unread');
    expect(a.statement).toContain('"괜찮다"가 아니라 "아직 모른다"');
  });

  it('둘 다 흔들렸다고 하면 shaken', () => {
    let p = makePremise({
      id: 'p3',
      userId: 'u',
      text: 'x',
      cusumPrior: CUSUM_PRIOR,
      adwinPrior: ADWIN_PRIOR,
      portfolioPrior: PORTFOLIO_PRIOR,
      now: T0,
    });
    for (let h = 0; h < 40; h += 1) p = appendReading(p, reading(String(h < 20 ? 3 : 8), h), T0);
    expect(assessPremise(p).stance).toBe('shaken');
  });

  it('한쪽만 흔들리면 contested — 합치지 않고 이름을 준다', () => {
    let p = makePremise({
      id: 'p4',
      userId: 'u',
      text: 'x',
      // 임계를 아주 크게 잡아 탐지기는 조용하게 만든다.
      cusumPrior: { ...CUSUM_PRIOR, decisionInterval: 1000 },
      portfolioPrior: PORTFOLIO_PRIOR,
      now: T0,
    });
    for (let h = 0; h < 40; h += 1) p = appendReading(p, reading(String(h < 20 ? 3 : 8), h), T0);
    const a = assessPremise(p);
    expect(a.stance).toBe('contested');
    expect(a.disagreement).toBeTruthy();
  });

  it('전제가 흔들리면 그것을 참조한 봉인 판단들이 깨어난다', () => {
    let p = makePremise({
      id: 'p5',
      userId: 'u',
      text: '전환율 유지',
      cusumPrior: CUSUM_PRIOR,
      adwinPrior: ADWIN_PRIOR,
      portfolioPrior: PORTFOLIO_PRIOR,
      now: T0,
    });
    for (let h = 0; h < 40; h += 1) p = appendReading(p, reading(String(h < 20 ? 3 : 8), h), T0);
    p = referenceFrom(p, 'fA', T0);
    p = referenceFrom(p, 'fB', T0);

    const sealedFrame: CognitiveFrame = { ...emptyFrame({ id: 'fA', userId: 'u', title: '', now: T0 }), status: 'sealed', sealed_at: iso(20) };
    const settledFrame: CognitiveFrame = {
      ...emptyFrame({ id: 'fB', userId: 'u', title: '', now: T0 }),
      status: 'settled',
      sealed_at: iso(1),
      settlement: { falsifier_observed: false, observed: 'x', evidence_ref: 'r', observed_at: iso(9), retrospective: '' },
    };

    const triggers = returnTriggers([p], [sealedFrame, settledFrame]);
    expect(triggers).toHaveLength(1);
    expect(triggers[0].wake_frame_ids).toEqual(['fA']);
    expect(triggers[0].already_settled_ids).toEqual(['fB']);
  });
});

describe('M2·M3 — E-0에서 "측정조차 못 함"이던 것이 계산된다', () => {
  const shakenPremise = () => {
    let p = makePremise({
      id: 'pm',
      userId: 'u',
      text: '전환율 유지',
      cusumPrior: CUSUM_PRIOR,
      adwinPrior: ADWIN_PRIOR,
      now: T0,
    });
    for (let h = 0; h < 40; h += 1) p = appendReading(p, reading(String(h < 20 ? 3 : 8), h), T0);
    return p;
  };

  it('분모가 0이면 비율을 내지 않는다 (0%는 "괜찮다"로 읽힌다)', () => {
    const r = measureM2([shakenPremise()], []);
    expect(r.state).toBe('no_denominator');
    expect(r.ratio).toBeNull();
  });

  it('경보 이후 봉인된 판단을 센다', () => {
    const p = referenceFrom(shakenPremise(), 'fLate', T0);
    const late: CognitiveFrame = { ...emptyFrame({ id: 'fLate', userId: 'u', title: '', now: T0 }), status: 'sealed', sealed_at: iso(30) };
    const r = measureM2([p], [late]);
    expect(r.state).toBe('measured');
    expect(r.numerator).toBe(1);
    expect(r.denominator).toBe(1);
    expect(r.cases[0].frame_id).toBe('fLate');
  });

  it('경보 전에 봉인된 판단은 분자에서 빠진다', () => {
    const p = referenceFrom(shakenPremise(), 'fEarly', T0);
    const early: CognitiveFrame = { ...emptyFrame({ id: 'fEarly', userId: 'u', title: '', now: T0 }), status: 'sealed', sealed_at: iso(1) };
    const r = measureM2([p], [early]);
    expect(r.numerator).toBe(0);
    expect(r.denominator).toBe(1);
  });

  it('아직 정산되지 않은 사례는 0이 아니라 pending 으로 남는다', () => {
    const p = referenceFrom(shakenPremise(), 'fOpen', T0);
    const open: CognitiveFrame = { ...emptyFrame({ id: 'fOpen', userId: 'u', title: '', now: T0 }), status: 'sealed', sealed_at: iso(20) };
    const r = measureM3([p], [open]);
    expect(r.pending).toHaveLength(1);
    expect(r.median_delay_ms).toBeNull();
    expect(r.statement).toContain('0으로 적지 않습니다');
  });

  it('정산까지 간 사례의 지연을 잰다', () => {
    const p = referenceFrom(shakenPremise(), 'fDone', T0);
    const done: CognitiveFrame = {
      ...emptyFrame({ id: 'fDone', userId: 'u', title: '', now: T0 }),
      status: 'settled',
      sealed_at: iso(7),
      // 경보는 이동이 시작된 20시간 지점에서 뜨므로, 정산은 그보다 뒤여야 지연이
      // 양수다. (지연 0도 유효한 값이므로 코드는 그것을 배제하지 않는다.)
      settlement: { falsifier_observed: true, observed: 'x', evidence_ref: 'r', observed_at: iso(35), retrospective: '' },
    };
    const r = measureM3([p], [done]);
    expect(r.resolved_delays_ms.length).toBe(1);
    expect(r.median_delay_ms).toBeGreaterThan(0);
  });
});

describe('M5 귀속 비대칭 — 사람이 아니라 기록의 분포', () => {
  const s = (id: string, ok: boolean, attribution: AttributedSettlement['attribution']): AttributedSettlement => ({
    frame_id: id,
    succeeded: ok,
    attribution,
    evidence_ref: `ref-${id}`,
    observed_at: iso(1),
  });

  it('한쪽 표본이 모자라면 숫자 대신 "아직 모릅니다"', () => {
    const r = measureM5([s('a', true, 'judgment'), s('b', true, 'judgment'), s('c', true, 'judgment')]);
    expect(r.state).toBe('unknown');
    if (r.state === 'unknown') {
      expect(r.reason).toContain('아직 모릅니다');
      expect(r.min_per_side).toBe(MIN_PER_SIDE);
    }
  });

  it('양쪽이 차면 분포를 내고 채점 대상이 기록임을 밝힌다', () => {
    const r = measureM5([
      s('w1', true, 'judgment'),
      s('w2', true, 'judgment'),
      s('w3', true, 'judgment'),
      s('l1', false, 'luck'),
      s('l2', false, 'luck'),
      s('l3', false, 'judgment'),
    ]);
    expect(r.state).toBe('measured');
    if (r.state === 'measured') {
      expect(r.success_judgment_ratio).toBe(1);
      expect(r.failure_judgment_ratio).toBeCloseTo(1 / 3, 4);
      expect(r.asymmetry).toBeGreaterThan(0);
      expect(r.subject_sentence).toContain('정산 기록의 귀속 분포');
      expect(r.statement).toContain('당신이 해석합니다');
      // 성향 어휘 금지
      expect(r.statement).not.toMatch(/경향|성향|편향이 있습니다/);
    }
  });

  it("'both'·'unclear' 는 분모에 들되 분자에는 안 든다", () => {
    const r = measureM5([
      s('w1', true, 'both'),
      s('w2', true, 'unclear'),
      s('w3', true, 'judgment'),
      s('l1', false, 'luck'),
      s('l2', false, 'luck'),
      s('l3', false, 'luck'),
    ]);
    if (r.state === 'measured') expect(r.success_judgment_ratio).toBeCloseTo(1 / 3, 4);
  });

  it('귀속이 없는 정산은 제외된다 — 기본값을 끼워넣지 않는다', () => {
    const f: CognitiveFrame = {
      ...emptyFrame({ id: 'f1', userId: 'u', title: '', now: T0 }),
      status: 'settled',
      settlement: { falsifier_observed: false, observed: 'x', evidence_ref: 'r', observed_at: iso(1), retrospective: '' },
    };
    expect(attributedSettlements([f], new Map())).toHaveLength(0);
  });

  it('사전등록과 사후 귀속이 갈리면 그 사실이 남는다 (어느 쪽이 옳다고 말하지 않는다)', () => {
    const drift = attributionDrift(
      [s('f1', false, 'luck')],
      [{ frame_id: 'f1', if_right: 'judgment', if_wrong: 'judgment', registered_at: iso(0) }],
    );
    expect(drift).toHaveLength(1);
    expect(drift[0].drifted).toBe(true);
    expect(drift[0].preregistered).toBe('judgment');
    expect(drift[0].actual).toBe('luck');
  });
});

describe('세계 궤적 — 되돌아 건널 수 있다 (Neo)', () => {
  const crossing = (ref: string, h: number): Crossing => ({
    kind: 'signal_reading',
    evidence_ref: ref,
    observed_at: iso(h),
    observed: `${ref} 관찰`,
  });

  it('철회된 증거는 세계 판정에서 빠지지만 행은 남는다', () => {
    const c = retractCrossing(crossing('r1', 1), iso(5), '지표를 잘못 읽었다');
    expect(c.retracted_at).toBe(iso(5));
    expect(c.retraction_reason).toContain('잘못');
    expect(worldTrajectory([c]).map((t) => t.to)).toEqual(['reality_contact', 'in_frame']);
  });

  it('사유 없는 철회는 철회가 아니다 — 불편한 관측을 조용히 지울 수 없다', () => {
    const c = retractCrossing(crossing('r2', 1), iso(5), '   ');
    expect(c.retracted_at).toBeUndefined();
  });

  it('증거 둘 중 하나만 철회되면 여전히 현실에 닿아 있다', () => {
    const a = crossing('r3', 1);
    const b = retractCrossing(crossing('r4', 2), iso(6), '오독');
    const traj = worldTrajectory([a, b]);
    expect(traj[traj.length - 1].to).toBe('reality_contact');
  });

  it('궤적은 세계가 바뀐 지점만 남긴다 (같은 세계 반복은 기록하지 않는다)', () => {
    const traj = worldTrajectory([crossing('r5', 1), crossing('r6', 2), crossing('r7', 3)]);
    expect(traj).toHaveLength(1);
    expect(traj[0].to).toBe('reality_contact');
  });

  it('철회 사건에는 사유가 detail 로 실린다', () => {
    const c = retractCrossing(crossing('r8', 1), iso(4), '신호가 이 전제의 증거가 아니었다');
    const t = worldTrajectory([c]).find((x) => x.cause === 'retraction');
    expect(t?.detail).toContain('신호가 이 전제의 증거가 아니었다');
  });
});
