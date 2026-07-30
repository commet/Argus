import type { DecisionItem } from './decision-items';
import { isItemDueForRecheck } from './decision-items';
import type { InvestigationResult } from './premise-researcher';

/**
 * 본선 전제(decision_items)를 서버 감시(premise-watch 크론)에 잇는 순수 부품
 * (2026-07-30 신설).
 *
 * ── 왜 이 파일이 생겼나 ────────────────────────────────────────────────
 * 전제 감시 크론은 review_receipts(문서 검수 경로)만 읽고 있었다. 본선이 봉인
 * 때 저장하는 decision_items 는 서버 감시가 영영 보지 않았다 — 종(🔔)을 켜면
 * "재확인 표시 켜짐"이라고 말하지만, 그 종을 울리는 것은 사용자가 /project 에
 * 직접 들어왔을 때(pull)뿐이었다. 능동 알림(push)은 문서 검수 전제에만 갔다.
 * 창업자 기획 3단계("추적하고 있다가 알려주기")가 본선에서 반쪽이었던 자리다.
 *
 * 같은 결함 모양이 이 리포에 반복된다: 두 저장소가 같은 일을 하는데 소비자가
 * 한쪽만 읽는다. 저장소를 오늘 합치지는 않는다(그건 이주 작업) — 대신 소비자가
 * 둘 다 읽게 하고, 그 배선의 순수 부분을 여기 두어 테스트가 닿게 한다.
 * 크론 라우트 안에 인라인으로 쓰면 vitest 가 못 읽는다 — 검사기가 못 읽는
 * 규칙은 없는 규칙이다 (UUID 검사기가 server-only 파일에 있어 팀 기능이 10일
 * 죽었던 그 실수).
 *
 * ── 무엇을 감시 대상으로 보나 ──────────────────────────────────────────
 * UI 와 **같은 함수**(isItemDueForRecheck)로 판정한다. 화면의 "다시 확인할
 * 때가 됐어요" 배지와 서버 알림이 다른 판정을 쓰면, 배지는 떴는데 알림은 안
 * 오거나 그 반대가 된다 — 두 표면 한 두뇌.
 */

/** 감시 조사 대상이 된 본선 전제 하나 + 조사에 넘길 입력. */
export interface DueDecisionItem {
  item: DecisionItem;
  /** 조사 기준일 (마지막 재확인일, 없으면 생성일) — YYYY-MM-DD. */
  baselineYMD: string;
}

/** 오늘 재확인이 도래한 감시 전제들. UI 의 due 판정과 같은 함수를 쓴다. */
export function dueDecisionItems(items: readonly DecisionItem[], now: number): DueDecisionItem[] {
  return (Array.isArray(items) ? items : [])
    .filter((i) => isItemDueForRecheck(i, now))
    .map((item) => ({
      item,
      baselineYMD: (item.alert?.last_checked ?? item.created_at ?? new Date(now).toISOString()).slice(0, 10),
    }));
}

/**
 * 조사 결과를 항목에 되새긴다. **verdict 와 무관하게 시계는 항상 리셋한다** —
 * 리셋하지 않으면 같은 전제가 다음 실행에서 또 조사되어 같은 웹 검색 비용을
 * 매일 낸다 (quiet 라고 안 적으면 quiet 를 매일 다시 알아내는 셈).
 *
 * last_value 에는 조사된 현재 사실 한 줄을 남긴다 — 다음 조사의 비교 기준이자,
 * 화면(/project)이 "마지막으로 확인했을 때는 이랬다"를 보여줄 재료.
 * fact 가 없으면(no_recent_source) 이전 값을 지우지 않는다 — 못 알아냈다는
 * 사실이 알아냈던 사실을 지우면 안 된다.
 */
export function applyItemRecheck(item: DecisionItem, result: InvestigationResult, nowISO: string): DecisionItem {
  return {
    ...item,
    alert: {
      ...item.alert,
      mode: item.alert?.mode ?? 'on_change',
      last_checked: nowISO,
      ...(result.fact ? { last_value: result.fact } : { ...(item.alert?.last_value ? { last_value: item.alert.last_value } : {}) }),
    },
    updated_at: nowISO,
  };
}

/** 알림 이메일 본문 재료 — 문장은 저장된 것과 조사된 것만, 생성 없음. */
export interface ItemAlertEmail {
  subject: string;
  markdown: string;
  /** 알림에서 돌아올 문 — 발송 루프(CompanionBriefEmail)와 같은 모양을 지킨다. */
  url: string;
}

/**
 * material 변화 알림 한 통의 재료를 만든다. 카드와 같은 규율: 여기 찍히는
 * 문장은 (a) 사용자가 봉인한 전제 원문, (b) 조사기가 출처와 함께 가져온 현재
 * 사실, (c) 이 파일의 고정 문구뿐이다. 평결("전제가 깨졌습니다")은 쓰지 않는다
 * — 그 판정은 사용자의 것이고, 우리는 변화를 가져다 놓을 뿐이다 (mirror).
 */
export function buildItemAlertEmail(input: {
  item: DecisionItem;
  projectName: string;
  result: InvestigationResult;
  baseUrl: string;
  locale?: 'ko' | 'en';
}): ItemAlertEmail {
  const ko = (input.locale ?? 'ko') === 'ko';
  const name = input.projectName.trim() || (ko ? '결정' : 'decision');
  const subject = ko
    ? `전제에 움직임 — ${name.slice(0, 40)}`
    : `A premise moved — ${name.slice(0, 40)}`;
  const lines = [
    ko ? `「${name}」을(를) 봉인할 때 이 전제 위에 서 있었어요:` : `When you sealed "${name}", it rested on this premise:`,
    '',
    `> ${input.item.text}`,
    '',
    ko ? '지금 확인해 보니:' : 'Checked just now:',
    '',
    `> ${input.result.fact ?? ''}`,
    ...(input.result.source_url ? ['', `${ko ? '출처' : 'Source'}: ${input.result.source_url}${input.result.source_date ? ` (${input.result.source_date})` : ''}`] : []),
    '',
    ko
      ? '이게 그 결정을 흔드는지는 직접 판단해 주세요 — 기록은 여기에 있어요:'
      : 'Whether this moves your decision is your call — the record is here:',
    `${input.baseUrl}/ko/project`,
  ];
  return { subject, markdown: lines.join('\n'), url: `${input.baseUrl}/ko/project` };
}
