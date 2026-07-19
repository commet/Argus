import { atomicWriteJson } from '../lib/atomic-write.js';
import { bearingPath } from '../lib/layout.js';
import { resolveToolArgusDir } from '../lib/argus-dir.js';
import { resolveToday } from '../lib/resolve-today.js';
import { resolveContract } from '../lib/resolve-contract.js';
import { guardTransition } from '../lib/state-machine.js';
import { validateSeal } from '../lib/validate-seal.js';
import { appendLedger, withLedgerLock, type LedgerEventInput } from '../lib/ledger-append.js';
import { asV2WriteField, mapSealProvenance } from '../v2/mirror.js';
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
  id: zId.describe('A short slug you pick for this decision (e.g. "q3-cutover"). A fresh id starts the record on its own.'),
  predicate: z.string().min(8).max(400).describe('A prediction reality can mark true/false. Good: "cutover downtime < 5 min". Bad: "it will go well".'),
  check_by: zDate.describe('YYYY-MM-DD, a real future date when the result can be checked.'),
  predicate_owner: z.enum(['user', 'ai_surfaced']).describe('Provenance. Never forge. "user" = the user wrote or affirmed it. "ai_surfaced" = Argus drafted, unconfirmed — on a host with a picker this AUTOMATICALLY shows one-tap Keep/Reword/Skip before saving.'),
  confirm_draft: z.boolean().optional().describe('Optional extra confirmation: force the one-tap picker even for a "user" predicate. ai_surfaced predicates get the picker automatically on supporting hosts. In the picker, Keep affirms and saves it as theirs, Reword saves the wording the user types (or asks in chat if left blank), Skip records nothing. Without picker support, saving proceeds — confirm in your own message first.'),
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

      let predicate = String(a['predicate']);
      const checkBy = String(a['check_by']);
      // The DATE part of `now` must equal the tz-aware logical `today`. Plain
      // new Date().toISOString() is always UTC, so a Korea (UTC+9) user sealing
      // at 08:00 KST (= 23:00Z the day before) got a receipt dated YESTERDAY —
      // the tool's own `today` disagreeing with the date it printed. recheck.ts
      // already fixed this same class for premise cadences. Keep the real UTC
      // time-of-day for intra-day ordering, but stamp the logical date.
      const now = a['today_override']
        ? `${today}T12:00:00.000Z`
        : `${today}T${new Date().toISOString().slice(11)}`;
      // Response voice follows the predicate (M4): config > text > env.
      let locale = resolveResponseLocale(dir, predicate);
      let T = SURFACES[locale].tools.seal;

      // One-tap confirm for a DRAFTED predicate (the activation fix; §9.7 O1
      // 방4): show the draft with Keep / Reword / Skip before it lands.
      // Keep = the user affirmed it → record as THEIRS. Reword with wording
      // typed in the same form = record THAT, user-authored, one round-trip.
      // Reword without wording / Skip / a declined picker = record nothing
      // (respect the non-yes). STRUCTURAL trigger: an ai_surfaced predicate
      // fires the picker on any capable host even when the model forgot
      // confirm_draft — "the draft was confirmed" must not depend on prose
      // compliance. On a host with no elicitation, this is skipped and the
      // seal proceeds with honest ai_surfaced provenance (the friction escape
      // stays; forced typing is NOT the invariant — honest provenance is).
      let elicitedKeep = false; // v2 provenance용: elicit 채널로 확인된 것만 elicited_user (II-B) — Keep 또는 폼에 직접 쓴 reword
      if ((a['confirm_draft'] === true || a['predicate_owner'] === 'ai_surfaced') && canElicit()) {
        const picked = await elicit(
          locale === 'ko' ? `이 예측으로 기록할까요?\n"${predicate}" (확인일 ${checkBy})` : `Record this prediction?\n"${predicate}" (check-by ${checkBy})`,
          { type: 'object', required: ['choice'], properties: {
            choice: {
              type: 'string', enum: ['keep', 'reword', 'skip'],
              enumNames: locale === 'ko' ? ['그대로 기록', '내가 다시 쓸게', '안 할래'] : ['Keep it', 'Let me reword', 'Skip'],
              description: locale === 'ko' ? '이 예측을 기록할지 고르세요.' : 'Whether to record this prediction.',
            },
            your_wording: {
              type: 'string',
              description: locale === 'ko' ? '"내가 다시 쓸게"를 골랐다면, 원하는 예측 문장을 여기에 적어 주세요. 그 말 그대로 저장됩니다.' : 'If you chose "Let me reword", type your prediction here. It is saved exactly as written.',
            },
          } },
        );
        const choice = picked?.['choice'];
        if (choice === 'reword') {
          const wording = typeof picked?.['your_wording'] === 'string' ? (picked['your_wording'] as string).trim() : '';
          if (wording) {
            // One-shot reword: the user's own words replace the draft — but they
            // pass the SAME falsifiability gate as any predicate (a vibe typed by
            // the user is still unsettleable; refusing honestly beats recording a
            // dead reminder).
            if (wording.length < 8 || wording.length > 400) {
              return toolError({ ok: false, tool: 'argus_seal', error_code: 'SEAL_INVALID', message: locale === 'ko' ? `다시 쓴 예측이 너무 ${wording.length < 8 ? '짧습니다' : '깁니다'} (8~400자).` : `The reworded prediction is too ${wording.length < 8 ? 'short' : 'long'} (8–400 chars).`, recovery: locale === 'ko' ? '예측 문장을 8~400자로 다시 알려주세요.' : 'Give the prediction again in 8–400 characters.' });
            }
            const rErr = validateSeal(wording, checkBy, today);
            if (rErr) {
              return toolError({ ok: false, tool: 'argus_seal', error_code: rErr.code, message: rErr.message, recovery: rErr.recovery });
            }
            predicate = wording;
            a = { ...a, predicate: wording, predicate_owner: 'user' };
            elicitedKeep = true; // typed through the elicit channel — evidenced user input
            // The voice follows the USER's wording now (they may have reworded
            // an English draft in Korean).
            locale = resolveResponseLocale(dir, predicate);
            T = SURFACES[locale].tools.seal;
          } else {
            // Reword chosen but no wording typed (or the host renders enum-only
            // forms) — fall back to the two-step: ask in chat, model re-calls.
            return envelope({ ok: true, tool: 'argus_seal', surface: locale === 'ko' ? '그럼 원하는 예측 문장을 알려주세요. 그 말 그대로 저장할게요.' : "Then tell me the prediction in your own words and I'll save exactly that.", next_actions: ['argus_predict'], data: { sealed: false, choice: 'reword' } });
          }
        } else if (choice !== 'keep') {
          // skip, or a declined/cancelled picker — record nothing.
          return envelope({ ok: true, tool: 'argus_seal', surface: locale === 'ko' ? '기록하지 않았어요.' : 'Not recorded.', next_actions: ['stop'], data: { sealed: false, choice: choice ?? 'declined' } });
        } else {
          // keep → the user affirmed the draft, so it is theirs now.
          a = { ...a, predicate_owner: 'user' };
          elicitedKeep = true;
        }
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
      const { receipt, calendarPath, v2Mirror } = await withLedgerLock(dir, async () => {
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
        const calendarPathW = await writeReturnCalendarEvent(dir, { id, predicate, check_by: checkBy, created_at: now, locale });
        // 미러 힌트: 원장 이벤트에 없는 elicit 목격 여부 + 영수증 필드만 —
        // 미러 자체는 appendLedger의 단일 관문이 수행한다 (mirror.ts).
        const appended = await appendLedger(dir, events, now, { seal: {
          provenance: mapSealProvenance(a['predicate_owner'], elicitedKeep),
          realQuestion: a['real_question'] as string | undefined,
          unverifiedAssumption: a['unverified_assumption'] as string | undefined,
          humanOnly: a['human_only'] as string | undefined,
          humanJudgment: a['human_judgment'] as string | undefined,
        } });
        return { receipt: receiptW, calendarPath: calendarPathW, v2Mirror: appended.v2_mirror };
      });

      const v2Write = asV2WriteField(v2Mirror);

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
      const calNote = locale === 'ko' ? ' 달력 리마인더(.ics)도 저장했습니다.' : ' Saved a calendar reminder (.ics).';
      return envelope({
        ok: true, tool: 'argus_seal',
        surface: `${T.sealed(predicate, checkBy)}${calNote}${nudge}${syncLine}`,
        next_actions: ['argus_check_in', 'stop'],
        data: {
          id, predicate, check_by: checkBy, predicate_owner: a['predicate_owner'],
          calendar_path: calendarPath,
          seal_text,
          status: 'sealed', ledger_events_written: events.map((e) => e.event),
          v2_write: v2Write,
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
