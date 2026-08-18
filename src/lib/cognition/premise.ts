import { allInsufficient, anyAlert, detectAll, toNumericSeries, type AdwinPrior, type CusumPrior, type DetectionResult } from './detect';
import { disagreement, runPortfolio, type PortfolioPrior, type PortfolioResult } from './portfolio';
import type { CognitiveFrame, SignalBinding, SignalReading } from './types';
import { normalizePremiseText } from '../premises-core';

/**
 * 지속하는 전제 — **기록을 시스템으로 만드는 조각.**
 *
 * ── 왜 이것이 근본적인가 ─────────────────────────────────────────────
 *
 * 1층에서 전제는 프레임의 소유물이었다. 그러면 프레임 3에서 쓴 "전환율이
 * 유지된다"와 프레임 7에서 쓴 같은 전제가 **서로 다른 객체**다. 결과:
 *
 *   · 전제가 무너져도 그것을 참조한 다른 판단들이 깨어나지 않는다
 *   · M2(부패 전제 위 결정률)가 **원리적으로 계산 불가**다 — 같은 전제인지
 *     알 수 없으니 "이미 반증된 전제를 참조한 결정"을 셀 수가 없다
 *   · 인지 '체계'가 아니라 인지 '기록'에 머문다
 *
 * 그래서 전제는 프레임 밖에 산다. 프레임은 전제를 **참조**하고, 전제는 자기
 * 판독 원장과 탐지 결과를 갖는다. 전제 하나가 흔들리면 그것을 참조하는
 * **모든 살아있는 판단이 동시에 깨어난다.** 그것이 브리프 §4 B가 말한
 * *"당신의 전제 중 하나가 방금 흔들렸습니다"* 의 실제 구조다.
 *
 * ── 판정의 세 겹, 그리고 셋을 합치지 않는 이유 ───────────────────────
 *
 *   탐지기(CUSUM·적응창)   임계를 넘었나 — 사전 믿음에 의존
 *   포트폴리오(fixed-share) 어느 가설이 앞서나 — 임계 없이, 후회 유계
 *   사람                    이 신호가 이 전제에 대한 증거인가 — 위임 불가
 *
 * 셋을 하나의 초록/빨강으로 합치면 사용자는 **자기 사전 믿음이 결과를 얼마나
 * 좌우했는지** 볼 기회를 잃는다. 그래서 엇갈림을 감추지 않고 그대로 낸다.
 *
 * ── 이미 있는 것과의 관계 (능력 중복 검사 통과 기록) ─────────────────
 *
 * 전제 모델의 정본은 `src/lib/premises-core.ts` 다 (결정 단위 5개 캡, 재점검
 * 주기, due 계산). **그대로 쓰지 않은 이유는 하나뿐이다**: 거기 `premiseId()`
 * 는 `decisionId` 를 키에 넣는다 — 같은 문장도 결정이 다르면 다른 전제다.
 * 그래서 M2·M3(프레임을 건너뛴 재사용·생존)이 원리적으로 셀 수 없었다.
 * 라이브 데이터가 그 id 체계에 묶여 있어 바꾸면 저장된 전제가 전부 고아가 된다.
 *
 * **대신 "같은 전제인가"의 판정은 빌려온다** — `normalizePremiseText()`.
 * 그 함수의 주석이 이미 *"groupable by normalized text"* 라고 적어둔,
 * 원래 의도된 다리다. 두 모델이 동일성 판정에서 갈라지면 한쪽이 조용히 틀린다.
 * append-only 원장(`argus-mcp/src/v2/ledger.ts`, `method-harness/ledger.ts`)은
 * 각각 MIT 존·Track R 존 소유라 존 순수성상 import 할 수 없다 — 여기 판독
 * 원장은 앱 존 Supabase 행이고, 불변성은 seal 후 UPDATE 금지 트리거가 건다.
 */

export type PremiseStance =
  /** 아직 판정할 만큼 보지 못했다. **`holds` 와 다른 사실이다.** */
  | 'unread'
  /** 신호가 임계 안에 있고 포트폴리오도 holds 를 앞세운다. */
  | 'holds'
  /** 탐지기와 포트폴리오가 엇갈린다 — 감추지 않고 이름을 준다. */
  | 'contested'
  /** 둘 다 흔들렸다고 말한다. */
  | 'shaken';

/**
 * 두 전제가 같은 전제인가 — 동일성의 **단일 정본**.
 * `premises-core` 의 정규화를 그대로 쓴다. 여기서 자체 규칙을 만들면 결정
 * 단위 모델과 지속 모델이 서로 다른 답을 내고, 그 순간 M2 는 조용히 틀린다.
 */
export function premiseIdentityKey(text: string): string {
  return normalizePremiseText(text || '');
}

/** 같은 전제를 가리키는가 (프레임·결정 경계를 건너뛰어). */
export function isSamePremiseText(a: string, b: string): boolean {
  return premiseIdentityKey(a) === premiseIdentityKey(b);
}

export interface DurablePremise {
  id: string;
  user_id: string | null;
  /** 전제 문장. 봉인 후 불변 — 바뀌면 새 전제이고 `supersedes` 로 잇는다. */
  text: string;
  /** 이 전제를 세계에 결박한 신호들. 임계는 근거와 함께만 존재한다. */
  bindings: SignalBinding[];
  /** 탐지 모수 — 사용자 소유 사전 믿음. */
  cusum_prior: CusumPrior | null;
  adwin_prior: AdwinPrior | null;
  portfolio_prior: PortfolioPrior | null;
  /** append-only 판독 원장. unread 도 남는다. */
  readings: SignalReading[];
  /** 이 전제를 참조하는 프레임 id들. */
  referenced_by: string[];
  supersedes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PremiseAssessment {
  premise_id: string;
  stance: PremiseStance;
  detections: DetectionResult[];
  portfolio: PortfolioResult | null;
  /** 탐지기와 포트폴리오가 엇갈릴 때의 한 줄 (일치하면 null). */
  disagreement: string | null;
  /** 사람이 읽을 요약. 사실 진술이며 조치를 지시하지 않는다. */
  statement: string;
  /** 경보 시 변화 추정 시각 (ISO) — M3 갱신 지연의 시작점. */
  alerted_at: string | null;
}

const nowIso = (now: number): string => new Date(now).toISOString();

export function makePremise(input: {
  id: string;
  userId: string | null;
  text: string;
  bindings?: SignalBinding[];
  cusumPrior?: CusumPrior | null;
  adwinPrior?: AdwinPrior | null;
  portfolioPrior?: PortfolioPrior | null;
  now: number;
}): DurablePremise {
  const at = nowIso(input.now);
  return {
    id: input.id,
    user_id: input.userId,
    text: (input.text || '').slice(0, 2000),
    bindings: (input.bindings ?? []).slice(),
    cusum_prior: input.cusumPrior ?? null,
    adwin_prior: input.adwinPrior ?? null,
    portfolio_prior: input.portfolioPrior ?? null,
    readings: [],
    referenced_by: [],
    supersedes: null,
    created_at: at,
    updated_at: at,
  };
}

/** 판독을 append 한다. 원장은 절대 덮어쓰지 않는다 (P1). */
export function appendReading(p: DurablePremise, r: SignalReading, now: number): DurablePremise {
  return { ...p, readings: [...p.readings, r], updated_at: nowIso(now) };
}

export function referenceFrom(p: DurablePremise, frameId: string, now: number): DurablePremise {
  if (p.referenced_by.includes(frameId)) return p;
  return { ...p, referenced_by: [...p.referenced_by, frameId], updated_at: nowIso(now) };
}

/**
 * 전제의 현재 처지를 판정한다.
 *
 * 임계가 없으면(사전 믿음을 아직 안 정했으면) **판정하지 않는다** — 기본
 * 임계를 몰래 끼워넣는 것이 이 설계가 가장 경계하는 일이다 (임계는 기계화
 * 불가능한 선택이고, 기계가 정하면 그 순간 이 도구가 거짓말이 된다).
 */
export function assessPremise(p: DurablePremise): PremiseAssessment {
  const hasPrior = !!(p.cusum_prior || p.adwin_prior);
  const series = toNumericSeries(p.readings);

  const detections = hasPrior
    ? detectAll(p.readings, { cusum: p.cusum_prior ?? undefined, adwin: p.adwin_prior ?? undefined })
    : [];
  const portfolio = p.portfolio_prior ? runPortfolio(series, p.portfolio_prior) : null;

  const alerted = anyAlert(detections);
  const insufficient = detections.length > 0 ? allInsufficient(detections) : series.values.length === 0;
  const portfolioMoved = portfolio ? portfolio.leader !== 'holds' : false;
  const dis = portfolio ? disagreement(alerted, portfolio) : null;

  let stance: PremiseStance;
  if (!hasPrior && !portfolio) {
    stance = 'unread';
  } else if (insufficient) {
    stance = 'unread';
  } else if (alerted && portfolioMoved) {
    stance = 'shaken';
  } else if (alerted || portfolioMoved) {
    stance = 'contested';
  } else {
    stance = 'holds';
  }

  const alertedDetection = detections.find((d) => d.verdict === 'alert');
  const alerted_at = alertedDetection?.evidence.change_at_ref
    ? // 참조는 `target@ISO` 형태이므로 @ 뒤가 시각이다.
      (alertedDetection.evidence.change_at_ref.split('@')[1] ?? null)
    : null;

  const parts: string[] = [];
  if (!hasPrior && !portfolio) {
    parts.push('이 전제에는 아직 임계가 없습니다 — 임계는 기계가 정할 수 없으므로 판정하지 않습니다.');
  } else if (stance === 'unread') {
    parts.push(`판독이 아직 모자랍니다 (수치 ${series.values.length}건 · 미판독 ${series.excluded_unread}건). "괜찮다"가 아니라 "아직 모른다"입니다.`);
  }
  for (const d of detections) parts.push(`[${d.method}] ${d.statement}`);
  if (portfolio) parts.push(`[포트폴리오] ${portfolio.statement}`);
  if (dis) parts.push(`[엇갈림] ${dis}`);

  return {
    premise_id: p.id,
    stance,
    detections,
    portfolio,
    disagreement: dis,
    statement: parts.join(' '),
    alerted_at,
  };
}

/**
 * 귀환 트리거 — 전제가 흔들렸을 때 **어느 판단들이 깨어나야 하나.**
 *
 * 이것이 1층에는 없던 것이다. 전제가 프레임의 소유물이면 이 함수를 쓸 수
 * 없다 — 같은 전제를 참조하는 다른 판단이 무엇인지 알 수 없기 때문이다.
 */
export interface ReturnTrigger {
  premise_id: string;
  premise_text: string;
  stance: PremiseStance;
  /** 깨어나야 하는 프레임들 — 봉인됐고 아직 정산되지 않은 것만. */
  wake_frame_ids: string[];
  /** 이미 정산된 프레임은 깨우지 않는다. 그 사실도 남긴다. */
  already_settled_ids: string[];
  reason: string;
  alerted_at: string | null;
}

export function returnTriggers(
  premises: readonly DurablePremise[],
  frames: readonly CognitiveFrame[],
): ReturnTrigger[] {
  const byId = new Map(frames.map((f) => [f.id, f]));
  const out: ReturnTrigger[] = [];

  for (const p of premises ?? []) {
    const a = assessPremise(p);
    if (a.stance !== 'shaken' && a.stance !== 'contested') continue;

    const wake: string[] = [];
    const settled: string[] = [];
    for (const fid of p.referenced_by) {
      const f = byId.get(fid);
      if (!f) continue;
      if (f.status === 'settled') settled.push(fid);
      else if (f.status === 'sealed') wake.push(fid);
    }
    if (wake.length === 0 && settled.length === 0) continue;

    out.push({
      premise_id: p.id,
      premise_text: p.text,
      stance: a.stance,
      wake_frame_ids: wake,
      already_settled_ids: settled,
      reason: a.statement,
      alerted_at: a.alerted_at,
    });
  }
  return out;
}

/**
 * M2 — 부패 전제 위 결정률.
 *
 * 정의: 봉인 시각이 **전제의 경보 시각보다 나중인** 프레임의 비율. 즉
 * "이미 관찰 가능하게 흔들린 전제를 참조한 채 내려진 결정".
 *
 * 이 계산이 성립하려면 (a) 전제에 지속 정체성이 있어야 하고 (b) 경보에
 * 시각이 있어야 한다. 1층에는 둘 다 없었으므로 E-0에서 "측정조차 못 함"
 * 이었다. 지금은 정의가 코드다.
 */
export interface M2Reading {
  state: 'measured' | 'no_denominator';
  /** 경보 이후에 봉인된 프레임 수. */
  numerator: number;
  /** 경보가 있는 전제를 참조한 봉인 프레임 전체. */
  denominator: number;
  ratio: number | null;
  /** 근거 — 어느 프레임이 어느 전제 때문에 세어졌나. */
  cases: Array<{ frame_id: string; premise_id: string; sealed_at: string; alerted_at: string }>;
  statement: string;
}

export function measureM2(premises: readonly DurablePremise[], frames: readonly CognitiveFrame[]): M2Reading {
  const byId = new Map(frames.map((f) => [f.id, f]));
  const cases: M2Reading['cases'] = [];
  let denominator = 0;

  for (const p of premises ?? []) {
    const a = assessPremise(p);
    if (!a.alerted_at) continue;
    for (const fid of p.referenced_by) {
      const f = byId.get(fid);
      if (!f || !f.sealed_at) continue;
      denominator += 1;
      // 봉인이 경보보다 나중 = 흔들린 걸 알 수 있었는데도 그 위에 결정했다.
      if (Date.parse(f.sealed_at) > Date.parse(a.alerted_at)) {
        cases.push({ frame_id: fid, premise_id: p.id, sealed_at: f.sealed_at, alerted_at: a.alerted_at });
      }
    }
  }

  if (denominator === 0) {
    return {
      state: 'no_denominator',
      numerator: 0,
      denominator: 0,
      ratio: null,
      cases: [],
      statement:
        '경보가 있는 전제를 참조한 봉인 판단이 아직 없습니다 — 분모가 0이므로 비율을 내지 않습니다 (0%로 적으면 "괜찮다"로 읽힙니다).',
    };
  }

  const ratio = Math.round((cases.length / denominator) * 10_000) / 10_000;
  return {
    state: 'measured',
    numerator: cases.length,
    denominator,
    ratio,
    cases,
    statement: `경보가 있는 전제를 참조한 봉인 판단 ${denominator}건 중 ${cases.length}건이 경보 이후에 봉인됐습니다 (${Math.round(ratio * 100)}%).`,
  };
}

/**
 * M3 — 갱신 지연.
 *
 * 정의: 전제의 경보 시각 → 그 전제를 참조한 프레임이 실제로 정산된 시각.
 * 아직 정산되지 않았으면 **`pending` 으로 남긴다** — 0이나 무한으로 적으면
 * 둘 다 거짓이다.
 */
export interface M3Reading {
  /** 정산까지 간 사례들의 지연 (밀리초). */
  resolved_delays_ms: number[];
  /** 아직 열려 있는 사례들 — 시계가 돌고 있다. */
  pending: Array<{ frame_id: string; premise_id: string; alerted_at: string }>;
  median_delay_ms: number | null;
  statement: string;
}

export function measureM3(premises: readonly DurablePremise[], frames: readonly CognitiveFrame[]): M3Reading {
  const byId = new Map(frames.map((f) => [f.id, f]));
  const delays: number[] = [];
  const pending: M3Reading['pending'] = [];

  for (const p of premises ?? []) {
    const a = assessPremise(p);
    if (!a.alerted_at) continue;
    const alertMs = Date.parse(a.alerted_at);
    if (Number.isNaN(alertMs)) continue;

    for (const fid of p.referenced_by) {
      const f = byId.get(fid);
      if (!f) continue;
      const settledAt = f.settlement?.observed_at;
      if (settledAt && !Number.isNaN(Date.parse(settledAt))) {
        const d = Date.parse(settledAt) - alertMs;
        // 경보보다 먼저 정산된 것은 이 지표의 사례가 아니다 (지연이 음수).
        if (d >= 0) delays.push(d);
      } else if (f.status === 'sealed') {
        pending.push({ frame_id: fid, premise_id: p.id, alerted_at: a.alerted_at });
      }
    }
  }

  const sorted = [...delays].sort((a, b) => a - b);
  const median = sorted.length === 0 ? null : sorted[Math.floor(sorted.length / 2)];

  const parts: string[] = [];
  if (delays.length === 0 && pending.length === 0) {
    parts.push('경보 후 귀환 사례가 아직 없습니다 — 측정할 지연이 없습니다.');
  } else {
    if (delays.length > 0) {
      parts.push(`경보 후 정산까지 간 사례 ${delays.length}건, 중위 지연 ${Math.round((median ?? 0) / 3_600_000)}시간.`);
    }
    if (pending.length > 0) {
      parts.push(`아직 열려 있는 사례 ${pending.length}건 — 시계가 돌고 있고, 0으로 적지 않습니다.`);
    }
  }

  return { resolved_delays_ms: delays, pending, median_delay_ms: median, statement: parts.join(' ') };
}
