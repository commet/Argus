import { atomicWriteJson } from '../lib/atomic-write.js';
import { bearingPath } from '../lib/layout.js';
import { resolveToolArgusDir } from '../lib/argus-dir.js';
import { resolveToday, logicalNow, resolveHorizon } from '../lib/resolve-today.js';
import { resolveContract } from '../lib/resolve-contract.js';
import { replayLedger } from '../lib/ledger-replay.js';
import { stuckDecisions } from '../lib/stuck-decisions.js';
import { refuseIfLedgerUnreadable } from '../lib/ledger-readable.js';
import { guardTransition } from '../lib/state-machine.js';
import { validateSeal } from '../lib/validate-seal.js';
import { appendLedger, withLedgerLock, type LedgerEventInput } from '../lib/ledger-append.js';
import { asV2WriteField, mapSealProvenance } from '../v2/mirror.js';
import { writeSealReceipt } from '../lib/receipt.js';
import { premiseId, MAX_ACTIVE_PREMISES, MAX_LOAD_BEARING } from '../lib/premises.js';
import { normalizePremiseText } from '../lib/premises-core.js';
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
import { ENVELOPE_OUTPUT_SCHEMA, zArgusDir, zId, zDate, zWhen, type ToolModule } from './tool-types.js';
import { handleToolException } from './errors.js';

// Session-once gate for the "name your assumption" nudge (same idea as the
// ambient due-line). A rapid-fire batch — "seal all three" → three seals
// without assumptions — pasted the identical nudge three times in a row, which
// read as nagging (experience loop, raj). Show it at most once per session per
// ledger; the count is unaffected, only the repeated prose is suppressed.
const assumptionNudgeShownFor = new Set<string>();
// 믿음 확인창의 세션당 1회 규율 (넛지와 같은 교훈, 같은 장치): "전부 봉인해"
// 한 마디가 봉인 셋을 연달아 부르면, 창 셋이 연달아 뜨는 것은 수집이 아니라
// 잔소리다. 첫 창이 세션의 몫이고, 나머지는 대화가 받는다.
const beliefWindowShownFor = new Set<string>();
export function resetSealSession(): void {
  assumptionNudgeShownFor.clear();
  beliefWindowShownFor.clear();
}

const inputSchema = z.strictObject({
  argus_dir: zArgusDir,
  id: zId.describe('A short slug you pick for this decision (e.g. "q3-cutover"). A fresh id starts the record on its own.'),
  // MUST NAME THE MOVE, NOT THE PROHIBITION (RUN6, measured).
  //
  // The first version of this line said "ONE prediction … never two joined by
  // and". The gate in validate-seal.ts is deterministic and correct, but a gate
  // only fires on a call that happens — and a prohibition here produces the one
  // outcome no gate can catch: the assistant read it, agreed the user's
  // sentence was a bundle, announced that Argus takes one clean predicate, and
  // never called. Zero records, which is strictly worse than a refusal it could
  // have recovered from. That is RUN4's failure reproduced by RUN6.
  //
  // A caller that is told what not to do, and not what to do instead, declines
  // on the user's behalf. So this states the permitted action first and keeps
  // the prohibition subordinate to it.
  predicate: z.string().min(8).max(400).describe('ONE prediction reality can mark true/false. If the user bundled several, seal the most load-bearing one now and tell them which you set aside; never stop at saying it is a bundle, and never join two with "and". Good: "cutover downtime < 5 min". Bad: "it will go well".'),
  // A horizon is offered FIRST because it is the form the caller can actually
  // produce: it has no clock, and dates were 44% of every refusal in 21
  // recorded journey runs (resolveHorizon() has the full account).
  check_by: zWhen.describe('When to check: +7d / +2w / +3m (prefer this — you have no clock), or YYYY-MM-DD.'),
  // 인지 수집 사이클 2 (12차 리시트): 열기는 건너뛸 수 있는 문이지만 봉인은
  // 모든 여정이 지난다. 그래서 결정의 질문과 사용자가 표현한 확신도는 여기에도
  // 탄다. 둘 다 선택이고, 저자성 규율(사용자가 말한 것만)은 설명이 나른다.
  question: z.string().min(1).max(300).describe('이 예측이 딛고 선 결정의 질문(선택이 아니라 질문). 돌아볼 때 선택을 가린 채 먼저 보여줍니다.\n\nThe QUESTION behind this bet, not the choice; shown first at return.').optional(),
  confidence: z.enum(['confident', 'uncertain', 'contested']).describe('이 예측에 대해 사용자가 실제로 표현한 확신 정도만. 추측 금지, 정산 때 현실과 대조됩니다.\n\nOnly confidence the user expressed; never guess.').optional(),
  predicate_owner: z.enum(['user', 'ai_surfaced']).describe('Provenance. Never forge. "user" = the user wrote or affirmed it. "ai_surfaced" = Argus drafted, unconfirmed — on a host with a picker this AUTOMATICALLY shows a one-tap confirm before saving.'),
  // WAS 665 SERVED BYTES — the single most expensive line on the whole tool
  // surface, and it bought nothing measurable: across five recorded journey runs
  // the assistant never once passed this flag, so the picker never fired
  // (docs/receipts/2026-08-11-first-user-journey/, 발견 3).
  //
  // What it spent those bytes on was RUNTIME behaviour — what the picker looks
  // like, what Accept and Decline each record, what happens on a host with no
  // picker. None of that is needed to decide whether to pass the flag, and all
  // of it is knowledge the caller needs when it reads the RESULT. The result is
  // not counted by the surface budget, so the same sentences are free there and
  // arrive exactly when they apply: `data.confirm_note` on the no-picker path,
  // and `data.retry_hint` on the decline / no-answer paths, which already
  // carried it. Keep here only what changes the call itself.
  confirm_draft: z.boolean().optional().describe('Force the one-tap confirm even for a "user" predicate. ai_surfaced gets it automatically on hosts with a picker.'),
  basis: z.enum(['judgment', 'luck', 'mixed', 'unsure']).optional(),
  real_question: z.string().max(400).describe('The real question behind the answer (receipt).').optional(),
  unverified_assumption: z.string().max(400).describe('The core assumption not yet verified (receipt). Recorded as an AI-tagged draft (ai_surfaced, with the original wording preserved) unless the user later amends it in their own words.').optional(),
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
      // 이 봉인이 기존 결정에 '붙은' 것인지 새 기록을 '만든' 것인지는 여기서만
      // 알 수 있다 — 봉인 뒤에는 둘 다 sealed로 보인다.
      const startedNewRecord = current.state === 'absent';
      const blind = refuseIfLedgerUnreadable('argus_seal', current);
      if (blind) return blind;
      guardTransition(current.state, 'seal'); // throws DECISION_CLOSED / ILLEGAL_TRANSITION

      // Resolve the horizon before anything validates or stores it, so every
      // downstream consumer (validation, ledger, receipt, calendar) sees one
      // canonical absolute date and never learns this second form exists.
      const checkByIn = resolveHorizon(a['check_by'], today) ?? a['check_by'];
      const vErr = validateSeal(a['predicate'], checkByIn, today);
      if (vErr) {
        return toolError({
          ok: false, tool: 'argus_seal', error_code: vErr.code, message: vErr.message, recovery: vErr.recovery,
          // The clauses ride in `data` because localize-result rewrites `recovery`
          // from a static per-locale map — the sentence pointing at them does not
          // survive the language switch, and `data` does (same lesson as the
          // reword hand-back below). Without them the model has to re-derive the
          // split it was just handed, which is how claims get dropped silently.
          ...(vErr.claims ? { data: { sealed: false, claims: vErr.claims } } : {}),
          // The clock rides as its own field for the same reason (journey KOC8,
          // measured). The English BAD_CHECK_BY message ends with "(today is
          // 2026-08-11)", but KO_ERRORS replaces the whole message with a
          // static Korean string — so a Korean caller was told the date was
          // wrong and never told what today is. It retried FOUR times, walking
          // forward a day at a time from its training year (2025-06-17 →
          // 06-18 → 06-24), and the journey ended with nothing recorded.
          // Localization must not be able to strip the one fact that makes the
          // refusal recoverable.
          ...(vErr.code === 'BAD_CHECK_BY' ? { today } : {}),
        });
      }

      let predicate = String(a['predicate']);
      let checkBy = String(checkByIn);
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
            data: { sealed: false, predicate, check_by: checkBy, retry_hint: 'you may call argus_predict again with predicate_owner:"user" ONLY if the user explicitly approved this exact sentence in chat — never otherwise (ownership transfers only on that explicit affirmation)' },
          });
        }
        const picked = asked.kind === 'accepted' ? asked.content : null;
        if (!picked) {
          // A decline — record nothing, say nothing more, and DO NOT re-ask. The
          // terse surface and `next_actions:['stop']` are deliberate: a "no"
          // deserves silence, and pushing after one is the over-fire violation.
          //
          // What is NOT deliberate, and was the real injury (2026-07-29): the
          // sentence the user had just written vanished with it. `data` carried
          // only `{sealed:false, choice:'declined'}`, so when the picker had in
          // fact never been drawn — a Codex approval policy answers `decline`
          // itself, showing nobody anything — the user watched their prediction
          // disappear and neither they nor the assistant could get it back.
          //
          // Whether the person declined or their host declined for them, there is
          // no reading under which discarding their words is right. So the draft
          // rides along, exactly as the no-answer branch above already does.
          //
          // This costs no inference. It does not guess who answered, does not
          // read the clock, and does not touch the protocol action — the three
          // things this codebase has now reverted twice, correctly. It only stops
          // throwing away work.
          return envelope({
            ok: true, tool: 'argus_seal',
            surface: locale === 'ko' ? '기록하지 않았습니다.' : 'Not recorded.',
            next_actions: ['stop'],
            data: {
              sealed: false, choice: 'declined', predicate, check_by: checkBy,
              retry_hint: 'the draft is preserved here; you may call argus_predict again with predicate_owner:"user" ONLY if the user explicitly approved this exact sentence in chat — never otherwise',
            },
          });
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
        // predicate_owner보다 뒤에 둘 것 — plugin-bridge-provenance.test.ts가
        // 이 파일의 첫 events.push부터 500자 창 안에서 predicate_owner를 검사한다.
        ...(typeof a['question'] === 'string' && a['question'] ? { question: a['question'] } : {}),
        ...(a['confidence'] === 'confident' || a['confidence'] === 'uncertain' || a['confidence'] === 'contested' ? { confidence: a['confidence'] } : {}),
      });

      // Promotion (plan v5 §5.4): the named unverified_assumption IS the first
      // premise — the premise set is canonical, the seal field is its input
      // alias. source='ai_surfaced' with ai_original preserved (the field is
      // model-fillable and the schema never requires the user's words — tagging
      // it user_stated would forge authorship; an amend transfers it honestly),
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
            source: 'ai_surfaced', ai_original: ua.trim(),
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
      // 방금 쓴 봉인이 원장에 반영된 뒤에 읽는다 — 이 봉인 자신은 sealed라
      // 목록에 들어오지 않는다.
      const stuck = startedNewRecord ? stuckDecisions(replayLedger(dir, today)) : [];
      const calNote = locale === 'ko' ? ' 달력 앱에 넣을 알림 파일도 함께 저장했습니다.' : ' A calendar reminder file is saved alongside it.';
      // The other half of the confirm_draft budget move (see the field above).
      // A confirmation was WANTED and this host cannot draw one, so the seal
      // proceeded with honest ai_surfaced provenance — the caller has to know
      // that, and this is the moment it matters. Only on that path: saying it
      // after a picker the user actually answered would be noise.
      const wantedConfirm = a['confirm_draft'] === true || a['predicate_owner'] === 'ai_surfaced';
      const confirmNote = wantedConfirm && !elicitedKeep && !canElicit()
        ? 'This host has no confirm dialog, so the prediction was saved as an unconfirmed AI draft (predicate_owner stays "ai_surfaced"). Confirm it in your own message; if the user gives you different words or a different date, call again with theirs.'
        : null;

      // ── 믿음 확인창 (입력 깊이 사이클 3) ─────────────────────────────────
      // 봉인 직후, 이 결정에 하중 믿음이 하나도 없을 때만 사용자에게 직접
      // 묻는다. §7.1의 두 번째 유형(답을 수집하는 픽커)이라 자유 텍스트 칸을
      // 두되, 스키마에는 어떤 제약도 선언하지 않는다(picker-no-required-field;
      // 길이는 서버가 검사하고 원문을 되돌려준다). 칸에 적힌 문장은 모델을
      // 거치지 않고 elicit 채널로 도착하므로 저자성이 구조로 확보된다
      // (user_stated + 원문이 곧 인용 + elicited 표식).
      //
      // 발화 규율(과발화 금지): 이 호출에서 이미 창이 떴으면(예측 확인,
      // elicitedKeep) 두 번째 창을 열지 않는다. 하중 가정이 이 호출로 승격
      // 됐거나(unverified_assumption) 이미 살아 있으면 묻지 않는다. 봉인은
      // 이미 원장에 있으므로 이 창의 어떤 결과도 봉인을 해치지 못한다.
      const hasLoadBearing = Boolean(promotedRef)
        || Boolean(ua && ua.trim())
        || Boolean(current.entry?.load_bearing_assumption)
        || (current.entry?.premises ?? []).some((p) => p.status === 'active' && p.load_bearing);
      let beliefWindow: Record<string, unknown> | null = null;
      let beliefLine = '';
      if (!elicitedKeep && !hasLoadBearing && !beliefWindowShownFor.has(dir) && canElicit()) {
        const asked = await elicitDetailed(
          locale === 'ko'
            ? `봉인됐습니다: "${sanitizeLine(predicate, 96)}"\n이 예측이 가장 크게 딛고 선 믿음 하나를 당신의 말로 남겨주세요.\n아래 칸에 적은 뒤 Accept까지 진행하세요.\n(지금 없으면 비워두고 Accept. 건너뛰어도 봉인은 그대로입니다.)`
            : `Sealed: "${sanitizeLine(predicate, 96)}"\nWhat is the one belief this bet rests on, in your words?\nType it below, then continue to Accept.\n(Leave it blank and Accept to skip. The seal stays either way.)`,
          {
            type: 'object',
            properties: {
              belief: {
                type: 'string',
                title: locale === 'ko' ? '딛고 선 믿음' : 'The belief underneath',
                description: locale === 'ko'
                  ? '이 예측이 기대는 가정 하나, 당신의 표현으로.'
                  : 'One assumption this bet rests on, your words.',
              },
            },
          },
        );
        // 세션 몫 소진: unsupported만 예외다 — 창이 아무에게도 닿지 않았다.
        // (거절·무응답·수락 전부, 사람이 창을 한 번 겪은 사실은 같다.)
        if (asked.kind !== 'unsupported') beliefWindowShownFor.add(dir);
        if (asked.kind === 'accepted') {
          const typed = typeof asked.content['belief'] === 'string' ? (asked.content['belief'] as string).trim() : '';
          if (typed && typed.length <= 400) {
            // 답한 시각으로 도장 (위 예측 확인창의 재도장과 같은 규칙) — 창이
            // 열려 있던 시간이 전제의 기록 시각을 거짓말하게 두지 않는다.
            const beliefNow = a['today_override'] ? now : logicalNow(now.slice(0, 10), false);
            // fail-soft: 봉인은 이미 원장에 있다. 여기서 어떤 예외가 나도
            // (잠금 경합·디스크) 성공한 봉인을 에러로 둔갑시키지 않는다 —
            // 타이핑한 문장은 되돌려주고 기록만 미룬다.
            let recorded: { ordinal: number } | null = null;
            let writeFailed = false;
            try {
              recorded = await withLedgerLock(dir, async () => {
                // 창이 열린 사이 다른 프로세스가 전제를 썼을 수 있다 — 잠금 안에서
                // 새로 fold해 중복·상한을 승격 기계와 같은 규칙으로 다시 지킨다.
                const fresh = resolveContract(dir, id, today);
                const prems = fresh.entry?.premises ?? [];
                const pid = premiseId(id, 'premise', typed);
                // 중복은 kind와 무관하게 문장으로 본다 — 분류기가 같은 문장을
                // claim으로 저장했어도 두 번 담지 않는다 (groupDuePremises와
                // 같은 정규화 규칙).
                if (prems.some((p) => normalizePremiseText(p.text) === normalizePremiseText(typed))) return null;
                if (prems.filter((p) => p.status === 'active').length >= MAX_ACTIVE_PREMISES) return null;
                const ordinal = prems.reduce((m, p) => Math.max(m, p.ordinal), 0) + 1;
                await appendLedger(dir, [{
                  id, event: 'premise_add', premise_id: pid, ordinal,
                  kind: 'premise', text: typed,
                  external: false,
                  load_bearing: prems.filter((p) => p.status === 'active' && p.load_bearing).length < MAX_LOAD_BEARING,
                  source: 'user_stated', anchor_quote: typed, elicited: true,
                }], beliefNow);
                return { ordinal };
              });
            } catch {
              writeFailed = true;
            }
            if (recorded) {
              beliefWindow = { recorded: true, ref: `P${recorded.ordinal}`, belief: typed };
              beliefLine = locale === 'ko'
                ? ` 딛고 선 믿음도 당신의 말 그대로 남았습니다 (P${recorded.ordinal}).`
                : ` The belief underneath is recorded in your words (P${recorded.ordinal}).`;
              // 방금 창으로 가정이 이름을 얻었다 — "가정을 이름 붙여라" 넛지는
              // 이 순간 목적을 다했으므로 겹쳐 내보내지 않는다.
              nudge = '';
            } else if (writeFailed) {
              beliefWindow = {
                recorded: false, reason: 'write_failed',
                user_input: { belief: typed },
                retry_hint: 'the seal itself is saved; record the belief via argus_capture action="add_context" with premises=[{text, source:"user_stated", anchor_quote: their exact words}]',
              };
            } else {
              beliefWindow = { recorded: false, reason: 'duplicate_or_cap', belief: typed };
            }
          } else if (typed) {
            // 사용자가 타이핑한 문장은 절대 잃지 않는다 (resolve·reword와 같은 규칙).
            beliefWindow = {
              recorded: false, reason: 'too_long',
              user_input: { belief: typed },
              retry_hint: 'trim data.belief_window.user_input.belief to <=400 chars with the user, then record it via argus_capture action="add_context" with premises=[{text, source:"user_stated", anchor_quote: their exact words}]',
            };
          } else {
            beliefWindow = { recorded: false, reason: 'left_blank' };
          }
        } else if (asked.kind === 'declined' || asked.kind === 'no_answer') {
          // 거절은 답이다: 조용히 존중하고 다시 묻지 않는다. 무응답도 봉인은
          // 그대로라 잃는 것이 없다 — 사실만 data에 남긴다.
          beliefWindow = { recorded: false, reason: asked.kind === 'declined' ? 'declined' : 'no_answer' };
        }
        // unsupported: 창이 아무에게도 닿지 않았다. 흔적도 남기지 않는다.
      }
      return envelope({
        ok: true, tool: 'argus_seal',
        surface: `${(a['predicate_owner'] === 'ai_surfaced' ? T.sealed_draft : T.sealed)(predicate, checkBy)}${calNote}${beliefLine}${nudge}${syncLine}`,
        next_actions: ['argus_check_in', 'stop'],
        data: {
          id, predicate, check_by: checkBy, predicate_owner: a['predicate_owner'],
          calendar_path: calendarPath,
          seal_text,
          status: 'sealed', ledger_events_written: events.map((e) => e.event),
          ...(confirmNote ? { confirm_note: confirmNote } : {}),
          // HAND BACK THE HANDLE (journey D1, measured). Sealing a NEW id while
          // the user's own framed decision sits unsealed is how one migration
          // became six ledger records with five orphans — the assistant
          // reconstructs an id from the topic instead of reusing the one it was
          // given a conversation ago, and it renames the scheme every time.
          //
          // Nothing is missing from the wiring: sealing onto that id works,
          // keeps the premises alive, and comes due on the check date (all
          // measured). Only the handle is missing. So this names it instead of
          // inventing a relation field — same repair as the check_by clock and
          // settle's saved_ids: the server knew, and did not say.
          //
          // Informational, never a refusal: the next claim may genuinely be its
          // own decision, and deciding that for the user is not ours to do.
          ...(startedNewRecord && stuck.length
            ? { unsealed_decisions: stuck, unsealed_note: 'These decisions carry the user\'s own premises but no prediction, so nothing will ever check them. If a claim belongs to one, call argus_predict again with THAT id instead of a new one — the premises stay attached and it comes due on its own date.' }
            : {}),
          v2_write: v2Write,
          skipped: receipt.skipped,
          account_synced: sync.synced,
          ...(sync.synced ? {} : { account_sync_reason: sync.reason }),
          // The named assumption now lives as a tracked premise (canonical set).
          // Marking it external (argus_premises op=amend) arms reality re-checks.
          ...(promotedRef ? { premise_promoted: promotedRef } : {}),
          // 믿음 확인창의 결과 사실 (recorded:true면 ref가 전제 번호). 값이
          // 없으면 창 자체가 발화하지 않은 것이다 (게이트 미충족 또는 미지원).
          ...(beliefWindow ? { belief_window: beliefWindow } : {}),
        },
      });
    } catch (e) {
      return handleToolException('argus_seal', e);
    }
  },
};
