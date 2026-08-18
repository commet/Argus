import type { CusumPrior } from './detect';
import type { PortfolioPrior } from './portfolio';
import type { SignalBinding, SignalReading } from './types';

/**
 * 전제를 세계에 묶는다 — **사람이 답할 수 있는 말로만.**
 *
 * ── 왜 이 파일이 생겼나 ──────────────────────────────────────────────
 *
 * `premise.ts` 는 전제가 흔들렸는지 판정하려면 `CusumPrior`(target·slack·
 * decisionInterval)를 요구한다. 그건 맞는 요구다 — 임계는 데이터에서 도출되지
 * 않으므로 사람이 정해야 한다(문헌 상충 1). 하지만 **사용자에게 "결정 구간 h를
 * 4σ로 하시겠습니까"라고 묻는 건 도구가 아니라 시험지다.**
 *
 * 그렇다고 기계가 기본 임계를 몰래 끼워넣으면 이 설계가 그 자리에서 거짓말이
 * 된다. 그래서 **묻는 말을 바꾼다.** 사람이 실제로 아는 것 넷만 묻는다:
 *
 *   평소 값        "보통 3% 나옵니다"                → target
 *   평소 출렁임    "그냥도 0.3%p 는 왔다갔다 해요"   → σ (결정 구간의 단위)
 *   깨진 값        "2% 밑으로 가면 제 전제가 틀린 겁니다" → 탐지할 이동폭 δ
 *   왜 그 값인가   "그 아래면 광고비가 안 빠집니다"   → 임계의 근거
 *
 * 여기서 관례를 적용한다: **k = δ/2, h = 4σ.** 이 둘은 문헌의 관례지 데이터에서
 * 나온 값이 아니다 — 그래서 코드에 숨기지 않고 아래 상수로 이름을 붙여 두고,
 * 만들어진 사전 믿음의 `rationale` 에 사용자의 말과 함께 그대로 적어 남긴다.
 *
 * ── 이 파일이 거절해야 하는 것 (조용히 만들면 안 되는 것) ────────────
 *
 * **깨진 값이 평소 출렁임 안에 있으면 감시를 만들지 않는다.** δ ≤ σ 면 그
 * 임계는 소음과 구별되지 않아 영영 의미 있게 울리지 않거나 아무 때나 운다.
 * 그걸 만들어 주면 사용자는 "감시 중"이라고 믿지만 실제로는 아무것도 지켜지지
 * 않는다 — 이 저장소가 이름 붙인 조용한 실패 그대로다. 그래서 이유를 말하고
 * 거절한다.
 *
 * ── 이미 있는 것과의 관계 ───────────────────────────────────────────
 *
 * 전제 모델의 정본은 `src/lib/premises-core.ts` (결정 단위)이고 지속 계층은
 * `./premise.ts` 다. 이 파일은 둘 중 어느 것도 다시 짓지 않는다 — **전제를
 * 만들지 않고, 전제가 요구하는 사전 믿음만** 사람의 답에서 만들어 건넨다.
 * 재점검 주기(`recheckCadenceDays`)도 premises-core 소유라 여기서 정하지 않는다.
 */

/** k = δ/2 — 탐지하려는 이동폭의 절반. 표준 tabular CUSUM 관례. */
export const SLACK_RATIO = 0.5;
/** h = 4σ — 관례의 아래끝(4~5σ). 데이터에서 나온 값이 아니라 고른 값이다. */
export const DECISION_SIGMA = 4;
/** 판정이 시작되는 최소 판독 수. detect.ts 의 CUSUM 이 요구하는 것과 같다. */
export const MIN_READINGS = 3;
/** 포트폴리오 학습률 η. T를 모르므로 관례 대신 고정값을 쓰고 밝힌다. */
export const LEARNING_RATE = 1.5;
/** 공유율 α. **0이면 죽은 가설이 부활하지 못해 국면 전환을 못 따라간다.** 관례 0.01~0.1. */
export const SHARE_RATE = 0.05;

export interface WatchSetup {
  /** 무엇을 볼 건가. "전환율", "월 매출". */
  what: string;
  /** 어디서 볼 건가. 대시보드·시트·표 이름. */
  where: string;
  /** 평소 값. */
  normal: string;
  /** 평소에도 이만큼은 왔다갔다 한다. */
  wobble: string;
  /** 이 값이 되면 전제가 깨진 것. */
  broken: string;
  /** 왜 그 값인가. 근거 없는 임계는 검토될 수 없다. */
  why: string;
}

/** 숫자만 뽑는다. `%`·`원`·쉼표는 벗기되, **숫자가 없으면 0이 아니라 NaN.** */
export function readNumber(raw: string): number {
  const stripped = (raw || '').replace(/[^0-9.+\-eE]/g, '');
  return /[0-9]/.test(stripped) ? Number(stripped) : Number.NaN;
}

/**
 * 감시를 만들 수 없는 이유를 **전부** 준다. 하나만 주면 사용자가 한 번에
 * 하나씩 고치며 여러 번 튕긴다.
 */
export function watchBlocks(w: WatchSetup): string[] {
  const out: string[] = [];
  if (!(w.what || '').trim()) out.push('무엇을 볼지 적어주세요.');
  if (!(w.where || '').trim()) out.push('그 숫자를 어디서 보는지 적어주세요.');

  const normal = readNumber(w.normal);
  const wobble = readNumber(w.wobble);
  const broken = readNumber(w.broken);

  if (Number.isNaN(normal)) out.push('평소 값이 숫자가 아닙니다.');
  if (Number.isNaN(wobble)) out.push('평소 출렁임이 숫자가 아닙니다.');
  if (Number.isNaN(broken)) out.push('깨진 값이 숫자가 아닙니다.');
  if (!Number.isNaN(wobble) && wobble <= 0) out.push('평소 출렁임은 0보다 커야 합니다 — 전혀 안 움직이는 숫자는 없습니다.');

  if (!Number.isNaN(normal) && !Number.isNaN(broken) && !Number.isNaN(wobble) && wobble > 0) {
    const delta = Math.abs(normal - broken);
    if (delta === 0) {
      out.push('평소 값과 깨진 값이 같습니다 — 이러면 언제 깨진 건지 알 수가 없습니다.');
    } else if (delta <= wobble) {
      out.push(
        `깨진 값(${w.broken})이 평소 출렁임(${w.wobble}) 안에 있습니다. ` +
          '이대로 만들면 그냥 흔들린 것과 진짜 깨진 것을 구분할 수 없습니다 — ' +
          '깨진 값을 더 멀리 잡거나, 평소 출렁임을 다시 보세요.',
      );
    }
  }

  if (!(w.why || '').trim()) {
    out.push('왜 그 값이면 전제가 깨진 건지 한 줄 적어주세요 — 나중에 이 기준을 다시 볼 때 필요합니다.');
  }
  return out;
}

/** 세계에 묶는 줄. 임계는 반드시 근거와 함께 산다. */
export function watchToBinding(w: WatchSetup): SignalBinding {
  return {
    kind: (w.what || '').trim().slice(0, 200),
    target: (w.where || '').trim().slice(0, 200),
    threshold: `평소 ${w.normal} · ${w.broken} 이 되면 깨진 것 (평소 출렁임 ${w.wobble})`,
    threshold_rationale: (w.why || '').trim().slice(0, 1000),
    threshold_owner: 'user',
  };
}

/**
 * 사람의 답 → CUSUM 사전 믿음.
 *
 * 막힌 게 하나라도 있으면 **null 을 낸다.** 반쯤 맞는 사전 믿음을 만들어 주면
 * 판정이 나오고, 나온 판정은 사용자가 믿는다.
 */
export function watchToCusumPrior(w: WatchSetup): CusumPrior | null {
  if (watchBlocks(w).length > 0) return null;
  const normal = readNumber(w.normal);
  const wobble = readNumber(w.wobble);
  const broken = readNumber(w.broken);
  const delta = Math.abs(normal - broken);
  return {
    target: normal,
    slack: delta * SLACK_RATIO,
    decisionInterval: wobble * DECISION_SIGMA,
    rationale:
      `${w.why.trim()} — 평소 ${w.normal}, 평소 출렁임 ${w.wobble}, ${w.broken} 이면 깨진 것으로 봄. ` +
      `여유 k 는 이동폭의 ${SLACK_RATIO}배, 결정 구간 h 는 출렁임의 ${DECISION_SIGMA}배 (문헌 관례이지 이 데이터에서 나온 값이 아님).`,
  };
}

/**
 * 사람의 답 → 포트폴리오 사전 믿음 (Herbster-Warmuth fixed-share).
 *
 * **왜 둘 다 만드는가.** 탐지기 하나만 있으면 그것이 울렸을 때 전제의 처지가
 * `contested`(한쪽만 말함)에서 멈춘다. 두 번째 독립 판정이 있어야 `shaken`
 * (둘 다 말함)에 닿는다. 그리고 둘이 엇갈릴 때 그 엇갈림을 그대로 보여주는
 * 것이 이 설계의 핵심이다 — 하나의 초록/빨강으로 합치면 사용자는 자기 사전
 * 믿음이 결과를 얼마나 좌우했는지 볼 기회를 잃는다.
 *
 * 스케일은 **사용자의 답에서 나온다**: 손실의 분모를 δ(평소↔깨진 거리)로 두면
 * "깨진 만큼 벗어남 = 손실 1"이 된다. η·α 는 문헌 관례라 위 상수로 이름을
 * 붙여두고 근거 문장에 그대로 적는다.
 */
export function watchToPortfolioPrior(w: WatchSetup): PortfolioPrior | null {
  if (watchBlocks(w).length > 0) return null;
  const normal = readNumber(w.normal);
  const broken = readNumber(w.broken);
  const delta = Math.abs(normal - broken);
  return {
    learningRate: LEARNING_RATE,
    shareRate: SHARE_RATE,
    target: normal,
    scale: delta,
    rationale:
      `평소 ${w.normal} 을 holds 의 예측치로, 손실 분모는 평소↔깨진 거리(${delta}). ` +
      `학습률 ${LEARNING_RATE} · 공유율 ${SHARE_RATE} 는 문헌 관례이지 이 데이터에서 나온 값이 아님 ` +
      `(공유율이 0이면 한 번 밀린 가설이 되살아나지 못해 국면 전환을 못 따라간다).`,
  };
}

/**
 * 오늘 본 값 → 판독 1건.
 *
 * 못 봤으면 **추정하지 않는다.** value=null 이고 이유가 남는다. 미판독은
 * `holds` 가 아니다 — 그 구분이 이 제품의 전부다.
 */
export function readingFrom(
  w: WatchSetup,
  input: { value: string; unreadReason?: string; observedAt: string },
): SignalReading {
  const seen = (input.value || '').trim();
  if (!seen) {
    return {
      binding_kind: (w.what || '').trim().slice(0, 200),
      target: (w.where || '').trim().slice(0, 200),
      value: null,
      unread_reason: (input.unreadReason || '').trim().slice(0, 500) || '값을 적지 않았습니다.',
      verdict: 'unread',
      observed_at: input.observedAt,
    };
  }
  return {
    binding_kind: (w.what || '').trim().slice(0, 200),
    target: (w.where || '').trim().slice(0, 200),
    value: seen.slice(0, 200),
    // 판정은 여기서 하지 않는다 — 한 건만 보고 부르는 판정은 탐지기가 아니다.
    // 이 값이 임계를 넘었는지는 `assessPremise` 가 전체 계열을 보고 정한다.
    verdict: 'holds',
    observed_at: input.observedAt,
  };
}

/**
 * 지금 이 감시가 무엇을 할 수 있는지 사람 말로. **판독이 모자라면 모자란다고
 * 적는다** — 조용히 "이상 없음"으로 보이면 안 된다.
 */
export function watchStatus(readingCount: number): string {
  if (readingCount === 0) return '아직 본 값이 없습니다. 하나도 안 보면 이 전제는 지켜지지 않습니다.';
  if (readingCount < MIN_READINGS) {
    return `본 값이 ${readingCount}건입니다. ${MIN_READINGS}건은 있어야 판정을 시작합니다 — 지금은 "괜찮다"가 아니라 "아직 모른다"입니다.`;
  }
  return `본 값 ${readingCount}건으로 판정합니다.`;
}
