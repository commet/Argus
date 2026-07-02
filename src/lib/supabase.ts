import { createClient, processLock } from '@supabase/supabase-js';
import type { Session } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Use the in-memory promise-chain lock instead of the default Web Locks API
    // (navigator.locks) lock. The navigator lock is keyed on a single name
    // ("lock:sb-…-auth-token") and is meant to coordinate token refresh ACROSS
    // browser tabs — but under React Strict Mode's mount→unmount→mount it gets
    // orphaned, so every getSession()/getUser() then waits 5s for the steal
    // recovery and the loser rejects with `AbortError: Lock broken by another
    // request with the 'steal' option`. Because getSession() sits in the
    // critical path of every proxied LLM call (getAuthHeaders), an orphaned
    // lock froze the whole "session start" with the analysis spinner stuck.
    // processLock is per-JS-context (no cross-tab coordination — acceptable for
    // this localStorage-first SPA) and cannot orphan, which removes the
    // deadlock at the source.
    lock: processLock,
  },
});

/**
 * getSession() with a hard wall-clock cap (same pattern as llm.ts getAuthHeaders).
 *
 * Defense in depth: getSession() sits in critical paths (app-shell auth boot,
 * account export/delete bearer, share/email token fetch). If token retrieval
 * ever stalls (a hung refresh, a contended auth lock), we must NOT freeze the
 * screen behind an infinite await — that's the "73s spinner / session won't
 * start" failure class. On timeout we resolve null (treat as signed-out); if a
 * real session exists, onAuthStateChange fires moments later and fills it in,
 * so the cost of a false negative is near zero.
 */
export async function getSessionWithTimeout(ms = 4000): Promise<Session | null> {
  try {
    return await Promise.race([
      supabase.auth.getSession().then(r => r.data.session),
      new Promise<null>(resolve => setTimeout(() => resolve(null), ms)),
    ]);
  } catch {
    return null; // auth unavailable — treat as signed-out rather than blocking
  }
}

/**
 * Get the current user ID with caching.
 * Uses getUser() for server-side JWT validation, but caches the result
 * to avoid excessive network requests (every store operation calls this).
 */
let _cachedUserId: string | null = null;
let _cacheTs = 0;
const _CACHE_TTL = 60_000; // 60 seconds

export async function getCurrentUserId(): Promise<string | null> {
  const now = Date.now();
  if (_cachedUserId && now - _cacheTs < _CACHE_TTL) return _cachedUserId;

  try {
    // Timeout-guard getUser() the same way getAuthHeaders guards getSession():
    // it sits in the DB write critical path (via withUser), so a hung auth call
    // must NOT wedge sync forever. On timeout, treat as anonymous (local-first
    // fast-fail) rather than hanging the promise.
    const user = await Promise.race([
      supabase.auth.getUser().then(r => (r.error ? null : r.data.user)),
      new Promise<null>(resolve => setTimeout(() => resolve(null), 4000)),
    ]);
    if (!user) {
      _cachedUserId = null;
      return null;
    }
    _cachedUserId = user.id;
    _cacheTs = now;
    return user.id;
  } catch {
    _cachedUserId = null;
    return null;
  }
}

/** Clear cached user ID (call on sign-out). */
export function clearUserCache() {
  _cachedUserId = null;
  _cacheTs = 0;
}

/**
 * Helper for safe DB operations with user context.
 */
export async function withUser<T>(fn: (userId: string) => Promise<T>): Promise<T | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;
  return fn(userId);
}
