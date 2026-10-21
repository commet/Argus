import type { DecisionRecord } from '../types.js';

/**
 * 다시 볼 때가 된 것 (단계 8).
 *
 * 세 가지 이유로 때가 온다:
 *  - **날짜** — 서명할 때 정한 `review` 가 지났다
 *  - **계기** — `review_on_event` 가 있고, 사람이 "그 일이 일어났다"고 말했다
 *    (기계가 판정할 수 없다. 조건 문장을 보여주고 사람에게 묻는다)
 *  - **조용함** — 30일 동안 한 번도 안 걸리고 아무 일도 없었다. 좀비 감쇠의
 *    첫 걸음이다: **한 번 묻는다.**
 *
 * 이 셋을 섞지 않는다 — 왜 지금 묻는지가 사람에게 다르게 읽힌다.
 */

export type DueReason = 'calendar' | 'event' | 'quiet';

export interface DueItem {
  record: DecisionRecord;
  reason: DueReason;
  /** 며칠 지났나 (달력) 또는 며칠째 조용한가. */
  days: number;
}

/** 이만큼 아무 일도 없으면 한 번 묻는다. */
export const QUIET_DAYS = 30;

const dayDiff = (from: string, to: string): number => {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((b - a) / 86_400_000) : 0;
};

/**
 * 마지막으로 **무슨 일이든** 있었던 날.
 *
 * 여기 빠진 사건이 있으면 그 사건은 "아무 일도 없었다"로 세어진다. 2026-09-10
 * 까지 **재확인과 멈춤이 빠져 있었고**, 그래서 이런 일이 났다 (실측):
 *
 *   어제 `dec-close --keep --next-review 2026-10-10` 으로 답했는데,
 *   오늘 그 결정이 *"72일 동안 아무 일도 없었다"* 며 다시 올라왔다.
 *
 * 사람이 답한 것이 일이 아니라고 세었기 때문이다. **답한 다음 날 같은 것을
 * 다시 묻는 것은 과발화**이고(거울 조항: 사용자가 닫은 결정을 다시 열지 않는다),
 * 게다가 그 문장은 거짓이다 — 무슨 일이 있었다. 사람이 답했다.
 */
function lastTouched(record: DecisionRecord): string {
  const dates = [
    record.adopted,
    ...record.amendments.map((a) => a.at.slice(0, 10)),
    ...record.fires.map((f) => f.at.slice(0, 10)),
    // 사람이 답한 날. 이것이 빠져 있어서 답이 "아무 일 없음"으로 세어졌다.
    ...record.reviews.map((r) => r.at.slice(0, 10)),
    // 멈춘 날도 일이다 — 멈춤은 사람만 하고, 다음 정산에서 묻힌다 (§4.7).
    ...record.pauses.map((p) => p.at.slice(0, 10)),
  ].filter(Boolean);
  return dates.sort().at(-1) ?? record.adopted;
}

export function dueDecisions(records: readonly DecisionRecord[], today: string): DueItem[] {
  const out: DueItem[] = [];
  for (const record of records) {
    if (record.status !== 'active') continue;
    if (record.review && record.review <= today) {
      out.push({ record, reason: 'calendar', days: dayDiff(record.review, today) });
      continue;
    }
    if (record.review_on_event) {
      // 계기형은 기계가 판정하지 않는다. 조건을 들고 사람 앞에 놓는 것까지가 일이다.
      out.push({ record, reason: 'event', days: 0 });
      continue;
    }
    const quiet = dayDiff(lastTouched(record), today);
    if (quiet >= QUIET_DAYS) out.push({ record, reason: 'quiet', days: quiet });
  }
  // 오래 지난 것부터.
  return out.sort((a, b) => b.days - a.days || a.record.id.localeCompare(b.record.id));
}
