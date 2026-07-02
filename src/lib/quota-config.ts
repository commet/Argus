/**
 * Single source of truth for LLM proxy rate limits.
 *
 * Keep these in sync with the Supabase rate_limit RPCs if you change them
 * (but the RPC takes `p_limit` as a param, so we don't hardcode on the DB side).
 *
 * USER-FACING COPY CONTRACT (H1-C6): never show these raw call counts to
 * users — every screen speaks in DECISIONS ("하루 결정 2~3개 분량"). One full
 * decision ≈ 10–15 calls, so ANON(30) ≈ 2–3 decisions and DAILY(50) ≈ 4–5.
 * Mixed units (calls on the login page, decisions in the workspace) made the
 * upgrade math impossible for users to do.
 */

/**
 * Daily limit for signed-in users (per user).
 * Sized so a logged-in user can comfortably run multiple Boss sessions
 * (~6–9 LLM calls each) plus workspace exploration in one day.
 */
export const DAILY_LIMIT = 50;

/**
 * Daily limit for anonymous visitors (per hashed IP).
 * Sized for ~2–3 Boss sessions before the LOGIN_REQUIRED nudge fires —
 * generous enough that a viral share visitor experiences full value
 * before being asked to sign up.
 */
export const ANON_LIMIT = 30;
