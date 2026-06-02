/**
 * Chronicler — the ship's-log narrator.
 *
 * Turns checkpoint transitions into typed waypoints (the 항해일지). Phase 2 is
 * the *deterministic salience gate*: it decides whether a transition is a real
 * turn worth logging and classifies it into one of the six WaypointTypes. The
 * prose (headline polish, significance, why-a-path-was-abandoned) is enriched
 * by an LLM pass later (Phase 5); this layer never invents — it only reads what
 * the checkpoint state already contains.
 *
 * Two principles, enforced structurally:
 *
 *  1. Honest causality. The `trigger` is *handed, not guessed*: at a briefing
 *     the last answer in `answers[]` literally caused that round's recompute, so
 *     we read it directly rather than inferring a cause after the fact.
 *
 *  2. Suppression by default. Most transitions are steps, not turns. Pure
 *     process stages (crew_set, crew_done, mix) and rounds that changed nothing
 *     salient return null. A voyage should yield ~5-7 waypoints, not one per
 *     checkpoint. Under-emitting beats noise; `sighting` (inherently fuzzy) is
 *     deferred to the Phase 5 LLM rather than guessed deterministically here.
 *
 * Pure functions only — no store access, no side effects beyond id/locale
 * lookups — so the gate is unit-testable in isolation.
 */

import { generateId } from '@/lib/uuid';
import { getCurrentLanguage } from '@/lib/i18n';
import type {
  AnalysisSnapshot,
  VoyageCheckpoint,
  VoyageCheckpointState,
  Waypoint,
  WaypointType,
  WaypointAlternative,
} from '@/stores/types';

const norm = (s: string | undefined | null): string =>
  (s || '').trim().toLowerCase().replace(/\s+/g, ' ');

const truncate = (s: string | undefined | null, n: number): string => {
  const t = (s || '').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

const latestSnap = (snaps: AnalysisSnapshot[] | undefined): AnalysisSnapshot | undefined =>
  snaps && snaps.length > 0 ? snaps[snaps.length - 1] : undefined;

/**
 * The cause of this round, read straight from state: the most recent answer is
 * the one that triggered the recompute. Paired with its question when findable.
 */
function lastAnswerTrigger(state: VoyageCheckpointState, ko: boolean): string | undefined {
  const a = state.answers[state.answers.length - 1];
  if (!a) return undefined;
  const q = state.questions.find((q) => q.id === a.question_id);
  return q ? `${ko ? '질문' : 'Q'}: ${truncate(q.text, 60)} → ${truncate(a.value, 60)}` : truncate(a.value, 80);
}

export interface DeriveWaypointArgs {
  /** The checkpoint just recorded (carries the post-transition state). */
  newCheckpoint: VoyageCheckpoint;
  /** The parent checkpoint's state (the before). Null only at origin. */
  prevState: VoyageCheckpointState | null;
  /** The session's original problem text — the departure heading. */
  problemText: string;
}

/**
 * Decide whether a checkpoint transition is a salient turn and, if so, return a
 * typed Waypoint. Returns null to suppress (the common case).
 *
 * One waypoint per checkpoint by design (a node = a turn). When a transition
 * qualifies for more than one type, the higher-altitude turn wins
 * (course_change > reef).
 */
export function deriveWaypoint(args: DeriveWaypointArgs): Waypoint | null {
  const { newCheckpoint: cp, prevState, problemText } = args;
  const state = cp.state_snapshot;
  const ko = getCurrentLanguage() === 'ko';

  const make = (
    type: WaypointType,
    headline: string,
    extra?: { trigger?: string; significance?: string; alternatives?: WaypointAlternative[] },
  ): Waypoint => ({
    id: generateId(),
    checkpoint_id: cp.id,
    type,
    headline,
    created_at: cp.created_at,
    ...extra,
  });

  switch (cp.stage) {
    // ── Always-salient endpoints ──
    case 'origin':
      return make('departure', truncate(problemText, 80) || (ko ? '출항' : 'Departure'), {
        trigger: truncate(problemText, 200),
      });

    case 'anchor':
      return make('anchorage', ko ? '항로 확정' : 'Course anchored');

    // ── Conditional turns ──
    case 'briefing': {
      const cur = latestSnap(state.snapshots);
      if (!cur) return null;
      const prev = prevState ? latestSnap(prevState.snapshots) : undefined;

      // course_change: the real question turned. The prior framing becomes a
      // road not taken (why_abandoned filled by the Phase 5 LLM pass).
      if (prev && norm(cur.real_question) && norm(cur.real_question) !== norm(prev.real_question)) {
        const alternatives: WaypointAlternative[] | undefined = prev.real_question
          ? [
              { label: truncate(prev.real_question, 80), why_abandoned: '', taken: false },
              { label: truncate(cur.real_question, 80), why_abandoned: '', taken: true },
            ]
          : undefined;
        return make('course_change', truncate(cur.real_question, 80), {
          trigger: lastAnswerTrigger(state, ko),
          alternatives,
        });
      }

      // reef: a hidden assumption was resolved — a *net* decrease in count is a
      // low-noise signal that the team retired one, not just reworded.
      if (prev && cur.hidden_assumptions.length < prev.hidden_assumptions.length) {
        const resolved = prev.hidden_assumptions.filter(
          (a) => !cur.hidden_assumptions.some((b) => norm(b) === norm(a)),
        );
        const head = resolved[0] || (ko ? '가정이 해소됨' : 'Assumption resolved');
        return make('reef', truncate(head, 80), { trigger: lastAnswerTrigger(state, ko) });
      }

      return null;
    }

    case 'crew_done': {
      // sighting: the team returned with material intelligence. Fills the
      // execution beat between a course change and the anchorage (otherwise the
      // log would jump straight from the turn to arrival).
      const reported = state.workers.filter(w => w.status === 'done' && w.result);
      if (reported.length === 0) return null;
      const head = ko
        ? `팀이 ${reported.length}개 영역을 조사해 보고했다`
        : `The team reported on ${reported.length} area${reported.length > 1 ? 's' : ''}`;
      return make('sighting', head);
    }

    case 'review': {
      // headwind: a high-severity stakeholder concern that forces a rethink.
      // Conservative — only 'critical' qualifies, so routine reviews stay quiet.
      const fb = state.dm_feedback;
      const critical = fb?.concerns?.find((c) => c.severity === 'critical');
      if (critical) {
        const who = fb
          ? `${fb.persona_name}${fb.persona_role ? ` (${fb.persona_role})` : ''}`
          : undefined;
        return make('headwind', truncate(critical.text, 80), { trigger: who });
      }
      return null;
    }

    // crew_set, mix → process steps, not turns (no waypoint).
    default:
      return null;
  }
}
