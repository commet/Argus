/**
 * Opt-in account sync (design: "MCP도 이메일로 귀환").
 *
 * The MCP server is a short-lived stdio process — it is NOT alive at a
 * prediction's check-by date, so it cannot email you itself. To close the loop
 * it pushes the sealed prediction to the user's Argus account, where an
 * always-on server cron (the Companion Brief) emails it when it comes due and
 * the webapp dashboard shows it.
 *
 * Strictly opt-in: with no ARGUS_TOKEN the push is a silent no-op and the seal
 * stays purely local (the privacy-preserving default). Fire-safe: any failure
 * degrades to local-only and never breaks the seal that already succeeded.
 *
 *   MCP config env:
 *     ARGUS_TOKEN    argus_pat_… (issued in the webapp; same token as `argus push`)
 *     ARGUS_API_URL  optional, defaults to https://argus.voyage
 */

import { resolveAccountApiUrl, resolveAccountToken, accountCredentialStatus } from '../a0/account-credentials.js';

export interface SealPush {
  action: 'seal';
  id: string;
  predicate: string;
  check_by: string;
  sealed_at?: string;
  source_title?: string;
  real_question?: string;
  human_judgment?: string;
  /** ONLY when the user opted in (`premise_sync: true`, §9.2-4): the sealed
   *  decision's monitored premises, so the account's premise-watch (T2) can
   *  re-check them against reality. Absent by default — premise data does not
   *  leave the machine without this explicit switch. */
  tracked_premises?: Array<Record<string, unknown>>;
}

export interface SettlePush {
  action: 'settle';
  id: string;
  outcome: 'held' | 'avoided' | 'partial' | 'still_pending' | 'missed';
  what_happened?: string;
  settled_at?: string;
}

/**
 * Reality has not answered at the check-by, so the bet is re-armed with a new
 * date and stays alive. NOT a `seal` re-push: that upserts a freshly built
 * receipt over the account row's `data`, wiping premises or edits the user made
 * on the web. NOT a `settle`: the account would close a bet nobody resolved and
 * stop emailing it. The account keeps nudging — at the right date.
 */
export interface DeferPush {
  action: 'defer';
  id: string;
  /** the new check-by (YYYY-MM-DD) */
  check_by: string;
  /** the user's own words for why reality is still silent */
  what_happened?: string;
}

/**
 * The user set the decision aside. The account must stop nudging it, or the
 * Companion Brief keeps emailing a decision they explicitly killed. Archived,
 * never "settled" — nothing reality said was recorded.
 */
export interface DismissPush {
  action: 'dismiss';
  id: string;
}

export type AccountPush = SealPush | SettlePush | DeferPush | DismissPush;

export interface PushResult {
  synced: boolean;
  reason?: string;
}

const TIMEOUT_MS = 5000;

export interface AccountReceipt {
  id: string;
  source_title: string;
  state: string;
  next_check_by: string | null;
  due: boolean;
  core_question: string;
  open_predicates: { predicate: string; check_by: string }[];
  /** Present when the account holds a settlement — the USER's own web-stated
   *  outcome and words, so argus_sync can mirror it into the local ledger as
   *  their record (never a machine verdict). Web outcome vocabulary
   *  ('happened'|'unclear'|…) — the importer maps it to the MCP enum. */
  settled_predicates?: { predicate: string; outcome: string; what_happened: string; settled_at?: string }[];
}

export interface PullResult {
  ok: boolean;
  reason?: string;
  receipts: AccountReceipt[];
}

/**
 * Resolve the account API base, enforcing https so the Bearer token never
 * travels in cleartext (MCP compliance audit F2). `ARGUS_API_URL` is a
 * self-host override; a non-https override (except localhost, for local dev)
 * returns null → callers skip the send rather than leak the token over http.
 */
function resolveApiBase(): string | null {
  const raw = resolveAccountApiUrl().replace(/\/+$/, '');
  try {
    const u = new URL(raw);
    const localhost = u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '::1';
    if (u.protocol !== 'https:' && !localhost) return null;
    return raw;
  } catch {
    return null;
  }
}

/** Pull the account's receipts (the sync's read side). No token ⇒ empty. */
export async function fetchAccountReceipts(): Promise<PullResult> {
  const token = resolveAccountToken();
  if (!token || !token.startsWith('argus_pat_')) return { ok: false, reason: noTokenReason(), receipts: [] };
  const base = resolveApiBase();
  if (!base) return { ok: false, reason: 'insecure_api_url', receipts: [] };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/api/mcp/receipts`, {
      headers: { authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, reason: `http_${res.status}`, receipts: [] };
    const body = (await res.json()) as { receipts?: AccountReceipt[] };
    return { ok: true, receipts: Array.isArray(body.receipts) ? body.receipts : [] };
  } catch {
    return { ok: false, reason: 'network', receipts: [] };
  } finally {
    clearTimeout(timer);
  }
}

/** '' from resolveAccountToken has two meanings; name the one that is a problem. */
function noTokenReason(): 'no_token' | 'credential_expired' | 'credential_unreadable' {
  const st = accountCredentialStatus();
  if (st === 'expired') return 'credential_expired';
  if (st === 'malformed') return 'credential_unreadable';
  return 'no_token';
}

export async function pushToAccount(payload: AccountPush): Promise<PushResult> {
  const token = resolveAccountToken();
  // An EXPIRED connection is not "not connected" (audit 2026-07-27). Reporting
  // it as no_token kept every sync line silent, so a user whose credential ran
  // out watched their seals stop reaching the account with nothing on any
  // screen saying so. Silence is only honest for a never-connected install.
  if (!token) return { synced: false, reason: noTokenReason() }; // local-only (default)
  if (!token.startsWith('argus_pat_')) return { synced: false, reason: 'bad_token_format' };

  const base = resolveApiBase();
  if (!base) return { synced: false, reason: 'insecure_api_url' }; // never leak the token over http (F2)
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/api/mcp/seal`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) return { synced: false, reason: `http_${res.status}` };
    return { synced: true };
  } catch {
    return { synced: false, reason: 'network' }; // never throws — local seal already stands
  } finally {
    clearTimeout(timer);
  }
}
