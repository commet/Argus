/**
 * Review → DKK onramp bridge (ADR-2026-07-15-dkk-review-onramp).
 *
 * The document review is where a human ADOPTS one of the AI-surfaced judgment
 * obligations. That single "내 판단으로 기록하기" act is a DKK `seal`: it
 * records the AI proposal, the human's sealed judgment, and the return contract
 * in one atomic batch on the canonical project ledger — after which the
 * judgment's lifecycle (observe / resolve / close) lives in DKK, not the local
 * review store.
 *
 * `buildReviewSealCommand` is pure (unit-tested); `sealReviewObligation` wires in
 * sign-in, project promotion, and the network submit.
 */

import { getSessionWithTimeout } from '@/lib/supabase';
import { submitProjectSemanticCommand, SemanticLedgerClientError } from '@/lib/semantic-web-client';
import { useProjectStore } from '@/stores/useProjectStore';
import { upsertToSupabase } from '@/lib/db';
import { generateId } from '@/lib/uuid';
import type { SemanticWebCommand } from '@/lib/semantic-web';
import type { JudgmentReceipt, JudgmentObligation } from '@/lib/review';

/** The return contract the user commits to when sealing (from the seal modal). */
export interface ReviewReturnContract {
  predicate: string;
  check_by: string; // YYYY-MM-DD
  pass_condition?: string;
  fail_condition?: string;
}

export interface ReviewSealIds {
  judgment_id: string;
  command_id: string;
  proposal_id: string;
}

export type ReviewSealResult =
  | { ok: true; judgment_id: string; project_id: string }
  | { ok: false; code: 'NOT_SIGNED_IN' | 'PROJECT_SYNC_FAILED' | 'SEAL_FAILED'; message?: string };

/** YYYY-MM-DD → noon UTC, so a timezone never shifts the calendar day. */
export function isoFromDay(day: string): string {
  return `${day}T12:00:00.000Z`;
}

/**
 * Pure: map a reviewed obligation + its return contract into the DKK seal
 * command (which the gateway expands into proposal_created + judgment_sealed +
 * return_promised). No I/O — ids are injected so the result is deterministic.
 */
export function buildReviewSealCommand(
  receipt: Pick<JudgmentReceipt, 'receipt_id'>,
  obligation: Pick<JudgmentObligation, 'statement'>,
  contract: ReviewReturnContract,
  ids: ReviewSealIds,
): Extract<SemanticWebCommand, { kind: 'seal' }> {
  const criterion = [
    contract.pass_condition?.trim() && `pass: ${contract.pass_condition.trim()}`,
    contract.fail_condition?.trim() && `fail: ${contract.fail_condition.trim()}`,
  ].filter(Boolean).join(' / ');
  return {
    kind: 'seal',
    command_id: ids.command_id,
    judgment_id: ids.judgment_id,
    statement: obligation.statement,
    return_contract_id: `${ids.judgment_id}:return`,
    review_at: isoFromDay(contract.check_by),
    review_question: contract.predicate,
    ...(criterion ? { resolution_criterion: criterion } : {}),
    // Onramp provenance: the sealed judgment was adopted from this AI proposal on
    // this reviewed document.
    proposal_id: ids.proposal_id,
    proposal_text: obligation.statement,
    source_ref: `review:${receipt.receipt_id}`,
  };
}

/** Ensure a project row exists locally AND is committed to Supabase — the seal
 *  RPC requires the server-side project row (createProject only fire-and-forgets
 *  the upsert). Returns the project id. */
async function ensureProjectCommitted(receipt: JudgmentReceipt): Promise<string> {
  const store = useProjectStore.getState();
  const projectId = receipt.project_id?.replace(/^account-project:/, '')
    || store.getOrCreateProject(receipt.source_title || '검수한 문서');
  const project = store.getProject(projectId);
  if (project) await upsertToSupabase('projects', project);
  return projectId;
}

/**
 * Seal one reviewed obligation into the DKK canonical ledger. Requires a
 * signed-in user (the ledger is per-account); the local review receipt still
 * works for anonymous analysis. Returns the sealed judgment id on success.
 */
export async function sealReviewObligation(
  receipt: JudgmentReceipt,
  obligation: JudgmentObligation,
  contract: ReviewReturnContract,
): Promise<ReviewSealResult> {
  const session = await getSessionWithTimeout();
  if (!session?.access_token) return { ok: false, code: 'NOT_SIGNED_IN' };

  let projectId: string;
  try {
    projectId = await ensureProjectCommitted(receipt);
  } catch (e) {
    return { ok: false, code: 'PROJECT_SYNC_FAILED', message: (e as Error)?.message };
  }

  const ids: ReviewSealIds = {
    judgment_id: `web-judgment:${generateId()}`,
    command_id: generateId(),
    proposal_id: `web-proposal:${generateId()}`,
  };
  const command = buildReviewSealCommand(receipt, obligation, contract, ids);

  try {
    await submitProjectSemanticCommand(projectId, command);
  } catch (e) {
    // The project row may not have been visible yet — commit again and retry once.
    if (e instanceof SemanticLedgerClientError && /FORBIDDEN|PROJECT_NOT_FOUND/i.test(e.code)) {
      try {
        const project = useProjectStore.getState().getProject(projectId);
        if (project) await upsertToSupabase('projects', project);
        await submitProjectSemanticCommand(projectId, command);
      } catch (e2) {
        return { ok: false, code: 'SEAL_FAILED', message: (e2 as Error)?.message };
      }
    } else {
      return { ok: false, code: 'SEAL_FAILED', message: (e as Error)?.message };
    }
  }
  return { ok: true, judgment_id: ids.judgment_id, project_id: projectId };
}
