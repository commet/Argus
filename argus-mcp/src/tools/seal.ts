import { atomicWriteJson } from '../lib/atomic-write.js';
import { bearingPath } from '../lib/layout.js';
import { resolveToolArgusDir } from '../lib/argus-dir.js';
import { resolveToday } from '../lib/resolve-today.js';
import { resolveContract } from '../lib/resolve-contract.js';
import { guardTransition } from '../lib/state-machine.js';
import { validateSeal } from '../lib/validate-seal.js';
import { appendLedger, type LedgerEventInput } from '../lib/ledger-append.js';
import { writeSealReceipt } from '../lib/receipt.js';
import { premiseId, MAX_ACTIVE_PREMISES, MAX_LOAD_BEARING } from '../lib/premises.js';
import { pushToAccount } from '../lib/push-account.js';
import { ensurePrivacyGitignore } from '../lib/privacy.js';
import { renderSeal } from '../lib/render-receipt.js';
import { resolveResponseLocale, SURFACES, humanizeSyncReason } from '../lib/surfaces.js';
import { accountPushId } from '../lib/install-id.js';
import { premiseSyncEnabled } from '../lib/premise-sync.js';
import { SCHEMA_VERSION } from '../lib/spine.js';
import { writeReturnCalendarEvent } from '../lib/calendar.js';
import { z } from 'zod';
import { envelope, toolError } from '../lib/envelope.js';
import { ENVELOPE_OUTPUT_SCHEMA, zArgusDir, zId, zDate, type ToolModule } from './tool-types.js';
import { handleToolException } from './errors.js';

// Session-once gate for the "name your assumption" nudge (same idea as the
// ambient due-line). A rapid-fire batch — "seal all three" → three seals
// without assumptions — pasted the identical nudge three times in a row, which
// read as nagging (experience loop, raj). Show it at most once per session per
// ledger; the count is unaffected, only the repeated prose is suppressed.
const assumptionNudgeShownFor = new Set<string>();
export function resetSealSession(): void {
  assumptionNudgeShownFor.clear();
}

const inputSchema = z.strictObject({
  argus_dir: zArgusDir,
  id: zId.describe('A short slug you pick for this decision (e.g. "q3-cutover"). No prior argus_open_decision is needed — a fresh id starts the record on its own.'),
  predicate: z.string().min(8).max(400).describe('A prediction reality can mark true/false. Good: "cutover downtime < 5 min". Bad: "it will go well".'),
  check_by: zDate.describe('YYYY-MM-DD, a real future date — when you will come back to settle.'),
  predicate_owner: z.enum(['user', 'ai_surfaced']).describe('Provenance. Never forge. "user" = the user wrote or affirmed it. "ai_surfaced" = Argus drafted, unconfirmed.'),
  basis: z.enum(['judgment', 'luck', 'mixed', 'unsure']).optional(),
  real_question: z.string().max(400).describe('The real question behind the answer (receipt).').optional(),
  unverified_assumption: z.string().max(400).describe('The core assumption not yet verified (receipt).').optional(),
  human_only: z.string().max(400).describe('What only a human can judge here (receipt).').optional(),
  human_judgment: z.string().max(400).describe("The user's one-line call. MUST be the user's words — never an Argus-drafted line relabeled.").optional(),
  today_override: zDate.optional(),
});

export const seal: ToolModule = {
  name: 'argus_seal',
  description:
    'Seal a falsifiable prediction (predicate + check-by date). Locks it immediately; no prior argus_open_decision is required, and when the user says to seal, do it without re-asking. Seal each decision the user names, one call per decision. Captures the seal-time Judgment Receipt fields. Refuses an empty/non-falsifiable predicate or a non-future date. On success, show the short `surface` line as the confirmation — keep sealing light. data.seal_text holds a fuller sealed certificate a host MAY offer if the user wants a keepsake, but the real keepsake is the settled receipt; do not print the full certificate on every seal.',
  inputSchema,
  outputSchema: ENVELOPE_OUTPUT_SCHEMA,
  // openWorldHint: true — with ARGUS_TOKEN set, sealing also mirrors to the account.
  annotations: { title: 'Seal a prediction', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  handler: async (a) => {
    try {
      const dir = resolveToolArgusDir(a['argus_dir']);
      const id = String(a['id'] ?? '');
      const today = resolveToday({ override: a['today_override'] as string | undefined });

      const current = resolveContract(dir, id, today);
      guardTransition(current.state, 'seal'); // throws DECISION_CLOSED / ILLEGAL_TRANSITION

      const vErr = validateSeal(a['predicate'], a['check_by'], today);
      if (vErr) {
        return toolError({ ok: false, tool: 'argus_seal', error_code: vErr.code, message: vErr.message, recovery: vErr.recovery });
      }

      const predicate = String(a['predicate']);
      const checkBy = String(a['check_by']);
      const now = new Date().toISOString();
      // Response voice follows the predicate (M4): config > text > env.
      const locale = resolveResponseLocale(dir, predicate);
      const T = SURFACES[locale].tools.seal;

      await ensurePrivacyGitignore(dir);

      // seal-time receipt (the rich fields that make the receipt not blank)
      const receipt = await writeSealReceipt(dir, {
        id, predicate, check_by: checkBy,
        real_question: a['real_question'] as string | undefined,
        unverified_assumption: a['unverified_assumption'] as string | undefined,
        human_only: a['human_only'] as string | undefined,
        human_judgment: a['human_judgment'] as string | undefined,
        basis: a['basis'] as 'judgment' | 'luck' | 'mixed' | 'unsure' | undefined,
      }, now);

      // bearing seed (so a due contract is visible even before the ledger is replayed elsewhere)
      await atomicWriteJson(bearingPath(dir, id), {
        v: SCHEMA_VERSION, id, contract_seed: { predicate, check_by: checkBy }, predicate_owner: a['predicate_owner'],
      });
      const calendarPath = await writeReturnCalendarEvent(dir, { id, predicate, check_by: checkBy, created_at: now });

      // ledger: self-create harvest if the decision was sealed without an explicit open
      const events: LedgerEventInput[] = [];
      if (current.state === 'absent') events.push({ id, event: 'harvest', decision: predicate });
      events.push({ id, event: 'seal', predicate, check_by: checkBy, basis: a['basis'] as string | undefined });

      // Promotion (plan v5 §5.4): the named unverified_assumption IS the first
      // premise — the premise set is canonical, the seal field is its input
      // alias. source='user' (receipt judgment fields are user-named),
      // external=false until the user marks it (honest default: we cannot infer
      // reality-checkability), load_bearing=true (it is the receipt headline).
      // Skipped field ⇒ no promotion. Dedup + cap-safe: never fails the seal.
      let promotedRef: string | null = null;
      const ua = a['unverified_assumption'] as string | undefined;
      if (ua && ua.trim()) {
        const existingPrems = current.entry?.premises ?? [];
        const pid = premiseId(id, 'premise', ua);
        const lbCount = existingPrems.filter((p) => p.status === 'active' && p.load_bearing).length;
        const activeCount = existingPrems.filter((p) => p.status === 'active').length;
        const isDup = existingPrems.some((p) => p.premise_id === pid);
        if (!isDup && activeCount < MAX_ACTIVE_PREMISES) {
          const ordinal = existingPrems.reduce((m, p) => Math.max(m, p.ordinal), 0) + 1;
          events.push({
            id, event: 'premise_add', premise_id: pid, ordinal,
            kind: 'premise', text: ua.trim(),
            external: false, load_bearing: lbCount < MAX_LOAD_BEARING,
            source: 'user_stated',
          });
          promotedRef = `P${ordinal}`;
        }
      }
      await appendLedger(dir, events, now);

      const namedAssumption = !receipt.skipped.includes('unverified_assumption');
      // Fire the nudge only on the FIRST assumption-less seal this session (per
      // ledger); a batch of them should not repeat the identical line.
      let nudge = '';
      if (!namedAssumption && !assumptionNudgeShownFor.has(dir)) {
        nudge = T.nudge_assumption;
        assumptionNudgeShownFor.add(dir);
      }

      // Opt-in: mirror the prediction to the user's account so the Companion
      // Brief can email it at check-by. No token ⇒ silent local-only no-op;
      // failure never affects the seal that already succeeded locally.
      // Premise opt-in sync (M3, §9.2-4): OFF by default — premises never leave
      // the machine unless the user set premise_sync:true. When on, only the
      // MONITORED ones (active + premise + external + load_bearing) ride along,
      // so the account's premise-watch (T2) can re-check them for real.
      const monitoredPremises = premiseSyncEnabled(dir)
        ? (current.entry?.premises ?? [])
            .filter((p) => p.status === 'active' && p.kind === 'premise' && p.external && p.load_bearing)
            .map((p) => ({ ...p }) as unknown as Record<string, unknown>)
        : [];
      const sync = await pushToAccount({
        // BS-1 (§9.4): the account key is namespaced per ledger so two machines
        // (or two projects) sealing the same natural slug can never collide.
        action: 'seal', id: accountPushId(dir, id), predicate, check_by: checkBy, sealed_at: now,
        source_title: predicate.slice(0, 80),
        real_question: a['real_question'] as string | undefined,
        human_judgment: a['human_judgment'] as string | undefined,
        ...(monitoredPremises.length > 0 ? { tracked_premises: monitoredPremises } : {}),
      });
      // 3-state sync voice (11 S3): success speaks, no-token stays silent
      // (local-only is the chosen default, not a failure), and a FAILURE with a
      // token set must speak — the user believes an email is coming.
      const syncLine = sync.synced
        ? T.synced
        : sync.reason === 'no_token'
          ? ''
          : T.sync_failed(humanizeSyncReason(String(sync.reason), locale));

      // The sealing confirmation (P1-E2): the terminal twin of the webapp's
      // seal certificate. surface stays the short model-facing line; seal_text
      // is FOR THE USER (the tool description says: show it verbatim).
      const seal_text = renderSeal({
        predicate,
        predicate_owner: a['predicate_owner'] as 'user' | 'ai_surfaced',
        sealed_on: now.slice(0, 10),
        check_by: checkBy,
        today,
        locale,
      });

      // The .ics exists (path in data.calendar_path for hosts that want it), but
      // dumping the absolute path — and the English label "Calendar file:" — into
      // a one-line surface was noise, and broke the Korean voice (copy-audit /
      // loop find). Mention it briefly, localized; keep the path in data.
      const calNote = locale === 'ko' ? ' 달력에 넣을 .ics 파일도 만들어뒀습니다.' : ' A calendar file (.ics) is saved too.';
      return envelope({
        ok: true, tool: 'argus_seal',
        surface: `${T.sealed(predicate, checkBy)}${calNote}${nudge}${syncLine}`,
        next_actions: ['argus_check_in', 'stop'],
        data: {
          id, predicate, check_by: checkBy, predicate_owner: a['predicate_owner'],
          calendar_path: calendarPath,
          seal_text,
          status: 'sealed', ledger_events_written: events.map((e) => e.event),
          skipped: receipt.skipped,
          account_synced: sync.synced,
          ...(sync.synced ? {} : { account_sync_reason: sync.reason }),
          // The named assumption now lives as a tracked premise (canonical set).
          // Marking it external (argus_premises op=amend) arms reality re-checks.
          ...(promotedRef ? { premise_promoted: promotedRef } : {}),
        },
      });
    } catch (e) {
      return handleToolException('argus_seal', e);
    }
  },
};
