import type { JudgmentAttribution } from '@/stores/types';
import type { AxisId } from './axes';

/**
 * 인지 구조 기록의 타입 — "두 세계"가 여기서 일급 시민이 된다.
 *
 * ── 두 세계 (창업자 지시, 2026-08-17) ────────────────────────────────
 *
 * 판단의 각 원소는 두 세계 중 하나에 산다.
 *
 *   in_frame        프레임 안. 정합성으로만 검증됐다 — 대화, 모델의 동의,
 *                   그럴듯함. 편안하고 빠르고 **틀릴 수 있다.**
 *   reality_contact 프레임 밖. 내 믿음에 무관심한 무언가가 검증했다 —
 *                   외부 신호, 정산, 커밋된 숫자.
 *
 * 이 구분이 필요한 이유는 CLAUDE.md가 이미 적어둔 불변식이다: *"프레임 안에서
 * 모델과 토론해 검증되는 결론은 없다 — 검증은 단발의 커밋과 정산 시점의
 * 현실뿐이다."* 그런데 그 불변식이 지금까지 **데이터에 없었다.** 산문으로만
 * 있으면 화면은 두 세계를 같은 색으로 그린다.
 *
 * 그래서: 세계는 자기선언으로 건널 수 없다. `reality_contact` 로 올리려면
 * `crossing` 증거가 필요하다 (신호 판독 / 정산 / 외부 산출물). 증거 없는
 * 승격은 엔진이 거부한다. **이것이 이 설계의 Neo 기제다** — 어느 세계에
 * 서 있는지 항상 알 수 있고, 건널 때는 값을 치른다.
 *
 * 주의: `in_frame` 은 열등한 상태가 아니다. 대부분의 사고는 거기서 일어나고
 * 일어나야 한다. 판정하지 않는다 — **위치를 표시할 뿐이다.**
 */
export type ElementWorld = 'in_frame' | 'reality_contact';

/** 세계를 건넌 증거. 자기선언은 증거가 아니다. */
export type CrossingKind =
  /** 외부 신호를 판독했다 (환율 API, 레지스트리 버전, 테이블 행수 …). */
  | 'signal_reading'
  /** 정산했다 — 예측이 현실과 대조됐다. */
  | 'settlement'
  /** 외부 산출물이 존재한다 (커밋, 배포, 발행, 계약 …). */
  | 'external_artifact';

export interface Crossing {
  kind: CrossingKind;
  /** 증거의 식별자. 기계가 되짚을 수 있어야 한다 (URL, 커밋 sha, 원장 행 id …). */
  evidence_ref: string;
  /** 판독/정산 시각 (ISO). 빈티지이므로 사후 수정 금지. */
  observed_at: string;
  /** 무엇이 관찰됐나. 짧은 사실 문장 — 해석은 넣지 않는다. */
  observed: string;
  /**
   * 증거가 철회된 시각 (ISO). 있으면 이 건넘은 세계 판정에서 빠진다.
   *
   * **왜 철회가 필요한가.** 현실 접촉은 한 방향 승격이 아니다. 신호를 잘못
   * 읽었을 수도, 판독한 지표가 그 전제의 증거가 아니었을 수도 있다. 철회가
   * 없으면 한 번 잘못 올라간 원소가 영구히 "현실에 닿음"으로 남고, 그것이
   * 이 설계가 막으려는 거짓 안심 그 자체가 된다.
   *
   * 그리고 이것이 창업자가 말한 **넘나듦**이다 — 프레임 안으로 되돌아올 수
   * 있어야 두 세계를 자유롭게 오가는 것이지, 한 번 나가면 못 돌아오는 것은
   * 그냥 다른 감옥이다.
   *
   * 철회해도 **행은 지우지 않는다** (P1 빈티지 보존). 그때 그렇게 믿었다는
   * 사실도 기록이다.
   */
  retracted_at?: string;
  /** 철회 사유. 비어 있는 철회는 철회가 아니다 (사후 조작과 구분되지 않는다). */
  retraction_reason?: string;
}

/**
 * 문장의 저자성. 기존 `judgment-authorship.ts` 의 세 갈래를 그대로 쓰되
 * **깊이**를 하나 더 얹는다.
 *
 * 왜 깊이가 필요한가 (E-0 실측의 발견 2): 창업자가 실명으로 올린 공개 댓글은
 * AI 초안이었지만 7라운드 거부·수정을 거쳤다. 반면 전제 22건은 **편집이 0**
 * 이었다. 노출이 큰 자리에서는 사람이 이미 싸우고, 위험한 곳은 **작아 보여서
 * 안 싸우는 자리**다. `user_reworded` 라는 한 값으로는 이 둘이 구분되지 않는다.
 */
export interface Authorship {
  /** 레거시 호환 비트 — 기존 술어와 같은 어휘. */
  authored: 'user' | 'ai_surfaced';
  /**
   * **정본 타입을 그대로 재사용한다** (`JudgmentAttribution`). 여기서 좁히면
   * (`'imported'`·`'legacy_unknown'` 을 빼면) 두 타입이 갈라지고, 갈라진 순간
   * 문서 임포트로 들어온 문장의 저자성이 이 엔진에서 조용히 사라진다.
   */
  wording_source: JudgmentAttribution['wording_source'];
  /**
   * AI 초안에서 최종 문장까지의 정규화 거리 (0~1).
   * 0 = 글자까지 같음, 1 = 완전히 다른 문장. 초안이 없으면 1.
   */
  revision_distance: number;
  /** 사용자가 이 칸을 고친 횟수 (알 수 없으면 0). */
  revision_rounds: number;
  recorded_at: string;
}

/** 이해 재진술의 상태. **사람에 대한 판정이 아니라 기록의 상태다.** */
export type ComprehensionState =
  /** 사용자가 자기 어휘로 다시 말했다. */
  | 'own_words'
  /** 다시 말했지만 AI 문장의 어휘를 그대로 되풀이했다. */
  | 'echo'
  /** 아직 다시 말하지 않았다. */
  | 'absent'
  /** 이 원소는 게이트 대상이 아니다 (사람이 처음부터 직접 썼거나 하중 축이 아님). */
  | 'not_required';

export interface Comprehension {
  state: ComprehensionState;
  /** 사용자의 재진술 원문 (없으면 빈 문자열). */
  restatement: string;
  /** AI 문장과 재진술의 내용어 겹침 비율 (0~1). 판정 근거를 숨기지 않는다. */
  overlap: number;
  /** 이 상태를 낸 임계값. 사전 믿음이므로 노출한다 (P6). */
  echo_threshold: number;
}

/** 전제를 외부 신호에 결박한 것. B 실험의 `premises.json` 을 타입으로 승격. */
export interface SignalBinding {
  /** 신호 종류 — 판독 방법을 아는 이름. */
  kind: string;
  /** 판독 대상 (URL, 테이블명, 지표명 …). */
  target: string;
  /**
   * 경보 임계. **검증 불가능한 사전 믿음이므로 반드시 근거와 함께 산다**
   * (문헌 상충 1: 모든 탐지기의 임계는 데이터에서 도출되지 않는다).
   */
  threshold: string;
  threshold_rationale: string;
  /** 임계를 정한 사람. 기계가 정하면 그 순간 이 설계가 거짓말이 된다. */
  threshold_owner: 'user';
}

/** 신호 판독 1회. append-only. */
export interface SignalReading {
  binding_kind: string;
  target: string;
  /** 판독값. 읽을 수 없었으면 null — **추정하지 않는다** (P5). */
  value: string | null;
  /** 읽을 수 없었던 이유. value 가 null 일 때만 채운다. */
  unread_reason?: string;
  verdict: 'holds' | 'alert' | 'unread';
  observed_at: string;
}

/**
 * 한 축에 담긴 하나의 원소.
 *
 * `text` 는 봉인 후 **불변**이다 (P1 빈티지 보존, Croushore-Stark). 생각이
 * 바뀌면 새 원소를 추가하고 `supersedes` 로 잇는다 — 덮어쓰지 않는다.
 * 사후확신은 경고로 줄지 않으므로(Fischhoff 1977) 구조로 막는다.
 */
export interface FrameElement {
  id: string;
  axis: AxisId;
  text: string;
  authorship: Authorship;
  world: ElementWorld;
  /** 세계를 건넌 증거들. append-only. */
  crossings: Crossing[];
  comprehension: Comprehension;
  /** 전제 축에서만 의미 있다. 다른 축은 빈 배열. */
  bindings: SignalBinding[];
  /** 이 원소가 대체하는 이전 원소 id (없으면 null). 덮어쓰기 대신 잇는다. */
  supersedes: string | null;
  created_at: string;
}

/** 봉인된 확신도 — 채점 대상이 되려면 해결 가능해야 한다. */
export interface SealedConfidence {
  /** 0~100. */
  value: number;
  /** 이 확신도가 붙는 대상 문장 (보통 falsifier 축의 원소). */
  about_element_id: string;
  /**
   * 제3자가 추가 해석 없이 판정할 수 있는가. false 면 **채점에서 제외된다**
   * (M6 의 정의 그대로). 판정 불가능한 문장에 Brier 점수를 매기는 것은 숫자
   * 놀이다.
   */
  resolvable: boolean;
  resolvable_reason: string;
}

export type FrameStatus =
  /** 조립 중. 아직 잠기지 않았다. */
  | 'drafting'
  /** 필수 축은 찼으나 이해 게이트가 남았다. */
  | 'comprehension_pending'
  /** 봉인됨 — 원소 text 불변, falsifier 고정. */
  | 'sealed'
  /** 정산됨 — 현실과 대조가 끝났다. */
  | 'settled';

export interface Settlement {
  /** 봉인된 falsifier 가 실제로 관찰됐나. */
  falsifier_observed: boolean;
  /** 무엇이 관찰됐는지 — 사실만. */
  observed: string;
  evidence_ref: string;
  observed_at: string;
  /**
   * 정산 시점의 회고. **당시 원문과 나란히만 표시된다** — 이것이 회고를
   * 원문 위에 덮지 못하게 하는 유일한 방법이다 (M1 실측: 방향은 보존되지만
   * 저자성 프레임이 소급됐다).
   */
  retrospective: string;
}

export interface CognitiveFrame {
  id: string;
  /** 사용자 소유. 다른 사용자에게 절대 보이지 않는다 (RLS). */
  user_id: string | null;
  /** 사용자가 이 판단을 부르는 이름. */
  title: string;
  status: FrameStatus;
  elements: FrameElement[];
  confidence: SealedConfidence | null;
  settlement: Settlement | null;
  /** 신호 판독 원장. append-only. */
  readings: SignalReading[];
  sealed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** 봉인 시도의 결과. 거부는 조용히 성공한 척하지 않는다 (P5). */
export type SealResult =
  | { ok: true; frame: CognitiveFrame }
  | {
      ok: false;
      /** 왜 막혔나 — 기계 가독 사유. */
      blocked_by: SealBlock[];
      /** 사용자에게 보이는 한 줄들. 판정 어휘가 아니라 결핍의 이름. */
      messages: string[];
    };

export type SealBlock =
  | { kind: 'axis_empty'; axis: AxisId }
  | { kind: 'comprehension_pending'; element_id: string; axis: AxisId }
  | { kind: 'authority_violation'; element_id: string; axis: AxisId; detail: string }
  | { kind: 'crossing_without_evidence'; element_id: string }
  | { kind: 'binding_without_rationale'; element_id: string; binding_kind: string };
