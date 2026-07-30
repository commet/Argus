/**
 * Single source of truth for LLM proxy rate limits.
 *
 * Keep these in sync with the Supabase rate_limit RPCs if you change them
 * (but the RPC takes `p_limit` as a param, so we don't hardcode on the DB side).
 *
 * USER-FACING COPY CONTRACT (H1-C6): never show these raw call counts to
 * users — every screen speaks in DECISIONS rather than raw proxy calls.
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
 *
 * ⚠️ 2026-07-29: **검증 기간 동안 일시적으로 크게 올려둔 값이다** (창업자 지시).
 * 평소 값은 30 (≈ 결정 2~3개) 이었고, 공개 전 실주행 검사를 하루에 여러 번 돌려야
 * 해서 한 IP 가 30콜에 막혔다. 검사가 못 도는 것이 지금은 더 비싸다고 판단.
 *
 * **되돌리는 법**: 코드를 고칠 필요 없다 — Vercel 환경변수 `ANON_DAILY_LIMIT` 에
 * 30 을 넣으면 즉시 내려간다(재배포 불필요). 아래 상수는 환경변수가 없을 때의 기본값.
 * 환경변수를 먼저 보게 만든 이유가 이것이다: 남용이 보이는 순간 배포를 기다리지
 * 않고 막을 수 있어야 한다.
 *
 * 홍보를 시작하면 이 값을 반드시 다시 내려야 한다 — 익명은 IP 당이고, IP 는 싸다.
 */
const ANON_LIMIT_DEFAULT = 400;

function readAnonLimit(): number {
  const raw = Number(process.env.ANON_DAILY_LIMIT);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : ANON_LIMIT_DEFAULT;
}

export const ANON_LIMIT = readAnonLimit();
