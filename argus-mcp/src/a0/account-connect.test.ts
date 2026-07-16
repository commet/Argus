import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { connectAccount } from './account-connect.js';

let tempDir = '';
let credentialFile = '';

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-connect-'));
  credentialFile = path.join(tempDir, 'account.json');
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('A0 familiar account connection', () => {
  it('uses external-browser PKCE with a loopback callback on capable desktops', async () => {
    const lines: string[] = [];
    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      expect(url).toBe('https://argus.example/api/mcp/oauth/token');
      const body = JSON.parse(String(init?.body)) as Record<string, string>;
      expect(body.grant_type).toBe('authorization_code');
      expect(body.code).toBe('fixture-code');
      expect(body.code_verifier.length).toBeGreaterThanOrEqual(43);
      expect(body.redirect_uri).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/callback$/);
      return json({
        access_token: 'argus_pat_browser', token_type: 'Bearer', scope: 'records:sync',
        expires_at: '2099-01-01T00:00:00.000Z',
      });
    });
    const openExternal = vi.fn(async (value: string) => {
      const authorize = new URL(value);
      expect(authorize.pathname).toBe('/en/auth/callback/mcp-connect');
      expect(authorize.searchParams.get('code_challenge_method')).toBe('S256');
      const callback = new URL(authorize.searchParams.get('redirect_uri')!);
      callback.searchParams.set('code', 'fixture-code');
      callback.searchParams.set('state', authorize.searchParams.get('state')!);
      await fetch(callback);
      return true;
    });

    const stored = await connectAccount({
      apiUrl: 'https://argus.example', credentialFile, fetchImpl: fetchImpl as typeof fetch,
      openExternal, writeLine: (line) => lines.push(line),
    });

    expect(stored.access_token).toBe('argus_pat_browser');
    expect(openExternal).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(lines.some((line) => line.startsWith('Connected.'))).toBe(true);
    expect(fs.readFileSync(credentialFile, 'utf8')).not.toContain('fixture-code');
  });

  it('uses RFC 8628-style polling only for the explicit headless fallback', async () => {
    let polls = 0;
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/api/mcp/oauth/device')) {
        return json({
          device_code: 'argus_device_fixture', user_code: 'ABCD-EFGH',
          verification_uri: 'https://argus.example/en/auth/callback/mcp-device',
          expires_in: 600, interval: 1,
        });
      }
      polls += 1;
      if (polls === 1) return json({ error: 'authorization_pending' }, 400);
      if (polls === 2) return json({ error: 'slow_down' }, 400);
      return json({
        access_token: 'argus_pat_device', token_type: 'Bearer', scope: 'records:sync',
        expires_at: '2099-01-01T00:00:00.000Z',
      });
    });
    const lines: string[] = [];
    const sleep = vi.fn(async () => undefined);

    const stored = await connectAccount({
      headless: true, apiUrl: 'https://argus.example', credentialFile,
      fetchImpl: fetchImpl as typeof fetch, writeLine: (line) => lines.push(line), sleep,
    });

    expect(stored.access_token).toBe('argus_pat_device');
    expect(polls).toBe(3);
    expect(sleep).toHaveBeenCalledTimes(3);
    expect(lines[0]).toContain('ABCD-EFGH');
  });

  it('rejects insecure non-loopback account endpoints before making a request', async () => {
    await expect(connectAccount({
      apiUrl: 'http://argus.example', credentialFile, fetchImpl: vi.fn() as unknown as typeof fetch,
    })).rejects.toThrow('must use HTTPS');
  });
});
