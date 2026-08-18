import { describe, it, expect } from 'vitest';
import {
  SLACK_RATIO, DECISION_SIGMA, MIN_READINGS,
  watchAnswerBlocks, deriveCusumPrior, deriveMaterialityRule, cusumSeries,
  evaluateMateriality,
  type WatchAnswers,
} from '../numeric-drift.js';

/**
 * 감시 4문답 — 사람의 답 하나에서 세 표현이 **모순 없이** 나오는가.
 *
 * 이 파일이 지키는 것은 두 가지다.
 *
 * 1. **만들면 안 되는 감시는 만들지 않는다.** 깨진 값이 평소 출렁임 안에
 *    있으면 그 임계는 소음과 구별되지 않는다 — 그걸 만들어 주면 사용자는
 *    "지켜보는 중"이라 믿고 실제로는 아무것도 안 지켜진다.
 * 2. **임계는 하나다.** `broken` 이 단일 정본이고 문장·CUSUM 사전믿음·
 *    스냅샷 규칙이 전부 거기서 유도된다. 셋이 서로 다른 답을 내면 같은
 *    전제가 판정마다 다른 임계를 쓰게 된다.
 */
const good = (): WatchAnswers => ({
  what: '전환율', where: '대시보드 A', normal: 3, wobble: 0.2, broken: 2,
  why: '2% 밑이면 광고비가 안 빠집니다', unit: '%',
});

describe('거절 — 지켜지는 척하는 감시를 만들지 않는다', () => {
  it('멀쩡한 답에는 막는 것이 없다', () => {
    expect(watchAnswerBlocks(good())).toEqual([]);
  });

  it('깨진 값이 평소 출렁임 안에 있으면 거절한다', () => {
    const w = { ...good(), normal: 3, wobble: 1, broken: 2.5 };
    expect(watchAnswerBlocks(w).join(' ')).toContain('평소 출렁임 안에');
    expect(deriveCusumPrior(w)).toBeNull();
    expect(deriveMaterialityRule(w)).toBeNull();
  });

  it('평소 값과 깨진 값이 같으면 거절한다', () => {
    expect(watchAnswerBlocks({ ...good(), broken: 3 }).join(' ')).toContain('언제 깨진 건지');
  });

  it('출렁임이 0 이하면 거절한다 — 전혀 안 움직이는 숫자는 없다', () => {
    expect(watchAnswerBlocks({ ...good(), wobble: 0 }).join(' ')).toContain('0보다 커야');
  });

  it('근거 없는 임계는 거절한다 — 나중에 검토할 수 없다', () => {
    expect(deriveCusumPrior({ ...good(), why: '   ' })).toBeNull();
  });

  it('막는 이유를 한 번에 다 준다 — 하나씩 튕기지 않는다', () => {
    const blocks = watchAnswerBlocks({ what: '', where: '', normal: NaN, wobble: NaN, broken: NaN, why: '' });
    expect(blocks.length).toBeGreaterThan(4);
  });
});

describe('유도 — 하나의 답에서 셋이 모순 없이 나온다', () => {
  it('CUSUM 사전믿음이 관례대로 유도되고, 관례를 근거 문장에 남긴다', () => {
    const p = deriveCusumPrior(good())!;
    expect(p.target).toBe(3);
    expect(p.slack).toBeCloseTo(Math.abs(3 - 2) * SLACK_RATIO);
    expect(p.decisionInterval).toBeCloseTo(0.2 * DECISION_SIGMA);
    expect(p.rationale).toContain('광고비');
    expect(p.rationale).toContain('이 데이터에서 나온 값이 아님');
  });

  it('스냅샷 규칙의 선이 CUSUM 이 겨냥하는 값과 같다 (단일 정본)', () => {
    const w = good();
    const rule = deriveMaterialityRule(w)!;
    expect(rule.type).toBe('threshold');
    expect(rule.params['line']).toBe(w.broken);
    // 계열 쪽이 겨냥하는 이동폭도 같은 두 값에서 나온다.
    expect(deriveCusumPrior(w)!.slack).toBeCloseTo(Math.abs(w.normal - w.broken) * SLACK_RATIO);
  });

  it('선에 정확히 닿아도 침묵하지 않는다 — 그리고 그 결과는 경계 선언이 낸 것이다', () => {
    const w = good();
    const rule = deriveMaterialityRule(w)!;
    expect(rule.modifiers?.boundary).toBe('inclusive');
    // 3% → 2% 는 선에 정확히 닿는 이동. inclusive 라 material 이어야 한다.
    expect(evaluateMateriality(w.normal, w.broken, rule).status).toBe('material');
    // 그 material 이 정말 boundary 에서 나왔는지 — 선언만 바꾸면 답이 바뀌어야
    // 한다. 안 바뀌면 boundary 는 저장만 되는 장식이고, 선에 닿는 값의 운명은
    // 우리가 선언한 적 없는 다른 무언가가 정하고 있는 것이다.
    const exclusive = { ...rule, modifiers: { ...rule.modifiers, boundary: 'exclusive' as const } };
    expect(evaluateMateriality(w.normal, w.broken, exclusive).status).not.toBe('material');
  });

  it('깨지는 방향은 사용자의 두 숫자에서 나온다 — 반대편 이동에는 선을 긋지 않는다', () => {
    const down = deriveMaterialityRule(good())!; // 평소 3 → 깨짐 2: 아래로 깨진다
    expect(down.params['direction']).toBe('below');
    const up = deriveMaterialityRule({ ...good(), normal: 2, broken: 3 })!;
    expect(up.params['direction']).toBe('above');
    // 아래로 깨지는 전제에서 위로 튀는 것은 이 규칙이 말한 적 없는 사건이다.
    // (누적 이탈은 계열 쪽이 양방향으로 본다 — 규칙을 지어내지 않는다.)
    expect(evaluateMateriality(3, 8, down).status).not.toBe('material');
  });

  it('선을 안 넘으면 스냅샷 판정은 조용하다', () => {
    const w = good();
    expect(evaluateMateriality(w.normal, 2.6, deriveMaterialityRule(w)!).status).not.toBe('material');
  });
});

describe('계열 — 스냅샷이 못 보는 누적 누수를 본다', () => {
  const prior = () => deriveCusumPrior(good())!;

  it(`판독 ${MIN_READINGS}건 미만이면 판정하지 않는다 — "괜찮다"가 아니다`, () => {
    const r = cusumSeries([3, 2.9], prior());
    expect(r.status).toBe('insufficient');
    expect(r.statement).toContain('아직 모른다');
    expect(r.sample).toBe(2);
  });

  it('평소 근처에 머물면 holds', () => {
    expect(cusumSeries([3, 3.05, 2.95, 3.02, 2.98], prior()).status).toBe('holds');
  });

  it('한 걸음도 선을 안 넘는데 같은 방향으로 계속 새면 경보 — 스냅샷은 못 보는 것', () => {
    // 2.4·2.35·2.3… 은 어느 한 걸음도 broken(2)에 닿지 않는다. 스냅샷 판정은
    // 매번 정직하게 "미교차"라 답하고, 그래서 영원히 조용하다.
    const drift = [2.4, 2.35, 2.3, 2.25, 2.2, 2.15];
    for (const v of drift) {
      expect(evaluateMateriality(3, v, deriveMaterialityRule(good())!).status).not.toBe('material');
    }
    const r = cusumSeries(drift, prior());
    expect(r.status).toBe('alert');
    // 5번째에서 성립한다는 것이 요점이다 — 한 판독이 튄 게 아니라 다섯 번
    // 같은 쪽으로 샌 것이 결정 구간(0.8)을 넘겼다. 이 숫자가 1이 되면 계열이
    // 아니라 그냥 예민한 스냅샷을 만든 것이다.
    expect(r.alert_at_index).toBe(5);
    expect(r.statistic).toBeGreaterThan(prior().decisionInterval);
    expect(r.statement).toContain('누적합');
  });

  it('평소 언저리의 흔들림은 아무리 길어도 경보가 아니다 — 계열이 예민한 게 아니다', () => {
    // 같은 길이·같은 방향 편향 없이 흔들리기만 하면 누적합이 안 쌓인다.
    const noise = [3.05, 2.95, 3.1, 2.9, 3.0, 2.98, 3.03, 2.97];
    const r = cusumSeries(noise, prior());
    expect(r.status).toBe('holds');
    expect(r.alert_at_index).toBe(-1);
  });

  it('같은 계열은 같은 판정을 낸다 (결정론)', () => {
    const vs = [2.6, 2.4, 2.2, 2.0];
    expect(JSON.stringify(cusumSeries(vs, prior()))).toBe(JSON.stringify(cusumSeries(vs, prior())));
  });

  it('숫자가 아닌 값은 계열에서 빠진다 — 0으로 메우지 않는다', () => {
    expect(cusumSeries([3, Number.NaN, 3.1, 2.9] as number[], prior()).sample).toBe(3);
  });
});

describe('임계는 하나다 — 세 표현이 어떤 답에서도 갈라지지 않는다', () => {
  /**
   * 위 케이스들은 하나의 예("전환율 3%, 2%면 깨짐")를 본다. 여기서는 같은
   * 주장을 답의 **범위 전체**에 건다: 사용자가 무슨 숫자를 대든 (a) 만들 수
   * 없는 감시는 어느 표현도 만들어지지 않고 (b) 만들 수 있는 감시에서는
   * 스냅샷 선과 계열이 겨냥하는 이동폭이 같은 두 숫자에서 나온다.
   *
   * 이 파일이 원래 여기서 `src/lib/cognition/watch.ts` 의 상수를 읽어 대조했다.
   * 그 원본은 아직 병합되지 않은 앱 존 브랜치에만 있어서, 이 브랜치에서는
   * 검사가 조용히 건너뛰고 초록으로 지나갔다 — 아무것도 안 지키면서 지키는
   * 척하는 테스트다. 게다가 §6 결정 ③이 그 원본을 은퇴시키기로 했으므로
   * 파일-대조 핀은 은퇴할 파일을 두 번째 권위로 만든다. 그래서 대조 대상을
   * 파일에서 **주장**으로 바꿨다 — 이건 어느 브랜치에서도 실제로 돈다.
   */
  const triples: Array<[number, number, number]> = [
    [3, 0.2, 2], [3, 0.2, 4], [100, 5, 70], [100, 5, 130],
    [0.5, 0.01, 0.4], [-2, 0.3, -5], [0, 0.1, -1], [1e6, 1e4, 9e5],
    [3, 1, 2.5], [3, 1, 3], [3, 0, 2], [50, 10, 45], // 뒤 넷은 막혀야 하는 답
  ];

  it.each(triples)('normal=%s wobble=%s broken=%s 에서 셋이 같은 임계를 쓴다', (normal, wobble, broken) => {
    const w: WatchAnswers = { what: 'x', where: 'y', normal, wobble, broken, why: '근거' };
    const blocked = watchAnswerBlocks(w).length > 0;
    const rule = deriveMaterialityRule(w);
    const p = deriveCusumPrior(w);

    if (blocked) {
      // 반쯤 맞는 감시를 만들지 않는다 — 하나가 막히면 셋 다 안 만들어진다.
      expect(rule, '막힌 답에서 스냅샷 규칙이 만들어졌다').toBeNull();
      expect(p, '막힌 답에서 계열 사전믿음이 만들어졌다').toBeNull();
      return;
    }
    expect(rule).not.toBeNull();
    expect(p).not.toBeNull();

    // (1) 선은 사용자가 말한 깨진 값 그 자체다 — 어림하지 않는다.
    expect(rule!.params['line']).toBe(broken);
    // (2) 계열이 겨냥하는 이동폭도 같은 두 숫자에서 나온다.
    expect(p!.slack).toBeCloseTo(Math.abs(normal - broken) * SLACK_RATIO, 6);
    expect(p!.target).toBe(normal);
    // (3) 깨진 값에 정확히 닿는 이동은 언제나 material 이다.
    expect(evaluateMateriality(normal, broken, rule!).status).toBe('material');
    // (4) 평소와 깨짐 사이의 값은 아직 아니다 — 선을 미리 당기지 않는다.
    const between = (normal + broken) / 2;
    expect(evaluateMateriality(normal, between, rule!).status).not.toBe('material');
  });

  it('관례 상수는 근거 문장에 출처와 함께 드러난다 — 숨은 기본값이 아니다', () => {
    const r = deriveCusumPrior(good())!.rationale;
    expect(r).toContain(String(SLACK_RATIO));
    expect(r).toContain(String(DECISION_SIGMA));
    expect(r).toContain('이 데이터에서 나온 값이 아님');
  });
});
