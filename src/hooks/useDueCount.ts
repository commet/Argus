'use client';

/**
 * useDueCount — the ONE definition of "what is waiting for the user's return"
 * (P0-6 ④, polish audit 2026-07-03). Three surfaces read this hook so they can
 * never drift apart:
 *
 *   - Header return badge (project dues + review dues, one number)
 *   - /project due strip ("그래서, 어떻게 됐어요?" — chips per due thing)
 *   - /workspace landing lantern (one line, renders NOTHING when due = 0)
 *
 * Return home is ONE house: the badge and the lantern both point at /project
 * (master §5-11 — settlement destinations stay the two EXISTING surfaces:
 * project decisions settle in /project's auto modal, review receipts in
 * /tools/review's ReceiptList).
 *
 * Computed every render on purpose (no memo): a memo keyed on [projects] froze
 * Date.now(), so a tab left open past midnight kept yesterday's count. Both
 * lists are small — recomputing is free. (Lifted verbatim from Header.tsx.)
 */

import { useEffect } from 'react';
import { useProjectStore } from '@/stores/useProjectStore';
import { useReviewStore } from '@/stores/useReviewStore';
import { useAuth } from '@/lib/auth';
import { contractStatus } from '@/lib/decision-contract';
import { summarizeReceipt } from '@/lib/review/status';
import type { Project } from '@/stores/types';
import type { JudgmentReceipt } from '@/lib/review/schema';

export interface DueCount {
  /** Projects whose decision-contract check-in date has arrived. */
  dueProjects: Project[];
  /** Review receipts with a sealed prediction past its check-by. */
  dueReceipts: JudgmentReceipt[];
  projectDueCount: number;
  reviewDueCount: number;
  /** The one number every return surface shows. */
  dueCount: number;
}

export function useDueCount(): DueCount {
  const projects = useProjectStore((s) => s.projects);
  const loadProjects = useProjectStore((s) => s.loadProjects);
  const receipts = useReviewStore((s) => s.receipts);
  const loadReceipts = useReviewStore((s) => s.load);
  const { user } = useAuth();

  // localStorage-first: load for EVERYONE (anon included). The seal→return loop
  // promises the anonymous cohort a dated return, so due surfaces must light up
  // for them too. Reruns when a user logs in so the remote merge lands.
  useEffect(() => {
    loadProjects();
    loadReceipts();
  }, [user, loadProjects, loadReceipts]);

  const now = Date.now();
  const dueProjects = (projects || []).filter(
    (p) => p.decision_contract && contractStatus(p.decision_contract, now).checkInDue,
  );
  const todayYMD = new Date().toISOString().slice(0, 10);
  const dueReceipts = (receipts || []).filter(
    (r) => summarizeReceipt(r, todayYMD).urgent,
  );

  return {
    dueProjects,
    dueReceipts,
    projectDueCount: dueProjects.length,
    reviewDueCount: dueReceipts.length,
    dueCount: dueProjects.length + dueReceipts.length,
  };
}
