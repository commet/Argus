import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';

/**
 * Ledger install id (BS-1, BLUEPRINT §9.4 두 기기 안전).
 *
 * Account rows used to be keyed `mcp_<slug>` — so two ledgers under one
 * account (laptop + desktop, or two projects) that both sealed a naturally
 * named decision ("migrate-db") silently collided on the same account row.
 * Every ledger now carries a stable random id (`.argus/.install`, 8 hex),
 * and the account key becomes `mcp_<install8>_<slug>`.
 *
 * Local decision ids are untouched — this namespaces only the account bridge.
 * The id is not a device fingerprint: it is random, local, and never reused
 * across ledgers.
 */

export function ledgerInstallId(argusDir: string): string {
  const p = path.join(argusDir, '.install');
  try {
    const raw = fs.readFileSync(p, 'utf8').trim();
    if (/^[0-9a-f]{8}$/.test(raw)) return raw;
  } catch { /* first run */ }
  const fresh = randomBytes(4).toString('hex');
  try {
    fs.mkdirSync(argusDir, { recursive: true });
    fs.writeFileSync(p, fresh, 'utf8');
  } catch { /* read-only dir — fall through with the in-memory id */ }
  return fresh;
}

/** The account-row id for a local decision: mcp_<install8>_<slug> (web adds the mcp_). */
export function accountPushId(argusDir: string, localId: string): string {
  return `${ledgerInstallId(argusDir)}_${localId}`;
}

/**
 * Reverse-map an account row id to OUR local id.
 * `mcp_<our-install>_<slug>` → slug; legacy `mcp_<slug>` (pre-namespace rows)
 * → slug; a row namespaced by ANOTHER ledger → null (it is not ours to settle).
 */
export function localIdFromAccountId(argusDir: string, accountId: string): string | null {
  if (!accountId.startsWith('mcp_')) return null;
  const rest = accountId.slice(4);
  const own = `${ledgerInstallId(argusDir)}_`;
  if (rest.startsWith(own)) return rest.slice(own.length);
  // another ledger's namespaced row: 8-hex + '_' prefix that is not ours
  if (/^[0-9a-f]{8}_/.test(rest)) return null;
  return rest; // legacy un-namespaced row — historically ours
}
