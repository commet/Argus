/**
 * Judgment Review receipts — localStorage-backed store (MVP slice).
 *
 * Persistence: receipt_only, local-only for now. Supabase sync is deferred to a
 * later slice that adds the `judgment_review_receipts` table + migration (see
 * persistence-contract.test.ts REVIEW_RECEIPTS). Keeping it local avoids the
 * PGRST204 silent-reject trap (CLAUDE.md §Schema Sync) until the column set is
 * locked. The receipt object itself already carries provenance for that move.
 */

import { create } from 'zustand';
import { STORAGE_KEYS, getStorage, setStorage } from '@/lib/storage';
import {
  type JudgmentReceipt,
  type ReceiptState,
  type FalsifiableFollowup,
  type FollowupOutcome,
} from '@/lib/review';

/** Fields the user owns when sealing a prediction (design doc §Ownership Modal). */
export interface SealPatch {
  predicate: string;
  pass_condition: string;
  fail_condition: string;
  check_by: string;
}

interface ReviewState {
  receipts: JudgmentReceipt[];
  loaded: boolean;
  load: () => void;
  saveReceipt: (r: JudgmentReceipt) => void;
  getReceipt: (id: string) => JudgmentReceipt | undefined;
  /** toggle a judgment obligation as user-owned; flips receipt state to owned. */
  setObligationOwned: (receiptId: string, obligationId: string, owned: boolean) => void;
  setReceiptState: (receiptId: string, state: ReceiptState) => void;
  /** Seal a falsifiable follow-up: the user owns the predicate; receipt→sealed. */
  sealFollowup: (receiptId: string, followupId: string, patch: SealPatch) => void;
  /** Settle a sealed follow-up against reality; receipt→settled. Argus records, never grades. */
  settleFollowup: (receiptId: string, followupId: string, outcome: FollowupOutcome, whatHappened: string) => void;
  remove: (receiptId: string) => void;
}

function persist(receipts: JudgmentReceipt[]): void {
  setStorage(STORAGE_KEYS.REVIEW_RECEIPTS, receipts);
}

export const useReviewStore = create<ReviewState>((set, get) => ({
  receipts: [],
  loaded: false,

  load: () => {
    if (get().loaded) return;
    const local = getStorage<JudgmentReceipt[]>(STORAGE_KEYS.REVIEW_RECEIPTS, []);
    set({ receipts: local, loaded: true });
  },

  saveReceipt: (r) => {
    const next = [r, ...get().receipts.filter((x) => x.receipt_id !== r.receipt_id)];
    set({ receipts: next });
    persist(next);
  },

  getReceipt: (id) => get().receipts.find((r) => r.receipt_id === id),

  setObligationOwned: (receiptId, obligationId, owned) => {
    const next = get().receipts.map((r) => {
      if (r.receipt_id !== receiptId) return r;
      const obligations = r.judgment_obligations.map((o) =>
        o.obligation_id === obligationId ? { ...o, owned_by_user: owned } : o,
      );
      const anyOwned = obligations.some((o) => o.owned_by_user);
      const state: ReceiptState = anyOwned && r.state === 'reviewed' ? 'owned' : r.state;
      return { ...r, judgment_obligations: obligations, state, updated_at: new Date().toISOString() };
    });
    set({ receipts: next });
    persist(next);
  },

  setReceiptState: (receiptId, state) => {
    const next = get().receipts.map((r) =>
      r.receipt_id === receiptId ? { ...r, state, updated_at: new Date().toISOString() } : r,
    );
    set({ receipts: next });
    persist(next);
  },

  sealFollowup: (receiptId, followupId, patch) => {
    const now = new Date().toISOString();
    const next = get().receipts.map((r) => {
      if (r.receipt_id !== receiptId) return r;
      const followups: FalsifiableFollowup[] = r.falsifiable_followups.map((f) =>
        f.followup_id === followupId
          ? {
              ...f,
              predicate: patch.predicate.trim() || f.predicate,
              pass_condition: patch.pass_condition,
              fail_condition: patch.fail_condition,
              check_by: patch.check_by,
              predicate_owner: 'user', // the user now owns it — no longer ai_surfaced
              sealed_at: now,
            }
          : f,
      );
      return { ...r, falsifiable_followups: followups, state: 'sealed' as ReceiptState, updated_at: now };
    });
    set({ receipts: next });
    persist(next);
  },

  settleFollowup: (receiptId, followupId, outcome, whatHappened) => {
    const now = new Date().toISOString();
    const next = get().receipts.map((r) => {
      if (r.receipt_id !== receiptId) return r;
      const followups: FalsifiableFollowup[] = r.falsifiable_followups.map((f) =>
        f.followup_id === followupId ? { ...f, outcome, what_happened: whatHappened, settled_at: now } : f,
      );
      // Receipt is settled once every sealed follow-up has an outcome.
      const allSealedSettled = followups
        .filter((f) => f.sealed_at)
        .every((f) => f.settled_at);
      const state: ReceiptState = allSealedSettled ? 'settled' : r.state;
      return { ...r, falsifiable_followups: followups, state, updated_at: now };
    });
    set({ receipts: next });
    persist(next);
  },

  remove: (receiptId) => {
    const next = get().receipts.filter((r) => r.receipt_id !== receiptId);
    set({ receipts: next });
    persist(next);
  },
}));
