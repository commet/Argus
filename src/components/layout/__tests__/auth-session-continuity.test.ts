import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const authGuard = readFileSync(join(__dirname, '..', 'AuthGuard.tsx'), 'utf8');
const login = readFileSync(join(__dirname, '..', '..', '..', 'app', '[locale]', 'login', 'page.tsx'), 'utf8');
const callback = readFileSync(join(__dirname, '..', '..', '..', 'app', '[locale]', 'auth', 'callback', 'page.tsx'), 'utf8');
const auth = readFileSync(join(__dirname, '..', '..', '..', 'lib', 'auth.tsx'), 'utf8');

describe('authentication session continuity contract', () => {
  it('preserves the protected route query when building the login return path', () => {
    expect(authGuard).toContain('useSearchParams');
    expect(authGuard).toContain('const query = searchParams.toString()');
    expect(authGuard).toContain("${query ? `?${query}` : ''}");
  });

  it('uses one redirect sanitizer at every post-auth boundary', () => {
    for (const source of [login, callback, auth]) {
      expect(source).toContain('safePostAuthRedirect');
    }
  });

  it('recovers from a rejected or timed-out OAuth code exchange', () => {
    expect(callback).toContain('Promise.race');
    expect(callback).toContain("router.replace('/login?error=auth_failed')");
    expect(callback).toContain('} catch {');
    expect(callback).toContain('clearTimeout(timeoutId)');
  });

  it('announces session loading without forcing motion', () => {
    for (const source of [authGuard, login, callback]) {
      expect(source).toContain('role="status"');
      expect(source).toContain('aria-live="polite"');
      expect(source).toContain('motion-reduce:animate-none');
    }
  });
});
