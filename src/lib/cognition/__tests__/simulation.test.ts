import { describe, it, expect } from 'vitest';
import { runSimulation } from '../simulate';
import { ECHO_THRESHOLD, echoOverlap, evaluateRestatement, acceptAsIs } from '../comprehension';
import { revisionDistance, elementAuthorship, isUneditedMachineText } from '../authorship';
import { deriveWorld, readingToCrossing, worldBalance } from '../world';
import { addElement, emptyFrame, makeElement, sealBlocks, sealFrame, settleFrame } from '../frame';
import { calibration, MIN_SAMPLE } from '../calibration';
import { corpusMirror, frameMirror } from '../mirror';
import { AXES, REQUIRED_AXES, axisSpec } from '../axes';
import type { CognitiveFrame } from '../types';

/** 결정론 기준 시각 — 엔진이 `Date.now()` 를 부르지 않으므로 테스트가 시각을 소유한다. */
const T0 = Date.parse('2026-08-17T00:00:00Z');

describe('인지 프레임 시뮬레이션 — 불변식이 실제로 서 있는가', () => {
  it('합성 에피소드 200개에서 불변식 위반이 0이다', () => {
    const report = runSimulation({ seed: 20260817, episodes: 200, baseTime: T0 });
    // 위반이 있으면 무엇이 깨졌는지 그대로 보여준다 — 숫자만 실패하면 원인을 못 찾는다.
    expect(report.violations, JSON.stringify(report.violations.slice(0, 8), null, 2)).toEqual([]);
  });

  it('같은 시드는 같은 결과를 낸다 (재현성)', () => {
    const a = runSimulation({ seed: 42, episodes: 60, baseTime: T0 });
    const b = runSimulation({ seed: 42, episodes: 60, baseTime: T0 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('다섯 시나리오를 전부 밟는다 — 안 밟은 경로는 검증되지 않은 경로다', () => {
    const r = runSimulation({ seed: 7, episodes: 50, baseTime: T0 });
    for (const s of ['full_user', 'ai_unrestated', 'ai_accepted', 'authority_break', 'bound_premise']) {
      expect(r.scenario_counts[s] ?? 0, `시나리오 ${s} 가 한 번도 생성되지 않았다`).toBeGreaterThan(0);
    }
  });

  it('봉인이 막히기도 하고 통과하기도 한다 — 전부 거부하는 엔진은 만점을 받으면 안 된다', () => {
    const r = runSimulation({ seed: 99, episodes: 100, baseTime: T0 });
    expect(r.sealed).toBeGreaterThan(0);
    expect(r.blocked).toBeGreaterThan(0);
  });

  it('이해 게이트와 권한 위반 사유가 실제로 발생한다', () => {
    const r = runSimulation({ seed: 1234, episodes: 100, baseTime: T0 });
    expect(r.block_kinds.comprehension_pending ?? 0).toBeGreaterThan(0);
    expect(r.block_kinds.authority_violation ?? 0).toBeGreaterThan(0);
  });
});

describe('축 레지스트리 — 문헌 등급이 코드에 박혀 있다', () => {
  it('일곱 축이고 각 축에 문헌 계보가 적혀 있다', () => {
    expect(AXES).toHaveLength(7);
    for (const a of AXES) {
      expect(a.lineage.length, `${a.id} 에 계보가 없다`).toBeGreaterThan(20);
    }
  });

  it('프레임과 값은 human_only 다 — 기계가 쓸 수 없는 축', () => {
    expect(axisSpec('frame').authority).toBe('human_only');
    expect(axisSpec('values').authority).toBe('human_only');
  });

  it('추론은 machine_recordable 이다 — 기록하되 채점하지 않는다 (Nisbett-Wilson)', () => {
    expect(axisSpec('inference').authority).toBe('machine_recordable');
  });

  it('필수 축에 프레임·값·전제·반증이 들어 있다', () => {
    expect(REQUIRED_AXES).toContain('frame');
    expect(REQUIRED_AXES).toContain('values');
    expect(REQUIRED_AXES).toContain('premises');
    expect(REQUIRED_AXES).toContain('falsifier');
  });
});

describe('저자성 — 깊이가 범주와 별개로 기록된다', () => {
  it('글자까지 같으면 거리 0, 완전히 다르면 1에 가깝다', () => {
    expect(revisionDistance('같은 문장', '같은 문장')).toBe(0);
    expect(revisionDistance('', '사람이 처음부터 쓴 문장')).toBe(1);
    expect(revisionDistance('AI 초안 문장', '완전히 다른 사람 문장')).toBeGreaterThan(0.5);
  });

  it('AI 초안을 그대로 확정하면 기계 문장이고 편집 거리 0이다', () => {
    const a = elementAuthorship({ text: 'AI가 쓴 문장', aiDraft: 'AI가 쓴 문장', touched: true, now: T0 });
    expect(a.wording_source).toBe('ai_surfaced');
    expect(a.revision_distance).toBe(0);
    expect(isUneditedMachineText(a)).toBe(true);
  });

  it('고쳐 쓰면 사람 문장이고 거리가 0보다 크다', () => {
    const a = elementAuthorship({ text: '내가 고친 문장이다', aiDraft: 'AI가 쓴 문장', touched: true, now: T0 });
    expect(a.wording_source).toBe('user_reworded');
    expect(a.revision_distance).toBeGreaterThan(0);
    expect(isUneditedMachineText(a)).toBe(false);
  });
});

describe('이해 게이트 — 어휘는 넘어가고 이해는 안 넘어가는 실패를 막는다', () => {
  const aiText = '대조쌍을 정산 시점에 맞춘다';
  const machine = elementAuthorship({ text: aiText, aiDraft: aiText, touched: false, now: T0 });

  it('원문 어휘를 되풀이하면 echo 다', () => {
    const c = evaluateRestatement({ axis: 'premises', authorship: machine, sourceText: aiText, restatement: '대조쌍을 정산 시점에 맞추는 것' });
    expect(c.state).toBe('echo');
    expect(c.overlap).toBeGreaterThanOrEqual(ECHO_THRESHOLD);
  });

  it('자기 어휘로 다시 쓰면 own_words 다', () => {
    const c = evaluateRestatement({
      axis: 'premises',
      authorship: machine,
      sourceText: aiText,
      restatement: '예전 결과를 알고 있는 사례로 미리 답을 가려놓고 물어본다는 뜻',
    });
    expect(c.state).toBe('own_words');
  });

  it('사람이 직접 쓴 문장에는 게이트가 걸리지 않는다', () => {
    const human = elementAuthorship({ text: '내가 쓴 문장', aiDraft: '', touched: true, now: T0 });
    const c = evaluateRestatement({ axis: 'premises', authorship: human, sourceText: '내가 쓴 문장', restatement: '' });
    expect(c.state).toBe('not_required');
  });

  it('선택 축(추론)에는 게이트가 걸리지 않는다 — 모든 축에 걸면 마찰이 채택을 죽인다', () => {
    const c = evaluateRestatement({ axis: 'inference', authorship: machine, sourceText: aiText, restatement: '' });
    expect(c.state).toBe('not_required');
  });

  it('그대로 쓰겠다는 탈출구는 own_words 로 세탁되지 않는다', () => {
    expect(acceptAsIs(aiText).state).toBe('echo');
  });

  it('짧게 답해도 통과되지 않는다 — 분모가 재진술이므로', () => {
    expect(echoOverlap(aiText, '대조쌍')).toBe(1);
  });
});

describe('두 세계 — 증거 없이는 건널 수 없다', () => {
  it('건넘이 없으면 in_frame', () => {
    expect(deriveWorld([])).toBe('in_frame');
  });

  it('유효한 건넘이 있으면 reality_contact', () => {
    expect(
      deriveWorld([
        { kind: 'settlement', evidence_ref: 'r1', observed_at: '2026-08-17T00:00:00Z', observed: '관찰됨' },
      ]),
    ).toBe('reality_contact');
  });

  it('증거 참조가 비어 있으면 건넘이 아니다', () => {
    expect(
      deriveWorld([{ kind: 'settlement', evidence_ref: '  ', observed_at: '2026-08-17T00:00:00Z', observed: 'x' }]),
    ).toBe('in_frame');
  });

  it('시각이 파싱 불가면 건넘이 아니다 — 빈티지가 없으면 당시가 정의되지 않는다', () => {
    expect(deriveWorld([{ kind: 'settlement', evidence_ref: 'r', observed_at: '언젠가', observed: 'x' }])).toBe('in_frame');
  });

  it('unread 판독은 건넘 증거가 되지 않는다', () => {
    expect(
      readingToCrossing({ binding_kind: 'k', target: 't', value: null, verdict: 'unread', observed_at: '2026-08-17T00:00:00Z' }),
    ).toBeNull();
  });

  it('세계 분포는 분모를 숨기지 않는다', () => {
    const b = worldBalance([]);
    expect(b).toEqual({ in_frame: 0, reality_contact: 0, total: 0, reality_contact_ids: [] });
  });
});

/** 필수 축이 사람 문장으로 채워진 봉인 가능한 프레임. */
function fullFrame(id: string, now: number): CognitiveFrame {
  let f = emptyFrame({ id, userId: 'u1', title: '테스트 판단', now });
  for (const axis of REQUIRED_AXES) {
    f = addElement(
      f,
      makeElement({ id: `${id}-${axis}`, axis, text: `${axis} 에 대한 내 문장`, touched: true, now }),
      now,
    );
  }
  return f;
}

describe('봉인 — 유혹의 상류에서 잠근다', () => {
  it('필수 축이 차면 봉인된다', () => {
    const res = sealFrame({ frame: fullFrame('f1', T0), now: T0 });
    expect(res.ok).toBe(true);
  });

  it('필수 축이 비면 사유를 전부 돌려준다 (첫 실패에서 멈추지 않는다)', () => {
    const f = emptyFrame({ id: 'f2', userId: 'u1', title: '빈 판단', now: T0 });
    const blocks = sealBlocks(f);
    expect(blocks.filter((b) => b.kind === 'axis_empty')).toHaveLength(REQUIRED_AXES.length);
  });

  it('모든 거부 사유에 사람이 읽을 문장이 있다', () => {
    const res = sealFrame({ frame: emptyFrame({ id: 'f3', userId: 'u1', title: '', now: T0 }), now: T0 });
    expect(res.ok).toBe(false);
    if (!res.ok) for (const m of res.messages) expect(m.trim().length).toBeGreaterThan(0);
  });

  it('근거 없는 임계는 봉인을 막는다', () => {
    let f = fullFrame('f4', T0);
    f = {
      ...f,
      elements: f.elements.map((e) =>
        e.axis === 'premises'
          ? {
              ...e,
              bindings: [
                { kind: 'fx', target: 'usd', threshold: '1400 이하', threshold_rationale: '  ', threshold_owner: 'user' as const },
              ],
            }
          : e,
      ),
    };
    expect(sealBlocks(f).some((b) => b.kind === 'binding_without_rationale')).toBe(true);
  });

  it('봉인된 프레임에는 원소를 추가할 수 없다', () => {
    const res = sealFrame({ frame: fullFrame('f5', T0), now: T0 });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(() =>
        addElement(res.frame, makeElement({ id: 'x', axis: 'inference', text: '나중 생각', touched: true, now: T0 }), T0),
      ).toThrow();
    }
  });

  it('봉인 없는 정산은 거부된다 — 사전 구속 없는 정산은 사후 합리화다', () => {
    expect(() =>
      settleFrame({
        frame: fullFrame('f6', T0),
        settlement: { falsifier_observed: false, observed: 'x', evidence_ref: 'r', observed_at: '2026-08-18T00:00:00Z', retrospective: '' },
        now: T0,
      }),
    ).toThrow();
  });

  it('정산은 원문을 덮지 않는다 (M1: 회고가 빈티지를 다시 쓰지 못한다)', () => {
    const sealedRes = sealFrame({ frame: fullFrame('f7', T0), now: T0 });
    expect(sealedRes.ok).toBe(true);
    if (!sealedRes.ok) return;
    const before = sealedRes.frame.elements.map((e) => e.text);
    const after = settleFrame({
      frame: sealedRes.frame,
      settlement: {
        falsifier_observed: true,
        observed: '반증 조건이 관찰됐다',
        evidence_ref: 'r1',
        observed_at: '2026-08-18T00:00:00Z',
        retrospective: '사실 처음부터 알고 있었다',
      },
      now: T0 + 86_400_000,
    });
    expect(after.elements.map((e) => e.text)).toEqual(before);
    expect(after.settlement?.retrospective).toContain('처음부터');
  });
});

describe('보정 — 봉인된 예측에만 점수가 붙는다', () => {
  const settled = (i: number, forecast: number, wrong: boolean): CognitiveFrame => ({
    ...emptyFrame({ id: `c${i}`, userId: 'u1', title: '', now: T0 }),
    status: 'settled',
    confidence: { value: forecast, about_element_id: 'e', resolvable: true, resolvable_reason: '수치로 판정' },
    settlement: {
      falsifier_observed: wrong,
      observed: 'x',
      evidence_ref: `ref${i}`,
      observed_at: '2026-08-18T00:00:00Z',
      retrospective: '',
    },
  });

  it('표본이 임계 미달이면 숫자 대신 "아직 모릅니다"', () => {
    const r = calibration([settled(1, 80, false)]);
    expect(r.state).toBe('unknown');
    if (r.state === 'unknown') {
      expect(r.reason).toContain('아직 모릅니다');
      expect(r.min_sample).toBe(MIN_SAMPLE);
    }
  });

  it('정산된 예측이 없으면 0이 아니라 "채점할 대상이 없다"', () => {
    const r = calibration([]);
    expect(r.state).toBe('unknown');
    if (r.state === 'unknown') expect(r.sample).toBe(0);
  });

  it('판정 불가능한 확신도는 분모에서 빠진다', () => {
    const unresolvable = { ...settled(9, 80, false) };
    unresolvable.confidence = { value: 80, about_element_id: 'e', resolvable: false, resolvable_reason: '해석 필요' };
    const r = calibration(Array.from({ length: 20 }, () => unresolvable));
    expect(r.state).toBe('unknown');
  });

  it('임계를 넘으면 Brier 분해를 내고 채점 대상이 예측임을 문장에 밝힌다', () => {
    const frames = Array.from({ length: 12 }, (_, i) => settled(i, i % 2 === 0 ? 90 : 20, i % 3 === 0));
    const r = calibration(frames);
    expect(r.state).toBe('measured');
    if (r.state === 'measured') {
      expect(r.brier).toBeGreaterThanOrEqual(0);
      expect(r.brier).toBeLessThanOrEqual(1);
      expect(r.subject_sentence).toContain('예측');
      expect(r.case_refs).toHaveLength(12);
      // Murphy 분해 항등식: BS = 불확실성 − 분해능 + 보정 (반올림 오차 허용)
      expect(Math.abs(r.brier - (r.uncertainty - r.resolution + r.reliability))).toBeLessThan(0.01);
    }
  });
});

describe('거울 — 사람이 아니라 기록을 비춘다', () => {
  it('성향·등급 문장을 만들지 않는다', () => {
    const res = sealFrame({ frame: fullFrame('m1', T0), now: T0 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    for (const s of frameMirror(res.frame).sentences) {
      expect(s).not.toMatch(/^당신은/);
      expect(s).not.toMatch(/경향이 있습니다|유형입니다|등급|점수입니다/);
    }
  });

  it('빈 축을 AI가 채우지 않고 비었다고 적는다', () => {
    const m = frameMirror(emptyFrame({ id: 'm2', userId: 'u1', title: '', now: T0 }));
    expect(m.sentences.join(' ')).toContain('아직 안 쓴 칸');
    expect(m.sentences.join(' ')).toContain('AI가 대신 채우지 않습니다');
  });

  it('현실에 닿은 것이 없으면 그 사실을 그대로 말한다', () => {
    const res = sealFrame({ frame: fullFrame('m3', T0), now: T0 });
    if (!res.ok) throw new Error('봉인 실패');
    expect(frameMirror(res.frame).sentences.join(' ')).toContain('아직 실제로 맞춰보지 않았습니다');
  });

  it('고쳐 쓴 문장이 없으면 평균 편집 거리는 null 이다 (0으로 적으면 정반대 사실)', () => {
    const res = sealFrame({ frame: fullFrame('m4', T0), now: T0 });
    if (!res.ok) throw new Error('봉인 실패');
    expect(frameMirror(res.frame).authorship.mean_revision_distance).toBeNull();
  });

  it('전 프레임 거울은 축별 공백을 빈도 사실로 낸다', () => {
    const c = corpusMirror([emptyFrame({ id: 'm5', userId: 'u1', title: '', now: T0 })]);
    const falsifier = c.axis_gap_frequency.find((a) => a.axis === 'falsifier');
    expect(falsifier?.gaps).toBe(1);
    expect(falsifier?.of).toBe(1);
    expect(falsifier?.frame_ids).toEqual(['m5']);
  });
});
