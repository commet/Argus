/**
 * Auto-track premises at seal (DESIGN-clarify-question-system-v2 §3.4 — premises
 * are a side-effect of the decision, not a manual chore).
 *
 * Before this, DecisionItemsCard required the user to click "전제 N개 불러와서
 * 추적하기" to start tracking — the return-loop premises sat un-armed until then.
 * Now sealing a decision auto-creates the tracked items from the voyage's own
 * assumptions, so the reconsider/recheck surface is populated the moment the
 * decision is committed. Pure; `now` injected.
 *
 * ── 종의 기본값 (2026-07-30, 창업자 결정으로 §5.1 뒤집음) ────────────────
 * 원래는 전부 external:false → 종 꺼짐(opt-in)이었다. 실측: 프로덕션 전제
 * 22건 중 종 켜진 것 0건 — 끄고 켜는 자리가 /project 안에 숨어 있어서, 서버
 * 감시(premise-watch 크론)가 완벽히 돌아도 지켜볼 대상이 영영 0이었다.
 * 이제 **premise 는 기본 켬(external + on_change), 끄는 스위치는 봉인 서랍에
 * 보이게** 둔다 — 숨은 opt-in 이 아니라 보이는 opt-out. 스파인 검토: 알림
 * 자체가 절제돼 있어(재확인은 14일 주기, 발화는 출처 있는 material 변화뿐,
 * 나머지는 침묵) 기본 켬이 nag 가 되지 않는다. open_question 은 현실이
 * 답해주지 않는 문장이라 종 대상이 아니다.
 *
 * Idempotent: item ids are the stable decision+type+text hash, so re-sealing (or
 * a later manual import) produces the same ids and addItems() skips duplicates.
 */

import { premiseShapeOf, sameClaim } from './premise-shape';
import { derivePremiseTexts } from './derive-premise-texts';
import { createItem, recordEdit, type DecisionItem } from './decision-items';
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
    /**
     * 봉인 서랍에서 종을 끈 문장들 — 추적은 하되(목록에 남음) 서버 감시에서만
     * 빠진다. deny(×)와 다른 축: ×는 저장 자체를 막고, 종 끔은 조용한 추적이다.
     */
    bellOffTexts?: readonly string[];
    /**
     * 봉인 서랍에서 고쳐 쓴 문장들 (2026-07-30, 인라인 수정) — from 은 풀의
     * 원문(정확 일치), to 는 사용자의 문장 그대로. 덮어쓰기가 아니라
     * recordEdit('refine') 로 적는다: AI 원문(ai_original)은 이력에 보존되고,
     * 출처는 ai_edited_by_user 로 승격된다 — 고치는 순간 사용자의 문장이 된다.
     * 자리(kind)는 **최종 문장**으로 다시 판정한다 — 물음으로 고쳐 썼으면
     * 미결 질문 자리로 간다.
     */
    overrides?: ReadonlyArray<{ from: string; to: string }>;
  } = {},
): DecisionItem[] {
  const excluded = (opts.excludeTexts ?? []).filter((t) => !!t && !!t.trim());
  const bellOff = (opts.bellOffTexts ?? []).filter((t) => !!t && !!t.trim());
  const overrides = (opts.overrides ?? []).filter((o) => !!o.from?.trim() && !!o.to?.trim());
  const texts = derivePremiseTexts(session, [])
    .filter((t) => !excluded.some((x) => x === t || sameClaim(x, t)))
    .slice(0, AUTO_TRACK_CAP);
  return texts.map((text) => {
    const override = overrides.find((o) => o.from === text);
    const finalText = override ? override.to.trim() : text;
    // 2026-07-29: 여기가 나오는 문장을 **전부** 'premise' 로 못 박고 있었다.
    // 물음표로 끝나는 문장이 "확인할 전제"로 저장됐다 — 버리지 않고 제자리
    // (open_question)로 옮긴다. 자리는 최종 문장으로 판정한다.
    const kind = premiseShapeOf(finalText);
    // deny/종은 풀의 원문으로 매칭한다 — 서랍 행의 정체성은 원문이다.
    const watched = kind === 'premise' && !bellOff.some((x) => x === text || sameClaim(x, text));
    let item = createItem(
      {
        decision_id: decisionId,
        type: kind,
        text,
        source: 'ai',
        external: watched,
        load_bearing: false,
        ai_original: text,
      },
      now,
    );
    // 고쳐 쓴 문장은 덮어쓰기가 아니라 refine 이력으로 — AI 원문 보존 +
    // ai_edited_by_user 승격이 recordEdit 한 곳에서 일어난다 (회계 단일 정본).
    if (override) item = recordEdit(item, 'refine', finalText, now);
    // createItem 의 기본 알림 휴리스틱과 무관하게, 여기서는 서랍의 보이는
    // 스위치가 정본이다 — 켠 것은 on_change 로 못 박는다.
    return watched ? { ...item, alert: { ...item.alert, mode: 'on_change' as const } } : item;
  });
}
