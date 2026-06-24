/**
 * Client wrappers for the account endpoints (server-side, service-role).
 * These guarantee COMPLETE export/erasure across all user-scoped tables — the old
 * Settings "export"/"reset" only touched localStorage, missing synced + server-only data.
 */
import { supabase } from './supabase';

async function bearer(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('login-required');
  return token;
}

/** Download every server-stored row (all tables) as one JSON file. Requires login. */
export async function exportAccountData(): Promise<void> {
  const token = await bearer();
  const res = await fetch('/api/account/export', {
    headers: { Authorization: `Bearer ${token}` },
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
  });
  const json = (await res.json()) as Partial<DeleteAccountResult> & { error?: string };
  if (!res.ok && !json.receipt) throw new Error(json.error || `delete-failed-${res.status}`);
  return { ok: !!json.ok, identityDeleted: !!json.identityDeleted, receipt: json.receipt || {} };
}

/** Total rows removed across all tables (for a human-readable receipt). */
export function totalRowsDeleted(receipt: Record<string, number | string>): number {
  return Object.values(receipt).reduce<number>((sum, v) => sum + (typeof v === 'number' ? v : 0), 0);
}
