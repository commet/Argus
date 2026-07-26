/**
 * Neutral record inventory for Telegram.
 *
 * Historical rows may still carry legacy outcome fields, but this renderer
 * never aggregates them into a score, frequency table, or maturity claim.
 */

export interface RecordCounts {
  open: number;
  settled: number;
  happened: number;
  avoided: number;
  partial: number;
}

export function recordSummaryMarkdown(c: RecordCounts, locale: 'ko' | 'en'): string {
  const ko = locale === 'ko';
  const out: string[] = [`📜 **${ko ? '내 판단 기록' : 'My records'}**`, ''];

  if (c.open + c.settled === 0) {
    out.push(ko
      ? '아직 남긴 기록이 없어요. 나중의 내가 다시 볼 만한 생각이 생기면 그 문장부터 남겨보세요.'
      : 'No records yet. When a thought is worth returning to, start by saving the sentence itself.');
    return out.join('\n');
  }

  out.push(ko
    ? `나중에 다시 볼 기록: **${c.open}** · 돌아와 답을 덧붙인 기록: **${c.settled}**`
    : `To revisit: **${c.open}** · Revisited: **${c.settled}**`);

  return out.join('\n');
}
