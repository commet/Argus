import { z } from 'zod';
import { isQuestionShaped } from '../lib/premise-shape.js';
import { statesAClaim } from '../lib/premise-claim.js';
import { resolveToolArgusDir } from '../lib/argus-dir.js';
import { replayLedger } from '../lib/ledger-replay.js';
import { resolveToday, logicalNow } from '../lib/resolve-today.js';
import { resolveContract } from '../lib/resolve-contract.js';
import { refuseIfLedgerUnreadable } from '../lib/ledger-readable.js';
import { guardTransition } from '../lib/state-machine.js';
import { appendLedger, withLedgerLock, type LedgerEventInput } from '../lib/ledger-append.js';
import {
  premiseId, resolvePremiseRef, isMonitored, normalizePremiseText,
  MAX_ACTIVE_PREMISES, MAX_LOAD_BEARING,
  type PremiseState,
} from '../lib/premises.js';
import { elicitDetailed, canElicit } from '../lib/elicit.js';
import { noAnswerResult } from '../lib/picker-fallback.js';
import { sanitizeLine } from '../v2/sanitize.js';
import { resolveResponseLocale } from '../lib/surfaces.js';
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
  text: z.string().min(3).max(400).optional().describe('One literal, factual sentence. No metaphor. Good: "base rate stays at 3.5% through 2026". Bad: "the ground this rests on". Optional ONLY when from_capture is given (the capture\'s verbatim text is used).'),
  from_capture: z.string().max(64).optional().describe('Promote a watch capture (§9.3): its wc- id (or unique prefix). The capture\'s VERBATIM text/provenance carry over; the capture itself stays on the watch log — promotion is a reference, never a move. Promotion is the user\'s verb: pass this only when they chose to promote.'),
  kind: z.enum(['premise', 'open_question']).default('premise').describe('premise = a fact/belief the decision rests on. open_question = something the user explicitly left undecided.'),
  external: z.boolean().default(false).describe('Can reality verify this later (a rate, a date, supply, a third party)? external + load_bearing arms re-checking.'),
  load_bearing: z.boolean().default(false).describe(`Would the decision flip if this is wrong? Mark sparingly — max ${MAX_LOAD_BEARING} per decision.`),
  monitoring_enabled: z.boolean().default(true).describe('Whether Argus should currently re-check/nudge this premise. This does not change whether the premise is important or externally verifiable.'),
  source: z.enum(['ai_surfaced', 'user_stated', 'ai', 'user']).optional().describe('Provenance. Never forge: "user_stated" = the user\'s own words; "ai_surfaced" = model-drafted (requires ai_original). Legacy aliases "user"/"ai" are accepted and normalized. Optional ONLY when from_capture is given (the capture\'s provenance carries over) — otherwise required.'),
  ai_original: z.string().max(400).optional().describe('REQUIRED when source="ai_surfaced": the model\'s original wording, preserved verbatim across later edits.'),
  anchor_quote: z.string().max(400).optional().describe('The user’s own words this rests on, verbatim. Stored with the premise now, and checked: a sentence that only repeats its own quote is recorded as context rather than as something to re-check later.'),
  chat_confirmed: z.boolean().default(false).describe('TRUE only when the user has ALREADY approved this exact ai_surfaced draft in the conversation (their explicit yes, or a host picker they answered). Skips the one-tap confirm window; provenance stays ai_surfaced. Never set it for a draft the user has not seen — that forges the approval this field asserts.'),
  materiality_rule: zMaterialityRule.optional().describe('Optional: how re-checks decide "did this materially change?". Absent → an under-fire default heuristic (silence when unsure). Define it to be precise (e.g. threshold "drops below 4.0", step "any one-notch credit downgrade").'),
  recheck_cadence_days: z.number().int().min(1).max(365).optional().describe('Optional: how many days between reality re-checks for this fact (M1). Absent → a default derived from the rule type (a moving number is checked more often than slow-moving state). The user pins this; it only moves the DUE nudge, never blocks a recheck.'),
  reponder_cadence_days: z.number().int().min(1).max(365).optional().describe('Optional (kind="open_question" only): how many days between reconsider nudges — a "come back and see if you can answer this yet" timer (M3). Absent → a sensible default. Leaving the question open stays a valid answer; this only moves the nudge, never forces a resolution.'),
  reconsider_cadence_days: z.number().int().min(1).max(365).optional().describe('Alias of reponder_cadence_days (the historical field name) — either spelling is accepted.'),
});

const inputSchema = z.strictObject({
  argus_dir: zArgusDir,
  id: zId.describe('The decision id — the same id you passed to argus_open_decision or argus_seal.'),
  op: z.enum(['add', 'amend', 'resolve', 'still_open']).describe('add = record premises; amend = correct one (user edit = signal); resolve = close an open question in the user\'s words; still_open = the user chose to leave an open question unresolved for now (defers the reconsider nudge, no verdict).'),
  premises: z.array(zPremiseInput).min(1).max(MAX_ACTIVE_PREMISES).optional().describe('op=add only.'),
  ref: z.string().max(64).optional().describe('op=amend/resolve: which premise — an ordinal ("P1"), the premise_id, or an unambiguous id prefix. Ordinals are permanent (a retired P2 stays P2).'),
  action: z.enum(['accept', 'refine', 'replace', 'retire']).optional().describe('op=amend only. accept = confirm as-is; refine/replace = correct the text; retire = remove from active tracking (stays on the record).'),
  text: z.string().min(3).max(400).optional().describe('op=amend refine/replace: the corrected text — the USER\'s wording, verbatim, never re-summarized.'),
  note: z.string().max(300).optional().describe('op=amend: optional why (never required).'),
  external: z.boolean().optional().describe('op=amend: correct the external flag (true lets re-checking arm for a load-bearing premise).'),
  load_bearing: z.boolean().optional().describe('op=amend: correct the load-bearing flag.'),
  monitoring_enabled: z.boolean().optional().describe('op=amend: turn re-check reminders on/off without changing importance or verifiability.'),
  recheck_cadence_days: z.number().int().min(1).max(365).optional().describe('op=amend: re-set how often (days) this fact is re-checked (M1). Widens or narrows the DUE nudge; never blocks an explicit recheck.'),
  reponder_cadence_days: z.number().int().min(1).max(365).optional().describe('op=amend/still_open: re-set how often (days) this open question is nudged for reconsideration (M3). Only moves the nudge — never forces a resolution.'),
  reconsider_cadence_days: z.number().int().min(1).max(365).optional().describe('Alias of reponder_cadence_days (the historical field name) — either spelling is accepted.'),
  decision: z.string().min(1).max(400).optional().describe('op=resolve: the user\'s own closing call. MUST be the user\'s words — never an Argus-drafted line.'),
  today_override: zDate.optional(),
});

function normalizePremiseSource(source: unknown): 'ai_surfaced' | 'user_stated' {
  return source === 'user' || source === 'user_stated' ? 'user_stated' : 'ai_surfaced';
}

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
      // Logical-date stamp so a premise added "today" is not dated yesterday by
      // raw UTC — else it can become the oldest event and skew "record since".
      const now = logicalNow(today, !!a['today_override']);

      // Alias normalization (§9.4 경계 수리): `reponder_cadence_days` is the
      // historical (misspelled) field a model reasoning from the description
      // will naturally write as `reconsider_cadence_days`. Accept both, store one.
      if (typeof a['reconsider_cadence_days'] === 'number' && typeof a['reponder_cadence_days'] !== 'number') {
        a = { ...a, reponder_cadence_days: a['reconsider_cadence_days'] };
      }
      if (Array.isArray(a['premises'])) {
        a = {
          ...a,
          premises: (a['premises'] as Array<Record<string, unknown>>).map((p) =>
            typeof p['reconsider_cadence_days'] === 'number' && typeof p['reponder_cadence_days'] !== 'number'
              ? { ...p, reponder_cadence_days: p['reconsider_cadence_days'] }
              : p,
          ),
        };
      }

      // from_capture 승격 (§9.3): resolve the watch capture and carry its
      // VERBATIM text + provenance over. The capture stays on the watch log —
      // this is a reference, never a move; and it is user-initiated by contract.
      if (op === 'add' && Array.isArray(a['premises']) && (a['premises'] as Array<Record<string, unknown>>).some((p) => typeof p['from_capture'] === 'string')) {
        const captures = replayLedger(dir, today).watch.captures;
        const resolved: Array<Record<string, unknown>> = [];
        for (const p of a['premises'] as Array<Record<string, unknown>>) {
          const ref = typeof p['from_capture'] === 'string' ? p['from_capture'].trim() : '';
          if (!ref) { resolved.push(p); continue; }
          const hits = captures.filter((c) => c.id === ref || (c.id && c.id.startsWith(ref)) || c.text === ref);
          if (hits.length === 0) {
            return toolError({ ok: false, tool: 'argus_premises', error_code: 'CAPTURE_NOT_FOUND', message: `No internal capture matches "${ref}".`, recovery: 'Pass the premise sentence directly in `text`.' });
          }
          if (hits.length > 1) {
            return toolError({ ok: false, tool: 'argus_premises', error_code: 'AMBIGUOUS_REF', message: `"${ref}" matches ${hits.length} internal captures.`, recovery: 'Pass the premise sentence directly in `text`.' });
          }
          const c = hits[0];
          resolved.push({
            ...p,
            from_capture: c.id ?? ref, // normalize to the full id for the lineage record
            // capture text wins unless the user re-typed it themselves
            text: typeof p['text'] === 'string' && p['text'] ? p['text'] : c.text,
            // a captured QUESTION promotes to an open_question unless the user
            // explicitly said otherwise (zod defaults kind to 'premise', so the
            // default must not shadow the capture's own kind)
            kind: p['kind'] === 'open_question' || c.kind !== 'question' ? (p['kind'] ?? 'premise') : 'open_question',
            source: p['source'] ?? c.source,
            ...(c.source === 'ai_surfaced' && !p['ai_original'] ? { ai_original: c.ai_original ?? c.text } : {}),
          });
        }
        a = { ...a, premises: resolved };
      }
      // text/source are schema-optional (to allow from_capture) — but by now
      // every premise must have both. PRESENCE only: length/format policing
      // stays with zod at dispatch (the pre-M2 handler contract), so the state
      // guard (ILLEGAL_TRANSITION etc.) keeps firing in its historical order.
      if (op === 'add' && Array.isArray(a['premises'])) {
        for (const p of a['premises'] as Array<Record<string, unknown>>) {
          if (!(typeof p['text'] === 'string' && p['text'].trim().length > 0)) {
            return toolError({ ok: false, tool: 'argus_premises', error_code: 'INVALID_INPUT', message: 'Each premise needs `text` (or a resolvable internal capture).', recovery: 'Pass the premise sentence directly in `text`.' });
          }
          if (typeof p['source'] !== 'string') {
            return toolError({ ok: false, tool: 'argus_premises', error_code: 'PROVENANCE_REQUIRED', message: `Each premise needs \`source\` (user_stated | ai_surfaced): "${String(p['text']).slice(0, 60)}"`, recovery: 'Say who said it — never forge provenance. (from_capture carries the capture\'s provenance automatically.)' });
          }
        }
      }

      const current = resolveContract(dir, id, today);
      const blind = refuseIfLedgerUnreadable('argus_premises', current);
      if (blind) return blind;
      const existing: PremiseState[] = current.entry?.premises ?? [];

      if (op === 'add') return await opAdd(dir, id, today, now, current.state, existing, a);
      if (op === 'amend') return await opAmend(dir, id, now, current.state, existing, a);
      if (op === 'still_open') return await opStillOpen(dir, id, today, now, current.state, existing, a);
      return await opResolve(dir, id, now, current.state, existing, a);
    } catch (e) {
      return handleToolException('argus_premises', e);
    }
  },
};

// ── op=add ─────────────────────────────────────────────────────────────────

async function opAdd(
  dir: string, id: string, today: string, now: string,
  state: Parameters<typeof guardTransition>[0], existing: PremiseState[],
  a: Record<string, unknown>,
) {
  guardTransition(state, 'premise_add');

  // text is guaranteed non-empty by the handler's post-resolution guard.
  const inputs = (a['premises'] as Array<z.infer<typeof zPremiseInput>> | undefined)
    ?.map((p) => ({
      ...p,
      text: p.text ?? '',
      // 2026-07-29: kind 는 모델이 채우는 값이고 zod 기본값이 'premise' 다. 모델이
      // 생략하면 물음도 전제가 된다 — 그러면 확인일에 "이 전제가 맞았나요?"라고
      // 물었을 때 "이 일정이 가능한가요?"가 나오고, 물음에는 참/거짓이 없다.
      // 모델의 라벨은 힌트고 문장의 모양이 사실이다. 물음이면 제자리로 옮긴다
      // (버리지 않는다 — open_question 은 처음부터 있던 자리다).
      kind: isQuestionShaped(p.text ?? '') ? ('open_question' as const) : p.kind,
    }));
  if (!inputs || inputs.length === 0) {
    return toolError({ ok: false, tool: 'argus_premises', error_code: 'PREMISES_REQUIRED', message: 'op=add needs a non-empty `premises` array.', recovery: 'Pass 1-5 premises: {text, kind, external, load_bearing, source}.' });
  }
  for (const p of inputs) {
    if (normalizePremiseSource(p.source) === 'ai_surfaced' && !(p.ai_original && p.ai_original.trim())) {
      return toolError({ ok: false, tool: 'argus_premises', error_code: 'PROVENANCE_REQUIRED', message: `source="ai_surfaced" requires ai_original (the model's original wording): "${p.text.slice(0, 60)}"`, recovery: 'Set ai_original to the exact model-drafted sentence, or source="user_stated" if the user wrote it.' });
    }
  }

  // One-tap confirm for a DRAFTED premise — seal's picker, mirrored (the ask
  // must be a structural picker, not prose the model may skip). Fires only in
  // the sense's canonical case: exactly ONE ai_surfaced draft in the call
  // (multi-premise structured flows confirm in their own conversation). Keep
  // records it with provenance ai_surfaced UNCHANGED — a tap approves the
  // recording, it does not transfer authorship (predictions differ: a bet must
  // become the user's; a premise is a mirror observation whose honest tag IS
  // the invariant). Reword typed in the form → the user's words, user_stated,
  // with the draft preserved as ai_original. Skip / declined / no elicitation
  // → the friction escape stays: nothing forced, no dead end.
  // Set when the confirm window closed with no answer while the SAME call also
  // carried the user's own premises: those record, and the surface has to admit
  // the draft went unanswered instead of silently shrinking the list.
  let noAnswerDraft = '';
  {
    const aiDrafts = inputs.filter((p) => normalizePremiseSource(p.source) === 'ai_surfaced');
    // chat_confirmed = the retry contract's missing half (2026-07-30, measured).
    // Both retry hints below say "once the user confirms in chat, call again" —
    // but the retry re-fired this very window, and on a host whose machinery
    // answers every elicitation instantly (headless Claude Code returns cancel
    // in ~0ms; a person cannot read the draft that fast) the draft could NEVER
    // be recorded. Worse: that dead end rewards relabeling the draft
    // user_stated to get past the picker — the exact provenance lie this
    // surface exists to prevent. The flag lets the caller assert the approval
    // already happened in conversation; provenance stays ai_surfaced.
    if (aiDrafts.length === 1 && aiDrafts[0].chat_confirmed !== true && canElicit()) {
      const draft = aiDrafts[0];
      const dLocale = resolveResponseLocale(dir, draft.text);
      // Native Accept/Decline (2026-07-24), mirroring seal: Accept → keep
      // (provenance ai_surfaced intact), Decline → skip.
      //
      // NO FIELD (2026-07-28). The comment here used to claim "one keystroke to
      // keep", and it was wrong in the way that mattered: Claude Code does not
      // preselect Accept when an ask declares any property, and Return inside a
      // text box moves to the next row rather than submitting. So the optional
      // reword box turned a yes into a two-Return gesture nobody was told about,
      // and pressing Return once sent nothing at all. Same defect as the seal
      // ask; same fix. Rewording stays available — the user says it in chat and
      // the model calls again with their words as `user_stated`.
      // Clip for DISPLAY only — the record keeps the whole sentence.
      const shownDraft = sanitizeLine(draft.text, 96);
      const asked = await elicitDetailed(
        dLocale === 'ko'
          ? `이 결정이 딛고 선 전제로 기록할까요?\n"${shownDraft}"\n\n그대로 남기려면 Accept, 남기지 않으려면 Decline입니다. 문장을 고치고 싶으면 Decline 후 말씀해 주세요.`
          : `Record this as a premise the decision rests on?\n"${shownDraft}"\n\nAccept to keep it, Decline to skip. To reword it, Decline and say so.`,
        { type: 'object', properties: {} },
      );
      // A window that never answered is not a decline (audit 2026-07-27). The
      // draft is dropped either way — we will not record a premise the user
      // never approved — but the SURFACE must not say "not recorded" as though
      // they refused, and the sentence must be handed back so one word in chat
      // finishes it. When the same call also carries the user's OWN premises,
      // those still record; only the unapproved draft falls away.
      if (asked.kind === 'no_answer') {
        inputs.splice(inputs.indexOf(draft), 1);
        if (inputs.length === 0) {
          return noAnswerResult({
            tool: 'argus_premises', ko: dLocale === 'ko',
            handBack: {
              ko: `"그거 맞아" 한마디면 이 전제를 그대로 남깁니다: "${draft.text}".`,
              en: `Say "yes, that one" and I'll record this premise as is: "${draft.text}".`,
            },
            next_actions: ['argus_capture', 'stop'],
            data: { id, premise_draft: draft.text, retry_hint: 'once the user confirms in chat, call argus_capture again with this premise, source:"ai_surfaced" + ai_original, and chat_confirmed:true (without it this window fires again)' },
          });
        }
        noAnswerDraft = draft.text;
      } else if (asked.kind === 'declined') {
        // A real decline → drop ONLY the draft; the user's own premises in the
        // same call still record below.
        inputs.splice(inputs.indexOf(draft), 1);
        if (inputs.length === 0) {
          // Same rule as seal.ts: stay silent, do not re-ask — but do not throw
          // the draft away. When a host policy answers `decline` without drawing
          // anything, this was the surface that made the user's own sentence
          // unrecoverable. Carrying it costs no inference about who answered.
          return envelope({
            ok: true, tool: 'argus_premises',
            surface: dLocale === 'ko' ? '기록하지 않았습니다.' : 'Not recorded.',
            next_actions: ['stop'],
            data: {
              recorded: false, choice: 'declined', id, premise_draft: draft.text,
              retry_hint: 'the draft is preserved here; if the user asks for it again, call argus_capture with this premise, source:"ai_surfaced" + ai_original, and chat_confirmed:true',
            },
          });
        }
      } else {
        // accepted, or `unsupported` (elicitor unwired between the capability
        // probe and the ask) — both keep the draft with its ai_surfaced tag.
        const picked = asked.kind === 'accepted' ? asked.content : {};
        const wording = typeof picked['reword'] === 'string' ? (picked['reword'] as string).trim() : '';
        if (wording) {
          if (wording.length < 4 || wording.length > 400) {
            // Hand their sentence back (audit 2026-07-27). Asking a user to
            // retype a 500-character premise from memory is how a correction
            // gets abandoned; the words are in our hands right here.
            return envelope({
              ok: true, tool: 'argus_premises',
              surface: dLocale === 'ko' ? '그럼 그 전제를 원하는 문장으로 알려주세요 (4~400자). 그 말 그대로 기록하겠습니다.' : 'Then tell me the premise in your own words (4–400 chars) and I will record exactly that.',
              next_actions: ['argus_capture'],
              data: { recorded: false, choice: 'reword', user_input: { reword: wording }, retry_hint: 'data.user_input.reword is what the user typed; offer it back trimmed to 4-400 chars rather than asking them to write it again' },
            });
          }
          draft.ai_original = draft.ai_original ?? draft.text;
          draft.text = wording;
          draft.source = 'user_stated';
        }
        // Accept blank → keep as drafted, provenance ai_surfaced intact.
      }
    }
  }

  // Dedup against the ledger by stable id. Three cases, kept distinct so a
  // re-add is never silently swallowed behind a misleading "already recorded":
  //  - collides with an ACTIVE premise (same text)     → true idempotent dup (skip)
  //  - collides with a RETIRED/RESOLVED one (same text) → NOT "already recorded";
  //    it stays on the record, and the surface says so with the recovery path
  //  - the id collides but the TEXT differs (rare djb2 clash) → never drop it
  //    silently; fail loudly so the fact isn't lost to a hash accident
  const byId = new Map(existing.map((p) => [p.premise_id, p] as const));
  const fresh: typeof inputs = [];
  const dupRetired: string[] = [];
  const collisions: string[] = [];
  for (const p of inputs) {
    const hit = byId.get(premiseId(id, p.kind, p.text));
    if (!hit) { fresh.push(p); continue; }
    if (normalizePremiseText(hit.text) !== normalizePremiseText(p.text)) {
      collisions.push(p.text); // same stable id, different fact — hash collision
      continue;
    }
    if (hit.status !== 'active') dupRetired.push(`P${hit.ordinal}`);
    // else: active same-text dup → idempotent skip (counted below)
  }
  if (collisions.length > 0) {
    return toolError({
      ok: false, tool: 'argus_premises', error_code: 'PREMISE_ID_COLLISION',
      message: `A different premise already holds the same stable id (rare hash collision): "${collisions[0].slice(0, 60)}".`,
      recovery: 'Reword this premise slightly so it gets its own id, then add it again.',
    });
  }
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

  // The claim band, shared byte-for-byte with the webapp (premise-claim.ts).
  // An agent in a terminal makes exactly the move a model in a browser makes:
  // it hands the user's own sentence back with the word "premise" on it. The
  // host asked for anchor_quote and never checked it against the text, so a
  // pure restatement was stored as something to re-check for months.
  //
  // It is NOT refused. The sentence is real and the user said it; it is just
  // not an assumption, so it does not get marked load-bearing and does not join
  // the re-check queue. The downgrade is visible in the echo and named in
  // next_actions, following the same idiom as the user_stated → ai_surfaced
  // downgrade one layer up: never reject the material, never mislabel it.
  const restated = new Set<string>();
  const scored = fresh.map((p) => {
    const quote = typeof p.anchor_quote === 'string' ? p.anchor_quote : '';
    if (!quote || p.kind !== 'premise' || statesAClaim(p.text, quote)) return p;
    restated.add(p.text);
    return { ...p, load_bearing: false, monitoring_enabled: false };
  });

  let nextOrdinal = existing.reduce((m, p) => Math.max(m, p.ordinal), 0) + 1;
  const events: LedgerEventInput[] = scored.map((p) => ({
    id, event: 'premise_add' as const,
    premise_id: premiseId(id, p.kind, p.text),
    ordinal: nextOrdinal++,
    kind: p.kind, text: p.text,
    external: p.external, load_bearing: p.load_bearing,
    ...(typeof p.anchor_quote === 'string' && p.anchor_quote ? { anchor_quote: p.anchor_quote } : {}),
    monitoring_enabled: p.monitoring_enabled,
    source: normalizePremiseSource(p.source),
    ...(p.ai_original ? { ai_original: p.ai_original } : {}),
    // 승격 계보 (§9.3): which watch capture this premise came from — a
    // reference on the record; the capture itself stays on the watch log.
    ...(typeof p.from_capture === 'string' && p.from_capture ? { capture_id: p.from_capture } : {}),
    ...(p.materiality_rule ? { materiality_rule: p.materiality_rule } : {}),
    ...(typeof p.recheck_cadence_days === 'number' ? { recheck_cadence_days: p.recheck_cadence_days } : {}),
    ...(typeof p.reponder_cadence_days === 'number' && p.kind === 'open_question' ? { reponder_cadence_days: p.reponder_cadence_days } : {}),
    // Anchor the ADD date at the logical `today` (deterministic) for every
    // premise, not just open_questions: added_ts is now what the first-recheck
    // cadence runs from (founder decision 2026-07-10), and the open_question
    // reconsider clock too. Without it, added_ts fell back to the real write
    // time, which diverged from today_override in sims and would misdate a
    // premise added under a today_override in real use.
    anchor_date: today,
  }));
  if (events.length > 0) {
    // §9.4 두 기기 안전: the ordinal base was read OUTSIDE any lock, so two
    // concurrent sessions adding premises to the same decision both saw max=4
    // and both assigned ordinal 5 — a DUPLICATE P5 whose second premise is
    // unreferenceable (resolvePremiseRef returns only the first). Re-derive the
    // ordinals under the ledger lock from a fresh fold, then append — the same
    // read-check-append-under-lock discipline seal/settle use.
    await withLedgerLock(dir, async () => {
      const freshPremises = replayLedger(dir, today).contracts.get(id)?.premises ?? [];
      let ord = freshPremises.reduce((m, p) => Math.max(m, p.ordinal), 0) + 1;
      for (const e of events) e.ordinal = ord++;
      await appendLedger(dir, events, now);
    });
  }

  // Full echo — the silent-premise defense: the host always has the material to
  // show the user exactly what was recorded (plan v5 §2).
  const echo = events.map((e) => ({
    ref: `P${e.ordinal}`, premise_id: e.premise_id, kind: e.kind, text: e.text,
    external: e.external, load_bearing: e.load_bearing, source: e.source,
    ...(e['ai_original'] ? { ai_original: e['ai_original'] } : {}),
    ...(e['anchor_quote'] ? { anchor_quote: e['anchor_quote'] } : {}),
    // Named on the item it happened to, so a host rendering the echo shows the
    // downgrade beside the sentence rather than as a footnote about "one of
    // these". `data` is what the model reads; `surface` is the human's line and
    // a person does not need to hear about the taxonomy.
    ...(e.text && restated.has(e.text) ? { recorded_as: 'context' as const } : {}),
    monitored: e.kind === 'premise' && e.external === true && e.load_bearing === true && e.monitoring_enabled !== false,
  }));
  const monitoredCount = echo.filter((p) => p.monitored).length;

  // Voice follows the call's own user-authored text (M4) — the premises being
  // written are the representative sample. Config-pinned locale still wins.
  const ko = resolveResponseLocale(dir, inputs[0]?.text) === 'ko';
  // The monitored note must match the actual state: on an already-sealed
  // decision "once the decision is sealed" was a false conditional (loop find).
  const sealedNow = state === 'sealed';
  const refRange = events.length > 0 ? `${echo[0].ref}${echo.length > 1 ? `–${echo[echo.length - 1].ref}` : ''}` : '';
  // Its own line, not appended to the confirmation. Together they ran to 133
  // characters in English — the confirmation of what was written, plus a second
  // fact about future re-checks, arriving as one wall. Korean stayed under the
  // limit only because Korean is denser, which is not a reason for the English
  // reader to get a worse line.
  const monitoredNote = monitoredCount === 0 ? '' : ko
    ? (sealedNow ? `\n그중 ${monitoredCount}건은 나중에 실제와 다시 대조해 확인합니다 (예측 저장됨).` : `\n예측을 저장하면 그중 ${monitoredCount}건을 나중에 실제와 다시 대조해 확인합니다.`)
    : (sealedNow ? `\n${monitoredCount} will be re-checked against what actually happens (prediction saved).` : `\nAfter saving a prediction, ${monitoredCount} will be re-checked against what actually happens.`);
  const oneLine = (s: string): string => {
    const t = s.replace(/\s+/g, ' ').trim();
    return t.length > 70 ? t.slice(0, 69) + '…' : t;
  };
  const surface =
    events.length === 0
      ? (dupRetired.length > 0
          ? (ko
              ? `새로 적은 것은 없습니다. ${dupRetired.join(', ')}은 예전에 은퇴시킨 전제와 같습니다. 기록에는 남아 있지만 지금은 활성이 아닙니다. 다시 추적하려면 표현을 조금 바꿔 새 항목으로 추가하세요.`
              : `Nothing new written. ${dupRetired.join(', ')} match${dupRetired.length === 1 ? 'es' : ''} a premise you retired earlier. It stays on the record but is no longer active. To track this fact again, add it with slightly different wording so it gets its own entry.`)
          : (ko
              ? '그 전제들은 이미 기록되어 활성 상태입니다 (새로 적은 것 없음).'
              : 'All of those premises are already recorded and active (nothing new written).'))
      // A single premise echoes its own words back — "전제 1건 (P1)" read as a
      // cold filing label to a non-dev (experience loop, sujin). Several keep the
      // count + ref range (echoing five sentences would bury the confirmation).
      : (events.length === 1
          ? (ko
              ? `방금 적어 두었습니다: '${oneLine(echo[0]?.text ?? '')}'. 잘못 적혔으면 그대로 말씀해 주세요. 바로잡은 내용도 기록에 남습니다.${monitoredNote}`
              // The Korean here says "tell me and I'll fix it, and the correction
              // stays on the record too". The English told the PERSON to call
              // `argus_capture` — a tool name they cannot type — and dropped the
              // reassurance entirely. `surface` is the line a human reads; the
              // tool names belong in next_actions, which the model reads.
              : `Noted: "${oneLine(echo[0]?.text ?? '')}". Say if it's wrong — your correction is recorded too.${monitoredNote}`)
          : (ko
              ? `전제 ${events.length}건을 기록했습니다 (${refRange}). 틀린 것이 있으면 말해 주세요. 바로잡은 내용도 기록에 남습니다.${monitoredNote}`
              : `${events.length} premises recorded (${refRange}). Say if it's wrong — your correction is recorded too.${monitoredNote}`));

  const noAnswerNote = noAnswerDraft
    ? (ko
        ? ` 확인 창이 답을 받지 못해 이 한 줄은 빼두었습니다: "${oneLine(noAnswerDraft)}". 맞으면 말씀해 주세요.`
        : ` The confirm window gave no answer, so this one was left out: "${oneLine(noAnswerDraft)}". Say the word if it belongs.`)
    : '';

  return envelope({
    ok: true, tool: 'argus_premises',
    surface: surface + noAnswerNote,
    next_actions: ['argus_predict', 'argus_patterns', 'leave_as_is'],
    data: {
      id,
      premises: echo,
      ...(restated.size > 0 ? {
        context_note: 'One or more premises only repeat the quote they rest on, so they are '
          + 'recorded as context: kept on the record, not marked load-bearing, not queued for '
          + 're-checking. If one really is load-bearing, add it again saying what that fact '
          + 'makes possible or impossible in THIS decision. If you cannot say that honestly, '
          + 'leaving it as context is the right outcome.',
      } : {}),
      skipped_duplicates: skippedDup, ...(dupRetired.length ? { skipped_retired: dupRetired } : {}), ...(noAnswerDraft ? { unanswered_draft: noAnswerDraft } : {}), ledger_events_written: events.map(() => 'premise_add') },
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
    return toolError({ ok: false, tool: 'argus_premises', error_code: 'AMEND_NEEDS_REF', message: 'op=amend needs `ref` (e.g. "P1") and `action`.', recovery: 'List premises via argus_patterns view="decision_context", then amend by ordinal.' });
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
    ...(typeof a['monitoring_enabled'] === 'boolean' ? { monitoring_enabled: a['monitoring_enabled'] as boolean } : {}),
    ...(typeof a['recheck_cadence_days'] === 'number' ? { recheck_cadence_days: a['recheck_cadence_days'] as number } : {}),
    ...(typeof a['reponder_cadence_days'] === 'number' && premise.kind === 'open_question' ? { reponder_cadence_days: a['reponder_cadence_days'] as number } : {}),
  };
  await appendLedger(dir, [ev], now);

  const nowExternal = typeof ev.external === 'boolean' ? ev.external : premise.external;
  const nowLb = typeof ev.load_bearing === 'boolean' ? ev.load_bearing : premise.load_bearing;
  const nowMonitoring = typeof ev.monitoring_enabled === 'boolean' ? ev.monitoring_enabled : premise.monitoring_enabled;
  const armed = action !== 'retire' && premise.kind === 'premise' && nowExternal && nowLb && nowMonitoring !== false;

  // Voice follows the user's correction when there is one, else the premise
  // being amended (their earlier words). Config-pinned locale still wins.
  const ko = resolveResponseLocale(dir, (typeof text === 'string' && text) || premise.text) === 'ko';
  const surface = ko
    ? (action === 'retire' ? `P${premise.ordinal}을 은퇴시켰습니다. 이력과 함께 기록에 남습니다.` :
       action === 'accept' ? `P${premise.ordinal}을 그대로 확정했습니다.` :
       `P${premise.ordinal}을 당신의 말로 고쳤습니다.${premise.source === 'ai_surfaced' ? ' AI가 처음 쓴 문장은 출처 표시를 위해 기록에 남습니다.' : ''}`)
    : (action === 'retire' ? `P${premise.ordinal} retired. It stays on the record with its history.` :
       action === 'accept' ? `P${premise.ordinal} confirmed as-is.` :
       `P${premise.ordinal} updated in your words.${premise.source === 'ai_surfaced' ? ' The AI\'s original stays on the record for provenance.' : ''}${armed ? '' : ''}`);

  return envelope({
    ok: true, tool: 'argus_premises',
    surface,
    next_actions: ['argus_patterns', 'leave_as_is'],
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
    return toolError({ ok: false, tool: 'argus_premises', error_code: 'RESOLVE_NEEDS_REF', message: 'op=resolve needs `ref`.', recovery: 'List open questions via argus_patterns view="decision_context", then resolve by ordinal.' });
  }
  const premise = resolvePremiseRef(existing, ref);
  if (premise.kind !== 'open_question') {
    return toolError({ ok: false, tool: 'argus_premises', error_code: 'NOT_AN_OPEN_QUESTION', message: `P${premise.ordinal} is a premise, not an open question.`, recovery: 'Re-check premises with argus_capture action="update_fact". Only an open question takes the user\'s closing call.' });
  }
  if (premise.status !== 'active') {
    return toolError({ ok: false, tool: 'argus_premises', error_code: 'PREMISE_RETIRED', message: `P${premise.ordinal} is already ${premise.status}.`, recovery: 'Read it via argus_patterns view="decision_context".' });
  }

  let decision = typeof a['decision'] === 'string' ? (a['decision'] as string).trim() : '';
  if (!decision) {
    // MCP-native elicitation: ask the USER directly. The question replays their
    // own open question verbatim and takes free text — no options, no leans.
    // Localize like the rest of the tool — a Korean user closing their own
    // Korean question used to get an English form. Voice follows the question.
    const qLocale = resolveResponseLocale(dir, premise.text);
    const got = await elicitDetailed(
      qLocale === 'ko'
        ? `이 결정에 남겨둔 질문입니다: "${sanitizeLine(premise.text, 96)}". 지금은 어떻게 판단하시나요? 아래 칸에 당신의 말로 적은 뒤 Accept까지 진행하세요. (그대로 열어두려면 Decline.)`
        : `Your open question on this decision: "${sanitizeLine(premise.text, 96)}". What is your call now, in your own words? Type it below, then continue to Accept. (Decline to leave it open.)`,
      // 필수 필드 없음 — 빈 채 Accept는 아래 `if (!decision)`가 정직하게
      // 되묻는다. "아직 못 정했다"도 유효한 답이므로 폼이 막아선 안 된다.
      { type: 'object', properties: { decision: { type: 'string', title: qLocale === 'ko' ? '지금의 판단' : 'Your call now', description: qLocale === 'ko' ? '당신의 판단, 당신의 표현. (아직이면 비워두고 Accept)' : 'Your call, your words. (Leave blank and Accept if still undecided.)' } } },
    );
    // This is the one ask where a broken window is most expensive: the user may
    // have typed a full paragraph of their own reasoning and we cannot get it
    // back. Say so plainly instead of reporting RESOLVE_NEEDS_DECISION, which
    // reads as "the user gave no call" about someone who did (audit 2026-07-27).
    if (got.kind === 'no_answer') {
      return noAnswerResult({
        tool: 'argus_premises', ko: qLocale === 'ko',
        handBack: {
          ko: `판단을 한 줄로 말씀해주시면 그 말 그대로 닫습니다: "${premise.text}". 아직이면 그대로 열어두면 됩니다.`,
          en: `Say your call in one line and I'll close it in exactly those words: "${premise.text}". If you're not there yet, leaving it open is fine.`,
        },
        next_actions: ['argus_patterns', 'leave_as_is'],
        data: { id, ref: `P${premise.ordinal}`, premise_id: premise.premise_id, question: premise.text, retry_hint: 'ask the user for their call in chat, then call argus_premises op="resolve" with `decision` set to their words' },
      });
    }
    const content = got.kind === 'accepted' ? got.content : null;
    decision = typeof content?.['decision'] === 'string' ? (content['decision'] as string).trim() : '';
  }
  if (!decision) {
    return toolError({
      ok: false, tool: 'argus_premises', error_code: 'RESOLVE_NEEDS_DECISION',
      message: 'An open question closes only in the user\'s own words.',
      recovery: 'Ask the user for their call and pass it as `decision` — never draft it for them. "Still undecided" is a valid answer: then leave it open (no call needed).',
      data: { id, ref: `P${premise.ordinal}`, question: premise.text },
    });
  }

  // STAMP WHEN THEY ANSWERED, not when the tool was called (2026-07-28, seen on
  // real hardware). `now` was computed at handler entry, then the picker sat
  // waiting for a human — 62 seconds in the observed run — so the ledger dated
  // the user's call a minute BEFORE the host logged their answer. A record whose
  // own timestamps run backwards against the host log is a record you cannot use
  // to reconstruct what happened. settle.ts already stamps after its picker;
  // this is the same rule. `today` is unchanged: the logical date is the date
  // they were asked about, and only the intra-day time was wrong.
  const answeredAt = a['today_override'] ? now : logicalNow(now.slice(0, 10), false);
  await appendLedger(dir, [{ id, event: 'premise_resolve', premise_id: premise.premise_id, decision }], answeredAt);

  // Voice follows the user's own closing call (their words ARE the sample).
  const ko = resolveResponseLocale(dir, decision || premise.text) === 'ko';
  return envelope({
    ok: true, tool: 'argus_premises',
    surface: ko
      ? `미결 질문을 당신의 말로 닫았습니다 (P${premise.ordinal}): "${decision}".`
      : `Open question P${premise.ordinal} closed in your words: "${decision}".`,
    next_actions: ['argus_patterns', 'leave_as_is'],
    data: { id, ref: `P${premise.ordinal}`, premise_id: premise.premise_id, decision, decision_owner: 'user' },
  });
}

// ── op=still_open (M3 handle b: defer the reconsider nudge — NOT a resolve) ──
// The user chose to keep the question open. It stays active and unresolved; the
// only effect is resetting the reconsider clock so it isn't nudged again until
// the next cadence. No verdict, no closing decision — leaving it open is a valid
// answer, and this handle must never read as pressure to finally decide.

async function opStillOpen(
  dir: string, id: string, today: string, now: string,
  state: Parameters<typeof guardTransition>[0], existing: PremiseState[],
  a: Record<string, unknown>,
) {
  guardTransition(state, 'premise_reconsider');

  const ref = a['ref'];
  if (typeof ref !== 'string') {
    return toolError({ ok: false, tool: 'argus_premises', error_code: 'STILL_OPEN_NEEDS_REF', message: 'op=still_open needs `ref`.', recovery: 'List open questions via argus_patterns view="decision_context", then defer by ordinal.' });
  }
  const premise = resolvePremiseRef(existing, ref);
  if (premise.kind !== 'open_question') {
    return toolError({ ok: false, tool: 'argus_premises', error_code: 'NOT_AN_OPEN_QUESTION', message: `P${premise.ordinal} is a premise, not an open question.`, recovery: 'Only an open question can be left open. Re-check a premise with argus_capture action="update_fact".' });
  }
  if (premise.status !== 'active') {
    return toolError({ ok: false, tool: 'argus_premises', error_code: 'PREMISE_RETIRED', message: `P${premise.ordinal} is already ${premise.status}.`, recovery: 'Read it via argus_patterns view="decision_context".' });
  }

  await appendLedger(dir, [{
    id, event: 'premise_reconsider', premise_id: premise.premise_id, anchor_date: today,
    ...(typeof a['reponder_cadence_days'] === 'number' ? { reponder_cadence_days: a['reponder_cadence_days'] as number } : {}),
  }], now);

  const ko = resolveResponseLocale(dir, premise.text) === 'ko';
  return envelope({
    ok: true, tool: 'argus_premises',
    surface: ko
      ? `P${premise.ordinal}, 열린 채로 둡니다. 평결도 압박도 없습니다. 한참 뒤에 다시 보여드리고, 그 전에는 조용히 있겠습니다. 질문을 열어두는 것도 진짜 선택입니다.`
      : `P${premise.ordinal} stays open. No verdict, no pressure. Argus brings it back after a while, not before you're ready. Leaving a question open is a real choice.`,
    next_actions: ['argus_patterns', 'leave_as_is'],
    data: { id, ref: `P${premise.ordinal}`, premise_id: premise.premise_id, deferred: true },
  });
}
