/**
 * 앵커 키워드 말뭉치 — 캡처 게이트(gate.ts)의 단일 데이터 원천 (P0 스파이크
 * ⑤에서 승격). 패턴은 정규식 source 문자열이며 ko는 플래그 없이, en은 i
 * 플래그로 컴파일된다. 러너에 패턴을 하드코딩하지 말 것 — 추가는 여기서만,
 * 그리고 반드시 spikes/p0/routing-cases.json에 케이스를 함께 추가할 것
 * (eval 하네스가 CI red로 잰다).
 *
 * 가드(negation/question)는 항상 키워드보다 먼저 평가된다: "선언형 키워드를
 * 포함한 부정문"("postgres로 가기로 한 건 아니야")이 이 도메인의 대표 함정.
 *
 * 한글 패턴에 \b 금지 — JS \b는 한글에 매치되지 않는 조용히 죽은 패턴이 된다.
 * 경계가 필요하면 (\s|$|[.,!]) 명시 (gate.ts 상단 각주 참조).
 */
export interface KeywordSet {
  declarative: readonly string[];
  deferred: readonly string[];
  negation_guards: readonly string[];
}
export interface AnchorKeywords {
  version: number;
  ko: KeywordSet;
  en: KeywordSet;
}

export const ANCHOR_KEYWORDS: AnchorKeywords = {
  version: 1,
  ko: {
    declarative: [
      '기로\\s*(했|한다|하자|확정)|기로\\s*함(\\s|$|[.,!])',
      '결정했|결정하자|결정했습니다',
      '확정하자|확정했|확정입니다|로\\s*확정',
      '가기로|하기로|쓰기로|올리기로|유지하기로',
    ],
    deferred: [
      '보류',
      '미루자|미루기로|미뤄두',
      '나중에\\s*다시',
      '다음\\s*(버전|스프린트|분기)에서?\\s*(보자|다루|다시)',
    ],
    negation_guards: [
      '건\\s*아니|것은\\s*아니|게\\s*아니',
      '진\\s*않았|지는\\s*않|하지\\s*않기로\\s*한\\s*건',
      '아직\\s*(결정|확정)\\s*(못|안|전)',
      '미정',
    ],
  },
  en: {
    declarative: [
      '\\bdecided to\\b',
      "\\b(let'?s|we'?ll|we'?re) go(ing)? with\\b",
      '\\bsettled on\\b',
      '\\bfinal call\\b',
      '\\bship it\\b',
      '\\bwe are going with\\b',
    ],
    deferred: [
      '\\bhold off\\b',
      '\\bpark (this|it|the)\\b',
      '\\bpunt on\\b',
      '\\bdefer(ring)? (this|it|the)\\b',
      '\\brevisit (this|it|the|after)\\b',
    ],
    negation_guards: [
      "\\bhaven'?t decided\\b",
      '\\bnot decided\\b',
      '\\bundecided\\b',
      '\\bno decision\\b',
      '\\byet to decide\\b',
      '\\b(could|might|may) go with\\b',
    ],
  },
};
