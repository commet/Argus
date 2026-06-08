/**
 * Lightweight event tracking for Argus.
 *
 * - Fire-and-forget: never blocks UI
 * - Works for anonymous + logged-in users
 * - Session-based grouping via sessionStorage
 * - Silently fails if Supabase isn't configured
 *
 * Usage:
 *   import { track } from '@/lib/analytics';
 *   track('decompose_complete', { question_count: 3 });
 *
 * Query examples (run in Supabase SQL Editor):
 *
 *   -- 일별 이벤트 수
 *   select date(created_at) as day, event_name, count(*)
 *   from user_events group by day, event_name order by day desc;
 *
 *   -- 데모 완주율
 *   select
 *     count(*) filter (where properties->>'step' = '0') as demo_start,
 *     count(*) filter (where properties->>'step' = '5') as demo_finish,
 *     round(count(*) filter (where properties->>'step' = '5')::numeric /
 *           nullif(count(*) filter (where properties->>'step' = '0'), 0) * 100) as completion_pct
 *   from user_events where event_name = 'demo_step';
 *
 *   -- 단계별 완료 퍼널
 *   select event_name, count(distinct session_id)
 *   from user_events
 *   where event_name in ('decompose_complete','recast_complete','feedback_complete','loop_converged')
 *   group by event_name;
 *
 *   -- 산출물 사용 빈도
 *   select properties->>'format' as format, count(*)
 *   from user_events where event_name = 'output_generated'
 *   group by format order by count desc;
 *
 *   -- 일별 활성 세션 수
 *   select date(created_at) as day, count(distinct session_id) as sessions
 *   from user_events group by day order by day desc;
 *
 *   -- 전제 평가 패턴 분포 (모두확인 vs 일부의심 vs 대부분의심)
 *   select properties->>'eval_pattern' as pattern, count(*)
 *   from user_events where event_name = 'decompose_complete'
 *   group by pattern;
 *
 *   -- 리프레이밍 전략별 사용 빈도
 *   select properties->>'strategy' as strategy, count(*)
 *   from user_events where event_name = 'decompose_complete'
 *   group by strategy order by count desc;
 *
 *   -- LLM 호출 평균 응답시간 (단계별)
 *   select properties->>'step' as step,
 *     round(avg((properties->>'duration_ms')::int)) as avg_ms,
 *     count(*) as calls
 *   from user_events where event_name = 'llm_call'
 *   group by step;
 *
 *   -- actor 변경 빈도 (AI→사람 vs 사람→AI)
 *   select properties->>'from' as from_actor, properties->>'to' as to_actor, count(*)
 *   from user_events where event_name = 'actor_changed'
 *   group by from_actor, to_actor;
 *
 *   -- 에러 빈도
 *   select properties->>'context' as ctx, count(*)
 *   from user_events where event_name = 'error'
 *   group by ctx order by count desc;
 *
 *   -- 단계 간 전환 퍼널 (세션별)
 *   select properties->>'from' as from_step, properties->>'to' as to_step, count(*)
 *   from user_events where event_name = 'step_transition'
 *   group by from_step, to_step order by count desc;
 */

import { supabase } from './supabase';
import { reportSyncFailure } from './sync-health';

let _sessionId: string | null = null;

function getSessionId(): string {
  if (_sessionId) return _sessionId;
  if (typeof window === 'undefined') return 'ssr';
  _sessionId = sessionStorage.getItem('ov_sid') || crypto.randomUUID();
  sessionStorage.setItem('ov_sid', _sessionId);
  return _sessionId;
}

/** Session-level metadata — computed once, attached to every event */
let _sessionMeta: Record<string, unknown> | null = null;

function getSessionMeta(): Record<string, unknown> {
  if (_sessionMeta) return _sessionMeta;
  if (typeof window === 'undefined') return {};
  _sessionMeta = {
    viewport_w: window.innerWidth,
    viewport_h: window.innerHeight,
    dark_mode: document.documentElement.getAttribute('data-theme') === 'dark',
    lang: navigator.language,
    touch: 'ontouchstart' in window,
    returning: !!localStorage.getItem('ov_returning'),
  };
  // Mark as returning for next session
  localStorage.setItem('ov_returning', '1');
  return _sessionMeta;
}

/**
 * Source attribution (UTM params + initial referrer) — captured once per session,
 * persisted in sessionStorage so subsequent page navigations within the session
 * still know the original entry point.
 */
function getSourceMeta(): Record<string, unknown> {
  if (typeof window === 'undefined') return {};
  const cached = sessionStorage.getItem('ov_src');
  if (cached) {
    try { return JSON.parse(cached); } catch { /* fall through — recompute */ }
  }
  const params = new URLSearchParams(window.location.search);
  const meta: Record<string, unknown> = {
    initial_referrer: document.referrer || null,
    initial_path: window.location.pathname,
    utm_source: params.get('utm_source'),
    utm_medium: params.get('utm_medium'),
    utm_campaign: params.get('utm_campaign'),
    utm_content: params.get('utm_content'),
    fbclid: params.get('fbclid'),
  };
  for (const k of Object.keys(meta)) if (meta[k] == null) delete meta[k];
  sessionStorage.setItem('ov_src', JSON.stringify(meta));
  return meta;
}

/**
 * Current authenticated user ID — set by the auth layer on login/logout.
 * Attached to every event so we can join against auth.users server-side.
 */
let _userId: string | null = null;

export function setAnalyticsUser(userId: string | null) {
  const previous = _userId;
  _userId = userId;
  // When a user first becomes known within a session, emit an identify event
  // so we can stitch pre-login anonymous events to their post-login identity
  // via session_id without a client-side email leak.
  if (userId && !previous && typeof window !== 'undefined') {
    track('user_identified', {});
  }
}

/**
 * Emit a session_start event the first time any event fires in a session.
 * Carries the source attribution so we can query "this session came from X"
 * by session_id without bloating every row with UTM columns.
 */
function maybeEmitSessionStart() {
  if (typeof window === 'undefined') return;
  if (sessionStorage.getItem('ov_sst') === '1') return;
  sessionStorage.setItem('ov_sst', '1');
  track('session_start', getSourceMeta());
}

export function track(event: string, properties?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;

  // First event of the session → emit session_start first (flag is set inside
  // maybeEmitSessionStart before the recursive track() call, so no infinite loop)
  if (event !== 'session_start') maybeEmitSessionStart();

  try {
    supabase.from('user_events').insert({
      event_name: event,
      properties: { ...getSessionMeta(), ...properties },
      session_id: getSessionId(),
      user_id: _userId,
      page_path: window.location.pathname + window.location.search,
      referrer: document.referrer || null,
    }).then(({ error }) => {
      // Telemetry is non-critical: count the failure as a canary but do NOT flip
      // the sync badge (anon-key inserts can fail for benign reasons).
      if (error) reportSyncFailure('analytics', { surface: false });
    });
  } catch {
    // silently fail — analytics should never break the app
  }
}

/**
 * Track time spent. Returns a function to call when done.
 * Usage: const done = trackTime('demo_step_1'); ... done();
 */
export function trackTime(event: string, properties?: Record<string, unknown>): () => void {
  const start = Date.now();
  return () => {
    track(event, { ...properties, duration_ms: Date.now() - start });
  };
}

/**
 * Track page view. Call once per route change.
 */
export function trackPageView(path?: string) {
  track('page_view', { path: path || window.location.pathname });
}

/**
 * Track LLM call timing. Wraps an async LLM call and records duration.
 */
export async function trackLLMCall<T>(
  step: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    track('llm_call', { step, duration_ms: Date.now() - start, success: true });
    return result;
  } catch (err) {
    track('llm_call', { step, duration_ms: Date.now() - start, success: false, error: err instanceof Error ? err.message : 'unknown' });
    throw err;
  }
}

/**
 * Track errors (non-fatal, for monitoring).
 */
export function trackError(context: string, error: unknown) {
  track('error', {
    context,
    message: error instanceof Error ? error.message : String(error),
  });
}
