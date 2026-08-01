import type { OpenQuestionNudge, PremiseChange } from '@/lib/companion-brief';
import { isReconsiderable, nextReponderDue } from '@/lib/premises-core';
import type { JudgmentReceipt } from '@/lib/review';

export function dueOpenQuestions(receipt: JudgmentReceipt, todayYMD: string): OpenQuestionNudge[] {
  const armed = receipt.state === 'sealed'
    || (receipt.falsifiable_followups || []).some((f) => f.sealed_at && !f.settled_at);
  if (!armed) return [];
  return (receipt.tracked_premises || [])
    .filter((p) => isReconsiderable(p))
    .filter((p) => {
      const due = nextReponderDue(p);
      return due === null || due <= todayYMD;
    })
    .map((p) => ({ ordinal: p.ordinal, text: p.text }));
}

function parseSourceDetail(detail?: string): { source_url: string; source_date?: string } {
  if (!detail) return { source_url: '' };
  const match = /^(.*?)\s+\((\d{4}-\d{2}-\d{2})\)$/.exec(detail);
  if (match) return { source_url: match[1], source_date: match[2] };
  return { source_url: detail };
}

export function pendingBriefChanges(receipt: JudgmentReceipt): PremiseChange[] {
  return (receipt.tracked_premises || [])
    .filter((premise) => premise.last_recheck?.brief_pending)
    .map((premise) => {
      const last = premise.last_recheck!;
      const source = parseSourceDetail(last.source_detail);
      return {
        ordinal: premise.ordinal,
        premise_id: premise.premise_id,
        text: premise.text,
        ...(last.baseline_finding ? { baseline: last.baseline_finding } : {}),
        ...(typeof last.baseline_numeric_value === 'number' ? { baseline_numeric_value: last.baseline_numeric_value } : {}),
        fact: last.finding,
        ...(typeof last.numeric_value === 'number' ? { current_value: last.numeric_value } : {}),
        source_url: source.source_url,
        source_date: source.source_date,
        checked_at: last.ts,
        confidence: last.confidence,
        kind: premise.kind,
      };
    });
}

export function clearPendingBriefChanges(receipt: JudgmentReceipt): JudgmentReceipt {
  return {
    ...receipt,
    tracked_premises: (receipt.tracked_premises || []).map((premise) => {
      if (!premise.last_recheck?.brief_pending) return premise;
      const { brief_pending: _pending, brief_kind: _kind, ...last } = premise.last_recheck;
      void _pending;
      void _kind;
      return { ...premise, last_recheck: last };
    }),
  };
}
