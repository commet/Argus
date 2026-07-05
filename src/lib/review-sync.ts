/**
 * Judgment Receipt ↔ Supabase sync (design doc §"Receipt 저장/동기화").
 *
 * The receipt is a rich nested object, so syncing it field-by-field would be a
 * PGRST204 drift trap (CLAUDE.md §Schema Sync). Instead the whole receipt rides
 * in one `data` jsonb column; only the fields the Companion cron + dashboard
 * query (state, next_check_by, titles) are lifted to real columns. All writes
 * still route through db.ts (never supabase.from() directly, per CLAUDE.md).
 *
 * Anonymous users have no user_id → every helper is a silent no-op and the
 * receipt stays in localStorage. The wedge works logged-out; login upgrades it.
 */

import { fetchFromSupabase, upsertToSupabase, softDeleteFromSupabase } from './db';
import { type JudgmentReceipt, summarizeReceipt } from './review';
import { isMonitored, nextRecheckDue } from './premises-core';

interface ReceiptRow {
  id: string;
  state: string;
  source_title: string;
  source_kind: string;
  next_check_by: string | null;
  data: JudgmentReceipt;
  updated_at?: string;
  created_at?: string;
  deleted_at?: string | null;
}

function todayYMD(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * The soonest date the cron should reach out — the earlier of (a) a sealed
 * prediction's check-by (summarizeReceipt) and (b) a monitored premise's next
 * re-check due date. Premises are armed only once the receipt is sealed, mirroring
 * the MCP's isNudgeArmed, so tracking never nags a not-yet-sealed review.
 */
function nextCheckByWithPremises(receipt: JudgmentReceipt, today: string): string | null {
  const dues: string[] = [];
  const base = summarizeReceipt(receipt, today).next_check_by;
  if (base) dues.push(base);
  const armed = receipt.state === 'sealed'
    || (receipt.falsifiable_followups || []).some((f) => f.sealed_at && !f.settled_at);
  if (armed) {
    for (const p of receipt.tracked_premises || []) {
      if (!isMonitored(p)) continue;
      const due = nextRecheckDue(p); // null = never checked → due now
      dues.push(due ?? today);
    }
  }
  if (dues.length === 0) return null;
  return dues.reduce((a, b) => (a < b ? a : b));
}

/** Map a receipt to its storage row (lifted query columns + jsonb blob). */
export function toReceiptRow(receipt: JudgmentReceipt): ReceiptRow {
  return {
    id: receipt.receipt_id,
    state: receipt.state,
    source_title: receipt.source_title,
    source_kind: receipt.source_kind,
    next_check_by: nextCheckByWithPremises(receipt, todayYMD()),
    data: receipt,
  };
}

/** Newest-wins merge on receipt_id using the app-level updated_at. */
function mergeReceipts(local: JudgmentReceipt[], remote: JudgmentReceipt[]): JudgmentReceipt[] {
  const map = new Map<string, JudgmentReceipt>();
  for (const r of local) map.set(r.receipt_id, r);
  for (const r of remote) {
    const cur = map.get(r.receipt_id);
    if (!cur) map.set(r.receipt_id, r);
    else if ((r.updated_at || '') > (cur.updated_at || '')) map.set(r.receipt_id, r);
  }
  return Array.from(map.values());
}

/**
 * Merge local receipts with the cloud copy and push any local-only ones up.
 * Returns the merged list (or `local` unchanged when logged-out / offline).
 */
export async function loadReceiptsMerged(local: JudgmentReceipt[]): Promise<JudgmentReceipt[]> {
  const rows = await fetchFromSupabase<ReceiptRow>('review_receipts', 'updated_at');
  if (!rows.length) {
    // Logged-out (fetch returns []) OR genuinely empty cloud: push local up so a
    // first login doesn't strand the anon receipts. push is itself a no-op anon.
    for (const r of local) void upsertToSupabase('review_receipts', toReceiptRow(r));
    return local;
  }
  const remote = rows.filter((row) => !row.deleted_at && row.data).map((row) => row.data);
  const merged = mergeReceipts(local, remote);

  // push local-only (created offline / before login) to the cloud
  const remoteIds = new Set(remote.map((r) => r.receipt_id));
  for (const r of merged) {
    if (!remoteIds.has(r.receipt_id)) void upsertToSupabase('review_receipts', toReceiptRow(r));
  }
  return merged;
}

/** Fire-and-forget push of one receipt (after review / seal / settle / own). */
export function pushReceipt(receipt: JudgmentReceipt): void {
  void upsertToSupabase('review_receipts', toReceiptRow(receipt));
}

/** Soft-delete so the row can't resurrect on the next merge. */
export function deleteReceiptRemote(receiptId: string): void {
  void softDeleteFromSupabase('review_receipts', receiptId);
}
