/**
 * 연결 읽기 (P-연결 1층, 정본 §8-§11) — 정산 때 전제가 깨지면 "같은 전제 위에
 * 선 다른 열린 결정"을 찾는다. 순수 읽기: 원장 상태(LedgerState)만 소비하고,
 * 임베딩·의미유사도·추론을 쓰지 않는다. 사용자 자신의 전제 텍스트가 정규화 후
 * '같은 문장'일 때만 연결한다 (같은 말 = 같은 전제). 이 기계식 연결이 연결 기능의
 * 바닥이다 — 포착이 경계를 stable-id load_bearing 전제로 이미 남기므로(seal.ts),
 * 연결은 그 전제 축을 읽기만 하면 되고 재가공이 없다.
 *
 * 스파인: 평결 없음. 반환하는 것은 사실(어느 열린 결정이 같은 전제에 기대나)과
 * 손잡이(그 결정 id)뿐 — "다시 보라"는 지시도, tilt도 아니다. 호출자(정산 표면)는
 * 이것을 중립 문장 + 재확인 손잡이로만 노출한다.
 */
import type { LedgerState } from './reducer.js';

export interface SharedPremiseLink {
  /** 같은 전제에 기댄, 아직 열린(봉인·미정산) 다른 결정. */
  decision_id: string;
  /** 그 결정 쪽 전제의 id(그 결정 축에 스코프됨 — 방금 깨진 전제와는 다른 id). */
  premise_id: string;
  /** 그 결정 쪽 전제의 원문 (렌더 시 sanitize는 표면의 몫, 규칙 19). */
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
 * 방금 정산된 결정에서 깨진 전제와 '같은 전제'에 기댄 다른 열린 결정들. 규칙:
 *  - 자기 자신(settlingDecisionId)은 제외.
 *  - resolved 전제·kind!=='premise'(fact/question)는 제외 — 살아있는 가정만.
 *  - 상대 결정이 'sealed'(열림)일 때만 — settled/dismissed/harvested는 제외.
 *    이미 닫힌 결정을 되살리지 않는다(스파인: 닫은 결정 재개 금지).
 *  - 결정 단위로 1회 (한 결정에 같은 전제가 둘이어도 한 줄).
 * 결정론적 순서: decision_id 오름차순 (표면 fold·테스트 안정).
 */
export function decisionsSharingPremise(
  state: LedgerState,
  brokenPremiseText: string,
  settlingDecisionId: string,
): SharedPremiseLink[] {
  const target = normalizePremiseText(brokenPremiseText);
  if (!target) return [];
  const byDecision = new Map<string, SharedPremiseLink>();
  for (const p of state.premises.values()) {
    if (p.resolved || p.kind !== 'premise') continue;
    if (!p.decision_id || p.decision_id === settlingDecisionId) continue;
    if (byDecision.has(p.decision_id)) continue;
    if (normalizePremiseText(p.text.value) !== target) continue;
    const d = state.decisions.get(p.decision_id);
    if (!d || d.state !== 'sealed') continue;
    byDecision.set(p.decision_id, {
      decision_id: p.decision_id,
      premise_id: p.id,
      premise_text: p.text.value,
    });
  }
  return [...byDecision.values()].sort((a, b) => (a.decision_id < b.decision_id ? -1 : 1));
}
