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
  outcome?: 'held' | 'avoided' | 'partial' | 'still_pending' | 'missed';
  outcome_source?: 'user_stated';
  assumption_held?: boolean | null;

  /** How many times reality had not answered at a check-by and the user deferred
   *  (still_pending → re-armed). Rendered as a neutral fact, never a grade. 0/absent
   *  ⇒ nothing shown. */
  deferred_times?: number;
  /** The FIRST check-by, when the record was deferred at least once — so the
   *  receipt can say "originally due X" alongside the final settled date. */
  originally_due?: string;

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
  patch: {
    what_happened: string; outcome: Receipt['outcome']; settled_at: string;
    /** Deferral history from the ledger fold (still_pending re-arms). Recorded as
     *  a neutral fact on the receipt; 0/absent ⇒ nothing shown. */
    deferred_times?: number; originally_due?: string;
  },
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
    // 'missed' = the sealed read was wrong → the assumption did not hold (§7.2).
    patch.outcome === 'avoided' || patch.outcome === 'partial' || patch.outcome === 'missed' ? false :
    null;

  const merged: Receipt = {
    ...base,
    // The ledger is the source of truth for the sealed prediction and its date.
    // A change_prediction (amend) updates the CONTRACT but not the seal-time
    // receipt file on disk, so `base.predicate`/`check_by` can be STALE — the
    // receipt then contradicts every list view (dogfood: receipt printed the
    // pre-amend "8월" predicate while the record showed the amended "9월" one).
    // Prefer the current contract values the settle handler resolved from the
    // fold, so the keepsake can never disagree with the ledger.
    ...(fallback?.predicate ? { predicate: fallback.predicate } : {}),
    ...(fallback?.check_by ? { check_by: fallback.check_by } : {}),
    settled_at: patch.settled_at,
    what_happened: patch.what_happened,
    outcome: patch.outcome,
    outcome_source: 'user_stated',
    assumption_held,
    ...(patch.deferred_times && patch.deferred_times > 0
      ? { deferred_times: patch.deferred_times, ...(patch.originally_due ? { originally_due: patch.originally_due } : {}) }
      : {}),
    ai_verdict: SPINE_INVARIANTS.aiVerdict,
  };
  await atomicWriteJson(receiptPath(argusDir, id), merged);
  return merged;
}

export function readReceipt(argusDir: string, id: string): Receipt | null {
  try {
    const parsed: unknown = JSON.parse(deBom(fs.readFileSync(receiptPath(argusDir, id), 'utf8')));
    // A hand-edited / corrupt receipt could be a primitive, null, or an array;
    // renderReceipt does r.predicate.split(...) unguarded and writeSettleReceipt
    // spreads `base`, so a non-object would crash the render / drop every field.
    // Reject anything but a plain object — a corrupt keepsake degrades, not dies.
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Receipt;
  } catch {
    return null;
  }
}
