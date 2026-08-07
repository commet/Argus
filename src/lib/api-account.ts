/**
 * Client wrappers for the account endpoints (server-side, service-role).
 * These guarantee COMPLETE export/erasure across all user-scoped tables — the old
 * Settings "export"/"reset" only touched localStorage, missing synced + server-only data.
 */
import { getSessionWithTimeout } from './supabase';
import { timeoutSignal } from './timeout-signal';

async function bearer(): Promise<string> {
  // 4s cap (shared helper): a hung auth call must fail fast as "login required"
  // instead of freezing the export/delete button forever.
  const session = await getSessionWithTimeout();
  const token = session?.access_token;
  if (!token) throw new Error('login-required');
  return token;
}

/** Download every server-stored row (all tables) as one JSON file. Requires login. */
export async function exportAccountData(): Promise<void> {
  const token = await bearer();
  const res = await fetch('/api/account/export', {
    headers: { Authorization: `Bearer ${token}` },
    // 60s: the export file can be large — everything else uses the 15s default.
    signal: timeoutSignal(60_000),
  });
  if (!res.ok) throw new Error(`export-failed-${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `argus-export-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Download canonical judgment continuity streams and verified artifacts in the
 * hashed archive format accepted by /api/account/restore. */
export async function exportJudgmentArchive(): Promise<void> {
  const token = await bearer();
  const res = await fetch('/api/account/export?format=judgment-archive', {
    headers: { Authorization: `Bearer ${token}` },
    signal: timeoutSignal(60_000),
  });
  if (!res.ok) throw new Error(`archive-export-failed-${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `argus-judgment-archive-${new Date().toISOString().split('T')[0]}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

export interface JudgmentArchiveRestoreReceipt {
  restore_id: string;
  status: 'dry_run' | 'restored' | 'conflict' | 'failed';
  can_apply: boolean;
  semantic_parity: boolean;
  error_code?: string;
  [key: string]: unknown;
}

/** Advanced restore boundary. Callers must present the authenticated account id
 * verbatim and an explicit source→target project mapping; dry-run is the default. */
export async function restoreJudgmentArchive(args: {
  archive: Blob;
  targetAccountId: string;
  projectMapping: Record<string, string>;
  dryRun?: boolean;
}): Promise<JudgmentArchiveRestoreReceipt> {
  const token = await bearer();
  const mapping = btoa(unescape(encodeURIComponent(JSON.stringify(args.projectMapping))))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const res = await fetch('/api/account/restore', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/zip',
      'X-Argus-Target-Account': args.targetAccountId,
      'X-Argus-Project-Mapping': mapping,
      'X-Argus-Dry-Run': String(args.dryRun ?? true),
    },
    body: args.archive,
    signal: timeoutSignal(60_000),
  });
  const receipt = await res.json() as JudgmentArchiveRestoreReceipt & { error?: string };
  if (!res.ok && !['conflict', 'failed'].includes(String(receipt.status))) {
    throw new Error(receipt.error ?? `archive-restore-failed-${res.status}`);
  }
  return receipt;
}

export interface DeleteAccountResult {
  ok: boolean;
  identityDeleted: boolean;
  receipt: Record<string, number | string>;
}

/** Permanently delete all server data AND the auth identity. Requires login. */
export async function deleteAccount(): Promise<DeleteAccountResult> {
  const token = await bearer();
  const res = await fetch('/api/account/delete', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    signal: timeoutSignal(),
  });
  const json = (await res.json()) as Partial<DeleteAccountResult> & { error?: string };
  if (!res.ok && !json.receipt) throw new Error(json.error || `delete-failed-${res.status}`);
  return { ok: !!json.ok, identityDeleted: !!json.identityDeleted, receipt: json.receipt || {} };
}

/** Total rows removed across all tables (for a human-readable receipt). */
export function totalRowsDeleted(receipt: Record<string, number | string>): number {
  return Object.values(receipt).reduce<number>((sum, v) => sum + (typeof v === 'number' ? v : 0), 0);
}

/** 분신 상태 — **개수만**. 봉인 내용은 이 경로로 나오지 않는다 (api/twin/status). */
export interface TwinStatus {
  cases: { open: number | null; settled: number | null };
  shadows: { sealed: number | null; revealed: number | null; graded: number | null; late: number | null };
  profile: { active: number | null; retired: number | null };
  delegations: { active: number | null; suspended: number | null };
  beliefs: { graded: number | null };
  theater: { runs: number | null };
}

export async function fetchTwinStatus(): Promise<TwinStatus> {
  const token = await bearer();
  const res = await fetch('/api/twin/status', {
    headers: { Authorization: `Bearer ${token}` },
    signal: timeoutSignal(15_000),
  });
  if (!res.ok) throw new Error(`twin-status-failed-${res.status}`);
  return (await res.json()) as TwinStatus;
}
