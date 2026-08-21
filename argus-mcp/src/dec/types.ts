/**
 * 결정 장부의 타입 — 판정 10(B+) 의 몸통.
 *
 * **원장이 진실이고, `decisions/*.md` 는 거기서 만들어지는 사람용 표면이다.**
 * 그래서 이 파일의 타입은 둘로 갈린다:
 *  - `DecEvent*`  — 원장에 **쌓이는** 것 (추가만 된다, 절대 안 고쳐진다)
 *  - `DecisionRecord` — 그 사건들을 접어서 나온 **현재 상태** (파일이 이걸 그린다)
 *
 * 낱말은 전부 기획서 §12 낱말 상자에서 왔다. 새로 만든 것 없음.
 */

/** 결정의 종류 (기획서 §12). `pred` 는 정의가 §11-5 규제 판정과 함께 확정될
 *  때까지 **서명을 받지 않는다** — 열거에만 있고 정의가 없던 v4 의 구멍이다. */
export type DecisionType = 'pin' | 'ban' | 'open' | 'pred';

/** 사람 없는 시간의 충돌 처분 — 서명 시점에 사람이 정한다 (대리가 아니라 사전 확장). */
export type Unattended = 'park' | 'log' | 'deny';

/** 3채널 컴파일이 되나. 안 되면 정직하게 "기계는 못 잡는다"고 파일에 적는다. */
export type WatchMode = 'machine' | 'inject_only';

export type DecisionStatus = 'active' | 'repealed' | 'paused';

/** 서명 — 결정이 법이 되는 단 하나의 순간. */
export interface DecSignedPayload {
  type: DecisionType;
  /** 사용자가 쓴 문장 그대로. */
  decision: string;
  /** 어디에 걸리나. 값 집합은 아직 안 정했다 (U1 — 규칙 파일 읽기를 짓는 날). */
  scope: string;
  /** 누구를 구속하나. */
  binds: string;
  /** 서명자 — 누가 한 타를 쳤나. */
  author: string;
  /** 발원자 — 문장이 어디서 나왔나. 서명자와 다를 수 있고, 다르면 파일이 그렇게 적는다. */
  provenance: 'user' | 'ai_surfaced';
  /** YYYY-MM-DD. */
  adopted: string;
  unattended: Unattended;
  watch: WatchMode;
  /** 달력 재확인 (YYYY-MM-DD). `review_on_event` 와 **적어도 하나**는 있어야 한다. */
  review?: string;
  /** 사건 재확인. 주입-전용 법은 이것을 고를 수 없다 (불변식 ⑤). */
  review_on_event?: string;
  /** 왜 이렇게 정했나 — 사용자가 쓴 것. */
  because?: string;
  /** 발원 장면 — 그때 실제로 한 말. 바이트로 대조된 것만 들어온다. */
  quote?: string;
  quote_at?: string;
  check?: string;
  falsified_if?: string;
  /** 열람용 필드 — 저장하되 주입·공개에서 기본 제외된다 (§12). */
  source?: string;
  source_origin?: string;
}

/** 개정 — 법을 바꾼다. 지우지 않고 위에 쌓는다 (불변식 ③). */
export interface DecAmendedPayload {
  decision?: string;
  scope?: string;
  binds?: string;
  review?: string;
  review_on_event?: string;
  unattended?: Unattended;
  watch?: WatchMode;
  because?: string;
  /** 왜 바꾸나 — 필수. 이유 없는 개정은 조용한 표류와 구분이 안 된다. */
  why: string;
  /** 사람이 파일을 고쳐서 시작된 개정인가 (판정 10 의 회수 경로). */
  from_hand_edit?: boolean;
}

/** 폐지 — 더는 법이 아니다. 기록은 남는다 (묘비 아님 — 원문 그대로 산다). */
export interface DecRepealedPayload {
  why: string;
  /** 이 결정을 이어받은 결정이 있으면. */
  succeeded_by?: string;
}

export type DecPayload = DecSignedPayload | DecAmendedPayload | DecRepealedPayload;

/** 한 건의 개정 이력 — 파일이 이걸 시간순으로 보여준다. */
export interface Amendment {
  at: string;
  why: string;
  from_hand_edit: boolean;
  changed: Array<{ field: string; from: string; to: string }>;
}

/** 사건들을 접어서 나온 현재 상태. 파일은 **이것만** 보고 그려진다. */
export interface DecisionRecord {
  id: string;
  type: DecisionType;
  decision: string;
  scope: string;
  binds: string;
  author: string;
  provenance: 'user' | 'ai_surfaced';
  adopted: string;
  unattended: Unattended;
  watch: WatchMode;
  status: DecisionStatus;
  review?: string;
  review_on_event?: string;
  because?: string;
  quote?: string;
  quote_at?: string;
  check?: string;
  falsified_if?: string;
  source?: string;
  source_origin?: string;
  amendments: Amendment[];
  repealed_at?: string;
  repealed_why?: string;
  succeeded_by?: string;
}
