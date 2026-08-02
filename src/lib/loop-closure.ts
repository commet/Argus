/**
 * Did the loop close?
 *
 * This is the only number that distinguishes Argus from a very good analysis
 * tool. A sealed decision is a sentence with a date on it; the product's whole
 * claim is that reality comes back and answers it. Whether that actually
 * happens has never appeared anywhere.
 *
 * The daily report counts seals, and it counts returns opened and answered
 * yesterday. Neither is the rate: seals and returns belong to different
 * cohorts, days or weeks apart, so dividing one by the other says nothing. The
 * question is per-decision — of the ones that CAME DUE, how many did their
 * person come back and settle — and it needs the contracts, not the events.
 *
 * Three rules keep it honest, and each of them is a way the number could
 * flatter or slander the product if left out.
 *
 *   GRACE.      A decision that came due yesterday has not had a fair chance.
 *               Without a grace window the rate is structurally pessimistic and
 *               a real signal reads as noise.
 *   NO SAMPLE.  Zero due means no measurement, not 0%. `rate` is null and the
 *               line says so.
 *   UNDATEABLE. A sealed contract with no check_in_at can NEVER come back. That
 *               is a product defect, not a user who did not return, so it is
 *               counted and reported separately and never folded into the rate.
 *               Hiding it inside the denominator would blame the person for a
 *               door that was never built.
 *
 * Pure. It knows nothing about storage; the caller hands it the contracts.
 */

export interface ClosureRow {
  /** When reality was supposed to answer. Absent = this seal has no return. */
  check_in_at?: string | null;
  /** When the person actually came back and graded it. */
  settled_at?: string | null;
}

export interface LoopClosure {
  /** Came due at least `graceDays` ago. The denominator. */
  due: number;
  /** Of those, settled. */
  settled: number;
  /** settled / due, or null when nothing has come due yet. */
  rate: number | null;
  /** Came due, grace expired, still unanswered. */
  stillOpen: number;
  /** Not yet due. Neither a success nor a failure — excluded from both. */
  pending: number;
  /** Sealed with no check-in date: a loop that cannot close. */
  undateable: number;
}

const DAY_MS = 86_400_000;

function parsed(value: string | null | undefined): number | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

export function loopClosure(
  rows: ClosureRow[],
  nowMs: number,
  graceDays = 3,
): LoopClosure {
  const cutoff = nowMs - graceDays * DAY_MS;
  let due = 0;
  let settled = 0;
  let pending = 0;
  let undateable = 0;

  for (const row of rows || []) {
    const checkIn = parsed(row?.check_in_at);
    if (checkIn === null) {
      undateable += 1;
      continue;
    }
    if (checkIn > cutoff) {
      pending += 1;
      continue;
    }
    due += 1;
    if (parsed(row?.settled_at) !== null) settled += 1;
  }

  return {
    due,
    settled,
    rate: due === 0 ? null : settled / due,
    stillOpen: due - settled,
    pending,
    undateable,
  };
}

/** One line for the report. Never prints a percentage it did not measure. */
export function loopClosureLine(closure: LoopClosure): string {
  const undateable = closure.undateable > 0
    ? ` · 확인일 없는 봉인 ${closure.undateable}건 (돌아올 수 없음)`
    : '';
  if (closure.rate === null) {
    return `아직 확인일이 지난 결정이 없음 · 대기 ${closure.pending}건${undateable}`;
  }
  const pct = Math.round(closure.rate * 100);
  return `확인일이 지난 ${closure.due}건 중 ${closure.settled}건 정산 (${pct}%)`
    + ` · 미응답 ${closure.stillOpen}건${undateable}`;
}
