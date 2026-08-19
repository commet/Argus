import { AXES, type AxisId } from './axes';
import { acceptAsIs } from './comprehension';
import {
  addElement,
  emptyFrame,
  makeElement,
  recordReading,
  sealBlocks,
  sealFrame,
  settleFrame,
} from './frame';
import { corpusMirror, frameMirror } from './mirror';
import type { CognitiveFrame, SignalBinding, SignalReading } from './types';

/**
 * 시뮬레이션 하네스 — **모델 없이** 인지 프레임 엔진 전체를 흔든다.
 *
 * 왜 이것이 필요한가. 이 엔진의 값은 불변식에 있다 (봉인 후 불변, 증거 없는
 * 세계 승격 금지, 권한 등급 집행, 임계 미달 시 "아직 모릅니다"). 불변식은
 * **깨지려고 시도해봐야** 서 있는지 알 수 있고, 손으로 쓴 단위 테스트 몇 개는
 * 내가 상상한 경로만 밟는다. 그래서 합성 에피소드를 결정론적으로 대량 생성해
 * 전 경로를 밟는다.
 *
 * 결정론 규약: `Math.random()`·`Date.now()` 를 쓰지 않는다. 시드에서 유도한
 * 선형 합동 생성기와 호출자가 넘긴 기준 시각만 쓴다 — 같은 시드 = 같은 결과.
 * (E-0 로그 측정기가 살아있는 파일을 읽어 재현 불가였던 실수를 반복하지 않는다.)
 *
 * ── 이미 있는 것과의 관계 ───────────────────────────────────────────
 * 전제 모델 정본은 `src/lib/premises-core.ts` + `./premise.ts`. 하네스는 그것을
 * 호출할 뿐 자체 전제 표현을 만들지 않는다.
 */

/** 시드 기반 LCG. 재현성이 목적이므로 통계적 품질은 요구하지 않는다. */
function lcg(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

const AI_PHRASES = [
  '대조쌍을 정산 시점에 맞춘다',
  '하중 가정을 상류에서 봉인한다',
  '전제를 외부 신호에 결박한다',
  '빈티지를 회고로 덮지 않는다',
  '조용한 열화를 시끄러운 귀환으로 바꾼다',
];

const USER_PHRASES = [
  '이번엔 사람을 더 안 늘리고 버텨본다',
  '가격을 올려도 이탈이 없을 거라고 본다',
  '이 기능은 내가 직접 써서 판단한다',
  '지금 시장이 아직 안 열렸다고 생각한다',
  '경쟁사는 여기까진 안 온다고 본다',
];

export interface SimulatedEpisode {
  frame: CognitiveFrame;
  /** 이 에피소드가 의도한 시나리오 이름 — 실패 원인을 되짚을 때 쓴다. */
  scenario: string;
}

export interface SimulationOptions {
  seed: number;
  episodes: number;
  /** 기준 시각(ms). 모든 타임스탬프가 여기서 파생된다. */
  baseTime: number;
}

/**
 * 한 에피소드를 만든다. 시나리오는 시드로 결정되며 다음 다섯 가지를 돈다:
 *
 *   full_user       모든 축을 사람이 직접 씀 → 봉인 가능
 *   ai_unrestated   하중 축에 AI 문장 + 재진술 없음 → **봉인 거부돼야 함**
 *   ai_accepted     같은 상황에서 "그대로 쓰겠다" → 봉인 가능 (탈출구 작동)
 *   authority_break `human_only` 축(프레임/값)에 AI 문장 → **거부돼야 함**
 *   bound_premise   전제를 신호에 결박 + 판독 → 현실 접촉으로 승격돼야 함
 */
function buildEpisode(i: number, rnd: () => number, baseTime: number): SimulatedEpisode {
  const scenarios = ['full_user', 'ai_unrestated', 'ai_accepted', 'authority_break', 'bound_premise'] as const;
  const scenario = scenarios[i % scenarios.length];
  const t = baseTime + i * 3_600_000; // 에피소드마다 1시간 간격 — 결정론적
  let frame = emptyFrame({ id: `sim-frame-${i}`, userId: `sim-user`, title: `합성 판단 ${i}`, now: t });

  const pick = (arr: readonly string[]) => arr[Math.floor(rnd() * arr.length) % arr.length];

  for (const spec of AXES) {
    // 선택 축은 절반만 채운다 — "정직한 공백"이 실제로 발생하는 경로를 밟기 위해.
    if (spec.optionalForSeal && rnd() < 0.5) continue;

    const humanOnly = spec.authority === 'human_only';
    let aiDraft = '';
    let text = pick(USER_PHRASES);
    let touched = true;
    let restatement = '';

    if (scenario === 'authority_break' && humanOnly) {
      // human_only 축에 손대지 않은 AI 문장 → 권한 위반이 떠야 한다.
      aiDraft = pick(AI_PHRASES);
      text = aiDraft;
      touched = false;
    } else if ((scenario === 'ai_unrestated' || scenario === 'ai_accepted') && spec.loadBearing && !humanOnly) {
      aiDraft = pick(AI_PHRASES);
      text = aiDraft;
      touched = false;
      // ai_accepted 는 나중에 acceptAsIs 로 게이트를 넘는다.
      restatement = '';
    }

    let el = makeElement({
      id: `sim-el-${i}-${spec.id}`,
      axis: spec.id,
      text,
      aiDraft,
      touched,
      restatement,
      now: t,
    });

    if (scenario === 'ai_accepted' && el.comprehension.state === 'absent') {
      el = { ...el, comprehension: acceptAsIs(el.text) };
    }

    if (scenario === 'bound_premise' && spec.id === 'premises') {
      const binding: SignalBinding = {
        kind: 'npm_version',
        target: 'argus-mcp',
        threshold: '버전 하락·소실 시 경보',
        threshold_rationale: '발행본이 사라지면 설치 경로가 끊긴다 — 이 전제의 붕괴는 곧 제품 부재다.',
        threshold_owner: 'user',
      };
      el = { ...el, bindings: [binding] };
    }

    frame = addElement(frame, el, t);
  }

  if (scenario === 'bound_premise') {
    const reading: SignalReading = {
      binding_kind: 'npm_version',
      target: 'argus-mcp',
      value: '1.2.0',
      verdict: 'holds',
      observed_at: new Date(t + 60_000).toISOString(),
    };
    frame = recordReading(frame, reading, t + 60_000);
    // 읽지 못한 판독도 원장에 남아야 하고, 세계를 올리지 않아야 한다.
    frame = recordReading(
      frame,
      {
        binding_kind: 'npm_version',
        target: 'argus-mcp',
        value: null,
        unread_reason: '네트워크 도달 불가',
        verdict: 'unread',
        observed_at: new Date(t + 120_000).toISOString(),
      },
      t + 120_000,
    );
  }

  return { frame, scenario };
}

export interface InvariantViolation {
  frame_id: string;
  scenario: string;
  invariant: string;
  detail: string;
}

/**
 * 불변식 검사 — 시뮬레이션의 본체.
 *
 * 각 불변식은 **양방향**으로 본다: 막아야 할 것을 막는가(적중), 그리고 막지
 * 말아야 할 것을 막지 않는가(위양성). 한쪽만 보면 "전부 거부"하는 엔진이
 * 만점을 받는다 — G 실험에서 위양성이 원형의 생존 조건임을 확인했다.
 */
export function checkInvariants(ep: SimulatedEpisode, now: number): InvariantViolation[] {
  const v: InvariantViolation[] = [];
  const push = (invariant: string, detail: string) =>
    v.push({ frame_id: ep.frame.id, scenario: ep.scenario, invariant, detail });

  const blocks = sealBlocks(ep.frame);
  const has = (kind: string) => blocks.some((b) => b.kind === kind);

  // I1. 재진술 없는 AI 하중 문장은 봉인을 막아야 한다.
  if (ep.scenario === 'ai_unrestated' && !has('comprehension_pending')) {
    push('I1 이해 게이트', '재진술 없는 AI 하중 문장인데 봉인이 막히지 않았다');
  }
  // I1b. "그대로 쓰겠다"를 쓴 에피소드는 이해 사유로 막히면 안 된다 (탈출구 작동).
  if (ep.scenario === 'ai_accepted' && has('comprehension_pending')) {
    push('I1b 탈출구', 'acceptAsIs 후에도 이해 게이트가 막았다 — 마찰 탈출구가 죽었다');
  }
  // I2. human_only 축의 미편집 AI 문장은 권한 위반이어야 한다.
  if (ep.scenario === 'authority_break' && !has('authority_violation')) {
    push('I2 권한 등급', 'human_only 축의 기계 문장인데 권한 위반이 뜨지 않았다');
  }

  const seal = sealFrame({ frame: ep.frame, now });

  // I3. 막힌 이유가 있으면 봉인은 실패해야 하고, 없으면 성공해야 한다 (양방향).
  if (blocks.length > 0 && seal.ok) push('I3 봉인 일관성', `사유 ${blocks.length}건인데 봉인이 성공했다`);
  if (blocks.length === 0 && !seal.ok) push('I3 봉인 일관성', '사유가 없는데 봉인이 실패했다');

  // I4. 모든 사유는 사람이 읽을 문장을 갖는다 — 빈 문장은 조용한 실패다.
  for (const msg of seal.ok ? [] : seal.messages) {
    if (!msg || !msg.trim()) push('I4 시끄러운 실패', '봉인 거부 사유의 문안이 비어 있다');
  }

  if (!seal.ok) return v;
  const sealed = seal.frame;

  // I5. 증거 없는 원소는 in_frame 이어야 한다.
  for (const el of sealed.elements) {
    if (el.world === 'reality_contact' && el.crossings.length === 0) {
      push('I5 두 세계', `원소 ${el.id} 가 증거 없이 현실 접촉을 주장한다`);
    }
  }

  // I6. unread 판독은 세계를 올리지 않는다.
  if (ep.scenario === 'bound_premise') {
    const unread = sealed.readings.filter((r) => r.verdict === 'unread');
    if (unread.length === 0) push('I6 미판독 보존', 'unread 판독이 원장에서 사라졌다');
    const premise = sealed.elements.find((e) => e.axis === 'premises' && e.bindings.length > 0);
    if (premise) {
      const fromUnread = premise.crossings.filter((c) => c.observed.includes('unread'));
      if (fromUnread.length > 0) push('I6 미판독 보존', 'unread 판독이 건넘 증거로 승격됐다');
      if (premise.world !== 'reality_contact') {
        push('I6 미판독 보존', 'holds 판독이 있는데 현실 접촉으로 승격되지 않았다');
      }
    }
  }

  // I7. 거울은 성향 문장을 만들지 않는다 — 주어가 사람인 문장 금지.
  const mirror = frameMirror(sealed);
  for (const s of mirror.sentences) {
    if (/^당신은|당신의 성향|경향이 있습니다|유형입니다|등급/.test(s)) {
      push('I7 무판정', `거울이 사람에 대한 판정 문장을 냈다: ${s}`);
    }
  }

  // I8. 봉인 후 정산 → falsifier 축이 현실에 닿아야 한다.
  const settled = settleFrame({
    frame: sealed,
    settlement: {
      falsifier_observed: false,
      observed: '반증 조건이 관찰되지 않았다',
      evidence_ref: `sim:settle:${sealed.id}`,
      observed_at: new Date(now + 86_400_000).toISOString(),
      retrospective: '돌아보면 전제가 맞았다',
    },
    now: now + 86_400_000,
  });
  const fals = settled.elements.filter((e) => e.axis === 'falsifier');
  if (fals.length > 0 && fals.every((e) => e.world !== 'reality_contact')) {
    push('I8 정산 접촉', '정산했는데 반증 축이 여전히 프레임 안이다');
  }
  // I9. 회고가 원문을 덮지 않았다.
  for (const el of settled.elements) {
    const original = sealed.elements.find((o) => o.id === el.id);
    if (original && original.text !== el.text) {
      push('I9 빈티지 보존', `정산이 원소 ${el.id} 의 원문을 바꿨다`);
    }
  }

  return v;
}

export interface SimulationReport {
  seed: number;
  episodes: number;
  /** 시나리오별 개수 — 전 경로를 실제로 밟았는지 확인. */
  scenario_counts: Record<string, number>;
  sealed: number;
  blocked: number;
  /** 봉인 거부 사유의 분포. 특정 사유가 0이면 그 경로를 안 밟은 것이다. */
  block_kinds: Record<string, number>;
  violations: InvariantViolation[];
  /** 전 프레임 거울 — 임계 미달이면 "아직 모릅니다"가 나와야 한다. */
  corpus_sentences: string[];
}

/** 시뮬레이션을 돌린다. **위반이 하나라도 있으면 집이 서 있지 않은 것이다.** */
export function runSimulation(opts: SimulationOptions): SimulationReport {
  const rnd = lcg(opts.seed);
  const scenario_counts: Record<string, number> = {};
  const block_kinds: Record<string, number> = {};
  const violations: InvariantViolation[] = [];
  const sealedFrames: CognitiveFrame[] = [];
  let sealed = 0;
  let blocked = 0;

  for (let i = 0; i < opts.episodes; i += 1) {
    const ep = buildEpisode(i, rnd, opts.baseTime);
    scenario_counts[ep.scenario] = (scenario_counts[ep.scenario] ?? 0) + 1;

    for (const b of sealBlocks(ep.frame)) {
      block_kinds[b.kind] = (block_kinds[b.kind] ?? 0) + 1;
    }

    violations.push(...checkInvariants(ep, opts.baseTime + i * 3_600_000));

    const res = sealFrame({ frame: ep.frame, now: opts.baseTime + i * 3_600_000 });
    if (res.ok) {
      sealed += 1;
      sealedFrames.push(res.frame);
    } else {
      blocked += 1;
    }
  }

  return {
    seed: opts.seed,
    episodes: opts.episodes,
    scenario_counts,
    sealed,
    blocked,
    block_kinds,
    violations,
    corpus_sentences: corpusMirror(sealedFrames).sentences,
  };
}

/** 축 id 목록 — 시뮬레이션 보고에서 커버리지를 셀 때 쓴다. */
export const ALL_AXES: readonly AxisId[] = AXES.map((a) => a.id);
