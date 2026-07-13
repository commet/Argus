/**
 * 연결 읽기 (정본 §8-§11) — 정산 때 전제가 깨지면 "같은 전제/근거 위에 선 다른
 * 열린 결정"을 찾는다. 순수 읽기: 원장 상태(LedgerState)만 소비하고, 임베딩·
 * 의미유사도·추론을 쓰지 않는다. 두 종류의 기계식 연결만 (둘 다 고정밀):
 *
 *   1. same_premise — 사용자 자신의 전제 텍스트가 정규화 후 '같은 문장'.
 *   2. shared_fact  — 표면 문장은 달라도 같은 구체 근거(URL·ISO 날짜)를 가리킴
 *      (§9 1층: "같은 현실을 가리키는 연결"). 맨숫자·금액은 '같은 200 다른 대상'
 *      (§10-4)의 오연결 함정이라 **의도적으로 제외** — 그건 관계 검증이 필요한
 *      상위 층(P3)이고, 여기서는 위조 불가능한 신호(정확한 URL·날짜)만 쓴다.
 *
 * 포착이 경계를 stable-id load_bearing 전제로 이미 남기므로(seal.ts), 연결은 그
 * 전제 축을 읽기만 하면 되고 재가공이 없다.
 *
 * 스파인: 평결 없음. 반환은 사실(어느 열린 결정이 같은 전제·근거에 기대나)과
 * 손잡이(그 결정 id)뿐 — "다시 보라"는 지시도, tilt도 아니다. 호출자(정산 표면)는
 * 이것을 중립 문장 + 재확인 손잡이로만 노출한다.
 */
import type { LedgerState } from './reducer.js';

export type ConnectionReason = 'same_premise' | 'shared_fact';

export interface RelatedDecision {
  /** 같은 전제/근거에 기댄, 아직 열린(봉인·미정산) 다른 결정. */
  decision_id: string;
  /** 그 결정 쪽 전제의 id(그 결정 축에 스코프됨 — 방금 깨진 전제와는 다른 id). */
  premise_id: string;
  /** 그 결정 쪽 전제의 원문 (렌더 시 sanitize는 표면의 몫, 규칙 19). */
  premise_text: string;
  /** 왜 이어졌나 — 같은 문장(same_premise) vs 같은 구체 근거(shared_fact). */
  reason: ConnectionReason;
  /** shared_fact일 때 공유된 근거 토큰(`url:…` 또는 `date:…`). */
  via?: string;
}

/** 하위호환 별칭 — same_premise만의 뷰(순수 매칭 단위 테스트가 쓰는 형태). */
export interface SharedPremiseLink {
  decision_id: string;
  premise_id: string;
  premise_text: string;
}

/**
 * 전제 텍스트 정규화 — '같은 문장' 판정용. 공백 접기 + 소문자 + 양끝 따옴표·구두점
 * 제거. 의미 유사도가 아니라 표면적으로 같은 말만 (고정밀·오연결 0 목표). 두
 * 결정이 같은 가정을 각각 봉인했을 때 premise_id는 결정별로 다르므로(seal이 결정
 * id를 해시에 섞는다), 매칭은 반드시 텍스트로 한다.
 */
export function normalizePremiseText(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^[\s"'`.,;:!?()[\]{}]+|[\s"'`.,;:!?()[\]{}]+$/g, '')
    .trim();
}

/**
 * 전제 문장에서 위조 불가능한 구체 근거 토큰만 뽑는다 (§9 1층·§10 단계1). 고정밀
 * 신호만: URL(스킴·호스트 소문자, fragment·끝슬래시 제거)과 ISO 날짜(YYYY-MM-DD,
 * 모호함 없음). **맨숫자·금액·상대월("12월")은 뽑지 않는다** — 같은 값이 다른
 * 대상을 가리키는 오연결(§10-4)이 흔해, 관계 검증(P3) 없이는 신뢰할 수 없다.
 * 토큰은 타입 접두사(`url:`/`date:`)로 교차타입 충돌을 막는다.
 */
export function extractTargets(text: string): string[] {
  const t = text.toLowerCase();
  const out = new Set<string>();
  for (const m of t.matchAll(/https?:\/\/[^\s"'`<>)\]]+/g)) {
    const u = m[0]
      .replace(/[.,;:!?)\]}]+$/, '') // 문장 끝 구두점 제거
      .replace(/#.*$/, '') // fragment 제거
      .replace(/\/+$/, ''); // 끝 슬래시 정규화
    if (u.length > 'https://'.length) out.add(`url:${u}`);
  }
  for (const m of t.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g)) out.add(`date:${m[0]}`);
  return [...out];
}

/**
 * 방금 정산된 결정에서 깨진 전제와 '같은 전제 또는 같은 근거'에 기댄 다른 열린
 * 결정들. 규칙:
 *  - 자기 자신(settlingDecisionId)은 제외.
 *  - resolved 전제·kind!=='premise'(fact/question)는 제외 — 살아있는 가정만.
 *  - 상대 결정이 'sealed'(열림)일 때만 — settled/dismissed/harvested는 제외
 *    (닫힌 결정을 되살리지 않는다, 스파인).
 *  - 결정 단위로 1행. 한 결정이 두 방식으로 걸리면 same_premise를 우선(더 강한 연결).
 *  - shared_fact는 깨진 전제에 근거 토큰이 실제로 있을 때만 (없으면 same_premise만).
 * 결정론적 순서: decision_id 오름차순.
 */
export function relatedOpenDecisions(
  state: LedgerState,
  brokenPremiseText: string,
  settlingDecisionId: string,
): RelatedDecision[] {
  const targetText = normalizePremiseText(brokenPremiseText);
  const brokenTargets = new Set(extractTargets(brokenPremiseText));
  const byDecision = new Map<string, RelatedDecision>();
  for (const p of state.premises.values()) {
    if (p.resolved || p.kind !== 'premise') continue;
    if (!p.decision_id || p.decision_id === settlingDecisionId) continue;
    const existing = byDecision.get(p.decision_id);
    if (existing?.reason === 'same_premise') continue; // 이미 최강 연결
    const d = state.decisions.get(p.decision_id);
    if (!d || d.state !== 'sealed') continue;

    let reason: ConnectionReason | undefined;
    let via: string | undefined;
    if (targetText && normalizePremiseText(p.text.value) === targetText) {
      reason = 'same_premise';
    } else if (brokenTargets.size > 0) {
      const shared = extractTargets(p.text.value).find((x) => brokenTargets.has(x));
      if (shared) { reason = 'shared_fact'; via = shared; }
    }
    if (!reason) continue;
    if (!existing || reason === 'same_premise') {
      byDecision.set(p.decision_id, {
        decision_id: p.decision_id, premise_id: p.id, premise_text: p.text.value,
        reason, ...(via ? { via } : {}),
      });
    }
  }
  return [...byDecision.values()].sort((a, b) => (a.decision_id < b.decision_id ? -1 : 1));
}

/**
 * same_premise 연결만 (하위호환 뷰). 순수 텍스트 일치 단위 테스트가 쓰는 형태를
 * 유지하려 relatedOpenDecisions 위에 얇게 얹는다 (단일 소스).
 */
export function decisionsSharingPremise(
  state: LedgerState,
  brokenPremiseText: string,
  settlingDecisionId: string,
): SharedPremiseLink[] {
  return relatedOpenDecisions(state, brokenPremiseText, settlingDecisionId)
    .filter((r) => r.reason === 'same_premise')
    .map(({ decision_id, premise_id, premise_text }) => ({ decision_id, premise_id, premise_text }));
}
