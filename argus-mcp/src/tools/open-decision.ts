import { atomicWriteJson } from '../lib/atomic-write.js';
import { sessionFilePath } from '../lib/layout.js';
import { resolveToolArgusDir } from '../lib/argus-dir.js';
import { resolveToday } from '../lib/resolve-today.js';
import { resolveContract } from '../lib/resolve-contract.js';
import { overfireGate, type Stakes, type Reversibility } from '../lib/overfire-gate.js';
import { validateCrux } from '../lib/validate-crux.js';
import { computeContinuity } from '../lib/continuity.js';
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
  user_question: z.string().max(600).optional(),
  crux_question: z.string().max(400).describe('The ONE neutral load-bearing question, phrased as a question. Never a fork, never a lean.').optional(),
  load_bearing_assumption: z.string().max(400).describe('The single assumption the decision rests on (neutral).').optional(),
  related_to: z.array(zId).max(20).describe('Ids of past decisions the user considers similar — surfaces a frequency-only track record, never a verdict.').optional(),
  today_override: zDate.optional(),
});

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

      const current = resolveContract(dir, id, today);
      if (a['already_decided'] === true && (current.state === 'sealed' || current.state === 'due' || current.state === 'settled')) {
        return toolError({
          ok: false, tool: 'argus_open_decision', error_code: 'ALREADY_CLOSED',
          message: 'This decision is already underway or closed.',
          recovery: 'To check reality, call argus_settle. Closed decisions are not reopened.',
        });
      }

      const signals = {
        stakes: a['stakes'] as Stakes,
        reversibility: a['reversibility'] as Reversibility,
        already_decided: a['already_decided'] === true,
      };
      const gate = overfireGate(signals);

      const now = new Date().toISOString();
      // Always log the gate inputs for post-hoc accuracy measurement (M2).
      await appendLedger(dir, [{ id, event: 'gate_input', gate: { ...signals, verdict: gate.reason } }], now);

      if (gate.response === 'reconfirm') {
        return envelope({
          ok: true, tool: 'argus_open_decision',
          surface: 'These signals look contradictory (high stakes yet easily reversible). Re-confirm stakes and reversibility before going further.',
          next_actions: ['argus_open_decision', 'leave_as_is'],
          over_fire_gate: { fired: false, reason: gate.reason },
          data: { id, crux_question: null, restraint_option: a['status_quo'], fork_emitted: false, harvest_written: false },
        });
      }

      if (!gate.fire) {
        return envelope({
          ok: true, tool: 'argus_open_decision',
          surface: `This looks like a "${gate.reason}" case. The steady move is to leave it as is — no fork to manufacture here.`,
          next_actions: ['leave_as_is', 'skip'],
          over_fire_gate: { fired: false, reason: gate.reason },
          data: { id, crux_question: null, restraint_option: a['status_quo'], fork_emitted: false, harvest_written: false },
        });
      }

      // FIRE: validate any model-supplied crux, persist the harvest.
      const cruxErr = validateCrux(a['crux_question']);
      if (cruxErr) {
        return toolError({ ok: false, tool: 'argus_open_decision', error_code: cruxErr.code, message: cruxErr.message, recovery: cruxErr.recovery });
      }

      await ensurePrivacyGitignore(dir);
      await atomicWriteJson(sessionFilePath(dir, id), {
        v: SCHEMA_VERSION, id, problem_text: a['decision'], status_quo: a['status_quo'],
        load_bearing_assumption: a['load_bearing_assumption'] ?? null, created_at: now,
      });
      await appendLedger(dir, [{ id, event: 'harvest', decision: a['decision'] as string }], now);

      const crux = (a['crux_question'] as string | undefined) ?? null;
      const relatedIds = Array.isArray(a['related_to']) ? (a['related_to'] as string[]) : [];
      const continuity = relatedIds.length ? computeContinuity(dir, relatedIds) : undefined;

      return envelope({
        ok: true, tool: 'argus_open_decision',
        surface: crux
          ? `Opened. The one question that decides this: ${crux}`
          : 'Opened. Surface exactly ONE neutral crux question (a question, not a fork or a lean), then seal a falsifiable prediction.',
        next_actions: ['argus_seal', 'leave_as_is', 'skip'],
        over_fire_gate: { fired: true, reason: gate.reason },
        data: {
          id,
          crux_question: crux,
          crux_question_provenance: crux ? 'ai_surfaced' : undefined,
          load_bearing_assumption: a['load_bearing_assumption'] ?? null,
          restraint_option: a['status_quo'],
          fork_emitted: false,
          harvest_written: true,
          continuity,
          lean_disclosure: 'Naming the load-bearing question points faintly at the flip; that residual lean is a known limit, not a verdict.',
        },
      });
    } catch (e) {
      return handleToolException('argus_open_decision', e);
    }
  },
};
