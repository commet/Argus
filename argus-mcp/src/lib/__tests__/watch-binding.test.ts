import { describe, it, expect } from 'vitest';
import {
  SLACK_RATIO, DECISION_SIGMA, MIN_BASELINE_READINGS, MR_ROBUST, MR_D2,
  watchAnswerBlocks, estimateBaseline, deriveMaterialityRule, cusumSeries, watchStatement,
  evaluateMateriality,
  type WatchAnswers,
} from '../numeric-drift.js';

/**
 * 감시 문답 — 사람에게 답할 수 있는 것만 묻고, 나머지는 판독에서 얻는가.
 *
 * 이 파일이 지키는 것 셋.
 *
 * 1. **답할 수 없는 것을 묻지 않는다.** 첫 판은 "평소 출렁임(σ)"을 물었다.
 *    실데이터에서 사용자 작성 텍스트 321건 중 변동성을 언급한 것은 1건,
 *    기록된 전제 579개 중 출렁임 수치를 가진 것은 0개였다. 답할 수 없는 것을
 *    물으면 사용자가 지어내거나 모델이 대신 메운다.
 * 2. **깨지는 값은 반드시 사람이 정한다.** 그건 데이터에서 도출되지 않는 가치
 *    판단이고, 도구가 대신 정하면 숨은 기본값이 판단을 대체한다.
 * 3. **모르면 모른다고 한다.** 기준선을 추정할 수 없으면 "괜찮다"가 아니라
 *    "아직 모른다"이고, 선이 잡음 안에 있으면 그 사실을 말한다.
 */
const good = (): WatchAnswers => ({
  what: '2주차 재방문율', where: '대시보드 A', broken: 25,
  why: '25% 밑이면 다음 달 예산 두 배 계획이 성립하지 않습니다', unit: '%',
});

describe('묻는 것 — 사람이 아는 넷', () => {
  it('멀쩡한 답에는 막는 것이 없다', () => {
    expect(watchAnswerBlocks(good())).toEqual([]);
  });

  it('볼 곳이 없으면 거절한다 — 읽을 수 없는 감시는 허구다', () => {
    expect(watchAnswerBlocks({ ...good(), where: '  ' }).join(' ')).toContain('어디서 보는지');
  });

  it('깨지는 값이 숫자가 아니면 거절한다', () => {
    expect(watchAnswerBlocks({ ...good(), broken: Number.NaN }).join(' ')).toContain('숫자로');
  });

  it('근거 없는 임계는 거절한다 — 나중에 검토할 수 없다', () => {
    expect(watchAnswerBlocks({ ...good(), why: '   ' }).join(' ')).toContain('왜 그 값이면');
  });

  it('막는 이유를 한 번에 다 준다 — 하나씩 튕기지 않는다', () => {
    const blocks = watchAnswerBlocks({ what: '', where: '', broken: Number.NaN, why: '' });
    expect(blocks).toHaveLength(4);
  });

  it('평소 값·출렁임은 묻지 않는다 — 실사용자가 낸 적 없는 값이다', () => {
    // 타입에 그 칸이 없다는 것이 이 규율의 기계적 형태다. 칸이 생기면 누군가
    // 채우고, 채울 수 없는 사람은 지어낸다.
    const keys = Object.keys(good());
    expect(keys).not.toContain('normal');
    expect(keys).not.toContain('wobble');
    // 넷을 답하는 것만으로 감시가 만들어져야 한다 (실측에서 가장 좋았던 실제
    // 전제가 가진 것이 what 과 broken 이었다).
    expect(watchAnswerBlocks(good())).toEqual([]);
  });
});

describe('기준선 — 자기보고가 아니라 판독에서 나온다', () => {
  const eight = [100, 104, 97, 103, 96, 105, 95, 102];

  it(`판독 ${MIN_BASELINE_READINGS}건 미만이면 기준선을 만들지 않는다`, () => {
    expect(estimateBaseline(eight.slice(0, MIN_BASELINE_READINGS - 1))).toBeNull();
    expect(estimateBaseline(eight)).not.toBeNull();
  });

  it('중앙값과 이동범위 중앙값으로 추정한다 — 평균·전체표준편차가 아니다', () => {
    const b = estimateBaseline(eight)!;
    // 중앙값: 정렬 [95,96,97,100,102,103,104,105] → (100+102)/2
    expect(b.center).toBe(101);
    const mr: number[] = [];
    for (let i = 1; i < eight.length; i += 1) mr.push(Math.abs(eight[i]! - eight[i - 1]!));
    const sorted = [...mr].sort((a, b2) => a - b2);
    const mid = Math.floor(sorted.length / 2);
    const medMR = sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
    expect(b.sigma).toBeCloseTo(MR_ROBUST * medMR, 6);
    expect(b.sample).toBe(8);
  });

  it('이상치 하나가 기준선을 끌고 가지 않는다 — 스스로를 숨기지 못하게', () => {
    const clean = [100, 101, 99, 100, 100, 100, 101, 99];
    const withSpike = [100, 101, 99, 100, 5000, 100, 101, 99];
    const a = estimateBaseline(clean)!;
    const b = estimateBaseline(withSpike)!;
    expect(b.center).toBeCloseTo(a.center, 0);

    // 왜 이게 중요한가: 출렁임 추정이 이상치에 부풀면 **그 이상치가 스스로를
    // 숨기고**(SPC 의 masking), 뒤이어 오는 진짜 표류까지 안 보이게 된다.
    // 견고 추정자도 이상치를 완전히 무시하지는 않는다 — 이동범위 둘이 바뀌니
    // 중앙값이 한 칸 움직인다. 주장은 "안 변한다"가 아니라 "**갇힌다**"이다.
    expect(b.sigma / a.sigma, '견고 추정자에서 σ 부풀림은 갇혀 있어야 한다').toBeLessThan(3);

    // 대조군: 평균 이동범위를 썼다면 얼마였는지. 이 줄이 선택의 근거다.
    const mrMean = (xs: number[]) => {
      let sum = 0;
      for (let i = 1; i < xs.length; i += 1) sum += Math.abs(xs[i]! - xs[i - 1]!);
      return (sum / (xs.length - 1)) / MR_D2;
    };
    expect(mrMean(withSpike) / mrMean(clean), '평균이었다면 σ 가 수백 배로 뛴다').toBeGreaterThan(100);
  });

  it('절반 이상이 붙어 있어 중앙 이동범위가 0이면 평균으로 물러난다', () => {
    // 견고 추정자만 쓰면 여기서 σ=0 이 되어 기준선이 통째로 사라진다.
    const flatThenMove = [100, 100, 100, 100, 100, 105, 110, 115];
    expect(estimateBaseline(flatThenMove)?.sigma).toBeGreaterThan(0);
  });

  it('전혀 안 움직이는 계열에는 기준선이 없다 — 0으로 나누지 않는다', () => {
    expect(estimateBaseline([7, 7, 7, 7, 7, 7, 7, 7])).toBeNull();
  });

  it('숫자가 아닌 값은 빠진다 — 0으로 메우지 않는다', () => {
    expect(estimateBaseline([100, Number.NaN, 104, 97] as number[])).toBeNull(); // 3건뿐
  });
});

describe('스냅샷 규칙 — 사용자가 정한 선 하나', () => {
  it('선은 사용자가 말한 값 그 자체다', () => {
    expect(deriveMaterialityRule(good(), 40)!.params['line']).toBe(25);
  });

  it('깨지는 방향은 지금 어디에 있는지에서 나온다 — 묻지 않고 읽는다', () => {
    expect(deriveMaterialityRule(good(), 40)!.params['direction']).toBe('below');
    expect(deriveMaterialityRule({ ...good(), broken: 25 }, 10)!.params['direction']).toBe('above');
  });

  it('선 위에 서 있으면 방향을 정할 수 없다 — 지어내지 않는다', () => {
    expect(deriveMaterialityRule(good(), 25)).toBeNull();
    expect(deriveMaterialityRule(good(), Number.NaN)).toBeNull();
  });

  it('막힌 답에서는 규칙도 만들어지지 않는다', () => {
    expect(deriveMaterialityRule({ ...good(), why: '' }, 40)).toBeNull();
  });

  it('선에 정확히 닿아도 침묵하지 않는다 — 그리고 그건 경계 선언이 낸 결과다', () => {
    const rule = deriveMaterialityRule(good(), 40)!;
    expect(rule.modifiers?.boundary).toBe('inclusive');
    expect(evaluateMateriality(40, 25, rule).status).toBe('material');
    // 선언만 바꾸면 답이 바뀌어야 한다. 안 바뀌면 boundary 는 저장만 되는
    // 장식이고, 선에 닿는 값의 운명은 선언한 적 없는 무언가가 정하고 있다.
    const exclusive = { ...rule, modifiers: { ...rule.modifiers, boundary: 'exclusive' as const } };
    expect(evaluateMateriality(40, 25, exclusive).status).not.toBe('material');
  });

  it('선을 안 넘으면 조용하다', () => {
    expect(evaluateMateriality(40, 30, deriveMaterialityRule(good(), 40)!).status).not.toBe('material');
  });
});

/**
 * 하나의 잘 고른 계열은 아무것도 증명하지 않는다.
 *
 * 이 파일의 첫 판에는 표류 계열 하나가 계열 판정의 유일한 증거였고, 그 값들은
 * **통과하도록 고른 값**이었다. 실제 규모의 시나리오를 걸어보니 유도가 틀려
 * 있었다: k 를 `|평소−깨짐|/2` 로 둔 탓에 임계가 멀면 k 가 5σ 로 커져,
 * **100→76 으로 무너지는 계열의 누적합 최고가 0** 이었다. 임계로 달려가는
 * 붕괴에 침묵하면서 한 번 튀고 마는 이상치에는 울렸다.
 *
 * 그래서 증거를 표로 바꾼다. 각 줄은 "무엇이 일어났나 → 도구는 무슨 말을 해야
 * 하나"이고, 기대값은 코드가 내는 답이 아니라 **원리**에서 온다. 새 줄을 넣을
 * 때도 기대를 먼저 적고 나서 돌린다.
 */
describe('현실 규모 시나리오 — 판정이 실제로 옳은가', () => {
  type Row = [name: string, broken: number, values: number[], want: string, why: string];
  const w = (broken: number): WatchAnswers => ({ ...good(), what: '주간 활성 사용자', unit: '', broken });

  const rows: Row[] = [
    ['건강하게 성장하는 지표', 50, [100, 104, 108, 112, 117, 122, 127, 133], 'holds',
      '사용자가 깨진다고 말한 쪽의 반대로 갔다. 좋은 소식을 알림으로 만드는 것이 과발화다'],
    ['임계로 향하는 붕괴', 50, [100, 96, 92, 88, 84, 80, 76, 72], 'alert',
      '아직 선(50)에 안 닿았지만 같은 쪽으로 계속 샜다. 이 표가 존재하는 이유인 결함'],
    ['순수 잡음', 50, [100, 104, 97, 103, 96, 105, 95, 102], 'holds',
      '교차하는 잡음은 누적되지 않는다'],
    ['일회성 이상치 하나 (즉시 회복)', 50, [100, 101, 40, 99, 100, 101, 100, 99], 'holds',
      '한 번 튄 것은 지속 이동이 아니다. 큰 한 방은 사용자가 정한 선이 잡는 몫이고, 두 번 말하면 과발화다'],
    ['깊은 저점 후 완전 회복', 50, [100, 95, 88, 82, 80, 85, 92, 100], 'holds',
      '판정은 지금 상태다. 끝나고 돌아온 일을 계속 경보로 부르지 않는다 (넘었던 사실은 문장에 남는다)'],
    ['큰 단위 지표 (원)', 1_500_000, [3_000_000, 2_900_000, 2_800_000, 2_700_000, 2_600_000, 2_500_000, 2_400_000, 2_300_000], 'alert',
      '규모가 달라져도 σ 단위로 재므로 같게 동작해야 한다'],
    ['선이 잡음 안에 있는 감시', 99, [100, 104, 97, 103, 96, 105, 95, 102], 'indistinguishable',
      '평소 언저리를 깨짐이라 부르면 흔들린 것과 깨진 것이 구별되지 않는다. 지켜지는 척하지 않는다'],
  ];

  it.each(rows)('%s → %#', (_name, broken, values, want, why) => {
    expect(cusumSeries(values, w(broken)).status, why).toBe(want);
  });

  it('한 번 튀고 마는 이상치는 계열이 아니라 선이 잡는다 — 분업이 실제로 성립한다', () => {
    const spike = [100, 101, 40, 99, 100, 101, 100, 99];
    // 계열: 지속 이동이 아니므로 조용하다.
    expect(cusumSeries(spike, w(50)).status).toBe('holds');
    // 선: 40 은 사용자가 깨진다고 말한 50 을 넘었다. 여기서 침묵하면 아무도
    // 그 사건을 말하지 않게 되고, 위 'holds' 는 "괜찮다"라는 거짓말이 된다.
    expect(evaluateMateriality(100, 40, deriveMaterialityRule(w(50), 100)!).status).toBe('material');
  });

  it('판독이 모자라면 "아직 모른다"이고, 선은 그동안에도 답한다', () => {
    const r = cusumSeries([100, 96, 92], w(50));
    expect(r.status).toBe('insufficient');
    expect(r.statement).toContain('아직 모른다');
    expect(r.statement).toContain('50');  // 그동안 무엇이 답하는지 알려준다
    expect(r.sample).toBe(3);
  });

  it('감시하지 않는 절반을 판정 문장이 밝힌다 — 조용히 반만 보지 않는다', () => {
    // 깨짐 값을 하나만 받으므로 반대쪽은 구조적으로 안 본다. 숨기면 사용자는
    // 양쪽이 지켜진다고 믿는다.
    const r = cusumSeries([100, 104, 97, 103, 96, 105, 95, 102], w(50));
    expect(r.statement).toContain('50 쪽으로 새는 것만');
  });

  it('판정의 근거 숫자를 함께 돌려준다 — 숨은 숫자로 판정하지 않는다', () => {
    const r = cusumSeries([100, 96, 92, 88, 84, 80, 76, 72], w(50));
    expect(r.baseline?.sample).toBe(8);
    expect(r.statement).toContain(String(r.baseline!.center));
  });

  it('같은 계열은 같은 판정을 낸다 (결정론)', () => {
    const vs = [100, 96, 92, 88, 84, 80, 76, 72];
    expect(JSON.stringify(cusumSeries(vs, w(50)))).toBe(JSON.stringify(cusumSeries(vs, w(50))));
  });
});

describe('사람에게 돌려주는 문장', () => {
  it('네 답이 그대로 보이고, 지어낸 숫자가 없다', () => {
    const t = watchStatement(good())!;
    expect(t).toContain('2주차 재방문율');
    expect(t).toContain('대시보드 A');
    expect(t).toContain('25%');
    expect(t).toContain('예산 두 배');
  });

  it('자주 우는 쪽을 밝힌다 — 조용한 쪽만 설명하지 않는다', () => {
    // 근거를 길게 설명하는 것은 계열의 관례 상수인데, 사용자가 실제로 받는
    // 알림은 선 쪽이 두 자릿수 배 더 낸다. 그걸 안 밝히면 사용자는 자기가
    // 받는 알림의 출처를 틀리게 안다.
    expect(watchStatement(good())!).toContain('판독 한 건이 닿기만 해도');
  });

  it('계열 판정이 언제부터 도는지 밝힌다', () => {
    expect(watchStatement(good())!).toContain(String(MIN_BASELINE_READINGS));
  });

  it('막힌 답에는 문장도 없다 — 반쯤 만든 감시를 설명하지 않는다', () => {
    expect(watchStatement({ ...good(), where: '' })).toBeNull();
  });
});

describe('관례 상수는 숨은 기본값이 아니다', () => {
  it('k 는 σ 에 걸린다 — 임계까지의 거리가 아니라', () => {
    // 이 한 줄이 첫 판의 결함을 다시 못 들어오게 한다. 임계를 아무리 멀리
    // 옮겨도 같은 계열은 같은 판정을 내야 한다: k 가 임계 거리에 걸리면
    // 먼 임계에서 계열이 귀머거리가 된다.
    const collapse = [100, 96, 92, 88, 84, 80, 76, 72];
    const near = cusumSeries(collapse, { ...good(), what: 'x', unit: '', broken: 70 });
    const far = cusumSeries(collapse, { ...good(), what: 'x', unit: '', broken: 10 });
    expect(near.status).toBe('alert');
    expect(far.status, '임계가 멀다고 계열이 귀머거리가 되면 안 된다').toBe('alert');
    expect(far.statistic).toBe(near.statistic);
  });

  it('관례임을 판정 문장이 밝힌다 (0.5σ · 4σ)', () => {
    expect(SLACK_RATIO).toBe(0.5);
    expect(DECISION_SIGMA).toBe(4);
    const series = [100, 104, 97, 103, 96, 105, 95, 102];
    const b = estimateBaseline(series)!;
    const r = cusumSeries(series, { ...good(), what: 'x', unit: '', broken: 50 });
    // 결정 구간이 σ 의 DECISION_SIGMA 배라는 것이 문장에 그대로 있다.
    expect(r.statement).toContain(String(Math.round(b.sigma * DECISION_SIGMA * 1e4) / 1e4));
  });
});
