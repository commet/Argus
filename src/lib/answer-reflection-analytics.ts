export interface AnswerReflectionEvent {
  session_id: string;
  event_name: string;
  properties: Record<string, unknown> | null;
}

export interface AnswerReflectionSummary {
  total: number;
  moved: number;
  unchanged: number;
  movedRate: number;
  p50Ms: number | null;
  p95Ms: number | null;
}

function percentile(values: number[], fraction: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
}

/** Aggregate only privacy-safe answer_reflected properties from human sessions. */
export function summarizeAnswerReflections(
  events: readonly AnswerReflectionEvent[],
  humanSessionIds: ReadonlySet<string>,
): AnswerReflectionSummary {
  const reflections = events.filter((event) =>
    event.event_name === 'answer_reflected' && humanSessionIds.has(event.session_id));
  const moved = reflections.filter((event) => event.properties?.material_change === true).length;
  const durations = reflections.flatMap((event) => {
    const value = event.properties?.duration_ms;
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? [value] : [];
  });
  return {
    total: reflections.length,
    moved,
    unchanged: reflections.length - moved,
    movedRate: reflections.length ? Math.round((moved / reflections.length) * 100) : 0,
    p50Ms: percentile(durations, 0.5),
    p95Ms: percentile(durations, 0.95),
  };
}
