import { closingJudgmentAuthorship } from '../judgment-authorship';
import type { Authorship } from './types';

/**
 * 저자성 + **깊이**.
 *
 * 범주 판정(사람 문장인가 기계 문장인가)은 새로 쓰지 않는다 —
 * `judgment-authorship.ts` 의 `closingJudgmentAuthorship()` 이 이 저장소의 단일
 * 권위이고, 프롬프트든 판정이든 두 번째 사본을 만드는 순간 둘은 갈라진다
 * (CLAUDE.md: Single Source of Truth). 이 파일이 보태는 것은 **얼마나 멀리
 * 갔는가** 하나다.
 *
 * 왜 깊이가 따로 필요한가 (E-0 2026-08-16 실측):
 *   · 창업자가 실명으로 올린 공개 댓글 = AI 초안 + **7라운드 거부·수정**
 *   · 봉인된 전제 22건 = AI 초안 + **편집 0건**
 * 기존 술어로는 둘 다 각각 `user_reworded` / `ai_surfaced` 로 갈리지만, 진짜
 * 위험 신호는 "AI가 썼다"가 아니라 **"AI가 썼는데 손대지 않았다"** 였다.
 * 노출이 큰 자리에서는 사람이 이미 싸운다. 위험한 곳은 작아 보여서 안 싸우는
 * 자리다. 그 차이를 숫자로 남기지 않으면 거울이 그 자리를 못 비춘다.
 */

const norm = (s: string): string => (s || '').replace(/\s+/g, ' ').trim();

/**
 * 정규화 편집 거리 (0~1). 0 = 같음, 1 = 완전히 다름.
 *
 * Levenshtein 을 쓰되 **두 문장 길이의 최댓값으로 나눈다**. 절대 편집수는
 * 문장 길이에 비례해 커져서 긴 초안을 조금 고친 것과 짧은 초안을 다 고친 것을
 * 구분하지 못한다.
 *
 * 초안이 없으면 비교 대상이 없으므로 1 (온전히 사용자 문장).
 */
export function revisionDistance(draft: string, final: string): number {
  const a = norm(draft);
  const b = norm(final);
  if (!a) return 1;
  if (!b) return 0;
  if (a === b) return 0;

  // 행 두 개만 쓰는 Levenshtein — 긴 문장에서도 메모리가 선형이다.
  let prev = new Array<number>(b.length + 1);
  let curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) prev[j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    const swap = prev;
    prev = curr;
    curr = swap;
  }

  const distance = prev[b.length];
  const denom = Math.max(a.length, b.length);
  // 부동소수 잡음이 스냅숏 테스트를 흔들지 않게 소수 4자리로 고정한다.
  return denom === 0 ? 0 : Math.round((distance / denom) * 10_000) / 10_000;
}

/**
 * 이 원소의 저자성을 판정한다.
 *
 * `revisionRounds` 는 UI가 셀 수 있으면 넘기고, 모르면 0으로 둔다 — **0을
 * "고치지 않았다"로 오해하면 안 된다**. `revision_distance` 가 그 사실의
 * 권위이고 rounds 는 보조 정보다. (모른다를 0으로 적는 것이 이 파일이
 * 감내하는 유일한 손실이며, 그래서 거울은 rounds 만으로 문장을 만들지 않는다.)
 */
export function elementAuthorship(input: {
  text: string;
  aiDraft: string;
  touched: boolean;
  revisionRounds?: number;
  now: number;
}): Authorship {
  const verdict = closingJudgmentAuthorship({
    text: input.text,
    aiDraft: input.aiDraft,
    touched: input.touched,
    now: input.now,
    sourceRef: 'cognition:frame_element',
  });

  return {
    authored: verdict.authored,
    wording_source: verdict.attribution.wording_source,
    revision_distance: revisionDistance(input.aiDraft, input.text),
    revision_rounds: Math.max(0, Math.floor(input.revisionRounds ?? 0)),
    recorded_at: new Date(input.now).toISOString(),
  };
}

/**
 * 손대지 않은 기계 문장인가 — 거울이 조용한 위험을 가리킬 때 쓰는 술어.
 *
 * 판정이 아니라 **사실 진술**이다: 이 문장은 기계가 썼고 사람이 한 글자도
 * 바꾸지 않았다. 그 사실이 나쁘다고 말하는 것은 이 함수의 일이 아니다.
 */
export function isUneditedMachineText(a: Authorship): boolean {
  return a.wording_source === 'ai_surfaced' && a.revision_distance === 0;
}
