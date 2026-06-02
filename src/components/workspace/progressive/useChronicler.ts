'use client';

/**
 * useChronicler — drives the async narration pass for the ship's log.
 *
 * Watches the active session's waypoints and, for any narratable turn that lacks
 * `significance`, fires a best-effort LLM narration (once per waypoint) and
 * merges the result back via the store. Runs only while `enabled` (the caller
 * passes `!busy`) so it never competes with an in-flight analysis stream.
 *
 * Integration is one line in ProgressiveFlow; all the bookkeeping lives here so
 * the engine component stays untouched.
 */

import { useEffect, useRef } from 'react';
import { useProgressiveStore } from '@/stores/useProgressiveStore';
import { useLocale } from '@/hooks/useLocale';
import { narrateWaypoint, isNarratable } from '@/lib/voyage-log-narrate';
import type { ProgressiveSession } from '@/stores/types';

export function useChronicler(session: ProgressiveSession | null | undefined, enabled: boolean) {
  const locale = useLocale();
  const enrichWaypoint = useProgressiveStore(s => s.enrichWaypoint);
  // Waypoints we've already attempted (success or failure) — never retry, so a
  // persistently-failing narration can't loop.
  const attempted = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled || !session) return;
    const waypoints = session.waypoints || [];
    const pending = waypoints.filter(
      w => isNarratable(w.type) && !w.significance && !attempted.current.has(w.id),
    );
    if (pending.length === 0) return;

    const byId = new Map((session.checkpoints || []).map(c => [c.id, c]));
    const lastQuestion = (cpId: string | null | undefined): string | undefined => {
      const cp = cpId ? byId.get(cpId) : undefined;
      return cp?.state_snapshot.snapshots.slice(-1)[0]?.real_question;
    };

    pending.forEach(w => {
      attempted.current.add(w.id);
      const cp = byId.get(w.checkpoint_id);
      narrateWaypoint({
        waypoint: w,
        problemText: session.problem_text,
        curRealQuestion: lastQuestion(w.checkpoint_id),
        prevRealQuestion: lastQuestion(cp?.parent_id),
        locale: locale as 'ko' | 'en',
      })
        .then(patch => { if (patch) enrichWaypoint(w.id, patch); })
        .catch(() => { /* best-effort */ });
    });
  }, [session, enabled, locale, enrichWaypoint]);
}
