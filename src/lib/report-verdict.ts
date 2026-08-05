/**
 * The one sentence the daily report was missing.
 *
 * The email is fifteen blocks and thirteen of them compare yesterday with the
 * day before. At three to eight real sessions a day that delta is noise: "5,
 * yesterday 8, ↓37%" is a coin flip wearing a percentage. Meanwhile the numbers
 * that decide whether this product works — does anyone reach the seal, does the
 * loop ever close, does the front door open — were rendered as grey footnotes
 * under other blocks, in the same 11px as a caption.
 *
 * So the reader had to assemble the story themselves, every morning, out of
 * fifteen equally-weighted boxes. That is what "it doesn't feel like it carries
 * the latest state" means in practice.
 *
 * This produces the headline: the FIRST true and load-bearing thing, in order of
 * what would have to be fixed first. It never scores the founder, never
 * congratulates, and never prints a rate it did not measure.
 *
 * Order matters and is the whole design. There is no point reporting the seal
 * rate to someone whose front door is shut, and no point reporting the loop
 * closure rate to someone nobody has sealed for.
 */

export interface WeeklyVerdictInput {
  /** Human sessions in the last 7 days. */
  sessions: number;
  /** External accounts created in the last 7 days. */
  signups: number;
  /** Sessions that reached the end of the flow. */
  completed: number;
  /** Sessions that sealed. */
  sealed: number;
  /** Sealed decisions whose check-in date has passed (grace applied). */
  due: number;
  /** Of those, settled. */
  settled: number;
  /** Sealed with no check-in date — a loop that cannot close. */
  undateable: number;
  /** Daily crons with no trace yesterday. */
  missingCrons: number;
}

export interface WeeklyVerdict {
  /** One sentence, the first thing that is both true and load-bearing. */
  headline: string;
  /** Which question it answers — for the label above it. */
  stage: 'broken' | 'nobody' | 'shallow' | 'unsealed' | 'unsettled' | 'closing';
}

export function weeklyVerdict(v: WeeklyVerdictInput): WeeklyVerdict {
  // A dead cron outranks every demand question: the numbers below it are not
  // trustworthy while a collector is missing.
  if (v.missingCrons > 0) {
    return {
      stage: 'broken',
      headline: `크론 ${v.missingCrons}개가 어제 안 돌았습니다 — 아래 숫자를 믿기 전에 이것부터입니다.`,
    };
  }
  // A seal that can never come back is a product defect, and it is cheap to fix
  // relative to anything else on this list.
  if (v.undateable > 0) {
    return {
      stage: 'broken',
      headline: `확인일 없이 봉인된 결정이 ${v.undateable}건 있습니다 — 그 판단들은 영영 돌아오지 않습니다.`,
    };
  }
  if (v.sessions === 0) {
    return { stage: 'nobody', headline: '7일간 사람 세션 0건 — 아직 잴 것이 없습니다.' };
  }
  if (v.completed === 0) {
    return {
      stage: 'shallow',
      headline: `7일간 ${v.sessions}명이 왔고, 끝까지 간 사람은 0명입니다 — 막히는 곳은 깊은 데가 아니라 앞쪽입니다.`,
    };
  }
  if (v.sealed === 0) {
    return {
      stage: 'unsealed',
      headline: `7일간 ${v.completed}명이 완주했고 봉인은 0건 — 이 제품의 해자는 전부 봉인 뒤에 있습니다.`,
    };
  }
  if (v.due > 0 && v.settled === 0) {
    return {
      stage: 'unsettled',
      headline: `확인일이 지난 ${v.due}건 중 정산 0건 — 고리가 아직 한 번도 닫히지 않았습니다.`,
    };
  }
  if (v.due === 0) {
    return {
      stage: 'closing',
      headline: `7일간 봉인 ${v.sealed}건. 확인일이 지난 결정은 아직 없습니다 — 판정은 그날부터입니다.`,
    };
  }
  return {
    stage: 'closing',
    headline: `확인일이 지난 ${v.due}건 중 ${v.settled}건이 정산됐습니다 — 고리가 돕니다.`,
  };
}

/** `a → b (n%)`, or an honest dash when there was no denominator to divide by. */
export function conversion(from: number, to: number): string {
  if (from === 0) return '—';
  return `${to}/${from} (${Math.round((to / from) * 100)}%)`;
}
