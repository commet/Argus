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

/** 마지막으로 무슨 일이든 있었던 날 (서명·개정·걸림 중 가장 나중). */
function lastTouched(record: DecisionRecord): string {
  const dates = [
    record.adopted,
    ...record.amendments.map((a) => a.at.slice(0, 10)),
    ...record.fires.map((f) => f.at.slice(0, 10)),
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
