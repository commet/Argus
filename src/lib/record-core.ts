/**
 * Track-record (자차표) formatting for the bot's sealed/settled decisions.
 *
 * Reuses calibration-disclosure (the single enforceable maturity invariant): below
 * SETTLED_THRESHOLD settled outcomes, NO accuracy/calibration figure may render —
 * only counts + an honest "unproven yet" line. And the user-facing spine: meaning-
 * language is sample-size-scaled FREQUENCY statements (counts), never a verdict or a
 * single accuracy score.
 */
import { calibrationDisclosure, SETTLED_THRESHOLD } from './calibration-disclosure';

export interface RecordCounts {
  open: number;      // sealed, still awaiting their check-in
  settled: number;   // settled against reality
  happened: number;  // outcome breakdown (sum ≤ settled)
  avoided: number;
  partial: number;
}

export function recordSummaryMarkdown(c: RecordCounts, locale: 'ko' | 'en'): string {
  const ko = locale === 'ko';
  // Gate stats on settled count (the only validated outcomes).
  const disc = calibrationDisclosure({ runs: c.open + c.settled, sealed: c.open + c.settled, settled: c.settled });

  const out: string[] = [`📊 **${ko ? '내 결정 기록' : 'My decision record'}**`, ''];

  if (c.open + c.settled === 0) {
    out.push(ko
      ? '아직 봉인한 결정이 없어요. 결정을 봉인하면 정한 날 돌아와 물어볼게요 — 그렇게 판단 기록이 쌓여요.'
      : 'No sealed decisions yet. Seal one and I’ll return on the date to ask — that’s how a record builds.');
    return out.join('\n');
  }

  out.push(ko
    ? `봉인 중(확인 대기): **${c.open}** · 정산 완료: **${c.settled}**`
    : `Open (awaiting check-in): **${c.open}** · Settled: **${c.settled}**`);

  if (c.settled > 0) {
    // Vocabulary unified with the web 자차표 (P1-A2 = 08 S2-5): "적중/빗나감"
    // matches RecordStrip's "적중한 가설/빗나간 가설" family, so the same
    // outcome never reads as two different words on two surfaces.
    // TODO(08 S2-5 long-term): feed these counts through record-summary's
    // merged display brain instead of a parallel path — the shapes already
    // match (ReviewRecordCounts === RecordCounts), guarded by the cross test
    // in record-summary.test.ts.
    out.push('', ko
      ? `정산 결과 — 적중 ${c.happened} · 빗나감 ${c.avoided} · 반반 ${c.partial}`
      : `Outcomes — held ${c.happened} · missed ${c.avoided} · partial ${c.partial}`);
  }

  // Honest maturity line (localized; the showStats gate is the enforceable part).
  out.push('', disc.showStats
    ? (ko
        ? `정산 ${c.settled}건 — 판단 기록이 쌓이고 있어요. (이건 빈도일 뿐, 점수가 아니에요.)`
        : `${c.settled} settled — your record is building. (Frequencies, not a score.)`)
    : (ko
        ? `아직 정산 ${c.settled}건이라 판단 기록이라 하기엔 일러요 — ${SETTLED_THRESHOLD}건부터 의미가 생겨요.`
        : `Only ${c.settled} settled — too few to call a record yet; it starts meaning something at ${SETTLED_THRESHOLD}.`));

  return out.join('\n');
}
