import { createClient, processLock } from '@supabase/supabase-js';

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
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
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
