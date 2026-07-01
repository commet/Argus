/**
 * Companion Brief — the return trigger (design doc §"Companion / 귀환").
 *
 * NOT a reminder. When a sealed prediction's check date arrives, Argus comes
 * back carrying the exact judgment the user sealed — the decision, the predicate,
 * what would count as right/wrong — and hands the settlement back to them. The
 * spine holds across the boundary: Argus never says whether it came true. It
 * shows what reality was asked, and the user records the answer.
 *
 * Pure builder (no I/O) so the copy is unit-tested and the cron route stays a
 * thin delivery shell. Voice: 해요체 동료, no score, no praise/blame vocab.
 */

export interface DuePredicate {
  predicate: string;
  pass_condition: string;
  fail_condition: string;
  check_by: string;
}

export interface DueReceiptBrief {
  source_title: string;
  core_question: string;
  predicates: DuePredicate[];
}

export interface CompanionBriefEmail {
  subject: string;
  /** Markdown body (rendered by markdownToEmailHtml). */
  markdown: string;
  url: string;
}

/**
 * Build the return email for one user's due receipts. `items` must already be
 * filtered to sealed-but-unsettled predicates whose check date has arrived.
 */
export function buildCompanionBrief(items: DueReceiptBrief[], baseUrl = 'https://argus.voyage'): CompanionBriefEmail {
  const url = `${baseUrl}/tools/review`;
  const count = items.reduce((n, it) => n + it.predicates.length, 0);
  const lead = items[0]?.source_title?.slice(0, 40) || '그 판단';
  const subject =
    count === 1
      ? `현실이 답할 차례예요 — ${lead}`
      : `확인할 차례가 된 판단 ${count}가지 — ${lead} 외`;

  const blocks: string[] = [
    '그때 봉인해두셨던 판단들의 확인일이 왔어요. 맞았는지 틀렸는지는 제가 정하지 않아요 — 현실이 어땠는지만, 당신이 1분 안에 기록하면 돼요.',
    '',
  ];

  for (const it of items) {
    blocks.push(`## ${it.source_title}`);
    if (it.core_question) blocks.push(`_${it.core_question}_`);
    blocks.push('');
    for (const p of it.predicates) {
      blocks.push(`- **봉인한 예측:** ${p.predicate}`);
      if (p.pass_condition) blocks.push(`  - 맞음: ${p.pass_condition}`);
      if (p.fail_condition) blocks.push(`  - 틀림: ${p.fail_condition}`);
      blocks.push(`  - 확인일: ${p.check_by}`);
    }
    blocks.push('');
  }

  blocks.push('아직 결과를 모르겠으면 "아직 불분명"도 답이에요. 그대로 기록해두면 다음에 다시 물어볼게요.');
  blocks.push('');
  blocks.push(`[내 판단 항로에서 정산하기 →](${url})`);

  return { subject, markdown: blocks.join('\n'), url };
}
