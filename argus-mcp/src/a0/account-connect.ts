import { createServer, type Server } from 'node:http';
import { randomBytes, createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import type { AddressInfo } from 'node:net';
import {
  writeStoredAccountCredential,
  type StoredAccountCredential,
} from './account-credentials.js';

const DEFAULT_API_URL = 'https://argus.voyage';
const CONNECT_TIMEOUT_MS = 5 * 60 * 1000;

type FetchLike = typeof fetch;

interface TokenResponse {
  access_token: string;
  token_type: 'Bearer';
  scope: string;
  expires_at: string;
}

export interface ConnectAccountOptions {
  headless?: boolean;
  apiUrl?: string;
  credentialFile?: string;
  clientName?: string;
  fetchImpl?: FetchLike;
  openExternal?: (url: string) => Promise<boolean>;
  writeLine?: (line: string) => void;
  sleep?: (ms: number) => Promise<void>;
}

function apiBase(value: string): string {
  const url = new URL(value.replace(/\/+$/, ''));
  const local = url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '::1';
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) {
    throw new Error('ARGUS_API_URL must use HTTPS (HTTP is allowed only for localhost).');
  }
  return url.toString().replace(/\/+$/, '');
}

function base64url(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

function challenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

async function defaultOpenExternal(url: string): Promise<boolean> {
  const command = process.platform === 'win32' ? 'explorer.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  try {
    const child = spawn(command, [url], { detached: true, stdio: 'ignore', windowsHide: true });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

function listen(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port));
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

function waitForCode(server: Server, expectedState: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Account connection timed out.')), CONNECT_TIMEOUT_MS);
    server.on('request', (request, response) => {
      const url = new URL(request.url || '/', 'http://127.0.0.1');
      if (url.pathname !== '/callback') {
        response.writeHead(404).end('Not found');
        return;
      }
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      if (!code || state !== expectedState) {
        response.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' }).end('Invalid or expired Argus connection.');
        return;
      }
      clearTimeout(timeout);
      response.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'",
        'cache-control': 'no-store',
      }).end('<!doctype html><meta charset="utf-8"><title>Argus connected</title><style>body{font:16px system-ui;max-width:38rem;margin:15vh auto;padding:2rem;color:#202020}h1{font-size:1.4rem}</style><h1>Argus account connected</h1><p>You can close this window and return to your terminal.</p>');
      resolve(code);
    });
  });
}

async function requestJson(fetchImpl: FetchLike, url: string, body: Record<string, unknown>): Promise<{ response: Response; json: Record<string, unknown> }> {
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  let json: Record<string, unknown> = {};
  try { json = await response.json() as Record<string, unknown>; } catch { /* surfaced as protocol failure below */ }
  return { response, json };
}

function tokenFrom(json: Record<string, unknown>): TokenResponse {
  if (typeof json.access_token !== 'string' || !json.access_token.startsWith('argus_pat_')) throw new Error('The account returned an invalid credential.');
  if (json.token_type !== 'Bearer' || typeof json.scope !== 'string' || typeof json.expires_at !== 'string') throw new Error('The account returned an incomplete credential.');
  return json as unknown as TokenResponse;
}

function persist(token: TokenResponse, base: string, credentialFile?: string): StoredAccountCredential {
  const stored: StoredAccountCredential = {
    version: 1,
    access_token: token.access_token,
    token_type: 'Bearer',
    scope: token.scope,
    expires_at: token.expires_at,
    api_url: base,
    connected_at: new Date().toISOString(),
  };
  writeStoredAccountCredential(stored, credentialFile);
  return stored;
}

async function connectWithBrowser(options: Required<Pick<ConnectAccountOptions, 'fetchImpl' | 'openExternal' | 'writeLine'>> & ConnectAccountOptions, base: string): Promise<StoredAccountCredential> {
  const verifier = base64url(48);
  const state = base64url(24);
  const server = createServer();
  const port = await listen(server);
  const redirectUri = `http://127.0.0.1:${port}/callback`;
  const codePromise = waitForCode(server, state);
  const authorize = new URL(`${base}/en/auth/callback/mcp-connect`);
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('redirect_uri', redirectUri);
  authorize.searchParams.set('state', state);
  authorize.searchParams.set('code_challenge', challenge(verifier));
  authorize.searchParams.set('code_challenge_method', 'S256');
  authorize.searchParams.set('client_name', options.clientName || 'Argus MCP');

  options.writeLine('Opening Argus in your browser to approve this device…');
  const opened = await options.openExternal(authorize.toString());
  if (!opened) options.writeLine(`Open this URL in a browser:\n${authorize.toString()}`);

  try {
    const code = await codePromise;
    const { response, json } = await requestJson(options.fetchImpl, `${base}/api/mcp/oauth/token`, {
      grant_type: 'authorization_code',
      code,
      code_verifier: verifier,
      redirect_uri: redirectUri,
    });
    if (!response.ok) throw new Error(`Account token exchange failed (${String(json.error || response.status)}).`);
    return persist(tokenFrom(json), base, options.credentialFile);
  } finally {
    await close(server);
  }
}

async function connectWithDeviceCode(options: Required<Pick<ConnectAccountOptions, 'fetchImpl' | 'writeLine' | 'sleep'>> & ConnectAccountOptions, base: string): Promise<StoredAccountCredential> {
  const { response, json } = await requestJson(options.fetchImpl, `${base}/api/mcp/oauth/device`, { client_name: options.clientName || 'Argus MCP' });
  if (!response.ok) throw new Error(`Could not start device authorization (${String(json.error || response.status)}).`);
  if (typeof json.device_code !== 'string' || typeof json.user_code !== 'string' || typeof json.verification_uri !== 'string') {
    throw new Error('The account returned an invalid device authorization.');
  }
  let interval = typeof json.interval === 'number' ? Math.max(1, json.interval) : 5;
  const expiresIn = typeof json.expires_in === 'number' ? json.expires_in : 600;
  const deadline = Date.now() + expiresIn * 1000;
  options.writeLine(`Open ${String(json.verification_uri)} and enter code: ${json.user_code}`);

  while (Date.now() < deadline) {
    await options.sleep(interval * 1000);
    const poll = await requestJson(options.fetchImpl, `${base}/api/mcp/oauth/token`, {
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      device_code: json.device_code,
    });
    if (poll.response.ok) return persist(tokenFrom(poll.json), base, options.credentialFile);
    if (poll.json.error === 'authorization_pending') continue;
    if (poll.json.error === 'slow_down') { interval += 5; continue; }
    if (poll.json.error === 'access_denied') throw new Error('Account connection was denied.');
    if (poll.json.error === 'expired_token') break;
    throw new Error(`Device authorization failed (${String(poll.json.error || poll.response.status)}).`);
  }
  throw new Error('Device authorization expired. Start the connection again.');
}

export async function connectAccount(options: ConnectAccountOptions = {}): Promise<StoredAccountCredential> {
  const base = apiBase(options.apiUrl || process.env.ARGUS_API_URL || DEFAULT_API_URL);
  const shared = {
    ...options,
    fetchImpl: options.fetchImpl || fetch,
    openExternal: options.openExternal || defaultOpenExternal,
    writeLine: options.writeLine || ((line: string) => process.stdout.write(`${line}\n`)),
    sleep: options.sleep || ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))),
  };
  const credential = options.headless
    ? await connectWithDeviceCode(shared, base)
    : await connectWithBrowser(shared, base);
  shared.writeLine(`Connected. Credential stored locally; expires ${credential.expires_at.slice(0, 10)}.`);
  return credential;
}
