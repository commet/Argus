export type ReturnEventName = 'return_opened' | 'return_answered' | 'return_deferred';

type ReturnEvent = {
  session_id: string;
  event_name: string;
  properties: Record<string, unknown> | null;
};

/**
 * Count return-loop activity once per project. Events from sessions that were
 * not classified as human never enter the metric. Legacy events without a
 * project id remain visible, but only once per session.
 */
export function distinctReturnProjects(
  events: ReturnEvent[],
  eventName: ReturnEventName,
  humanSessionIds: Set<string>
): Set<string> {
  return new Set(events
    .filter(e => e.event_name === eventName && humanSessionIds.has(e.session_id))
    .map(e => {
      const projectId = e.properties?.project_id;
      return typeof projectId === 'string' && projectId.trim()
        ? `project:${projectId}`
        : `session:${e.session_id}`;
    }));
}
