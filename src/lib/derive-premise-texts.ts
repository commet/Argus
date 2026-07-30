import type { ProgressiveSession } from '@/stores/types';
import { sameClaim } from './premise-shape';

/**
 * 봉인 시 추적 후보가 되는 전제 문장 풀 — 세 우물에서 긷는다 (2026-07-30 확장).
 *
 * 순서가 곧 우선순위다. 호출부 캡(AUTO_TRACK_CAP)에 뒤가 잘리므로 앞이 살아남는다:
 *
 *   1. falsification.real_bet      — 사용자가 **자기 말로** 적은 지배 베팅.
 *                                    사람 문장이 기계 문장보다 먼저 산다.
 *   2. mix.key_assumptions         — 초안이 기대고 있다고 선언한 가정들.
 *   3. snapshot.hidden_assumptions — 분석이 "확인할 가정 N개"로 **이미 화면에
 *                                    보여준** 그 문장들. 2026-07-30까지 여기서
 *                                    버려졌다 — 화면으로는 "이 가정을 확인하세요"
 *                                    라고 말해놓고 추적 목록에는 안 넣는, 말과
 *                                    행동이 갈라진 상태였다 (창업자 기획 1단계:
 *                                    "AI와 대화하면서 뽑힌 숨은 전제들도 잘 뽑는다").
 *   폴백. legacy reframe 가정      — 리프레임으로 빠져나간 경우에만 존재.
 *
 * 근사 중복은 sameClaim 으로 거른다 — "매출이 유지된다"와 "매출은 확정 계약
 * 기준으로 유사한 수준을 유지한다"가 둘 다 저장되면 사용자는 같은 걸 두 번
 * 확인하고, 전제 감시는 같은 웹 조사를 두 번 한다(실비용). 먼저 온 쪽(=더
 * 사람에 가까운 쪽)이 남는다.
 *
 * Pure + standalone — 브라우저 없이 단위 테스트가 닿는다.
 */
export function derivePremiseTexts(
  session: ProgressiveSession | null | undefined,
  reframeAssumptionTexts: (string | undefined)[],
): string[] {
  const clean = (arr: (string | undefined)[]) =>
    arr.filter((t): t is string => !!t && !!t.trim()).map((t) => t.trim());

  const mix = session?.final_mix ?? session?.mix ?? null;
  const latestSnapshot = (session?.snapshots ?? []).slice(-1)[0];
  const fromSession = clean([
    session?.falsification?.real_bet,
    ...(mix?.key_assumptions || []),
    ...(latestSnapshot?.hidden_assumptions || []),
  ]);
  const pool = fromSession.length > 0 ? fromSession : clean(reframeAssumptionTexts);

  const out: string[] = [];
  for (const t of pool) {
    if (out.some((kept) => kept === t || sameClaim(kept, t))) continue;
    out.push(t);
  }
  return out;
}
