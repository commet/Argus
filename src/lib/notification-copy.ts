/**
 * Notification-copy vocabulary lint (BLUEPRINT §4.1 금지 목록의 기계 검사기).
 *
 * Every notification is exactly quote → fact → handle; the moment copy carries a
 * verdict, advice, urgency, a score, or re-engagement bait it violates the spine
 * (공정 3 exit: "알림 문안에 권고/평가 표현이 들어가면 테스트 실패"). This is the
 * single source the copy tests share — add a pattern here and every builder's
 * test picks it up. Pure and dependency-free; used at test time (the builders
 * are deterministic, so a green test pins the shipped copy).
 *
 * Pattern discipline: only vocabulary that can NEVER legitimately appear in
 * notification copy. Disclaimers quote judgment words in the negative ("결과를
 * 채점하는 게 아니에요", "맞았는지 틀렸는지는 제가 정하지 않아요"), so bare
 * verdict stems (채점/맞았/틀렸/scoring) are deliberately NOT listed — a naive
 * stem match would flag the very sentences that keep the copy honest.
 */

export interface ForbiddenVocabularyPattern {
  /** Which §4.1 clause the pattern enforces. */
  label: 'advice' | 'verdict_or_score' | 'urgency' | 're_engagement';
  pattern: RegExp;
}

export const FORBIDDEN_NOTIFICATION_VOCABULARY: ForbiddenVocabularyPattern[] = [
  // 조언/권고 — AI가 "재검토를 권한다"고 말하는 순간 스파인 위반 (§4.2 T2).
  { label: 'advice', pattern: /권고|권장|추천|재검토를 권|하는 게 좋겠|하시는 게 좋|하시길|해야 합니다|하셔야/ },
  { label: 'advice', pattern: /\brecommend|you should\b|had better\b/i },
  // 평결/점수 — 사용자에 대한 어떤 등급·판정도 없다 (우정 3조).
  { label: 'verdict_or_score', pattern: /평결|점수|등급이|판정/ },
  { label: 'verdict_or_score', pattern: /\bverdict\b(?!\s*[-─:]+\s*none)|\bgrade\b|\byour score\b/i },
  // 재촉/긴박감 — "벌써 N일", "놓치지 마세요" 류 (§4.1 금지).
  { label: 'urgency', pattern: /벌써|놓치지 마|서둘러|서두르|지금 바로|마감 임박/ },
  { label: 'urgency', pattern: /don'?t miss\b|\bhurry\b|act now\b|last chance\b/i },
  // re-engagement / streak — 우정 2조를 engagement 조작으로 오염시키는 형태 (§4.3).
  { label: 're_engagement', pattern: /보고 싶어요|돌아와 주세요|연속 기록|스트릭/ },
  { label: 're_engagement', pattern: /we miss you|come back soon|\bstreak\b/i },
];

/** All §4.1 violations found in a piece of notification copy (empty = clean).
 *  Returns `label: matched-text` strings so a failing test names the clause. */
export function findForbiddenNotificationVocabulary(text: string): string[] {
  const hits: string[] = [];
  for (const { label, pattern } of FORBIDDEN_NOTIFICATION_VOCABULARY) {
    const m = text.match(pattern);
    if (m) hits.push(`${label}: "${m[0]}"`);
  }
  return hits;
}
