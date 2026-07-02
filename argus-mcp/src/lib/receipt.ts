import fs from 'fs';
import { deBom } from './deBom.js';
import { atomicWriteJson } from './atomic-write.js';
import { receiptPath } from './layout.js';
import { SCHEMA_VERSION, SPINE_INVARIANTS } from './spine.js';

/**
 * The Judgment Receipt (blueprint §2.3 + addendum C/E/N7). The differentiated
 * asset: a falsifiable prediction sealed, brought back, and checked against
 * reality, with AI-verdict literally null.
 *
 * The seal-time fields (real_question / unverified_assumption / human_only /
 * human_judgment) are captured at SEAL — without them the receipt's
 * "...made by Me. (not the model)" line is blank, which is the whole point.
 */
/** Sentinel for a judgment field the user chose not to name (addendum: explicit
 * skip trace, not a silent blank and not a forced gate). */
export const SKIPPED = '(skipped)';

export interface Receipt {
  v: number;
  id: string;
  created_at: string;

  // seal-time capture
  real_question: string;
  unverified_assumption: string;
  human_only: string;
  human_judgment: string;          // owner: always the user, never ai_surfaced
  human_judgment_owner: 'user';
  /** Which of the judgment fields were left unnamed at seal — recorded honestly, never hidden. */
  skipped: string[];
  predicate: string;
  check_by: string;
  basis?: 'judgment' | 'luck' | 'mixed' | 'unsure';

  // settle-time patch
  settled_at?: string;
  what_happened?: string;
  outcome?: 'held' | 'avoided' | 'partial' | 'still_pending';
  outcome_source?: 'user_stated';
  assumption_held?: boolean | null;

  ai_verdict: null;                // literal null — drift-guard asserts this
}

export interface ReceiptSeed {
  id: string;
  real_question?: string;
  unverified_assumption?: string;
  human_only?: string;
  human_judgment?: string;
  predicate: string;
  check_by: string;
  basis?: Receipt['basis'];
}

/** Write the seal-time receipt. Single write (no read-merge race, E).
 *  Judgment fields left unnamed are recorded as an explicit skip, not a silent
 *  blank — the spine keeps the escape (you can still seal) but the omission is
 *  honest and visible. */
export async function writeSealReceipt(argusDir: string, seed: ReceiptSeed, now: string): Promise<Receipt> {
  const skipped: string[] = [];
  const field = (name: string, value: string | undefined): string => {
    if (typeof value === 'string' && value.trim().length > 0) return value;
    skipped.push(name);
    return SKIPPED;
  };

  const receipt: Receipt = {
    v: SCHEMA_VERSION,
    id: seed.id,
    created_at: now,
    real_question: field('real_question', seed.real_question),
    unverified_assumption: field('unverified_assumption', seed.unverified_assumption),
    human_only: field('human_only', seed.human_only),
    human_judgment: field('human_judgment', seed.human_judgment),
    human_judgment_owner: 'user',
    skipped,
    predicate: seed.predicate,
    check_by: seed.check_by,
    ...(seed.basis ? { basis: seed.basis } : {}),
    ai_verdict: SPINE_INVARIANTS.aiVerdict,
  };
  await atomicWriteJson(receiptPath(argusDir, seed.id), receipt);
  return receipt;
}

/** Patch the receipt at settle time. Reads the seal-time receipt, adds the reality fields, single atomic write. */
export async function writeSettleReceipt(
  argusDir: string,
  id: string,
  patch: { what_happened: string; outcome: Receipt['outcome']; settled_at: string },
  /** Ledger-replay fallback when the seal-time receipt file was lost (11 S7):
   *  without it the rebuilt receipt printed empty quotes for the prediction. */
  fallback?: { predicate?: string; check_by?: string },
): Promise<Receipt> {
  const existing = readReceipt(argusDir, id);
  const base: Receipt = existing ?? {
    v: SCHEMA_VERSION, id, created_at: patch.settled_at,
    real_question: SKIPPED, unverified_assumption: SKIPPED, human_only: SKIPPED, human_judgment: SKIPPED,
    human_judgment_owner: 'user', skipped: ['real_question', 'unverified_assumption', 'human_only', 'human_judgment'],
    predicate: fallback?.predicate ?? '', check_by: fallback?.check_by ?? '',
    ai_verdict: SPINE_INVARIANTS.aiVerdict,
  };
  const assumption_held =
    patch.outcome === 'held' ? true :
    patch.outcome === 'avoided' || patch.outcome === 'partial' ? false :
    null;

  const merged: Receipt = {
    ...base,
    settled_at: patch.settled_at,
    what_happened: patch.what_happened,
    outcome: patch.outcome,
    outcome_source: 'user_stated',
    assumption_held,
    ai_verdict: SPINE_INVARIANTS.aiVerdict,
  };
  await atomicWriteJson(receiptPath(argusDir, id), merged);
  return merged;
}

export function readReceipt(argusDir: string, id: string): Receipt | null {
  try {
    return JSON.parse(deBom(fs.readFileSync(receiptPath(argusDir, id), 'utf8'))) as Receipt;
  } catch {
    return null;
  }
}
