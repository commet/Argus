import { atomicWriteJson } from '../lib/atomic-write.js';
import { bearingPath } from '../lib/layout.js';
import { resolveToolArgusDir } from '../lib/argus-dir.js';
import { resolveToday, logicalNow } from '../lib/resolve-today.js';
import { resolveContract } from '../lib/resolve-contract.js';
import { refuseIfLedgerUnreadable } from '../lib/ledger-readable.js';
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
import { sanitizeLine } from '../v2/sanitize.js';
import { elicitDetailed, canElicit } from '../lib/elicit.js';
import { SCHEMA_VERSION } from '../lib/spine.js';
import { writeReturnCalendarEvent } from '../lib/calendar.js';
import { z } from 'zod';
import { envelope, toolError } from '../lib/envelope.js';
import { noAnswerResult } from '../lib/picker-fallback.js';
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
  predicate_owner: z.enum(['user', 'ai_surfaced']).describe('Provenance. Never forge. "user" = the user wrote or affirmed it. "ai_surfaced" = Argus drafted, unconfirmed — on a host with a picker this AUTOMATICALLY shows a one-tap confirm before saving.'),
  confirm_draft: z.boolean().optional().describe('Optional extra confirmation: force the one-tap confirm even for a "user" predicate. ai_surfaced predicates get it automatically on supporting hosts. The picker maps to the host\'s native Accept/Decline and carries NO input fields, so one keypress records it: Accept keeps the sentence as theirs, Decline records nothing. If they want different words or a different date, they say so in chat and you call again with the new value. Without picker support, saving proceeds — confirm in your own message first.'),
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
    'Seal a falsifiable prediction (predicate + check-by date). Locks it immediately; no prior capture step is required, and when the user says to seal, do it without re-asking. Seal each decision the user names, one call per decision. Captures the seal-time Judgment Receipt fields. Refuses an empty/non-falsifiable predicate or a non-future date. On success, show the short `surface` line as the confirmation — keep sealing light. data.seal_text holds a fuller sealed certificate a host MAY offer if the user wants a keepsake, but the real keepsake is the settled receipt; do not print the full certificate on every seal.',
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
      const blind = refuseIfLedgerUnreadable('argus_seal', current);
      if (blind) return blind;
      guardTransition(current.state, 'seal'); // throws DECISION_CLOSED / ILLEGAL_TRANSITION

      const vErr = validateSeal(a['predicate'], a['check_by'], today);
      if (vErr) {
        return toolError({ ok: false, tool: 'argus_seal', error_code: vErr.code, message: vErr.message, recovery: vErr.recovery });
      }

      let predicate = String(a['predicate']);
      let checkBy = String(a['check_by']);
      // The DATE part of `now` must equal the tz-aware logical `today`. Plain
      // new Date().toISOString() is always UTC, so a Korea (UTC+9) user sealing
      // at 08:00 KST (= 23:00Z the day before) got a receipt dated YESTERDAY —
      // the tool's own `today` disagreeing with the date it printed. recheck.ts
      // already fixed this same class for premise cadences. Keep the real UTC
      // time-of-day for intra-day ordering, but stamp the logical date.
      let now = logicalNow(today, !!a['today_override']);
      // Response voice follows the predicate (M4): config > text > env.
      let locale = resolveResponseLocale(dir, predicate);
      let T = SURFACES[locale].tools.seal;

      // One-tap confirm for a DRAFTED predicate (the activation fix; §9.7 O1
      // 방4). Design (2026-07-24, 창업자 도그푸딩): the picker maps to
      // elicitation's NATIVE Accept/Decline instead of a required 3-way enum —
      // a required enum forced "expand → pick → Accept" (3-4 keystrokes) and
      // rendered as an unset field the user had to hunt for. Now:
      //   Accept, both fields blank → KEEP the draft (the user affirmed it → theirs)
      //   Accept + `reword`         → record the user's wording (user_stated)
      //   Accept + `check_by`       → adjust the horizon inline (the "그 날짜 쎄"
      //                               escape — keep the statement, fix only the date)
      //   Decline / cancel          → SKIP (record nothing)
      // Both edit fields are OPTIONAL, so Accept is actionable in one keystroke.
      // STRUCTURAL trigger: an ai_surfaced predicate fires the picker on any
      // capable host even if the model forgot confirm_draft. No elicitation →
      // the seal proceeds with honest ai_surfaced provenance (friction escape
      // stays; forced typing is NOT the invariant — honest provenance is).
      let elicitedKeep = false; // v2 provenance: only elicit-channel confirmation counts as elicited_user (II-B)
      if ((a['confirm_draft'] === true || a['predicate_owner'] === 'ai_surfaced') && canElicit()) {
        // CLIP FOR DISPLAY ONLY (2026-07-28). The full predicate went into the
        // message raw, so a 380-character prediction — well inside the schema's
        // own 400-char cap — arrived as one 302-character line. The record keeps
        // every character; only what the human reads is bounded, and the clip
        // leaves an ellipsis so nobody mistakes it for the whole sentence.
        const shownPred = sanitizeLine(predicate, 96);
        // NO FIELDS ON THE YES-PATH (2026-07-28, the third "Accept does not work").
        //
        // Read out of the shipped Claude Code binary rather than guessed at:
        //
        //     const [selected] = useState(hasFields ? null : "accept")
        //     handleTextInputSubmit = () => move("down")
        //
        // If the ask declares ANY field, Accept is not selected at mount — the
        // cursor sits in the first text box, and Return there MOVES to the next
        // row instead of submitting. Our seal ask shipped two optional boxes, so
        // "read it, press Accept" sent nothing at all: the dialog waited until
        // the request timed out and the host reported that as a cancel. The
        // founder's log shows it arriving at 60.018s, which nobody pressed.
        //
        // With no properties, `selected` starts on "accept" and one Return
        // records it. That IS the ask: "is this your sentence, yes or no." A
        // user who wants different words says so in chat and the model calls
        // again — the same path every host without a picker already takes, and
        // one this tool has always supported.
        //
        // The two previous fixes here (`required`, then `format`) were real and
        // are still right. They were not this. Nobody counted the keystrokes,
        // because every harness we own answers the ask programmatically.
        // `evals/claude-code-form.mjs` now counts them.
        const asked = await elicitDetailed(
          locale === 'ko'
            ? `이 예측으로 기록할까요?\n"${shownPred}"\n확인일 ${checkBy}\n\n그대로 남기려면 Accept, 남기지 않으려면 Decline입니다. 문장이나 날짜를 고치고 싶으면 Decline 후 말씀해 주세요.`
            : `Record this prediction?\n"${shownPred}"\ncheck-by ${checkBy}\n\nAccept to keep it, Decline to skip. To change the wording or the date, Decline and say so.`,
          { type: 'object', properties: {} },
        );
        // A NO and a NON-ANSWER are different facts (2026-07-27). Declining is an
        // answer: record nothing, say so, stop. But a picker that closed without
        // an answer — validated field, focus trapped in a text input, host quirk
        // we cannot see from here — must NOT eat the user's work behind a polite
        // "not recorded". Name it and hand back the plain-text path, once.
        if (asked.kind === 'no_answer') {
          return noAnswerResult({
            tool: 'argus_seal', ko: locale === 'ko',
            handBack: {
              ko: `"저장해줘" 한마디면 이대로 남깁니다: "${predicate}" (확인일 ${checkBy}).`,
              en: `Say "save it" and I'll keep this as is: "${predicate}" (check-by ${checkBy}).`,
            },
            next_actions: ['argus_predict', 'stop'],
            data: { sealed: false, predicate, check_by: checkBy, retry_hint: 'call argus_predict again with predicate_owner:"user" and no confirm_draft once the user says yes in chat' },
          });
        }
        const picked = asked.kind === 'accepted' ? asked.content : null;
        if (!picked) {
          // A deliberate decline — record nothing, and do not re-ask.
          return envelope({ ok: true, tool: 'argus_seal', surface: locale === 'ko' ? '기록하지 않았습니다.' : 'Not recorded.', next_actions: ['stop'], data: { sealed: false, choice: 'declined' } });
        }
        // Accept. Apply any optional edits, then re-gate through validateSeal —
        // a vibe typed by the user is still unsettleable; refusing honestly beats
        // recording a dead reminder.
        const rw = typeof picked['reword'] === 'string' ? (picked['reword'] as string).trim() : '';
        const cbEdit = typeof picked['check_by'] === 'string' ? (picked['check_by'] as string).trim() : '';
        if (rw) predicate = rw;
        if (cbEdit) checkBy = cbEdit;
        // A refusal AFTER the user typed must hand their words back (audit
        // 2026-07-27). Without `data.user_input` the only thing reaching the
        // model is "too long", so it asks the user to retype a paragraph they
        // already wrote — and they don't. We are holding the text; return it.
        if (rw && rw.length > 400) {
          return toolError({
            ok: false, tool: 'argus_seal', error_code: 'SEAL_INVALID',
            message: locale === 'ko' ? '다시 쓴 예측이 너무 깁니다 (최대 400자).' : 'The reworded prediction is too long (max 400 chars).',
            recovery: locale === 'ko' ? '아래 data.user_input.reword가 사용자가 방금 쓴 문장입니다. 처음부터 다시 쓰게 하지 말고, 그 문장을 400자로 줄여 사용자에게 확인받은 뒤 다시 부르세요.' : "data.user_input.reword below is what the user just typed. Do not make them start over: offer it trimmed to 400 chars, confirm with them, then call again.",
            // Also in `data`, because localize-result rewrites `recovery` from a
            // static per-locale map — the sentence telling the model to reuse
            // their words does not survive the language switch. `data` does.
            data: { sealed: false, user_input: { reword: rw, ...(cbEdit ? { check_by: cbEdit } : {}) }, retry_hint: 'data.user_input.reword is what the user just typed; offer it back trimmed to 400 chars rather than asking them to write it again' },
          });
        }
        if (rw || cbEdit) {
          const rErr = validateSeal(predicate, checkBy, today);
          if (rErr) {
            return toolError({
              ok: false, tool: 'argus_seal', error_code: rErr.code, message: rErr.message,
              recovery: rErr.recovery,
              data: { sealed: false, user_input: { ...(rw ? { reword: rw } : {}), ...(cbEdit ? { check_by: cbEdit } : {}) } },
            });
          }
        }
        // Accept (blank or edited) = the user affirmed it → it is theirs now.
        a = { ...a, predicate, check_by: checkBy, predicate_owner: 'user' };
        elicitedKeep = true;
        if (rw) { // voice follows the user's wording (they may have reworded EN→KO)
          locale = resolveResponseLocale(dir, predicate);
          T = SURFACES[locale].tools.seal;
        }
      }

      // RE-STAMP AFTER THE PICKER (2026-07-28, seen on real hardware). `now` was
      // computed at handler entry; if the confirm dialog was up, a human was
      // deciding for as long as they needed — a minute is ordinary — and the
      // ledger, the receipt, the .ics and the account push all carried the
      // earlier instant. The record then reads as if they answered before the
      // host logged their answer. The logical DATE is unchanged (that is the day
      // they were asked about); only the intra-day time is corrected.
      if (elicitedKeep && !a['today_override']) now = logicalNow(now.slice(0, 10), false);

      await ensurePrivacyGitignore(dir);

      // ledger: self-create harvest if the decision was sealed without an explicit open
      const events: LedgerEventInput[] = [];
      if (current.state === 'absent') events.push({ id, event: 'harvest', decision: predicate });
      events.push({
        id, event: 'seal', predicate, check_by: checkBy, basis: a['basis'] as string | undefined,
        // Provenance rides the ledger event itself. It previously lived only in
        // the bearing seed / receipt / v2 mirror, none of which the webapp push
        // reads — so an ai_surfaced draft crossed the bridge looking user-authored.
        predicate_owner: a['predicate_owner'] as 'user' | 'ai_surfaced' | undefined,
      });

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
      // ".ics" is a file extension, not a word. To the non-developer this
      // product is for it reads as noise in the middle of a friendly line
      // (2026-07-28 surface sweep). Say what it is; the file is still an .ics.
      const calNote = locale === 'ko' ? ' 달력 앱에 넣을 알림 파일도 함께 저장했습니다.' : ' A calendar reminder file is saved alongside it.';
      return envelope({
        ok: true, tool: 'argus_seal',
        surface: `${(a['predicate_owner'] === 'ai_surfaced' ? T.sealed_draft : T.sealed)(predicate, checkBy)}${calNote}${nudge}${syncLine}`,
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
