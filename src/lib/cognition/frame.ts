import { AXES, REQUIRED_AXES, axisSpec, isKnownAxis, type AxisId } from './axes';
import { elementAuthorship } from './authorship';
import { comprehensionNotRequired, evaluateRestatement, gateApplies } from './comprehension';
import { deriveWorld, elementsClaimingUnevidencedCrossing, readingToCrossing, reconcileWorld } from './world';
import type {
  CognitiveFrame,
  Crossing,
  FrameElement,
  SealBlock,
  SealResult,
  SealedConfidence,
  Settlement,
  SignalBinding,
  SignalReading,
} from './types';

/**
 * 인지 구조 프레임의 조립·봉인 엔진. **순수 함수만** — 네트워크도, 시각도,
 * 난수도 없다. `now` 와 `id` 는 호출자가 넣는다.
 *
 * 왜 순수여야 하나: 이 엔진의 판정(봉인 거부, 세계 귀속, 이해 게이트)은 CI에서
 * 같은 답을 내야 한다. 안에서 `Date.now()` 를 부르면 테스트가 시각에 따라
 * 흔들리고, 흔들리는 가드는 없는 가드다. E-0 실험에서 로그 측정기가 정확히
 * 이 실수로 재현 불가였다 (말뭉치가 매 실행마다 자랐다).
 *
 * 설계 규칙 셋:
 *   1. **봉인 후 text 는 불변.** 생각이 바뀌면 새 원소 + `supersedes`. 덮어쓰기
 *      금지 (P1, Croushore-Stark 실시간 데이터 원리).
 *   2. **권한 등급을 엔진이 집행한다.** `human_only` 축에 기계 발원 문장을
 *      봉인하려 하면 거부된다 (P8). 산문 규칙은 지켜지지 않는다 — 이 저장소
 *      자신의 소급 측정에서 기계가 검사하지 않는 규약의 준수율이 90%였다.
 *   3. **거부는 시끄럽다.** `SealResult` 는 사유를 기계 가독으로 돌려준다.
 *      조용히 부분 성공하는 경로가 없다 (P5).
 *
 * ── 이미 있는 것과의 관계 ───────────────────────────────────────────
 * 저자성 판정의 정본은 `src/lib/judgment-authorship.ts` 이고 `./authorship.ts`
 * 가 그것을 부른다 — 여기서 다시 판정하지 않는다. 전제의 지속 모델은
 * `src/lib/premises-core.ts` + `./premise.ts` 이고 프레임은 참조만 한다.
 */

const nowIso = (now: number): string => new Date(now).toISOString();

export function emptyFrame(input: { id: string; userId: string | null; title: string; now: number }): CognitiveFrame {
  const at = nowIso(input.now);
  return {
    id: input.id,
    user_id: input.userId,
    title: (input.title || '').slice(0, 200),
    status: 'drafting',
    elements: [],
    confidence: null,
    settlement: null,
    readings: [],
    sealed_at: null,
    created_at: at,
    updated_at: at,
  };
}

/**
 * 원소를 만든다. 저자성·이해 상태·세계가 **한자리에서 함께** 정해진다 —
 * 셋을 나중에 따로 채우게 두면 하나가 비어도 화면이 멀쩡해 보인다
 * (CLAUDE.md: 생산된 필드는 기본이 dead-on-arrival이므로 소비를 가드한다).
 */
export function makeElement(input: {
  id: string;
  axis: AxisId;
  text: string;
  /** Argus가 미리 넣어둔 초안 (없으면 빈 문자열). */
  aiDraft?: string;
  /** 사용자가 그 칸을 건드렸는가. */
  touched?: boolean;
  revisionRounds?: number;
  /** 이해 재진술 (하중 축 × 기계 발원일 때만 의미 있다). */
  restatement?: string;
  bindings?: SignalBinding[];
  crossings?: Crossing[];
  supersedes?: string | null;
  now: number;
}): FrameElement {
  if (!isKnownAxis(input.axis)) throw new Error(`알 수 없는 인지 축: ${String(input.axis)}`);

  const text = (input.text || '').slice(0, 2000);
  const authorship = elementAuthorship({
    text,
    aiDraft: input.aiDraft ?? '',
    touched: input.touched ?? false,
    revisionRounds: input.revisionRounds,
    now: input.now,
  });

  const comprehension = gateApplies(input.axis, authorship)
    ? evaluateRestatement({
        axis: input.axis,
        authorship,
        sourceText: text,
        restatement: input.restatement ?? '',
      })
    : comprehensionNotRequired();

  const crossings = (input.crossings ?? []).slice();

  return {
    id: input.id,
    axis: input.axis,
    text,
    authorship,
    world: deriveWorld(crossings),
    crossings,
    comprehension,
    // 결박은 전제 축의 것이다. 다른 축에 붙은 결박은 조용히 버리지 않고
    // 봉인 시점에 사유로 드러난다 (아래 authority_violation).
    bindings: (input.bindings ?? []).slice(),
    supersedes: input.supersedes ?? null,
    created_at: nowIso(input.now),
  };
}

/** 원소를 프레임에 얹는다. 봉인된 프레임은 원소를 받지 않는다. */
export function addElement(frame: CognitiveFrame, el: FrameElement, now: number): CognitiveFrame {
  if (frame.status === 'sealed' || frame.status === 'settled') {
    throw new Error('봉인된 프레임에는 원소를 추가할 수 없다 — 새 프레임을 열거나 supersedes 로 이어라');
  }
  return { ...frame, elements: [...frame.elements, el], updated_at: nowIso(now) };
}

/**
 * 신호 판독을 원장에 append 하고, 해당 전제 원소에 건넘 증거를 얹는다.
 *
 * `unread` 판독도 **원장에는 남는다** — 읽지 못한 사실 자체가 기록이다.
 * 다만 건넘으로 승격되지 않는다 (world.ts 참조).
 */
export function recordReading(frame: CognitiveFrame, reading: SignalReading, now: number): CognitiveFrame {
  const crossing = readingToCrossing(reading);
  const elements = frame.elements.map((el) => {
    if (el.axis !== 'premises') return el;
    const bound = (el.bindings ?? []).some(
      (b) => b.kind === reading.binding_kind && b.target === reading.target,
    );
    if (!bound || !crossing) return el;
    return reconcileWorld({ ...el, crossings: [...el.crossings, crossing] });
  });
  return {
    ...frame,
    elements,
    readings: [...frame.readings, reading],
    updated_at: nowIso(now),
  };
}

/** 살아있는 원소들 — superseded 된 것은 제외하되 원장에서 지우지는 않는다. */
export function liveElements(frame: CognitiveFrame): FrameElement[] {
  const superseded = new Set(frame.elements.map((e) => e.supersedes).filter((x): x is string => !!x));
  return frame.elements.filter((e) => !superseded.has(e.id));
}

export function elementsByAxis(frame: CognitiveFrame, axis: AxisId): FrameElement[] {
  return liveElements(frame).filter((e) => e.axis === axis);
}

/**
 * 봉인 가능한지 검사한다. **판정 사유를 전부 돌려준다** — 첫 실패에서
 * 멈추면 사용자가 여러 번 벽에 부딪힌다.
 */
export function sealBlocks(frame: CognitiveFrame): SealBlock[] {
  const blocks: SealBlock[] = [];
  const live = liveElements(frame);

  // 1) 필수 축이 비어 있나. 빈 축은 AI가 채우지 않는다 — 정직한 공백으로 남는다.
  for (const axis of REQUIRED_AXES) {
    if (!live.some((e) => e.axis === axis && e.text.trim())) blocks.push({ kind: 'axis_empty', axis });
  }

  for (const el of live) {
    const spec = axisSpec(el.axis);

    // 2) 권한 등급 집행 (P8). human_only 축에 손대지 않은 기계 문장은 봉인 불가.
    if (spec.authority === 'human_only' && el.authorship.wording_source === 'ai_surfaced') {
      blocks.push({
        kind: 'authority_violation',
        element_id: el.id,
        axis: el.axis,
        detail: `'${spec.label}' 칸은 AI가 대신 쓸 수 없습니다. 직접 써주세요.`,
      });
    }

    // 3) 결박은 전제 축의 것이다. 다른 축에 붙었으면 조용히 버리지 않고 드러낸다.
    if (el.bindings.length > 0 && el.axis !== 'premises') {
      blocks.push({
        kind: 'authority_violation',
        element_id: el.id,
        axis: el.axis,
        detail: '숫자에 묶는 건 \'무엇에 기대고 있나\' 칸에서만 됩니다.',
      });
    }

    // 4) 이해 게이트. 하중 축 × 기계 발원 × 재진술 없음 → 막는다.
    if (el.comprehension.state === 'absent') {
      blocks.push({ kind: 'comprehension_pending', element_id: el.id, axis: el.axis });
    }

    // 5) 임계에 근거가 없는 결박. 임계는 사전 믿음이므로 근거 없이 존재할 수 없다.
    for (const b of el.bindings) {
      if (!(b.threshold_rationale || '').trim()) {
        blocks.push({ kind: 'binding_without_rationale', element_id: el.id, binding_kind: b.kind });
      }
    }
  }

  // 6) 증거 없이 현실 접촉을 주장하는 원소.
  for (const el of elementsClaimingUnevidencedCrossing(live)) {
    blocks.push({ kind: 'crossing_without_evidence', element_id: el.id });
  }

  return blocks;
}

/** 사용자에게 보이는 한 줄. **판정 어휘가 아니라 결핍의 이름을 쓴다.** */
export function blockMessage(block: SealBlock): string {
  switch (block.kind) {
    case 'axis_empty':
      return `'${axisSpec(block.axis).label}' 칸이 비어 있습니다. 이 칸은 채워야 잠글 수 있습니다.`;
    case 'comprehension_pending':
      return `'${axisSpec(block.axis).label}' 칸이 아직 AI 문장 그대로입니다. 한 줄로 다시 써보거나, '그냥 이대로 쓸게요'를 눌러주세요.`;
    case 'authority_violation':
      return block.detail;
    case 'crossing_without_evidence':
      return '맞춰봤다고 되어 있는데 실제 결과가 없습니다. 숫자·결과·외부 기록 중 하나가 있어야 합니다.';
    case 'binding_without_rationale':
      return `'${block.binding_kind}' 기준선을 왜 그 숫자로 잡았는지가 비어 있습니다. 이 숫자는 데이터가 정해주는 게 아니라 사람이 고르는 거라, 이유가 있어야 나중에 다시 볼 수 있습니다.`;
    default:
      // 새 블록 종류를 추가하고 문안을 잊으면 조용히 빈 문자열이 나가는 대신
      // 눈에 보이는 문장이 나간다.
      return '아직 잠글 수 없습니다 (사유 문구 미작성).';
  }
}

/**
 * 봉인한다. 유혹의 상류에서 잠그는 것이 이 제품의 존재 이유이므로, 이 함수가
 * 느슨해지는 순간 나머지 전부가 장식이 된다.
 */
export function sealFrame(input: {
  frame: CognitiveFrame;
  confidence?: SealedConfidence | null;
  now: number;
}): SealResult {
  const { frame, now } = input;
  if (frame.status === 'sealed' || frame.status === 'settled') {
    return { ok: false, blocked_by: [], messages: ['이미 잠근 기록입니다.'] };
  }

  const blocks = sealBlocks(frame);
  if (blocks.length > 0) {
    return { ok: false, blocked_by: blocks, messages: blocks.map(blockMessage) };
  }

  const at = nowIso(now);
  return {
    ok: true,
    frame: {
      ...frame,
      elements: frame.elements.map(reconcileWorld),
      confidence: input.confidence ?? frame.confidence,
      status: 'sealed',
      sealed_at: at,
      updated_at: at,
    },
  };
}

/**
 * 정산한다 — 봉인된 falsifier 를 현실과 대조한다.
 *
 * 회고(`retrospective`)는 저장되지만 **원문을 덮지 않는다.** 이것이 M1(기억
 * 다시쓰기)에 대해 문헌이 아는 유일한 처방이다: 사후확신은 경고로 줄지 않고
 * (Fischhoff 1977), 당시 기록의 보존만이 듣는다.
 */
export function settleFrame(input: { frame: CognitiveFrame; settlement: Settlement; now: number }): CognitiveFrame {
  const { frame, settlement, now } = input;
  if (frame.status !== 'sealed') {
    throw new Error('봉인되지 않은 프레임은 정산할 수 없다 — 사전 구속 없는 정산은 사후 합리화다');
  }
  const at = nowIso(now);
  const crossing: Crossing = {
    kind: 'settlement',
    evidence_ref: settlement.evidence_ref,
    observed_at: settlement.observed_at,
    observed: settlement.observed,
  };
  return {
    ...frame,
    // 정산은 falsifier 축을 현실에 닿게 만든다.
    elements: frame.elements.map((el) =>
      el.axis === 'falsifier' ? reconcileWorld({ ...el, crossings: [...el.crossings, crossing] }) : el,
    ),
    settlement,
    status: 'settled',
    updated_at: at,
  };
}

// 축별 채움 현황은 `mirror.ts` 의 axisReflection 이 낸다. 여기 같은 것을
// 하나 더 두면 두 화면이 서로 다른 숫자를 말하게 된다.
