export type AnalyticsSignalKind = 'operational_error' | 'guardrail' | 'none';

const OPERATIONAL_ERROR_EVENTS = new Set([
  'error',
  'unhandled_error',
  'unhandled_rejection',
  'llm_error',
  'server_llm_error',
  'workspace_start_error',
  'review_timeout',
  'review_failed',
]);

const GUARDRAIL_EVENTS = new Set([
  'server_rate_limited',
  'server_captcha_rejected',
]);

/** Separate real product failures from expected quota and abuse controls. */
export function classifyAnalyticsSignal(
  eventName: string,
  properties: Record<string, unknown> | null,
): AnalyticsSignalKind {
  if (GUARDRAIL_EVENTS.has(eventName)) return 'guardrail';

  // The server emits the authoritative guardrail event for these same 429s.
  // Ignoring the client companion prevents one blocked request counting twice.
  if (eventName === 'llm_error' && properties?.status === 429) return 'none';
  if (
    eventName === 'workspace_start_error'
    && (properties?.is_rate_limit === true || properties?.needs_login === true)
  ) return 'none';

  return OPERATIONAL_ERROR_EVENTS.has(eventName) ? 'operational_error' : 'none';
}
