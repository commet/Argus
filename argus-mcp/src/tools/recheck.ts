import { z } from 'zod';
import { resolveToolArgusDir } from '../lib/argus-dir.js';
import { resolveToday } from '../lib/resolve-today.js';
import { replayLedger } from '../lib/ledger-replay.js';
import { deriveState, guardTransition } from '../lib/state-machine.js';
import { appendLedger, type LedgerEventInput } from '../lib/ledger-append.js';
import { resolvePremiseRef, matchingMonitoredPremises, normalizePremiseText, recheckCadenceDays } from '../lib/premises.js';
import { evaluateMateriality, type MaterialityRule, type Materiality } from '../lib/numeric-drift.js';
import { resolveResponseLocale, SURFACES } from '../lib/surfaces.js';
import { envelope, toolError } from '../lib/envelope.js';
import type { NextAction } from '../lib/spine.js';
import { ENVELOPE_OUTPUT_SCHEMA, zArgusDir, zId, zDate, type ToolModule } from './tool-types.js';
import { handleToolException } from './errors.js';

/**
 * argus_recheck — re-check one premise against reality (plan v5 §2, §7.1).
 *
 * The HOST does the research (web search, a document, the user's report); this
 * tool does the mechanical part only:
 *   - numeric premises: compares EXPLICIT numbers (never parses prose — the
 *     first-number-in-string bug class reads "2026년 기준금리 3.5%" as 2026)
 *   - text premises: records the host's provenance-armed factual assertion
 *     (`changed`) — a paraphrase is not a changed fact, so string comparison
 *     over-fires and is not used
 *   - provenance is REQUIRED on every recheck: a half-remembered value must
 *     never enter the reality record unlabeled
 *
 * When the fact drifted, the surface returns the handle — never a directive.
 */

const inputSchema = z.strictObject({
  argus_dir: zArgusDir,
  id: zId.describe('The decision id.'),
  ref: z.string().max(64).describe('Which premise — ordinal ("P1"), premise_id, or unambiguous prefix.'),
  finding: z.string().min(3).max(400).describe('The CURRENT state of the fact, one literal comparable sentence. e.g. "base rate 3.75% after a 25bp hike".'),
  numeric_value: z.number().optional().describe('The fact\'s current number, named EXPLICITLY (e.g. 3.75). Never extracted from prose by regex. When present, drift is decided mechanically (>=10% move or sign flip).'),
  changed: z.boolean().optional().describe('Text premises only: has the FACT materially changed vs the recorded baseline? A research finding about external reality (provenance required) — never a judgment of the user.'),
  source: z.enum(['url', 'user_stated', 'host_reported']).describe('Where the finding comes from. host_reported = the model\'s own research without a citation — recorded honestly as such.'),
  source_detail: z.string().max(300).optional().describe('URL or short citation when source="url".'),
  apply_to_matching: z.boolean().default(false).describe('Also record this re-check on OTHER decisions whose monitored premise has the same normalized text (same fact, same evidence — an explicit mechanical fan-out, plan v5 P1).'),
  today_override: zDate.optional(),
});

export const recheck: ToolModule = {
  name: 'argus_recheck',
  description:
    'Re-check one premise of a decision against reality. The host researches the fact and passes the finding (with provenance); ' +
    'the tool records it and decides drift mechanically — explicit numbers compare numerically, text premises take the host\'s asserted `changed`. ' +
    'First re-check records the baseline and never alerts. If the fact drifted, the response says so and returns the handle — whether to revisit the decision stays the user\'s call.',
  inputSchema,
  outputSchema: ENVELOPE_OUTPUT_SCHEMA,
  annotations: { title: 'Re-check a premise against reality', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (a) => {
    try {
      const dir = resolveToolArgusDir(a['argus_dir']);
      const id = String(a['id'] ?? '');
      const today = resolveToday({ override: a['today_override'] as string | undefined });
      const now = new Date().toISOString();

      const state = replayLedger(dir, today);
      const entry = state.contracts.get(id);
      guardTransition(deriveState(entry, today), 'premise_recheck');

      const premise = resolvePremiseRef(entry?.premises ?? [], String(a['ref']));
      if (premise.kind !== 'premise') {
        return toolError({ ok: false, tool: 'argus_recheck', error_code: 'NOT_RECHECKABLE', message: `P${premise.ordinal} is an open question — it is resolved by you, not re-checked against reality.`, recovery: 'Use argus_premises op="resolve" with your own call.' });
      }
      if (premise.status !== 'active') {
        return toolError({ ok: false, tool: 'argus_recheck', error_code: 'PREMISE_RETIRED', message: `P${premise.ordinal} is ${premise.status}.`, recovery: 'Only active premises are re-checked. See argus_recall view="premises".' });
      }

      const finding = String(a['finding']);
      // Response voice follows the finding sentence (M4): config > text > env.
      const T = SURFACES[resolveResponseLocale(dir, String(a['finding']))].tools.recheck;
      const source = String(a['source']);
      const sourceDetail = a['source_detail'] as string | undefined;
      const numericValue = a['numeric_value'] as number | undefined;
      const changed = a['changed'] as boolean | undefined;

      // ── drift decision (mechanical or host-asserted; plan v5 §7.1, M2 §4) ──
      const prior = premise.last_recheck;
      const baselineOnly = !prior;
      // M2 3-valued materiality: 'material' | 'uncertain' | 'unchanged'. `drifted`
      // stays on the record for back-compat (material → true) but the SPINE wiring
      // (next_actions) reads `status`: only `material` auto-attaches the handle.
      let status: Materiality | 'baseline' = 'baseline';
      let drifted = false;
      let reason = 'baseline recorded';
      let lowConfidence = false;
      let integrityNote: string | undefined;

      if (!baselineOnly) {
        const prevNum = prior.numeric_value;
        if (typeof numericValue === 'number' && typeof prevNum === 'number') {
          const m = evaluateMateriality(prevNum, numericValue, premise.materiality_rule as MaterialityRule | undefined);
          status = m.status;
          drifted = m.status === 'material';
          reason = m.reason;
          lowConfidence = m.low_confidence === true;
          if (typeof changed === 'boolean' && changed !== drifted && status !== 'uncertain') {
            integrityNote = `numeric materiality (${reason}) disagrees with the asserted changed=${changed} — the numbers win; both are on the record.`;
          }
        } else if (typeof changed === 'boolean') {
          status = changed ? 'material' : 'unchanged';
          drifted = changed;
          reason = changed ? 'the host asserts the fact changed (see source)' : 'the host asserts the fact is unchanged';
          if (changed && normalizePremiseText(finding) === normalizePremiseText(prior.finding)) {
            integrityNote = 'asserted changed=true but the finding text is identical to the recorded baseline — recorded as asserted, flagged here.';
          }
        } else {
          return toolError({
            ok: false, tool: 'argus_recheck', error_code: 'RECHECK_NEEDS_ASSERTION',
            message: 'A prior baseline exists but neither a comparable numeric_value nor a `changed` assertion was given.',
            recovery: `Pass numeric_value (explicit number) for a numeric fact, or changed=true/false as your research finding vs the baseline: "${prior.finding}".`,
          });
        }
      }

      const mkEvent = (targetId: string, targetPremiseId: string): LedgerEventInput => ({
        id: targetId, event: 'premise_recheck', premise_id: targetPremiseId,
        finding,
        ...(typeof numericValue === 'number' ? { numeric_value: numericValue } : {}),
        drifted, baseline_only: baselineOnly, source,
        ...(sourceDetail ? { source_detail: sourceDetail } : {}),
      });

      const events: LedgerEventInput[] = [mkEvent(id, premise.premise_id)];

      // ── explicit cross-decision fan-out (same fact, same evidence) ──
      const appliedTo: Array<{ decision_id: string; ref: string }> = [];
      if (a['apply_to_matching'] === true) {
        for (const m of matchingMonitoredPremises(state, id, premise.text)) {
          try {
            guardTransition(deriveState(m.entry, today), 'premise_recheck');
          } catch { continue; } // closed decisions are skipped, never forced
          events.push(mkEvent(m.entry.id, m.premise.premise_id));
          appliedTo.push({ decision_id: m.entry.id, ref: `P${m.premise.ordinal}` });
        }
      }

      await appendLedger(dir, events, now);

      // heuristic-fallback notice (M2 §7): only when no rule was declared AND the
      // engine leaned on the under-fire default (low_confidence).
      const heuristicNote = lowConfidence && !premise.materiality_rule
        ? T.uncertain_heuristic_note
        : '';

      const surface = baselineOnly
        ? T.baseline(premise.ordinal, finding, source, recheckCadenceDays(premise))
        : status === 'material'
          ? T.material(premise.ordinal, prior!.finding, finding, source)
          : status === 'uncertain'
            // M2 §4/§7: uncertain surfaces the FACT only — no handle, no fork. The
            // user decides whether to define a rule or leave it.
            ? `${T.uncertain(premise.ordinal, reason)}${heuristicNote}`
            : T.unchanged(premise.ordinal, source);

      // ── SPINE (M2 §4, mirror clause): the handle auto-attaches ONLY on
      //    `material`. `uncertain` (depends / boundary / rule-uncovered) NEVER
      //    auto-attaches argus_recall — that would manufacture a fork on a flat
      //    or reversible decision. The user calls the handle; the tool doesn't.
      const next_actions: NextAction[] = status === 'material'
        ? ['argus_recall', 'leave_as_is']
        : ['leave_as_is', 'stop'];

      return envelope({
        ok: true, tool: 'argus_recheck',
        surface,
        // NEXT_ACTIONS is a closed enum (v4 §0.5-2: not extended) — tool
        // discovery rides the surface text and descriptions instead.
        next_actions,
        data: {
          id, ref: `P${premise.ordinal}`, premise_id: premise.premise_id,
          finding, drifted, baseline_only: baselineOnly, reason,
          ...(baselineOnly ? {} : { materiality: status }),
          ...(lowConfidence ? { low_confidence: true } : {}),
          source, ...(sourceDetail ? { source_detail: sourceDetail } : {}),
          ...(integrityNote ? { integrity_note: integrityNote } : {}),
          ...(appliedTo.length ? { applied_to_matching: appliedTo } : {}),
          ledger_events_written: events.map(() => 'premise_recheck'),
        },
      });
    } catch (e) {
      return handleToolException('argus_recheck', e);
    }
  },
};
