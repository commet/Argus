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
import {
  type PremiseState,
  type PremiseRecheck,
  premiseId as makePremiseId,
  MAX_ACTIVE_PREMISES,
  MAX_LOAD_BEARING,
} from '@/lib/premises-core';
import { evaluateMateriality, type MaterialityRule, type Materiality } from '@/lib/numeric-drift';

/** What the user supplies to promote an extracted assumption/claim into a tracked
 *  premise. Provenance is 'ai' with the original wording preserved (ai_original). */
export interface PromotePremiseInput {
  text: string;
  load_bearing: boolean;
  /** true = re-checkable against reality (arms the recheck-due nudge). */
  external: boolean;
  recheck_cadence_days?: number;
  materiality_rule?: MaterialityRule;
}

/** The user's reality finding for one premise. The host/user supplies it — the
 *  system never auto-detects a change (honest limit). */
export interface RecheckInput {
  finding: string;
  numeric_value?: number;
  /** text premises: the user's asserted "did the fact change?" research finding. */
  changed?: boolean;
  source: 'url' | 'user_stated' | 'host_reported';
  source_detail?: string;
}

/** The materiality verdict a recheck produces — surfaced as "fact + handle",
 *  never as a directive. 'baseline' = first check, records only. */
export type RecheckStatus = Materiality | 'baseline';

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
  /** Promote an extracted assumption/claim into a tracked premise (living premises).
   *  Respects the caps (5 active / 2 load-bearing) so tracking can never nag. */
  promotePremise: (receiptId: string, input: PromotePremiseInput) => void;
  /** Re-check one premise against a reality finding the user supplies; records it
   *  and returns the materiality verdict for a "fact + handle" surface (never a
   *  directive). PULL only — the system never auto-detects a change. */
  recheckPremise: (receiptId: string, premiseId: string, input: RecheckInput) => RecheckStatus;
  /** Opt a premise in/out of the autonomous watcher (Workstream E). When on, the
   *  server cron auto-researches it at its cadence and emails a proactive alert on
   *  a material change. Explicit per-premise consent — its text leaves the device
   *  only when this is on. */
  setAutoWatch: (receiptId: string, premiseId: string, on: boolean, query?: string) => void;
  /** Stop tracking a premise (status→retired). Never deletes history. */
  retirePremise: (receiptId: string, premiseId: string) => void;
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

  promotePremise: (receiptId, input) => {
    const now = new Date().toISOString();
    const text = input.text.trim();
    if (!text) return;
    const next = get().receipts.map((r) => {
      if (r.receipt_id !== receiptId) return r;
      const existing = r.tracked_premises ?? [];
      const pid = makePremiseId(r.receipt_id, 'premise', text);
      if (existing.some((p) => p.premise_id === pid)) return r; // dedup
      const active = existing.filter((p) => p.status === 'active');
      if (active.length >= MAX_ACTIVE_PREMISES) return r; // cap → silently no-op (UI discloses)
      const lbCount = active.filter((p) => p.load_bearing).length;
      const load_bearing = input.load_bearing && lbCount < MAX_LOAD_BEARING;
      const ordinal = existing.reduce((m, p) => Math.max(m, p.ordinal), 0) + 1;
      const premise: PremiseState = {
        premise_id: pid,
        ordinal,
        kind: 'premise',
        text,
        external: input.external,
        load_bearing,
        source: 'ai',
        ai_original: text,
        ...(input.materiality_rule ? { materiality_rule: input.materiality_rule } : {}),
        ...(typeof input.recheck_cadence_days === 'number' ? { recheck_cadence_days: input.recheck_cadence_days } : {}),
        status: 'active',
        amend_history: [],
        recheck_count: 0,
        added_ts: now,
      };
      return { ...r, tracked_premises: [...existing, premise], updated_at: now };
    });
    set({ receipts: next });
    persist(next);
    pushUpdated(next, receiptId);
  },

  recheckPremise: (receiptId, premiseId, input) => {
    const now = new Date().toISOString();
    const finding = input.finding.trim();
    let status: RecheckStatus = 'baseline';
    const next = get().receipts.map((r) => {
      if (r.receipt_id !== receiptId) return r;
      const premises = (r.tracked_premises ?? []).map((p) => {
        if (p.premise_id !== premiseId) return p;
        const prior = p.last_recheck;
        const baselineOnly = !prior;
        if (baselineOnly) {
          status = 'baseline';
        } else if (typeof input.numeric_value === 'number' && typeof prior!.numeric_value === 'number') {
          status = evaluateMateriality(prior!.numeric_value, input.numeric_value, p.materiality_rule).status;
        } else if (typeof input.changed === 'boolean') {
          status = input.changed ? 'material' : 'unchanged';
        } else {
          // no comparable value and no assertion → nothing to decide; record only.
          status = 'unchanged';
        }
        const rec: PremiseRecheck = {
          finding,
          ...(typeof input.numeric_value === 'number' ? { numeric_value: input.numeric_value } : {}),
          drifted: status === 'material',
          baseline_only: baselineOnly,
          source: input.source,
          ...(input.source_detail ? { source_detail: input.source_detail } : {}),
          ts: now,
        };
        return { ...p, last_recheck: rec, recheck_count: p.recheck_count + 1 };
      });
      return { ...r, tracked_premises: premises, updated_at: now };
    });
    set({ receipts: next });
    persist(next);
    pushUpdated(next, receiptId);
    return status;
  },

  setAutoWatch: (receiptId, premiseId, on, query) => {
    const now = new Date().toISOString();
    const next = get().receipts.map((r) => {
      if (r.receipt_id !== receiptId) return r;
      const premises = (r.tracked_premises ?? []).map((p) =>
        p.premise_id === premiseId
          ? { ...p, auto_watch: on, watch_query: on ? (query?.trim() || p.watch_query) : p.watch_query }
          : p,
      );
      return { ...r, tracked_premises: premises, updated_at: now };
    });
    set({ receipts: next });
    persist(next);
    pushUpdated(next, receiptId);
  },

  retirePremise: (receiptId, premiseId) => {
    const now = new Date().toISOString();
    const next = get().receipts.map((r) => {
      if (r.receipt_id !== receiptId) return r;
      const premises = (r.tracked_premises ?? []).map((p) =>
        p.premise_id === premiseId ? { ...p, status: 'retired' as const } : p,
      );
      return { ...r, tracked_premises: premises, updated_at: now };
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
