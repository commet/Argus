/**
 * What it costs a person to reach the seal.
 *
 * The seal is this product's activation event and the entrance to the only
 * thing it has that a chat window does not: a sentence with a date on it, and
 * reality arriving later to answer it. Everything downstream — settlement, the
 * return, the n=1 record of how this person's judgment actually performs — is
 * stored behind that one event.
 *
 * The daily report has always counted how many seals happened. It has never
 * counted what they cost. Those are different questions, and only the second one
 * says whether the entrance is too far from the door: a flow that takes nine
 * phases and twenty minutes to reach the seal converts differently from one that
 * takes two answers, and no amount of staring at the seal COUNT distinguishes
 * them.
 *
 * Deliberately a count of turns and minutes, never a judgment about the person.
 * "This user took a long time" is not a finding this file is allowed to produce;
 * "the median seal costs N answers" is a fact about the product.
 */

export interface CostEvent {
  session_id: string;
  event_name: string;
  properties: Record<string, unknown> | null;
}

export interface SealCost {
  /** Distinct sessions that sealed. */
  seals: number;
  /** Median answers given before the seal, or null when nothing reported one. */
  medianAnswers: number | null;
  /** Median minutes from session start to seal, or null when unreported. */
  medianMinutes: number | null;
  /**
   * Seals whose event carried no cost fields. Clients shipped before the fields
   * existed still seal, and counting them as zero would make the flow look free.
   * Surfaced instead of absorbed — an honest gap, not a filled one.
   */
  withoutCost: number;
}

function positiveNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

/** Lower median on even counts. Small n here; a stable rule beats an average
 *  that one twenty-minute session can drag anywhere. */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

export function sealCostSummary(
  events: CostEvent[],
  humanSessionIds: Set<string>,
): SealCost {
  /** By session, so a re-seal from the sealed drawer is not a second data point. */
  const bySession = new Map<string, Record<string, unknown> | null>();
  for (const event of events) {
    if (event.event_name !== 'decision_sealed') continue;
    if (!humanSessionIds.has(event.session_id)) continue;
    if (!bySession.has(event.session_id)) bySession.set(event.session_id, event.properties);
  }

  const answers: number[] = [];
  const minutes: number[] = [];
  let withoutCost = 0;

  for (const properties of bySession.values()) {
    const a = positiveNumber(properties?.answers);
    const m = positiveNumber(properties?.minutes);
    if (a === null && m === null) {
      withoutCost += 1;
      continue;
    }
    if (a !== null) answers.push(a);
    if (m !== null) minutes.push(m);
  }

  return {
    seals: bySession.size,
    medianAnswers: median(answers),
    medianMinutes: median(minutes),
    withoutCost,
  };
}

/** One line for the report. Says "not reported yet" rather than printing a zero
 *  that reads like a free flow. */
export function sealCostLine(cost: SealCost): string {
  if (cost.seals === 0) return '어제 봉인 0건 — 비용을 잴 표본이 없음';
  const parts: string[] = [];
  if (cost.medianAnswers !== null) parts.push(`답변 ${cost.medianAnswers}개`);
  if (cost.medianMinutes !== null) parts.push(`${cost.medianMinutes}분`);
  if (parts.length === 0) {
    return `봉인 ${cost.seals}건 · 비용 미보고 (구버전 클라이언트 ${cost.withoutCost}건)`;
  }
  const gap = cost.withoutCost > 0 ? ` · 비용 미보고 ${cost.withoutCost}건` : '';
  return `봉인 1건까지 중앙값 ${parts.join(' · ')}${gap}`;
}
