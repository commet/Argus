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
  FlowQuestion,
  VoyageCheckpoint,
  VoyageCheckpointState,
  Waypoint,
  WaypointType,
  WaypointAlternative,
} from '@/stores/types';
import type { TypedQuestionMeta } from '@/lib/question-types';

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

/**
 * If the answer that triggered this round resolved a `strategic_fork`, surface
 * the fork's options as roads not taken: every direction the user DIDN'T pick
 * becomes a tap-to-sail alternative (the one they picked is taken=true). This is
 * what turns "아 다른 선택지를 고를걸" into a real branch they can sail later —
 * the chart draws the unchosen options as faint dashed keyword stubs and the
 * Logbook offers each a "이 길 가보기" handle (both read `alternatives`).
 *
 * Only fires when the *most recent* answer is the fork, so the options surface
 * once (on the checkpoint right after the choice), not on every later round.
 */
function strategicForkAlternatives(state: VoyageCheckpointState): WaypointAlternative[] | undefined {
  const a = state.answers[state.answers.length - 1];
  if (!a) return undefined;
  const q = state.questions.find((q) => q.id === a.question_id) as
    (FlowQuestion & { typed?: TypedQuestionMeta }) | undefined;
  const meta = q?.typed;
  if (!meta || meta.tag !== 'strategic_fork' || !meta.options || meta.options.length < 2) return undefined;
  const chosen = a.value.trim();
  const alts: WaypointAlternative[] = meta.options.map((o) => {
    const why = o.effect && 'rationale' in o.effect ? (o.effect.rationale || '') : '';
    return { label: truncate(o.label, 80), why_abandoned: truncate(why, 80), taken: o.label.trim() === chosen };
  });
  // Worth surfacing only if at least one direction was left untravelled.
  return alts.some((x) => !x.taken) ? alts : undefined;
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

      // A strategic_fork the user just resolved → its unchosen options ARE the
      // roads not taken (richer and more recognizable than a bare framing diff,
      // and each is tap-to-sail). Takes precedence over the real_question diff.
      const forkAlts = strategicForkAlternatives(state);
      if (forkAlts) {
        return make('course_change', truncate(cur.real_question, 80) || (ko ? '방향 선택' : 'Direction chosen'), {
          trigger: lastAnswerTrigger(state, ko),
          alternatives: forkAlts,
        });
      }

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

    case 'crew_set': {
      // helm: the captain left their mark on the crew — hand-added members or
      // tasks routed to people (self / human) instead of pure AI auto-pilot.
      // A fully auto AI crew is just a process step (no waypoint).
      const ws = state.workers || [];
      if (ws.length === 0) return null;
      const added = ws.filter((w) => w.added_manually).length;
      const swapped = ws.filter((w) => w.user_assigned).length;
      const selfCount = ws.filter((w) => w.agent_type === 'self').length;
      const askCount = ws.filter((w) => w.agent_type === 'human').length;
      if (added === 0 && swapped === 0 && selfCount === 0 && askCount === 0) return null;

      const parts: string[] = [];
      if (added > 0) parts.push(ko ? `직접 추가 ${added}` : `${added} hand-picked`);
      if (swapped > 0) parts.push(ko ? `직접 지정 ${swapped}` : `${swapped} re-cast`);
      if (selfCount > 0) parts.push(ko ? `내 판단 ${selfCount}` : `${selfCount} my call`);
      if (askCount > 0) parts.push(ko ? `사람에게 ${askCount}` : `${askCount} to people`);

      // Hand-built = the captain shaped the AI crew (added or re-cast); otherwise
      // the mark is purely that people carry some of the work.
      const handBuilt = added > 0 || swapped > 0;
      const headline = handBuilt
        ? (ko ? '선장이 팀을 직접 짰다' : 'The captain hand-built the crew')
        : (ko ? '사람이 직접 맡은 부분이 있다' : 'Some parts are handled by people');
      return make('helm', headline, { significance: parts.join(' · ') });
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

    // mix → a process step, not a turn (no waypoint).
    default:
      return null;
  }
}
