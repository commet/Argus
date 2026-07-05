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

/** A tracked premise whose re-check cadence has come due. This is an INVITATION
 *  to re-check reality — never a claim that the fact changed (the system cannot
 *  auto-detect that; the user supplies the finding). Honest-limit copy. */
export interface DuePremiseNudge {
  ordinal: number;
  text: string;
  /** the finding recorded at the last re-check, if any (context, not a verdict). */
  last_finding?: string;
}

export interface DueReceiptBrief {
  source_title: string;
  core_question: string;
  predicates: DuePredicate[];
  /** monitored premises due for a re-check (living premises). */
  premise_nudges?: DuePremiseNudge[];
  /** Delta — what changed since the seal (e.g. a newer version exists). Optional. */
  delta?: string;
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
  const count = items.reduce((n, it) => n + it.predicates.length + (it.premise_nudges?.length ?? 0), 0);
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
    if (it.core_question) blocks.push(`_${it.core_question}_`); // Recall
    blocks.push('');
    for (const p of it.predicates) {
      // Recall + Reality Check
      blocks.push(`- **봉인한 예측:** ${p.predicate}`);
      if (p.pass_condition) blocks.push(`  - 맞음: ${p.pass_condition}`);
      if (p.fail_condition) blocks.push(`  - 틀림: ${p.fail_condition}`);
      blocks.push(`  - 확인일: ${p.check_by}`);
      // Suggestion — a concrete check action, never a verdict (§Companion Brief)
      const check = p.pass_condition || p.fail_condition;
      if (check) blocks.push(`  - 지금 확인할 것: "${check}"가 실제로 그런지 데이터/사실 하나만 보세요.`);
    }
    // Premise re-check nudges — an INVITATION to look at reality, never a claim
    // that the fact changed. Argus can't watch reality for you; you supply the
    // finding when you come back. (honest-limit copy)
    if (it.premise_nudges?.length) {
      blocks.push('');
      blocks.push('**재확인할 전제** (제가 현실을 대신 감시하진 못해요 — 잠깐 확인만 부탁드려요):');
      for (const n of it.premise_nudges) {
        blocks.push(`- P${n.ordinal}: ${n.text} — 지금 현실은 어때요?`);
        if (n.last_finding) blocks.push(`  - 지난 확인: ${n.last_finding}`);
      }
    }
    // Delta — what changed since the seal
    if (it.delta) blocks.push(`\n_그 사이 바뀐 것: ${it.delta}_`);
    blocks.push('');
  }

  // Choice
  blocks.push('답할 수 있는 것: 그렇게 됐다 / 피했다 / 부분적으로 / 아직 불분명 — 또는 날짜만 미루기. 아직 모르겠으면 "아직 불분명"도 답이에요.');
  blocks.push('');
  blocks.push(`[내 판단 항로에서 정산하기 →](${url})`);
  // Opt-out notice (04 S5): the seal modal promised "one email for the
  // settlement, nothing else" — the email itself carries the exit too.
  blocks.push('');
  blocks.push('_이 메일은 검수에서 예측을 봉인해서 받는 정산용 한 통이에요. 더 받고 싶지 않으면 이 메일에 답장으로 알려주세요 — 바로 멈출게요._');

  return { subject, markdown: blocks.join('\n'), url };
}
