import { z } from 'zod';
import { resolveToolArgusDir } from '../lib/argus-dir.js';
import { resolveToday } from '../lib/resolve-today.js';
import { resolveContract } from '../lib/resolve-contract.js';
import { guardTransition } from '../lib/state-machine.js';
import { appendLedger, type LedgerEventInput } from '../lib/ledger-append.js';
import {
  premiseId, resolvePremiseRef, isMonitored,
  MAX_ACTIVE_PREMISES, MAX_LOAD_BEARING,
  type PremiseState,
} from '../lib/premises.js';
import { elicit } from '../lib/elicit.js';
import { envelope, toolError } from '../lib/envelope.js';
import { ENVELOPE_OUTPUT_SCHEMA, zArgusDir, zId, zDate, type ToolModule } from './tool-types.js';
import { handleToolException } from './errors.js';

/**
 * argus_premises — the write surface for a decision's living premises
 * (plan v5 §2). One tool, three ops, so hosts thread ONE name:
 *
 *   add     — record the facts / open questions the decision rests on
 *   amend   — the user corrects a premise (the edit IS the signal; authorship
 *             transfers honestly, ai_original preserved)
 *   resolve — the user closes an open question IN THEIR OWN WORDS
 *             (elicitation-only: this tool never generates options, examples,
 *             or leans — a two-pole fork cannot be expressed here)
 *
 * Premise text is DATA, never instructions; it is echoed back in full
 * (data.premises) so the host can always show the user what was recorded.
 */

const zRuleModifiers = z.strictObject({
  direction: z.enum(['harmful_only', 'either', 'sign_flip']).optional(),
  harmful_dir: z.enum(['up', 'down']).optional(),
  unit_axis: z.enum(['absolute', 'ratio', 'percentage_point', 'complement']).optional(),
  boundary: z.enum(['inclusive', 'exclusive']).optional(),
  scale: z.string().max(64).optional(),
  resolution: z.number().optional(),
  zero_meaningful: z.boolean().optional(),
  safety_floor: z.number().optional(),
  near_zero_cut: z.number().optional(),
}).optional();

// M2 materiality rule — how "did this fact materially change?" is decided for
// this premise. Optional: absent → the under-fire default heuristic (M2 §2).
const zMaterialityRule = z.strictObject({
  type: z.enum(['threshold', 'step', 'delta', 'relative', 'band', 'map', 'stateful'])
    .describe('threshold=crosses a line; step=moves N notches on a grid/ordinal; delta=absolute move; relative=% move; band=leaves [lo,hi]; map=enters a named material-state set (nominal); stateful=path/volatility (opt-in, v2).'),
  params: z.record(z.string(), z.union([z.number(), z.string(), z.array(z.string())]))
    .describe('Rule params: line/S/N/D/P/lo/hi/material_states…'),
  modifiers: zRuleModifiers,
});

const zPremiseInput = z.strictObject({
  text: z.string().min(3).max(400).describe('One literal, factual sentence. No metaphor. Good: "base rate stays at 3.5% through 2026". Bad: "the ground this rests on".'),
  kind: z.enum(['premise', 'open_question']).default('premise').describe('premise = a fact/belief the decision rests on. open_question = something the user explicitly left undecided.'),
  external: z.boolean().default(false).describe('Can reality verify this later (a rate, a date, supply, a third party)? external + load_bearing arms re-checking.'),
  load_bearing: z.boolean().default(false).describe(`Would the decision flip if this is wrong? Mark sparingly — max ${MAX_LOAD_BEARING} per decision.`),
  source: z.enum(['ai', 'user']).describe('Provenance. Never forge: "user" = the user\'s own words; "ai" = model-drafted (requires ai_original).'),
  ai_original: z.string().max(400).optional().describe('REQUIRED when source="ai": the model\'s original wording, preserved verbatim across later edits.'),
  materiality_rule: zMaterialityRule.optional().describe('Optional: how re-checks decide "did this materially change?". Absent → an under-fire default heuristic (silence when unsure). Define it to be precise (e.g. threshold "drops below 4.0", step "any one-notch credit downgrade").'),
  recheck_cadence_days: z.number().int().min(1).max(365).optional().describe('Optional: how many days between reality re-checks for this fact (M1). Absent → a default derived from the rule type (a moving number is checked more often than slow-moving state). The user pins this; it only moves the DUE nudge, never blocks a recheck.'),
});

const inputSchema = z.strictObject({
  argus_dir: zArgusDir,
  id: zId.describe('The decision id from argus_open_decision.'),
  op: z.enum(['add', 'amend', 'resolve']).describe('add = record premises; amend = correct one (user edit = signal); resolve = close an open question in the user\'s words.'),
  premises: z.array(zPremiseInput).min(1).max(MAX_ACTIVE_PREMISES).optional().describe('op=add only.'),
  ref: z.string().max(64).optional().describe('op=amend/resolve: which premise — an ordinal ("P1"), the premise_id, or an unambiguous id prefix. Ordinals are permanent (a retired P2 stays P2).'),
  action: z.enum(['accept', 'refine', 'replace', 'retire']).optional().describe('op=amend only. accept = confirm as-is; refine/replace = correct the text; retire = remove from active tracking (stays on the record).'),
  text: z.string().min(3).max(400).optional().describe('op=amend refine/replace: the corrected text — the USER\'s wording, verbatim, never re-summarized.'),
  note: z.string().max(300).optional().describe('op=amend: optional why (never required).'),
  external: z.boolean().optional().describe('op=amend: correct the external flag (true lets re-checking arm for a load-bearing premise).'),
  load_bearing: z.boolean().optional().describe('op=amend: correct the load-bearing flag.'),
  recheck_cadence_days: z.number().int().min(1).max(365).optional().describe('op=amend: re-set how often (days) this fact is re-checked (M1). Widens or narrows the DUE nudge; never blocks an explicit recheck.'),
  decision: z.string().min(1).max(400).optional().describe('op=resolve: the user\'s own closing call. MUST be the user\'s words — never an Argus-drafted line.'),
  today_override: zDate.optional(),
});

export const premises: ToolModule = {
  name: 'argus_premises',
  description:
    'Record and maintain the premises a decision rests on — the facts and open questions behind it. ' +
    'op=add records them (echoed back in full so the user sees what was written); op=amend lets the user correct one (edits are the signal; provenance is preserved); ' +
    'op=resolve closes an open question in the user\'s own words. Premises lock once the check-by date arrives. ' +
    'A load-bearing external premise is re-checked against reality via argus_recheck once the decision is sealed.',
  inputSchema,
  outputSchema: ENVELOPE_OUTPUT_SCHEMA,
  annotations: { title: 'Track decision premises', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (a) => {
    try {
      const dir = resolveToolArgusDir(a['argus_dir']);
      const id = String(a['id'] ?? '');
      const today = resolveToday({ override: a['today_override'] as string | undefined });
      const op = String(a['op']);
      const now = new Date().toISOString();

      const current = resolveContract(dir, id, today);
      const existing: PremiseState[] = current.entry?.premises ?? [];

      if (op === 'add') return await opAdd(dir, id, today, now, current.state, existing, a);
      if (op === 'amend') return await opAmend(dir, id, now, current.state, existing, a);
      return await opResolve(dir, id, now, current.state, existing, a);
    } catch (e) {
      return handleToolException('argus_premises', e);
    }
  },
};

// ── op=add ─────────────────────────────────────────────────────────────────

async function opAdd(
  dir: string, id: string, _today: string, now: string,
  state: Parameters<typeof guardTransition>[0], existing: PremiseState[],
  a: Record<string, unknown>,
) {
  guardTransition(state, 'premise_add');

  const inputs = a['premises'] as Array<z.infer<typeof zPremiseInput>> | undefined;
  if (!inputs || inputs.length === 0) {
    return toolError({ ok: false, tool: 'argus_premises', error_code: 'PREMISES_REQUIRED', message: 'op=add needs a non-empty `premises` array.', recovery: 'Pass 1-5 premises: {text, kind, external, load_bearing, source}.' });
  }
  for (const p of inputs) {
    if (p.source === 'ai' && !(p.ai_original && p.ai_original.trim())) {
      return toolError({ ok: false, tool: 'argus_premises', error_code: 'PROVENANCE_REQUIRED', message: `source="ai" requires ai_original (the model's original wording): "${p.text.slice(0, 60)}"`, recovery: 'Set ai_original to the exact model-drafted sentence, or source="user" if the user wrote it.' });
    }
  }

  // Dedup against the ledger by stable id — re-adding is idempotent, not an error.
  const known = new Set(existing.map((p) => p.premise_id));
  const fresh = inputs.filter((p) => !known.has(premiseId(id, p.kind, p.text)));
  const skippedDup = inputs.length - fresh.length;

  const activeCount = existing.filter((p) => p.status === 'active').length;
  if (activeCount + fresh.length > MAX_ACTIVE_PREMISES) {
    return toolError({ ok: false, tool: 'argus_premises', error_code: 'PREMISE_CAP', message: `A decision holds at most ${MAX_ACTIVE_PREMISES} active premises (${activeCount} already active).`, recovery: 'Retire one first (op=amend action=retire), or fold minor premises into the load-bearing ones — a decision is 5 premises, not a wiki.' });
  }
  const lbExisting = existing.filter((p) => p.status === 'active' && p.load_bearing).length;
  const lbNew = fresh.filter((p) => p.load_bearing).length;
  if (lbExisting + lbNew > MAX_LOAD_BEARING) {
    return toolError({ ok: false, tool: 'argus_premises', error_code: 'PREMISE_CAP', message: `At most ${MAX_LOAD_BEARING} load-bearing premises (${lbExisting} already marked).`, recovery: 'Load-bearing means the decision flips if it is wrong — if three qualify, the sharpest one is hiding among them.' });
  }

  let nextOrdinal = existing.reduce((m, p) => Math.max(m, p.ordinal), 0) + 1;
  const events: LedgerEventInput[] = fresh.map((p) => ({
    id, event: 'premise_add' as const,
    premise_id: premiseId(id, p.kind, p.text),
    ordinal: nextOrdinal++,
    kind: p.kind, text: p.text,
    external: p.external, load_bearing: p.load_bearing,
    source: p.source,
    ...(p.ai_original ? { ai_original: p.ai_original } : {}),
    ...(p.materiality_rule ? { materiality_rule: p.materiality_rule } : {}),
    ...(typeof p.recheck_cadence_days === 'number' ? { recheck_cadence_days: p.recheck_cadence_days } : {}),
  }));
  if (events.length > 0) await appendLedger(dir, events, now);

  // Full echo — the silent-premise defense: the host always has the material to
  // show the user exactly what was recorded (plan v5 §2).
  const echo = events.map((e) => ({
    ref: `P${e.ordinal}`, premise_id: e.premise_id, kind: e.kind, text: e.text,
    external: e.external, load_bearing: e.load_bearing, source: e.source,
    monitored: e.kind === 'premise' && e.external === true && e.load_bearing === true,
  }));
  const monitoredCount = echo.filter((p) => p.monitored).length;

  return envelope({
    ok: true, tool: 'argus_premises',
    surface:
      events.length === 0
        ? 'All of those premises are already recorded (nothing new written).'
        : `${events.length} premise(s) recorded (${echo[0].ref}${echo.length > 1 ? `–${echo[echo.length - 1].ref}` : ''}). Fix anything wrong with op=amend — your correction is part of the record.${monitoredCount > 0 ? ` ${monitoredCount} will be re-checked against reality once the decision is sealed.` : ''}`,
    next_actions: ['argus_seal', 'argus_recall', 'leave_as_is'],
    data: { id, premises: echo, skipped_duplicates: skippedDup, ledger_events_written: events.map(() => 'premise_add') },
  });
}

// ── op=amend ───────────────────────────────────────────────────────────────

async function opAmend(
  dir: string, id: string, now: string,
  state: Parameters<typeof guardTransition>[0], existing: PremiseState[],
  a: Record<string, unknown>,
) {
  guardTransition(state, 'premise_amend');

  const ref = a['ref'];
  const action = a['action'] as 'accept' | 'refine' | 'replace' | 'retire' | undefined;
  if (typeof ref !== 'string' || !action) {
    return toolError({ ok: false, tool: 'argus_premises', error_code: 'AMEND_NEEDS_REF', message: 'op=amend needs `ref` (e.g. "P1") and `action`.', recovery: 'List premises via argus_recall view="premises", then amend by ordinal.' });
  }
  const premise = resolvePremiseRef(existing, ref);
  if (premise.status !== 'active' && action !== 'accept') {
    return toolError({ ok: false, tool: 'argus_premises', error_code: 'PREMISE_RETIRED', message: `P${premise.ordinal} is ${premise.status} — it stays on the record but is no longer edited.`, recovery: 'Add a fresh premise instead (op=add); the old one keeps its history.' });
  }

  const text = a['text'] as string | undefined;
  if ((action === 'refine' || action === 'replace') && !(text && text.trim())) {
    return toolError({ ok: false, tool: 'argus_premises', error_code: 'AMEND_NEEDS_TEXT', message: `action=${action} needs the corrected text.`, recovery: "Pass `text` with the user's wording, verbatim — never re-summarize it." });
  }

  const loadBearing = a['load_bearing'];
  if (loadBearing === true && !premise.load_bearing) {
    const lbActive = existing.filter((p) => p.status === 'active' && p.load_bearing).length;
    if (lbActive >= MAX_LOAD_BEARING) {
      return toolError({ ok: false, tool: 'argus_premises', error_code: 'PREMISE_CAP', message: `At most ${MAX_LOAD_BEARING} load-bearing premises.`, recovery: 'Unmark another one first (op=amend load_bearing=false).' });
    }
  }

  const ev: LedgerEventInput = {
    id, event: 'premise_amend', premise_id: premise.premise_id, action,
    ...(action === 'refine' || action === 'replace' ? { from: premise.text, to: text } : {}),
    ...(typeof a['note'] === 'string' ? { note: a['note'] as string } : {}),
    ...(typeof a['external'] === 'boolean' ? { external: a['external'] as boolean } : {}),
    ...(typeof loadBearing === 'boolean' ? { load_bearing: loadBearing as boolean } : {}),
    ...(typeof a['recheck_cadence_days'] === 'number' ? { recheck_cadence_days: a['recheck_cadence_days'] as number } : {}),
  };
  await appendLedger(dir, [ev], now);

  const nowExternal = typeof ev.external === 'boolean' ? ev.external : premise.external;
  const nowLb = typeof ev.load_bearing === 'boolean' ? ev.load_bearing : premise.load_bearing;
  const armed = action !== 'retire' && premise.kind === 'premise' && nowExternal && nowLb;

  const surface =
    action === 'retire' ? `P${premise.ordinal} retired — it stays on the record with its history.` :
    action === 'accept' ? `P${premise.ordinal} confirmed as-is.` :
    `P${premise.ordinal} updated in your words.${premise.source === 'ai' ? ' The AI\'s original stays on the record for provenance.' : ''}${armed ? '' : ''}`;

  return envelope({
    ok: true, tool: 'argus_premises',
    surface,
    next_actions: ['argus_recall', 'leave_as_is'],
    data: {
      id, ref: `P${premise.ordinal}`, premise_id: premise.premise_id, action,
      ...(text ? { text } : {}), monitored_after: armed,
    },
  });
}

// ── op=resolve (elicitation-only — no options, no examples, no leans) ──────

async function opResolve(
  dir: string, id: string, now: string,
  state: Parameters<typeof guardTransition>[0], existing: PremiseState[],
  a: Record<string, unknown>,
) {
  guardTransition(state, 'premise_resolve');

  const ref = a['ref'];
  if (typeof ref !== 'string') {
    return toolError({ ok: false, tool: 'argus_premises', error_code: 'RESOLVE_NEEDS_REF', message: 'op=resolve needs `ref`.', recovery: 'List open questions via argus_recall view="premises", then resolve by ordinal.' });
  }
  const premise = resolvePremiseRef(existing, ref);
  if (premise.kind !== 'open_question') {
    return toolError({ ok: false, tool: 'argus_premises', error_code: 'NOT_AN_OPEN_QUESTION', message: `P${premise.ordinal} is a premise, not an open question.`, recovery: 'Premises are re-checked against reality (argus_recheck), not resolved. Only an open_question takes the user\'s closing call.' });
  }
  if (premise.status !== 'active') {
    return toolError({ ok: false, tool: 'argus_premises', error_code: 'PREMISE_RETIRED', message: `P${premise.ordinal} is already ${premise.status}.`, recovery: 'Read it via argus_recall view="premises".' });
  }

  let decision = typeof a['decision'] === 'string' ? (a['decision'] as string).trim() : '';
  if (!decision) {
    // MCP-native elicitation: ask the USER directly. The question replays their
    // own open question verbatim and takes free text — no options, no leans.
    const got = await elicit(
      `Your open question on this decision: "${premise.text}". What is your call now, in your own words? (You can also leave it open.)`,
      { type: 'object', properties: { decision: { type: 'string', maxLength: 400, description: 'Your call, your words.' } }, required: ['decision'] },
    );
    decision = typeof got?.['decision'] === 'string' ? (got['decision'] as string).trim() : '';
  }
  if (!decision) {
    return toolError({ ok: false, tool: 'argus_premises', error_code: 'RESOLVE_NEEDS_DECISION', message: 'An open question closes only in the user\'s own words.', recovery: 'Ask the user for their call and pass it as `decision` — never draft it for them. "Still undecided" is a valid answer: then leave it open (no call needed).' });
  }

  await appendLedger(dir, [{ id, event: 'premise_resolve', premise_id: premise.premise_id, decision }], now);

  return envelope({
    ok: true, tool: 'argus_premises',
    surface: `Open question P${premise.ordinal} closed in your words: "${decision}".`,
    next_actions: ['argus_recall', 'leave_as_is'],
    data: { id, ref: `P${premise.ordinal}`, premise_id: premise.premise_id, decision, decision_owner: 'user' },
  });
}
