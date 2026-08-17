import { AXES, axisSpec, type AxisId } from './axes';
import { isUneditedMachineText } from './authorship';
import { calibration, type CalibrationReading } from './calibration';
import { elementsByAxis, liveElements } from './frame';
import { worldBalance, type WorldBalance } from './world';
import type { CognitiveFrame, FrameElement } from './types';

/**
 * 인지 구조의 거울 — **자신을 알고 자신의 인지 체계를 개선하기 위한** 표면.
 * 이 저장소에서 가장 위험한 파일이므로 규율을 앞에 적는다.
 *
 * ── 이 파일이 절대 하지 않는 것 ──────────────────────────────────────
 *
 * CLAUDE.md Zero-Judgment 게이트: 사용자가 누구인지에 대한 사용자향 판정 금지.
 * *"당신은 B+ 결정자입니다" 류의 문장은 이 제품에 존재하지 않는다.*
 *
 * 그래서 이 거울은:
 *   · 사람에게 점수·등급·유형을 붙이지 않는다
 *   · "당신은 ~한 경향이 있다" 같은 성향 문장을 만들지 않는다
 *   · 코칭을 라우팅하지 않고 프롬프트를 개인화하지 않는다
 *
 * ── 그럼 무엇을 하나 ─────────────────────────────────────────────────
 *
 * **기록의 구조를 비춘다.** 판정 대상은 사람이 아니라 이 프레임이다.
 *
 *   "일곱 축 중 다섯이 찼고, 두 축은 비어 있습니다"          ← 사실
 *   "여섯 원소가 프레임 안, 하나가 현실에 닿았습니다"        ← 위치
 *   "전제 3건 중 2건이 기계 문장이고 편집이 0입니다"         ← 사실 + 증거 id
 *   "봉인한 예측 4건 — 채점 임계 10건 미달, 아직 모릅니다"   ← 정직한 공백
 *
 * Nisbett-Wilson(1977)이 왜 이 형태를 강제하는가: 사람은 자기 판단의 *이유*를
 * 정확히 보고하지 못한다 — 자기보고는 작화다. 그래서 인지 체계를 **묻지 않고**
 * 약정의 잔여물에서 재구성한다. 증언이 아니라 잔여물로 짓는 거울.
 *
 * ── 정직한 공백 ──────────────────────────────────────────────────────
 *
 * 비어 있는 축을 AI가 채우지 않고 **비었다고 적는다.** 채우면 그 순간 이
 * 도구는 자기가 방어하려는 실패(그럴듯함이 맞음으로 위장)의 사례가 된다.
 */

export interface AxisReflection {
  axis: AxisId;
  label: string;
  /** 이 축의 살아있는 원소 수. */
  filled: number;
  /** 비어 있고 필수인가 — 정직한 공백. */
  gap: boolean;
  authority: string;
  /** 이 축에서 손대지 않은 기계 문장의 원소 id들. 사실 + 증거. */
  unedited_machine_ids: string[];
  /** 이 축에서 아직 당신 말이 아닌 원소 id들 (재진술 미완). */
  awaiting_restatement_ids: string[];
}

export interface AuthorshipReflection {
  total: number;
  user_direct: number;
  user_reworded: number;
  ai_surfaced: number;
  /** 기계 문장 중 한 글자도 안 고친 것. E-0 발견 2가 지목한 조용한 위험. */
  unedited_machine: number;
  unedited_machine_ids: string[];
  /**
   * 고쳐 쓴 문장들의 평균 편집 거리 (0~1). 대상이 없으면 null —
   * **0으로 적지 않는다** (0은 "안 고쳤다"는 뜻이라 정반대 사실이 된다).
   */
  mean_revision_distance: number | null;
}

export interface ComprehensionReflection {
  gated: number;
  own_words: number;
  echo: number;
  absent: number;
  /** 재진술이 남은 원소 id들. */
  absent_ids: string[];
  echo_threshold: number;
}

export interface FrameMirror {
  frame_id: string;
  status: CognitiveFrame['status'];
  axes: AxisReflection[];
  world: WorldBalance;
  authorship: AuthorshipReflection;
  comprehension: ComprehensionReflection;
  /**
   * 사용자에게 보이는 문장들. **전부 사실 진술이며 성향 문장이 없다.**
   * 이 배열이 이 파일의 출력 계약이고, 가드 테스트가 금지 어휘를 검사한다.
   */
  sentences: string[];
}

const pct = (n: number, d: number): string => (d === 0 ? '0' : String(Math.round((n / d) * 100)));

function axisReflection(frame: CognitiveFrame, axis: AxisId): AxisReflection {
  const spec = axisSpec(axis);
  const els = elementsByAxis(frame, axis).filter((e) => (e.text || '').trim());
  return {
    axis,
    label: spec.label,
    filled: els.length,
    gap: els.length === 0 && !spec.optionalForSeal,
    authority: spec.authority,
    unedited_machine_ids: els.filter((e) => isUneditedMachineText(e.authorship)).map((e) => e.id),
    awaiting_restatement_ids: els.filter((e) => e.comprehension.state === 'absent').map((e) => e.id),
  };
}

function authorshipReflection(els: readonly FrameElement[]): AuthorshipReflection {
  const total = els.length;
  const by = (k: FrameElement['authorship']['wording_source']) =>
    els.filter((e) => e.authorship.wording_source === k);
  const unedited = els.filter((e) => isUneditedMachineText(e.authorship));
  const reworded = by('user_reworded');
  const meanDist =
    reworded.length === 0
      ? null
      : Math.round(
          (reworded.reduce((s, e) => s + (e.authorship.revision_distance || 0), 0) / reworded.length) * 10_000,
        ) / 10_000;
  return {
    total,
    user_direct: by('user_direct').length,
    user_reworded: reworded.length,
    ai_surfaced: by('ai_surfaced').length,
    unedited_machine: unedited.length,
    unedited_machine_ids: unedited.map((e) => e.id),
    mean_revision_distance: meanDist,
  };
}

function comprehensionReflection(els: readonly FrameElement[]): ComprehensionReflection {
  const gated = els.filter((e) => e.comprehension.state !== 'not_required');
  const cnt = (s: FrameElement['comprehension']['state']) => gated.filter((e) => e.comprehension.state === s).length;
  return {
    gated: gated.length,
    own_words: cnt('own_words'),
    echo: cnt('echo'),
    absent: cnt('absent'),
    absent_ids: gated.filter((e) => e.comprehension.state === 'absent').map((e) => e.id),
    echo_threshold: gated[0]?.comprehension.echo_threshold ?? 0.6,
  };
}

/**
 * 한 프레임의 거울.
 *
 * 문장을 만드는 규칙: **주어는 항상 기록이다.** "이 프레임은…", "이 축은…",
 * "당신이 봉인한 예측은…". "당신은…"으로 시작하는 문장은 만들지 않는다.
 */
export function frameMirror(frame: CognitiveFrame): FrameMirror {
  const els = liveElements(frame).filter((e) => (e.text || '').trim());
  const axes = AXES.map((a) => axisReflection(frame, a.id));
  const world = worldBalance(els);
  const authorship = authorshipReflection(els);
  const comprehension = comprehensionReflection(els);

  const sentences: string[] = [];

  const gaps = axes.filter((a) => a.gap);
  sentences.push(
    gaps.length === 0
      ? `일곱 축이 모두 채워졌습니다 (원소 ${els.length}개).`
      : `필수 축 ${gaps.length}개가 비어 있습니다: ${gaps.map((g) => g.label).join(' · ')}. 비워둔 채로 둘 수 있고, AI가 채우지 않습니다.`,
  );

  sentences.push(
    world.reality_contact === 0
      ? `이 프레임의 원소 ${world.total}개는 전부 프레임 안에 있습니다 — 아직 아무것도 현실과 대조되지 않았습니다.`
      : `원소 ${world.total}개 중 ${world.reality_contact}개가 현실에 닿았습니다 (${pct(world.reality_contact, world.total)}%). 나머지 ${world.in_frame}개는 프레임 안입니다.`,
  );

  if (authorship.unedited_machine > 0) {
    sentences.push(
      `문장 ${authorship.total}개 중 ${authorship.unedited_machine}개가 기계가 쓴 그대로입니다 (한 글자도 고쳐지지 않음). 해당 원소: ${authorship.unedited_machine_ids.join(', ')}.`,
    );
  } else if (authorship.ai_surfaced === 0) {
    sentences.push(`문장 ${authorship.total}개가 모두 당신이 직접 쓰거나 고쳐 쓴 것입니다.`);
  }

  if (comprehension.gated > 0) {
    sentences.push(
      `기계 발원 하중 문장 ${comprehension.gated}개 중 당신 말로 다시 쓴 것 ${comprehension.own_words}개, 원문을 되풀이한 것 ${comprehension.echo}개, 아직 안 쓴 것 ${comprehension.absent}개입니다 (되풀이 임계 ${comprehension.echo_threshold}).`,
    );
  }

  return { frame_id: frame.id, status: frame.status, axes, world, authorship, comprehension, sentences };
}

export interface CorpusMirror {
  frames: number;
  sealed: number;
  settled: number;
  /** 전 프레임의 세계 분포 합계. */
  world: WorldBalance;
  /** 보정 — 봉인된 예측에만, 임계 미달이면 "아직 모릅니다". */
  calibration: CalibrationReading;
  /**
   * 축별로 **얼마나 자주 비었나**. 성향 진술이 아니라 빈도 사실이다.
   * ("당신은 반증 조건을 잘 안 씁니다" ✗ / "반증 축이 12개 중 7개에서 비었습니다" ✓)
   */
  axis_gap_frequency: Array<{ axis: AxisId; label: string; gaps: number; of: number; frame_ids: string[] }>;
  sentences: string[];
}

/**
 * 여러 프레임에 걸친 거울 — 여기서 "인지 체계"가 보이기 시작한다.
 *
 * 한 프레임은 한 판단이지만, 여러 프레임의 **약정 패턴**은 체계다. 그리고
 * 그것을 사용자에게 묻지 않고 잔여물에서 세는 것이 Nisbett-Wilson 이후로
 * 정직한 유일한 방법이다.
 *
 * 여전히 성향 문장은 만들지 않는다. 빈도와 증거 id만 낸다 — 그 빈도가 무엇을
 * 뜻하는지는 **사용자가 해석한다** (P8: 채택의 주체는 사람).
 */
export function corpusMirror(frames: readonly CognitiveFrame[]): CorpusMirror {
  const list = (frames ?? []).filter(Boolean);
  const allEls = list.flatMap((f) => liveElements(f).filter((e) => (e.text || '').trim()));

  const axis_gap_frequency = AXES.map((spec) => {
    const missing = list.filter((f) => elementsByAxis(f, spec.id).every((e) => !(e.text || '').trim()));
    return {
      axis: spec.id,
      label: spec.label,
      gaps: missing.length,
      of: list.length,
      frame_ids: missing.map((f) => f.id),
    };
  });

  const cal = calibration(list);
  const sentences: string[] = [];

  sentences.push(
    `프레임 ${list.length}개 — 봉인 ${list.filter((f) => f.status === 'sealed').length}개, 정산 ${list.filter((f) => f.status === 'settled').length}개.`,
  );

  const worst = [...axis_gap_frequency].sort((a, b) => b.gaps - a.gaps)[0];
  if (worst && worst.gaps > 0) {
    // 증거 id는 동봉해야 하지만(TWIN 조건 2) 문장에 전부 늘어놓으면 읽히지 않는다.
    // 문장에는 앞 5개만, 전체는 `axis_gap_frequency[].frame_ids` 에 그대로 남는다.
    const shown = worst.frame_ids.slice(0, 5).join(', ');
    const rest = worst.frame_ids.length - 5;
    sentences.push(
      `'${worst.label}' 축이 ${worst.of}개 프레임 중 ${worst.gaps}개에서 비어 있습니다. 예: ${shown}${rest > 0 ? ` 외 ${rest}개` : ''}.`,
    );
  }

  sentences.push(cal.state === 'unknown' ? cal.reason : cal.subject_sentence);

  return {
    frames: list.length,
    sealed: list.filter((f) => f.status === 'sealed').length,
    settled: list.filter((f) => f.status === 'settled').length,
    world: worldBalance(allEls),
    calibration: cal,
    axis_gap_frequency,
    sentences,
  };
}
