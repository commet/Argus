import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  isValidOAuthState,
  isValidPkceChallenge,
  isValidPkceVerifier,
  normalizeUserCode,
  pkceChallenge,
  safeClientName,
  sha256,
  validLoopbackRedirect,
} from '@/lib/mcp-account-oauth';

describe('A0 MCP account OAuth primitives', () => {
  it('validates RFC 7636 verifier/challenge material', () => {
    const verifier = 'A'.repeat(43);
    expect(isValidPkceVerifier(verifier)).toBe(true);
    expect(isValidPkceChallenge(pkceChallenge(verifier))).toBe(true);
    expect(isValidPkceVerifier('short')).toBe(false);
  });

  it('accepts only exact HTTP loopback callbacks with dynamic ports', () => {
    expect(validLoopbackRedirect('http://127.0.0.1:43123/callback'))
      .toBe('http://127.0.0.1:43123/callback');
    expect(validLoopbackRedirect('http://localhost:43123/callback')).toBeNull();
    expect(validLoopbackRedirect('https://127.0.0.1:43123/callback')).toBeNull();
    expect(validLoopbackRedirect('http://127.0.0.1:43123/other')).toBeNull();
    expect(validLoopbackRedirect('http://127.0.0.1.evil.test:43123/callback')).toBeNull();
  });

  it('normalizes human device codes without persisting ambiguous formatting', () => {
    expect(normalizeUserCode('abcd efgh')).toBe('ABCD-EFGH');
    expect(normalizeUserCode('ab-cd')).toBe('ABCD');
  });

  it('bounds state and client metadata', () => {
    expect(isValidOAuthState('A'.repeat(16))).toBe(true);
    expect(isValidOAuthState('too-short')).toBe(false);
    expect(safeClientName('\u0000  Argus CLI  ')).toBe('Argus CLI');
    expect(safeClientName('x'.repeat(100))).toHaveLength(60);
  });

  it('hashes secrets deterministically without returning raw material', () => {
    expect(sha256('argus_device_secret')).toBe(sha256('argus_device_secret'));
    expect(sha256('argus_device_secret')).not.toContain('argus_device_secret');
  });

  it('stores only hashes for one-time authorization and device codes', () => {
    const sql = fs.readFileSync(
      path.join(process.cwd(), 'supabase', 'migrations', '20260716_mcp_account_oauth.sql'),
      'utf8',
    );
    expect(sql).toContain('code_hash');
    expect(sql).toContain('user_code_hash');
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
    expect(sql).not.toMatch(/^\s*(device_code|user_code|access_token)\s+text/im);
  });
});
