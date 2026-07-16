import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  disconnectStoredAccount,
  readStoredAccountCredential,
  resolveAccountApiUrl,
  resolveAccountToken,
  writeStoredAccountCredential,
  type StoredAccountCredential,
} from './account-credentials.js';

let tempDir = '';
let credentialFile = '';
const savedEnv: Record<string, string | undefined> = {};

const credential = (expiresAt = '2099-01-01T00:00:00.000Z'): StoredAccountCredential => ({
  version: 1,
  access_token: 'argus_pat_fixture',
  token_type: 'Bearer',
  scope: 'records:sync',
  expires_at: expiresAt,
  api_url: 'https://argus.example',
  connected_at: '2026-07-16T00:00:00.000Z',
});

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-a0-'));
  credentialFile = path.join(tempDir, 'account.json');
  for (const key of ['ARGUS_ACCOUNT_FILE', 'ARGUS_DIR', 'ARGUS_TOKEN', 'ARGUS_API_URL']) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  process.env.ARGUS_ACCOUNT_FILE = credentialFile;
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('A0 isolated account credential fallback', () => {
  it('round-trips only through the explicitly isolated credential file', () => {
    writeStoredAccountCredential(credential(), credentialFile);
    expect(readStoredAccountCredential(credentialFile)).toEqual(credential());
    expect(fs.existsSync(`${credentialFile}.tmp`)).toBe(false);
  });

  it('ignores expired and malformed credentials', () => {
    writeStoredAccountCredential(credential('2020-01-01T00:00:00.000Z'), credentialFile);
    expect(readStoredAccountCredential(credentialFile)).toBeNull();
    fs.writeFileSync(credentialFile, '{"access_token":"not-a-pat"}', 'utf8');
    expect(readStoredAccountCredential(credentialFile)).toBeNull();
  });

  it('keeps ARGUS_TOKEN and ARGUS_API_URL as explicit advanced overrides', () => {
    writeStoredAccountCredential(credential(), credentialFile);
    process.env.ARGUS_TOKEN = 'argus_pat_manual';
    process.env.ARGUS_API_URL = 'https://manual.example';
    expect(resolveAccountToken()).toBe('argus_pat_manual');
    expect(resolveAccountApiUrl()).toBe('https://manual.example');
  });

  it('disconnects idempotently', () => {
    writeStoredAccountCredential(credential(), credentialFile);
    expect(disconnectStoredAccount(credentialFile)).toBe(true);
    expect(disconnectStoredAccount(credentialFile)).toBe(true);
    expect(readStoredAccountCredential(credentialFile)).toBeNull();
  });
});
