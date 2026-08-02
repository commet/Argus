import { describe, expect, it } from 'vitest';
import { summarizeAnswerReflections } from '@/lib/answer-reflection-analytics';

describe('summarizeAnswerReflections', () => {
  it('shows whether questions moved state and preserves the latency tail', () => {
    const events = [
      { session_id: 'a', event_name: 'answer_reflected', properties: { material_change: true, duration_ms: 500 } },
      { session_id: 'a', event_name: 'answer_reflected', properties: { material_change: false, duration_ms: 1_500 } },
      { session_id: 'b', event_name: 'answer_reflected', properties: { material_change: true, duration_ms: 9_000 } },
      { session_id: 'bot', event_name: 'answer_reflected', properties: { material_change: true, duration_ms: 99_000 } },
    ];
    expect(summarizeAnswerReflections(events, new Set(['a', 'b']))).toEqual({
      total: 3,
      moved: 2,
      unchanged: 1,
      movedRate: 67,
      p50Ms: 1_500,
      p95Ms: 9_000,
    });
  });

  it('does not manufacture latency when old events lack it', () => {
    expect(summarizeAnswerReflections([
      { session_id: 'a', event_name: 'answer_reflected', properties: null },
    ], new Set(['a']))).toMatchObject({ total: 1, unchanged: 1, p50Ms: null, p95Ms: null });
  });
});
