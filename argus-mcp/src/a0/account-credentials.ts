import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface StoredAccountCredential {
  version: 1;
  access_token: string;
  token_type: 'Bearer';
  scope: string;
  expires_at: string;
  api_url: string;
  connected_at: string;
}

function defaultCredentialPath(): string {
  const explicit = process.env.ARGUS_ACCOUNT_FILE?.trim();
  if (explicit) return path.resolve(explicit);

  const argusDir = process.env.ARGUS_DIR?.trim();
  if (argusDir) return path.join(path.resolve(argusDir), 'account-credentials.json');

  if (process.platform === 'win32') {
    const root = process.env.LOCALAPPDATA?.trim() || path.join(os.homedir(), 'AppData', 'Local');
    return path.join(root, 'Argus', 'account-credentials.json');
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'Argus', 'account-credentials.json');
  }
  const root = process.env.XDG_CONFIG_HOME?.trim() || path.join(os.homedir(), '.config');
  return path.join(root, 'argus', 'account-credentials.json');
}

export function accountCredentialPath(): string {
  return defaultCredentialPath();
}

export function readStoredAccountCredential(file = defaultCredentialPath()): StoredAccountCredential | null {
  // Unit tests must opt into an isolated temp location. Never probe a
  // developer's actual config directory merely because a sync helper ran.
  if (process.env.NODE_ENV === 'test' && !process.env.ARGUS_ACCOUNT_FILE && !process.env.ARGUS_DIR && file === defaultCredentialPath()) {
    return null;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<StoredAccountCredential>;
    if (parsed.version !== 1 || parsed.token_type !== 'Bearer') return null;
    if (typeof parsed.access_token !== 'string' || !parsed.access_token.startsWith('argus_pat_')) return null;
    if (typeof parsed.expires_at !== 'string' || Date.parse(parsed.expires_at) <= Date.now()) return null;
    if (typeof parsed.api_url !== 'string' || typeof parsed.scope !== 'string' || typeof parsed.connected_at !== 'string') return null;
    return parsed as StoredAccountCredential;
  } catch {
    return null;
  }
}

export function writeStoredAccountCredential(
  credential: StoredAccountCredential,
  file = defaultCredentialPath(),
): void {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const temp = path.join(dir, `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`);
  try {
    fs.writeFileSync(temp, `${JSON.stringify(credential, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    fs.renameSync(temp, file);
    try { fs.chmodSync(file, 0o600); } catch { /* Windows ACLs do not use POSIX modes. */ }
  } finally {
    try { fs.unlinkSync(temp); } catch { /* rename already removed it */ }
  }
}

/** Manual ARGUS_TOKEN remains the advanced/CI override. */
export function resolveAccountToken(): string {
  const manual = process.env.ARGUS_TOKEN?.trim();
  if (manual) return manual;
  return readStoredAccountCredential()?.access_token ?? '';
}

export function resolveAccountApiUrl(): string {
  const manual = process.env.ARGUS_API_URL?.trim();
  if (manual) return manual;
  return readStoredAccountCredential()?.api_url ?? 'https://argus.voyage';
}

export function disconnectStoredAccount(file = defaultCredentialPath()): boolean {
  try {
    fs.unlinkSync(file);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'ENOENT';
  }
}
