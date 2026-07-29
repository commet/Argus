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

import { premiseShapeOf } from './premise-shape';
import { derivePremiseTexts } from './derive-premise-texts';
import { createItem, type DecisionItem } from './decision-items';
import type { ProgressiveSession } from '@/stores/types';

/** "A decision is 5 premises, not a wiki" (premises-core MAX_ACTIVE, §3.1b). */
const AUTO_TRACK_CAP = 5;

export function buildAutoTrackedPremiseItems(
  decisionId: string,
  session: ProgressiveSession | null | undefined,
  now: number,
): DecisionItem[] {
  const texts = derivePremiseTexts(session, []).slice(0, AUTO_TRACK_CAP);
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
