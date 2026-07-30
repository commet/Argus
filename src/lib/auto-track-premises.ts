/**
 * Auto-track premises at seal (DESIGN-clarify-question-system-v2 §3.4 — premises
 * are a side-effect of the decision, not a manual chore).
 *
 * Before this, DecisionItemsCard required the user to click "전제 N개 불러와서
 * 추적하기" to start tracking — the return-loop premises sat un-armed until then.
 * Now sealing a decision auto-creates the tracked items from the voyage's own
 * assumptions, so the reconsider/recheck surface is populated the moment the
 * decision is committed. Spine-safe by default: items are external:false →
 * alert OFF (monitoredPremises requires external), so nothing nags until the
 * user turns on a bell (the opt-out default, DESIGN §5.1). Pure; `now` injected.
 *
 * Idempotent: item ids are the stable decision+type+text hash, so re-sealing (or
 * a later manual import) produces the same ids and addItems() skips duplicates.
 */

import { premiseShapeOf, sameClaim } from './premise-shape';
import { derivePremiseTexts } from './derive-premise-texts';
import { createItem, type DecisionItem } from './decision-items';
import type { ProgressiveSession } from '@/stores/types';

/** "A decision is 5 premises, not a wiki" (premises-core MAX_ACTIVE, §3.1b). */
const AUTO_TRACK_CAP = 5;

export function buildAutoTrackedPremiseItems(
  decisionId: string,
  session: ProgressiveSession | null | undefined,
  now: number,
  opts: {
    /**
     * 봉인 화면에서 사용자가 ×로 뺀 문장들 (2026-07-30 — deny 배선).
     *
     * 그전까지 이 함수는 봉인 UI의 선택을 **전혀 받지 않았다.** 사용자가 봉인
     * 카드에서 전제를 ×로 빼도 추적 저장소에는 그대로 active 로 저장됐다 —
     * "선택에 따라서 저장한다"(창업자 기획 2단계)의 deny 쪽이 정확히 여기서
     * 끊겨 있었다. 사람이 아니라고 말한 것을 시스템이 계속 믿는 것은, 없는
     * 동의를 지어내는 것과 같은 부류의 거짓이다.
     *
     * 대조는 sameClaim — 봉인 카드의 술어 문장과 풀의 문장이 표기만 다른 같은
     * 주장일 수 있다(실측: "매출이/매출은"). 글자 일치로만 거르면 뺀 것이
     * 표기 차이로 살아남는다.
     */
    excludeTexts?: readonly string[];
  } = {},
): DecisionItem[] {
  const excluded = (opts.excludeTexts ?? []).filter((t) => !!t && !!t.trim());
  const texts = derivePremiseTexts(session, [])
    .filter((t) => !excluded.some((x) => x === t || sameClaim(x, t)))
    .slice(0, AUTO_TRACK_CAP);
  return texts.map((text) =>
    createItem(
      {
        decision_id: decisionId,
        // 2026-07-29: 여기가 나오는 문장을 **전부** 'premise' 로 못 박고 있었다.
        // 텍스트는 LLM 의 key_assumptions 에서 오고 그 프롬프트에는 모양 제약이
        // 없어서, 물음표로 끝나는 문장이 "확인할 전제"로 저장됐다. 확인일에
        // "이 전제가 맞았나요?"라고 물으면 답할 수 없는 자리다.
        // 버리지 않고 제자리(open_question)로 옮긴다 — 물음은 쓸모없는 게 아니라
        // 자리가 틀렸을 뿐이고, 그 자리는 처음부터 있었다.
        type: premiseShapeOf(text),
        text,
        source: 'ai',
        external: false,
        load_bearing: false,
        ai_original: text,
      },
      now,
    ),
  );
}
