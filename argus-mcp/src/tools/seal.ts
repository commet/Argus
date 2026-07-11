import { atomicWriteJson } from '../lib/atomic-write.js';
import { bearingPath } from '../lib/layout.js';
import { resolveToolArgusDir } from '../lib/argus-dir.js';
import { resolveToday } from '../lib/resolve-today.js';
import { resolveContract } from '../lib/resolve-contract.js';
import { guardTransition } from '../lib/state-machine.js';
import { validateSeal } from '../lib/validate-seal.js';
import { appendLedger, withLedgerLock, type LedgerEventInput } from '../lib/ledger-append.js';
import { writeSealReceipt } from '../lib/receipt.js';
import { premiseId, MAX_ACTIVE_PREMISES, MAX_LOAD_BEARING } from '../lib/premises.js';
import { pushToAccount } from '../lib/push-account.js';
import { ensurePrivacyGitignore } from '../lib/privacy.js';
import { renderSeal } from '../lib/render-receipt.js';
import { resolveResponseLocale, SURFACES, humanizeSyncReason } from '../lib/surfaces.js';
import { accountPushId } from '../lib/install-id.js';
import { premiseSyncEnabled } from '../lib/premise-sync.js';
import { elicit, canElicit } from '../lib/elicit.js';
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
  confirm_draft: z.boolean().optional().describe('Set true when YOU drafted this predicate for the user (turning their decision into a falsifiable one-liner) and want a one-tap confirm before it is recorded. On a host that supports it, the user is shown the draft with Keep / Reword / Skip; Keep records it as THEIRS (affirmed), Reword returns without sealing so you can use their words, Skip records nothing. On a host without the picker, the seal proceeds (so confirm in your own message first).'),
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
      // Stamp the seal at the LOGICAL day when a today_override is given (sims,
      // tests), else real wall-clock. Without this the receipt showed a
      // wall-clock sealed date that diverged from the simulated timeline and
      // read as "the record misstates my dates" (experience loop, settler). Real
      // use passes no override, so created_at stays the true write time.
      const now = a['today_override'] ? `${today}T12:00:00.000Z` : new Date().toISOString();
      // Response voice follows the predicate (M4): config > text > env.
      const locale = resolveResponseLocale(dir, predicate);
      const T = SURFACES[locale].tools.seal;

      // One-tap confirm for a DRAFTED predicate (the activation fix): when the
      // model turned the user's decision into a falsifiable line and wants a
      // light yes before it lands, show the draft with Keep / Reword / Skip.
      // Keep = the user affirmed it → record as THEIRS. Reword / Skip / a
      // declined picker = record nothing (respect the non-yes). On a host with
      // no elicitation, this is skipped and the seal proceeds (the model
      // confirmed in text). This is spine-safe: the draft is shown and the user
      // says yes — never a silent auto-seal of an inferred prediction.
      if (a['confirm_draft'] === true && canElicit()) {
        const picked = await elicit(
          locale === 'ko' ? `이 예측으로 기록할까요?\n"${predicate}" (확인일 ${checkBy})` : `Record this prediction?\n"${predicate}" (check-by ${checkBy})`,
          { type: 'object', required: ['choice'], properties: { choice: {
            type: 'string', enum: ['keep', 'reword', 'skip'],
            enumNames: locale === 'ko' ? ['그대로 기록', '내가 다시 쓸게', '안 할래'] : ['Keep it', 'Let me reword', 'Skip'],
            description: locale === 'ko' ? '이 예측을 기록할지 고르세요.' : 'Whether to record this prediction.',
          } } },
        );
        const choice = picked?.['choice'];
        if (choice === 'reword') {
          return envelope({ ok: true, tool: 'argus_seal', surface: locale === 'ko' ? '그럼 원하는 문장으로 알려주세요. 그 말 그대로 봉인할게요.' : "Then tell me the prediction in your own words and I'll seal exactly that.", next_actions: ['argus_seal'], data: { sealed: false, choice: 'reword' } });
        }
        if (choice !== 'keep') {
          // skip, or a declined/cancelled picker — record nothing.
          return envelope({ ok: true, tool: 'argus_seal', surface: locale === 'ko' ? '기록하지 않았어요. 남기고 싶으면 argus_watch로 한 줄만 적어둘 수도 있어요.' : 'Not recorded. If you want, jot a one-line note with argus_watch instead.', next_actions: ['argus_watch', 'stop'], data: { sealed: false, choice: choice ?? 'declined' } });
        }
        // keep → the user affirmed the draft, so it is theirs now.
        a = { ...a, predicate_owner: 'user' };
      }

      await ensurePrivacyGitignore(dir);

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
      // §9.4 두 기기 안전: seal is a read-check-append like settle, and it was the
      // one write that skipped the lock. Two processes on one ledger both replay
      // `absent`, both pass the guard, and both append a `seal` — replay then does
      // stats.total_sealed++ per event, so ONE prediction counts as two, forever,
      // on an append-only log. Re-guard under the lock: the loser sees the same
      // ILLEGAL_TRANSITION it would have seen had it arrived second sequentially.
      //
      // The receipt / bearing / calendar files are written INSIDE the lock, after
      // the re-guard passes — not before. If a concurrent process wins the seal,
      // the re-guard throws and this process writes nothing; writing them earlier
      // left the loser's receipt on disk contradicting the winner's ledger (and
      // resolveContract reads the receipt back, so the user would see a mismatch).
      const { receipt, calendarPath } = await withLedgerLock(dir, async () => {
        const fresh = resolveContract(dir, id, today);
        guardTransition(fresh.state, 'seal');
        // seal-time receipt (the rich fields that make the receipt not blank)
        const receiptW = await writeSealReceipt(dir, {
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
        const calendarPathW = await writeReturnCalendarEvent(dir, { id, predicate, check_by: checkBy, created_at: now });
        await appendLedger(dir, events, now);
        return { receipt: receiptW, calendarPath: calendarPathW };
      });

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
