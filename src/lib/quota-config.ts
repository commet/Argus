/**
 * Single source of truth for LLM proxy rate limits.
 *
 * Keep these in sync with the Supabase rate_limit RPCs if you change them
 * (but the RPC takes `p_limit` as a param, so we don't hardcode on the DB side).
 *
 * USER-FACING COPY CONTRACT (H1-C6): never show these raw call counts to
 * users — every screen speaks in DECISIONS rather than raw proxy calls
 * (one full decision ≈ 10–15 calls).
 * Mixed units (calls on the login page, decisions in the workspace) made the
 * upgrade math impossible for users to do.
 */

/**
 * Daily limit for signed-in users (per user).
 *
 * 2026-07-30 홍보 개시: 익명을 50으로 올리면서(창업자 — 첫 방문이 후해야 한다)
 * 같이 80으로. 익명=로그인(둘 다 50)이면 가입 유인이 0이 된다 — 사다리는
 * 한 칸씩 통째로 올린다.
 */
export const DAILY_LIMIT = 80;

/**
 * Daily limit for anonymous visitors (per hashed IP).
 *
 * 2026-07-30 홍보 개시: 검증 기간의 400(임시)에서 내리되, 평소 값 30이 아니라
 * **50** 으로 (창업자 — "처음에 사람들 막 써볼 텐데" 첫 방문이 후해야 한다).
 * 50 ≈ 결정 4~5개 분량. 익명은 IP 당이고 IP 는 싸므로 이 값이 곧 비용
 * 방어선이다 — 남용이 보이면 Vercel 환경변수 `ANON_DAILY_LIMIT` 로 즉시
 * 내리고, 검증·부하시험 때만 일시적으로 올렸다가 변수를 지운다. 코드 기본값은
 * 항상 안전한 쪽이어야 한다 (400 기본값 + "env 로 내리면 된다" 구조는 env 를
 * 깜빡하는 순간이 곧 사고다).
 */
const ANON_LIMIT_DEFAULT = 50;

function readAnonLimit(): number {
  const raw = Number(process.env.ANON_DAILY_LIMIT);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : ANON_LIMIT_DEFAULT;
}

export const ANON_LIMIT = readAnonLimit();

/**
 * Daily cap on ALL platform-funded model calls combined (auth + anon).
 *
 * The per-IP and per-user limits bound one abuser; they cannot bound many
 * IPs at once (rotation, a launch-day bot swarm). This is the cost circuit
 * breaker: when the sum hits this number the service degrades honestly
 * ("at capacity today") instead of the bill absorbing the difference.
 * 4000 calls ≈ 250-400 full decisions/day — far above an organic launch day,
 * an order of magnitude below a runaway bill. `GLOBAL_DAILY_LIMIT` env
 * overrides in either direction (raise for a good problem, drop during abuse).
 */
const GLOBAL_LIMIT_DEFAULT = 4000;

function readGlobalLimit(): number {
  const raw = Number(process.env.GLOBAL_DAILY_LIMIT);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : GLOBAL_LIMIT_DEFAULT;
}

export const GLOBAL_LIMIT = readGlobalLimit();
