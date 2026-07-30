/**
 * 루프 맥박 (2026-07-30, 창업자 불안의 해독제).
 *
 * "루프가 꺼지거나 중간에 깨질까 봐"는 감으로 달랠 걱정이 아니라 잴 수 있는
 * 사실이다: 매일 돌아야 하는 크론들이 어제 흔적(user_events)을 남겼는가.
 * 지금까지는 사람이 DB를 열어봐야 알 수 있었다 — 심장이 멎어도 아무도 모르는
 * 상태. 이 부품은 daily-report(창업자 아침 메일)가 어제의 이벤트 이름들을 그대로
 * 넣어 호출하고, 빠진 크론을 **소리 내어** 보고한다.
 *
 * 원칙:
 *   · 판정하지 않는다 — "돌았다/안 돌았다"는 사실만. 원인 추정은 사람 몫.
 *   · 꺼짐(kill-switch)도 흔적이다 — premise-watch 는 disabled 여도 기록을
 *     남기므로(2026-07-30 수리), 흔적 없음 = 스위치가 아니라 **실행 자체가 없음**.
 *   · 이 검사 자체가 앱 안에서 돈다는 한계를 안다 — 앱이 통째로 죽으면 맥박도
 *     같이 죽는다. 그 바깥 층은 리포 쪽 health-pulse(GitHub Actions)가 잰다.
 *
 * Pure. 저장소를 모른다 — 호출부가 어제의 event_name 목록을 준다.
 */

/** 매일 흔적을 남겨야 하는 크론들 (vercel.json crons 와 짝). */
export const EXPECTED_DAILY_CRONS: readonly string[] = [
  'cron_premise_watch',
  'cron_companion_brief',
  'cron_checkin_due',
  'cron_telegram_reminders',
  'anon_cleanup',
];

export interface LoopPulse {
  /** 어제 흔적이 없는 크론 이름들 — 비어 있으면 심장이 어제도 뛰었다. */
  missing: string[];
  /** 어제 흔적을 남긴 기대 크론 수 (분자) / 기대 총수 (분모)는 호출부가 안다. */
  seen: string[];
  ok: boolean;
}

export function loopPulse(
  yesterdayEventNames: Iterable<string>,
  expected: readonly string[] = EXPECTED_DAILY_CRONS,
): LoopPulse {
  const names = new Set(yesterdayEventNames);
  const seen = expected.filter((e) => names.has(e));
  const missing = expected.filter((e) => !names.has(e));
  return { missing, seen, ok: missing.length === 0 };
}
