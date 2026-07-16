import { createHash, randomBytes } from 'crypto';

export const MCP_AUTH_CODE_TTL_SECONDS = 5 * 60;
export const MCP_DEVICE_CODE_TTL_SECONDS = 10 * 60;
export const MCP_DEVICE_POLL_INTERVAL_SECONDS = 5;
export const MCP_ACCOUNT_SCOPE = 'records:sync';

const PKCE_VALUE = /^[A-Za-z0-9._~-]{43,128}$/;
const OAUTH_STATE = /^[A-Za-z0-9._~-]{16,256}$/;

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

export function randomOpaqueCode(prefix: string, bytes = 32): string {
  return `${prefix}${randomBytes(bytes).toString('base64url')}`;
}

export function randomUserCode(): string {
  // Omit visually ambiguous characters. The database stores only a hash.
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = randomBytes(8);
  const chars = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]);
  return `${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`;
}

export function normalizeUserCode(value: string): string {
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  return compact.length > 4 ? `${compact.slice(0, 4)}-${compact.slice(4)}` : compact;
}

export function isValidPkceChallenge(value: unknown): value is string {
  return typeof value === 'string' && PKCE_VALUE.test(value);
}

export function isValidPkceVerifier(value: unknown): value is string {
  return typeof value === 'string' && PKCE_VALUE.test(value);
}

export function isValidOAuthState(value: unknown): value is string {
  return typeof value === 'string' && OAUTH_STATE.test(value);
}

/**
 * Native-app OAuth callbacks must stay on the local machine. Exact loopback
 * literals avoid DNS rebinding; dynamic ports are allowed by RFC 8252.
 */
export function validLoopbackRedirect(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 500) return null;
  try {
    const url = new URL(value);
    const loopback = url.hostname === '127.0.0.1' || url.hostname === '[::1]' || url.hostname === '::1';
    if (url.protocol !== 'http:' || !loopback || !url.port) return null;
    if (url.pathname !== '/callback' || url.username || url.password || url.hash) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function safeClientName(value: unknown): string {
  if (typeof value !== 'string') return 'Argus MCP';
  const cleaned = value.replace(/[\u0000-\u001F\u007F]/g, '').trim();
  return cleaned.slice(0, 60) || 'Argus MCP';
}

export function expiresAt(seconds: number, now = Date.now()): string {
  return new Date(now + seconds * 1000).toISOString();
}
