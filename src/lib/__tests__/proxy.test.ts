/**
 * Guard tests for the locale middleware (src/proxy.ts). Build/unit suites do NOT
 * exercise redirect behavior, so the routing contract was unverified. These lock
 * it: locale-less pages redirect to the resolved locale, the root avoids the
 * trailing-slash triple-hop, and /api + metadata routes are never locale-prefixed.
 */
import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';

const BASE = 'https://argus.voyage';

function req(path: string, opts: { acceptLang?: string; cookie?: string } = {}): NextRequest {
  const headers: Record<string, string> = {};
  if (opts.acceptLang) headers['accept-language'] = opts.acceptLang;
  if (opts.cookie) headers['cookie'] = opts.cookie;
  return new NextRequest(`${BASE}${path}`, { headers });
}

/** location pathname of a redirect response, or null if it isn't a redirect. */
function redirectTo(res: Response): string | null {
  if (res.status !== 307) return null;
  const loc = res.headers.get('location');
  return loc ? new URL(loc, BASE).pathname : null;
}

describe('proxy — locale redirect of locale-less page paths', () => {
  it('redirects a locale-less page to the Accept-Language locale', () => {
    expect(redirectTo(proxy(req('/workspace', { acceptLang: 'en-US,en;q=0.9' })))).toBe('/en/workspace');
    expect(redirectTo(proxy(req('/workspace', { acceptLang: 'ko-KR,ko;q=0.9' })))).toBe('/ko/workspace');
  });

  it('root "/" redirects to /{locale} WITHOUT a trailing slash (no triple-hop)', () => {
    const to = redirectTo(proxy(req('/', { acceptLang: 'en-US' })));
    expect(to).toBe('/en');
    expect(to).not.toBe('/en/');
  });

  it('the argus-locale cookie wins over Accept-Language', () => {
    expect(redirectTo(proxy(req('/workspace', { cookie: 'argus-locale=ko', acceptLang: 'en-US' })))).toBe('/ko/workspace');
  });

  it('?lang wins over both cookie and Accept-Language', () => {
    expect(redirectTo(proxy(req('/workspace?lang=ko', { cookie: 'argus-locale=en', acceptLang: 'en-US' })))).toBe('/ko/workspace');
  });

  it('defaults to en when no signal is present', () => {
    expect(redirectTo(proxy(req('/workspace')))).toBe('/en/workspace');
  });

  it('sets the argus-locale cookie on the redirect', () => {
    const res = proxy(req('/workspace', { acceptLang: 'ko-KR' }));
    expect(res.headers.get('set-cookie') || '').toContain('argus-locale=ko');
  });
});

describe('proxy — paths that must NOT be locale-redirected', () => {
  it('already-locale-prefixed pages pass through (not a redirect)', () => {
    expect(redirectTo(proxy(req('/en/workspace')))).toBeNull();
    expect(redirectTo(proxy(req('/ko')))).toBeNull();
  });

  it('/api routes pass through (CSP only, never locale-prefixed)', () => {
    expect(redirectTo(proxy(req('/api/llm')))).toBeNull();
    expect(redirectTo(proxy(req('/api/search')))).toBeNull();
  });

  it('root metadata routes pass through (would 404 if prefixed)', () => {
    expect(redirectTo(proxy(req('/sitemap.xml')))).toBeNull();
    expect(redirectTo(proxy(req('/robots.txt')))).toBeNull();
    expect(redirectTo(proxy(req('/manifest.webmanifest')))).toBeNull();
  });
});

describe('proxy — CSP is always attached', () => {
  it('sets a nonce-based Content-Security-Policy on both redirect and pass-through', () => {
    expect(proxy(req('/workspace')).headers.get('content-security-policy')).toMatch(/script-src[^;]*nonce-/);
    expect(proxy(req('/en/workspace')).headers.get('content-security-policy')).toMatch(/script-src[^;]*nonce-/);
  });
});
