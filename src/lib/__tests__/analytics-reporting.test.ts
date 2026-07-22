import { describe, expect, it } from 'vitest';
import { classifyAnalyticsSignal } from '../analytics-reporting';
import { elapsedSecondsSince } from '../elapsed-time';

describe('analytics reporting signals', () => {
  it('does not double-count expected rate limits as product failures', () => {
    expect(classifyAnalyticsSignal('server_rate_limited', { kind: 'anon_daily' })).toBe('guardrail');
    expect(classifyAnalyticsSignal('llm_error', { status: 429 })).toBe('none');
    expect(classifyAnalyticsSignal('workspace_start_error', { needs_login: true })).toBe('none');
  });

  it('keeps genuine client and server failures in the operational digest', () => {
    expect(classifyAnalyticsSignal('llm_error', { status: 503 })).toBe('operational_error');
    expect(classifyAnalyticsSignal('review_timeout', { elapsed_s: 150 })).toBe('operational_error');
    expect(classifyAnalyticsSignal('review_failed', { kind: 'model_error' })).toBe('operational_error');
    expect(classifyAnalyticsSignal('unhandled_error', {})).toBe('operational_error');
  });

  it('measures async duration from wall-clock time rather than stale render state', () => {
    expect(elapsedSecondsSince(1_000, 151_400)).toBe(150);
    expect(elapsedSecondsSince(2_000, 1_000)).toBe(0);
  });
});
