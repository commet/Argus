/**
 * Judgment Review receipts — localStorage-first, Supabase-synced store.
 *
 * Persistence: local write is instant; the cloud copy lives in `review_receipts`
 * (whole receipt in a `data` jsonb column, see lib/review-sync.ts). Anonymous
 * users stay local-only (getCurrentUserId → null makes every sync helper a
 * no-op); logging in merges and pushes. Ownership fields ride inside the receipt
 * and are never server-set, so the spine's honest-authorship invariant holds
 * across the sync boundary.
 */

import { create } from 'zustand';
import { STORAGE_KEYS, getStorage, setStorage } from '@/lib/storage';
import { loadReceiptsMerged, pushReceipt, deleteReceiptRemote } from '@/lib/review-sync';
import {
  type JudgmentReceipt,
  type ReceiptState,
  type FalsifiableFollowup,
  type FollowupOutcome,
} from '@/lib/review';

/** Fields the user owns when sealing a prediction (design doc §Ownership Modal). */
export interface SealPatch {
  predicate: string;
  /** user-owned lean + assumption (Ownership Modal §890) — never Argus-filled. */
  lean?: string;
  key_assumption?: string;
  pass_condition: string;
  fail_condition: string;
  check_by: string;
}

interface ReviewState {
  receipts: JudgmentReceipt[];
  loaded: boolean;
  synced: boolean;
  /** local-first hydrate; also kicks off a one-time cloud merge when logged in. */
  load: () => void;
  /** merge the cloud copy into local state (called by load; safe to await). */
  syncCloud: () => Promise<void>;
  saveReceipt: (r: JudgmentReceipt) => void;
  getReceipt: (id: string) => JudgmentReceipt | undefined;
  /** toggle a judgment obligation as user-owned; flips receipt state to owned. */
  setObligationOwned: (receiptId: string, obligationId: string, owned: boolean) => void;
  setReceiptState: (receiptId: string, state: ReceiptState) => void;
  /** Seal a falsifiable follow-up: the user owns the predicate; receipt→sealed. */
  sealFollowup: (receiptId: string, followupId: string, patch: SealPatch) => void;
  /** Settle a sealed follow-up against reality; receipt→settled. Argus records, never grades. */
  settleFollowup: (receiptId: string, followupId: string, outcome: FollowupOutcome, whatHappened: string, learned?: string) => void;
  /** Revise: push the check date instead of settling (Settlement View §933 choice). */
  reviseFollowup: (receiptId: string, followupId: string, newCheckBy: string) => void;
  remove: (receiptId: string) => void;
}

function persist(receipts: JudgmentReceipt[]): void {
  setStorage(STORAGE_KEYS.REVIEW_RECEIPTS, receipts);
}

export const useReviewStore = create<ReviewState>((set, get) => ({
  receipts: [],
  loaded: false,
  synced: false,

  load: () => {
    if (!get().loaded) {
      const local = getStorage<JudgmentReceipt[]>(STORAGE_KEYS.REVIEW_RECEIPTS, []);
      set({ receipts: local, loaded: true });
    }
    if (!get().synced) void get().syncCloud();
  },

  syncCloud: async () => {
    if (get().synced) return;
    set({ synced: true }); // guard first so concurrent mounts don't double-fetch
    try {
      const merged = await loadReceiptsMerged(get().receipts);
      set({ receipts: merged });
      persist(merged);
    } catch {
      set({ synced: false }); // let a later mount retry on transient failure
    }
  },

  saveReceipt: (r) => {
    const next = [r, ...get().receipts.filter((x) => x.receipt_id !== r.receipt_id)];
    set({ receipts: next });
    persist(next);
    pushReceipt(r);
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
    pushUpdated(next, receiptId);
  },

  setReceiptState: (receiptId, state) => {
    const next = get().receipts.map((r) =>
      r.receipt_id === receiptId ? { ...r, state, updated_at: new Date().toISOString() } : r,
    );
    set({ receipts: next });
    persist(next);
    pushUpdated(next, receiptId);
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
              lean: patch.lean?.trim() || undefined,
              key_assumption: patch.key_assumption?.trim() || undefined,
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
    pushUpdated(next, receiptId);
  },

  settleFollowup: (receiptId, followupId, outcome, whatHappened, learned) => {
    const now = new Date().toISOString();
    const next = get().receipts.map((r) => {
      if (r.receipt_id !== receiptId) return r;
      const followups: FalsifiableFollowup[] = r.falsifiable_followups.map((f) =>
        f.followup_id === followupId
          ? { ...f, outcome, what_happened: whatHappened, learned: learned?.trim() || undefined, settled_at: now }
          : f,
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
    pushUpdated(next, receiptId);
  },

  reviseFollowup: (receiptId, followupId, newCheckBy) => {
    const now = new Date().toISOString();
    const next = get().receipts.map((r) => {
      if (r.receipt_id !== receiptId) return r;
      const followups: FalsifiableFollowup[] = r.falsifiable_followups.map((f) =>
        f.followup_id === followupId
          ? { ...f, check_by: newCheckBy, revise_count: (f.revise_count ?? 0) + 1 }
          : f,
      );
      // Pushing the date keeps it sealed/active — it does not settle.
      return { ...r, falsifiable_followups: followups, updated_at: now };
    });
    set({ receipts: next });
    persist(next);
    pushUpdated(next, receiptId);
  },

  remove: (receiptId) => {
    const next = get().receipts.filter((r) => r.receipt_id !== receiptId);
    set({ receipts: next });
    persist(next);
    deleteReceiptRemote(receiptId);
  },
}));

/** Push the just-mutated receipt to the cloud (no-op when logged out). */
function pushUpdated(receipts: JudgmentReceipt[], receiptId: string): void {
  const r = receipts.find((x) => x.receipt_id === receiptId);
  if (r) pushReceipt(r);
}
