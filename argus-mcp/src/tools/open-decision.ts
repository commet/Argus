import { atomicWriteJson } from '../lib/atomic-write.js';
import { sessionFilePath } from '../lib/layout.js';
import { resolveToolArgusDir } from '../lib/argus-dir.js';
import { resolveToday, logicalNow } from '../lib/resolve-today.js';
import { resolveContract } from '../lib/resolve-contract.js';
import { refuseIfLedgerUnreadable } from '../lib/ledger-readable.js';
import { overfireGate, type Stakes, type Reversibility } from '../lib/overfire-gate.js';
import { validateCrux } from '../lib/validate-crux.js';
import { computeContinuity } from '../lib/continuity.js';
import { relatedOpenForPremises } from '../v2/connection-io.js';
import { resolveResponseLocale, SURFACES } from '../lib/surfaces.js';
import { appendLedger } from '../lib/ledger-append.js';
import { ensurePrivacyGitignore } from '../lib/privacy.js';
import { SCHEMA_VERSION } from '../lib/spine.js';
import { z } from 'zod';
import { envelope, toolError } from '../lib/envelope.js';
import { ENVELOPE_OUTPUT_SCHEMA, zArgusDir, zId, zDate, type ToolModule } from './tool-types.js';
import { handleToolException } from './errors.js';

const inputSchema = z.strictObject({
  argus_dir: zArgusDir,
  id: zId.min(1).max(128).describe('Single identifier for this decision (used as the file segment). A new decision gets a new id.'),
  decision: z.string().min(1).max(600).describe('The choice the user actually faces, in one neutral sentence. A choice, not an opinion.'),
  stakes: z.enum(['trivial', 'low', 'moderate', 'high']).describe('Cost of being wrong. If between two, pick the lower (restraint default).'),
  reversibility: z.enum(['one_way_door', 'costly_to_reverse', 'easily_reversible']),
  status_quo: z.string().min(1).max(300).describe('What happens if nothing is done — so "leave_as_is" is always a real option.'),
  already_decided: z.boolean().default(false),
  // NOTE: there was a `user_question` field here. Nothing ever read it — it was
  // accepted, then evaporated (the include_upcoming_days class: "an accepted-
  // then-discarded argument is a silent lie in the schema"), and on the most
  // load-bearing input of all, the user's own question. Removed rather than
  // faked: the live home for the user's question is argus_seal's `real_question`,
  // which reaches the Judgment Receipt.
  crux_question: z.string().max(400).describe('The ONE neutral load-bearing question, phrased as a question. Never a fork, never a lean.').optional(),
  load_bearing_assumption: z.string().max(400).describe('The single assumption the decision rests on (neutral).').optional(),
  related_to: z.array(zId).max(20).describe('Ids of past decisions the user considers similar. They are references, never an outcome aggregate or verdict.').optional(),
  today_override: zDate.optional(),
});

// Restraint reasons → human sentences (11 P2-1/S6) now live in the surfaces
// dictionary (SURFACES[locale].tools.open_decision.reason) so ko/en share one
// source. Each names WHY no fork is manufactured; the caller appends the fixed
// handle-return coda. 'flat' is kept for forward-compat even though the current
// gate never emits it.

export const openDecision: ToolModule = {
  name: 'argus_open_decision',
  description:
    'Open a consequential decision. Runs a fire-or-not restraint gate FIRST; if it fires, surfaces at most one neutral crux question and a "leave as is" option. Never a fork, never a verdict, never a lean. On flat/low-stakes/reversible/closed decisions it returns restraint.',
  inputSchema,
  outputSchema: ENVELOPE_OUTPUT_SCHEMA,
  annotations: { title: 'Open a decision', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (a) => {
    try {
      const dir = resolveToolArgusDir(a['argus_dir']);
      const id = String(a['id'] ?? '');
      const today = resolveToday({ override: a['today_override'] as string | undefined });
      // Response voice follows the decision sentence (M4): config > text > env.
      const locale = resolveResponseLocale(dir, a['decision'] as string | undefined);
      const T = SURFACES[locale].tools.open_decision;

      const current = resolveContract(dir, id, today);
      const blind = refuseIfLedgerUnreadable('argus_open_decision', current);
      if (blind) return blind;
      if (a['already_decided'] === true && (current.state === 'sealed' || current.state === 'due' || current.state === 'settled')) {
        return toolError({
          ok: false, tool: 'argus_open_decision', error_code: 'ALREADY_CLOSED',
          message: 'This decision is already underway or closed.',
          recovery: 'To record what reality did, call argus_resolve. Closed decisions are not reopened.',
        });
      }
      // Idempotent re-open (2026-08-09 audit): a model retry with the same id
      // was the ONLY guardless write path left — every retry appended another
      // gate_input + harvest pair, ghost lines the replay absorbs but the
      // ledger carries forever (and "record since" drifts to the retry time).
      if (current.state === 'opened') {
        return envelope({
          ok: true, tool: 'argus_open_decision',
          surface: locale === 'ko'
            ? '이미 열려 있는 결정입니다. 다시 기록하지 않았습니다. 예측을 봉인하려면 argus_predict 를 부르세요.'
            : 'This decision is already open — nothing was recorded twice. Seal a prediction with argus_predict.',
          next_actions: ['argus_predict', 'stop'],
          data: { id, state: current.state, idempotent: true },
        });
      }

      const signals = {
        stakes: a['stakes'] as Stakes,
        reversibility: a['reversibility'] as Reversibility,
        already_decided: a['already_decided'] === true,
      };
      const gate = overfireGate(signals);

      // Validate any model-supplied crux BEFORE any side-effect — invalid input
      // must error without persisting. (The public capture surface no longer
      // sends a crux; this guards internal callers that still can.)
      const cruxErr = validateCrux(a['crux_question']);
      if (cruxErr) {
        return toolError({ ok: false, tool: 'argus_open_decision', error_code: cruxErr.code, message: cruxErr.message, recovery: cruxErr.recovery });
      }

      // Logical-date stamp (not raw UTC), so the open — usually the OLDEST event —
      // dates on the same basis as seals; else "record since" reads a day early.
      const now = logicalNow(today, !!a['today_override']);
      // Always log the gate inputs for post-hoc accuracy measurement (M2).
      await appendLedger(dir, [{ id, event: 'gate_input', gate: { ...signals, verdict: gate.reason } }], now);

      // 기록과 의식을 분리한다: the user's own decision and premise are recorded
      // REGARDLESS of the gate — deciding it "isn't worth keeping" would itself
      // be a judgment about the user's decision (zero-judgment violation). The
      // over-fire gate now governs only the surface CEREMONY (whether a crux is
      // offered and a seal is nudged), never whether the record is written.
      await ensurePrivacyGitignore(dir);
      await atomicWriteJson(sessionFilePath(dir, id), {
        v: SCHEMA_VERSION, id, problem_text: a['decision'], status_quo: a['status_quo'],
        load_bearing_assumption: a['load_bearing_assumption'] ?? null, created_at: now,
      });
      await appendLedger(dir, [{ id, event: 'harvest', decision: a['decision'] as string }], now);

      const relatedIds = Array.isArray(a['related_to']) ? (a['related_to'] as string[]) : [];
      const continuity = relatedIds.length ? computeContinuity(dir, relatedIds) : undefined;

      if (gate.response === 'reconfirm') {
        return envelope({
          ok: true, tool: 'argus_open_decision',
          surface: T.reconfirm,
          next_actions: ['leave_as_is'],
          over_fire_gate: { fired: false, reason: gate.reason },
          data: { id, crux_question: null, restraint_option: a['status_quo'], fork_emitted: false, harvest_written: true, continuity },
        });
      }

      if (!gate.fire) {
        return envelope({
          ok: true, tool: 'argus_open_decision',
          // Human sentence, not a snake_case enum (11 P2-1). Contract (§4): the
          // line ENDS by naming the option and returning the handle — never a
          // directive ("leave it") issued in the user's stead. The decision is
          // now recorded quietly, so the old "jot a note if you want it kept"
          // exit is gone (it IS kept); the gate only withholds the ceremony.
          surface: `${T.reason[gate.reason as keyof typeof T.reason] ?? T.reason_fallback} ${T.leave_coda}`,
          next_actions: ['leave_as_is', 'skip'],
          over_fire_gate: { fired: false, reason: gate.reason },
          data: { id, crux_question: null, restraint_option: a['status_quo'], fork_emitted: false, harvest_written: true, continuity },
        });
      }

      // FIRE: the ceremony — surface the one neutral crux (if supplied) and the
      // seal path. Persistence already happened above.
      const crux = (a['crux_question'] as string | undefined) ?? null;

      // Capture-time connection (정본 §8-§11, §8-C): the same mechanical read the
      // settle surface uses, moved to the front door. If the premise this
      // decision rests on is one the user already tracks under another OPEN
      // decision, name that fact + the handle — never a verdict, never "revisit
      // it". best-effort: a non-git/uninit/failed v2 read just yields no line.
      const premiseTexts = [
        typeof a['load_bearing_assumption'] === 'string' ? (a['load_bearing_assumption'] as string) : '',
        ...(Array.isArray(a['premises']) ? (a['premises'] as Array<{ text?: string }>).map((p) => p?.text ?? '') : []),
      ];
      const connections = relatedOpenForPremises(dir, today, premiseTexts, id);
      let connectionLine = '';
      if (connections.length > 0) {
        const shown = connections.slice(0, 3).map((c) => c.decision_id);
        const extra = connections.length - shown.length;
        connectionLine = locale === 'ko'
          ? `\n이 결정과 같은 전제 위에 선 다른 열린 결정: ${shown.join(', ')}${extra > 0 ? ` 외 ${extra}개` : ''}. argus_check_in으로 함께 볼 수 있어요.`
          : `\nOther open decisions stand on the same assumption or fact: ${shown.join(', ')}${extra > 0 ? ` (+${extra} more)` : ''}. Review them together with argus_check_in.`;
      }

      return envelope({
        ok: true, tool: 'argus_open_decision',
        surface: (crux ? T.opened_with_crux(crux) : T.opened_bare) + connectionLine,
        next_actions: ['argus_predict', 'leave_as_is', 'skip'],
        over_fire_gate: { fired: true, reason: gate.reason },
        data: {
          id,
          crux_question: crux,
          crux_question_provenance: crux ? 'ai_surfaced' : undefined,
          // The spine-mandated product-level disclosure of the irreducible
          // residual lean (mirror clause): naming the load-bearing question
          // faintly points at the flip. A KNOWN-LIMIT fact riding in data —
          // never a verdict, never appended to the surface as a directive.
          lean_disclosure: T.lean_disclosure,
          load_bearing_assumption: a['load_bearing_assumption'] ?? null,
          restraint_option: a['status_quo'],
          fork_emitted: false,
          harvest_written: true,
          continuity,
          ...(connections.length > 0 ? {
            connections: connections.map((c) => c.decision_id),
            connection_reasons: connections.map((c) => ({ id: c.decision_id, reason: c.reason, ...(c.via ? { via: c.via } : {}) })),
          } : {}),
        },
      });
    } catch (e) {
      return handleToolException('argus_open_decision', e);
    }
  },
};
