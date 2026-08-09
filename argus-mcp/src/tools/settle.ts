import { resolveToolArgusDir } from '../lib/argus-dir.js';
import { resolveToday, asDate, logicalNow } from '../lib/resolve-today.js';
import { resolveContract } from '../lib/resolve-contract.js';
import { refuseIfLedgerUnreadable } from '../lib/ledger-readable.js';
import { guardTransition } from '../lib/state-machine.js';
import { appendLedger, withLedgerLock } from '../lib/ledger-append.js';
import { asV2WriteField } from '../v2/mirror.js';
import { writeSettleReceipt } from '../lib/receipt.js';
import { pushToAccount } from '../lib/push-account.js';
import { elicitDetailed, canElicit } from '../lib/elicit.js';
import { renderReceipt } from '../lib/render-receipt.js';
import { resolveResponseLocale, SURFACES, humanizeSyncReason, type SurfaceLocale } from '../lib/surfaces.js';
import { accountPushId } from '../lib/install-id.js';
import { resolvePremiseRef, receiptPremisesInfo } from '../lib/premises.js';
import { replayLedger } from '../lib/ledger-replay.js';
import { relatedOpenForPremise } from '../v2/connection-io.js';
import type { RelatedDecision } from '../v2/connection.js';
import { sanitizeLine } from '../v2/sanitize.js';
import { OUTCOME_VALUES, outcomeEnumNames, outcomeFieldDescription } from '../lib/outcome-labels.js';
import { z } from 'zod';
import { envelope, toolError } from '../lib/envelope.js';
import { noAnswerResult } from '../lib/picker-fallback.js';
import { appsCapable } from '../lib/apps-ui.js';
import { daysBetween } from '../lib/premises-core.js';
import { ENVELOPE_OUTPUT_SCHEMA, zArgusDir, zId, zDate, type ToolModule } from './tool-types.js';
import { handleToolException } from './errors.js';

const inputSchema = z.strictObject({
  argus_dir: zArgusDir,
  id: zId,
  outcome: z.enum(['held', 'avoided', 'partial', 'still_pending', 'missed']).describe("What reality did to the prediction — record the user's words, never infer. Definitions (held and avoided are counted separately, so pick the right one): held = the predicted thing actually happened; avoided = the predicted RISK did not occur (the bad thing you predicted was dodged); partial = it half-happened / mixed; missed = the saved prediction was simply wrong; still_pending = reality has not answered yet, so pass a future defer_to and it comes back. If omitted, Argus asks the user directly on hosts that support elicitation.").optional(),
  outcome_source: z.literal('user_stated').default('user_stated').describe('Always "user_stated" — an AI-inferred outcome cannot be expressed. Defaulted, so you may omit it.'),
  what_happened: z.string().min(1).max(600).optional().describe("What reality did, in the user's words. Required when recording held/avoided/partial/missed. Omit for still_pending and pass defer_to instead."),
  broken_premise_ref: z.string().max(64).optional().describe('Optional, USER-attributed: which tracked premise (ordinal like "P1"), if any, broke and drove the outcome. Never inferred by the model — ask, or omit.'),
  defer_to: zDate.optional().describe("Only with outcome='still_pending': the new check-by (YYYY-MM-DD, a real future date) — when to look again, taken from the horizon the user names (\"the data lands next Friday\"). The decision stays alive and comes due again then. Omit only if the user has not said when; on elicitation hosts Argus will ask."),
  today_override: zDate.optional(),
});

export const settle: ToolModule = {
  name: 'argus_settle',
  description:
    'Settle a sealed decision against reality and issue a Judgment Receipt with zero AI verdict. Hard-errors if there is no prior seal. The outcome is the user\'s — recorded, never inferred. On the ledger\'s FIRST completed settle, `surface` contains the full then-vs-now receipt — show it verbatim; it is the user\'s first payoff. Later settles return the short line and keep the receipt in data.receipt_text.',
  inputSchema,
  outputSchema: ENVELOPE_OUTPUT_SCHEMA,
  // openWorldHint: true — with ARGUS_TOKEN set, settling also mirrors to the account.
  // idempotentHint:false (11 S7) — a repeat settle is NOT a no-op: it hard-errors
  // ALREADY_SETTLED (append-only ledger), so the hint was a false signal to hosts.
  annotations: { title: 'Settle against reality', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  handler: async (a) => {
    try {
      const dir = resolveToolArgusDir(a['argus_dir']);
      const id = String(a['id'] ?? '');
      const today = resolveToday({ override: a['today_override'] as string | undefined });

      const current = resolveContract(dir, id, today);
      const blind = refuseIfLedgerUnreadable('argus_settle', current);
      if (blind) return blind;
      guardTransition(current.state, 'settle'); // NO_PRIOR_SEAL / ALREADY_SETTLED / DECISION_CLOSED

      // Outcome is the user's — recorded, never inferred. If the model didn't
      // supply it, ask the USER directly with a structured choice (spine-safe:
      // this is reality, not a verdict). Falls back to requiring it on hosts
      // without elicitation.
      let outcome = a['outcome'] as 'held' | 'avoided' | 'partial' | 'still_pending' | 'missed' | undefined;
      // MCP Apps host (SEP-1865): the settle CARD is already rendering beside
      // this call. Return the awaiting state with everything the card needs;
      // the user's click comes back as a second argus_resolve WITH outcome.
      // Both doors stay open — the surface tells the model the user may just
      // answer in chat instead (a card is an offer, never a gate).
      if (!outcome && appsCapable()) {
        const cardLocale = resolveResponseLocale(dir, current.predicate ?? null);
        const daysOver = current.check_by && current.check_by < today ? daysBetween(current.check_by, today) : 0;
        return envelope({
          ok: true, tool: 'argus_settle',
          surface: cardLocale === 'ko'
            ? '정산 카드를 옆에 띄웠습니다. 카드에서 고르셔도 되고, 어떻게 됐는지 말로 알려주셔도 됩니다.'
            : 'The settle card is up. Pick on the card, or just say what happened.',
          next_actions: ['stop'],
          data: {
            status: 'awaiting_picker', id, predicate: current.predicate ?? id,
            check_by: current.check_by ?? null, days_overdue: daysOver, locale: cardLocale,
            // The card's click comes back as a fresh tools/call, and it must
            // address THIS ledger. Sending the dir with the state the card
            // renders means the two can never disagree; relying on the optional
            // ui/notifications/tool-input meant a host that skips it silently
            // routed the click to ~/.argus (audit 2026-07-28).
            argus_dir: dir,
          },
        });
      }
      if (!outcome && canElicit()) {
        // Localize the picker like every other elicitation (ambient-elicit does):
        // a bilingual "그렇게 됐다 (held)" mishmash showed to BOTH a Korean and an
        // English user. Voice follows the language the decision was sealed in.
        const pickerLocale = resolveResponseLocale(dir, current.predicate ?? null);
        // SHOW WHICH PREDICTION (2026-07-28, found by dumping what a host
        // actually renders). This ask used to open with a bare "현실이 어떻게
        // 답했나요?" — no predicate, no date. The seal picker quotes the
        // sentence; the settle picker did not, and settling is the moment a
        // user with several open bets most needs to know which one is on
        // screen. The old tail was also wrong: it sent "아직 모르겠으면
        // Decline", but Decline records nothing and asks again, while the
        // enum's still_pending properly moves the date. It pointed away from
        // the handle that works.
        const q = sanitizeLine(current.predicate ?? id, 96);
        const due = current.check_by ?? '';
        // Is this field genuinely optional right now? Only if the model already
        // carried what-happened in from the conversation. Found on real
        // hardware 2026-07-28: the label said "(optional)" and "leave blank if
        // you do not know yet" unconditionally, so a user who picked an outcome
        // and left it blank — exactly what the screen invited — was refused
        // afterwards with WHAT_HAPPENED_REQUIRED. The form must not promise
        // what the server will not honour.
        const haveWhat = typeof a['what_happened'] === 'string' && (a['what_happened'] as string).trim().length > 0;
        const asked = await elicitDetailed(pickerLocale === 'ko'
          // Say what is TRUE ON EVERY HOST: choosing is not yet saving, and the
          // answer lands at Accept. The previous wording spelled out Claude
          // Code's keyboard — "→ 키로 고른 뒤, 아래 화살표로 수락 줄까지" — which
          // a Codex user reading a rendered form (verified on a real app-server,
          // 2026-07-29) is being told to press keys that are not there, and a
          // desktop user with a mouse likewise. The load-bearing fact is not the
          // keystroke, it is that a selection alone does not record anything.
          ? `"${q}"${due ? ` (확인일 ${due})` : ''}\n\n현실이 어떻게 답했나요? 하나 고른 뒤 Accept까지 진행하면 기록됩니다.\n아직 결과가 안 나왔으면 "아직 모르겠다"를 고르세요. 지금 답하기 어려우면 Decline.`
          : `"${q}"${due ? ` (check-by ${due})` : ''}\n\nWhat did reality do? Pick one, then continue to Accept to record it.\nNo answer yet? Choose "Don't know yet". Bad moment? Decline.`, {
          type: 'object',
          properties: {
            outcome: {
              type: 'string',
              enum: [...OUTCOME_VALUES],
              enumNames: outcomeEnumNames(pickerLocale),
              title: pickerLocale === 'ko' ? '현실이 어떻게 답했나' : 'What reality did',
              description: outcomeFieldDescription(pickerLocale),
            },
            // Capture what-happened in the SAME picker so a settle that reached
            // the picker doesn't dead-end on WHAT_HAPPENED_REQUIRED after the user
            // already answered. Optional: if the model already passed what_happened
            // from the conversation, the user can leave this blank. What the user
            // types here is THEIR words (spine-safe — never model-inferred).
            what_happened: {
              type: 'string',
              title: pickerLocale === 'ko'
                ? (haveWhat ? '실제로 무슨 일이 있었나 (선택)' : '실제로 무슨 일이 있었나')
                : (haveWhat ? 'What actually happened (optional)' : 'What actually happened'),
              // No `minLength` even when it is needed — a constraint here blocks
              // Accept inside the form, which is the defect this file already
              // carries a comment about. The honest thing is to SAY it is needed
              // and let the server refuse with the user's pick handed back.
              // No newline in a DESCRIPTION. The `message` is a block the host
              // lays out; a field description is a hint rendered beside or under
              // one input, and hosts treat a `\n` there inconsistently — some
              // collapse it, some print it literally. Seen while reading the
              // real Codex wire, 2026-07-29: the second sentence fell outside
              // the field's own indentation. Two sentences, one line.
              description: pickerLocale === 'ko'
                ? (haveWhat
                  ? '무슨 일이 있었는지 당신의 말로 한 줄. 비우면 앞서 말씀하신 내용을 그대로 씁니다.'
                  : '무슨 일이 있었는지 당신의 말로 한 줄. 결과를 남기려면 이 줄이 필요합니다. 아직 모르겠으면 위에서 "아직 모르겠다"를 고르세요.')
                : (haveWhat
                  ? 'One line on what actually happened, in your words. Leave blank to keep what you already said.'
                  : 'One line, in your words. A settled record needs it. Not sure yet? Choose "Don\'t know yet" above.'),
            },
          },
          // 필수 필드 없음 (2026-07-27, 창업자 도그푸딩 스크린샷).
          //
          // R34가 봉인/전제 픽커에서 걷어낸 바로 그 패턴이 정산 픽커엔
          // 그대로 남아 있었다. 필수 enum은 호스트에서 접힌 채 뜨고
          // (`→ to expand`), 사용자가 what_happened만 적고 Accept하면 폼
          // 안에서 빨간 "This field is required"로 막힌다 — 우리가 서버에서
          // 없앤 막다름이 클라이언트로 자리만 옮긴 것이다. 하필 정산은
          // 귀환 경로, 이 제품의 두 번째 인상 한복판이다.
          //
          // 비운 채 Accept해도 잃는 게 없다: 아래 `if (!outcome)`가 이미
          // OUTCOME_REQUIRED로 정직하게 되묻고 모델이 대화로 물어본다.
          // 폼 안에서 빨간 글씨로 막느니 한 번 더 묻는 쪽이 낫다.
          // 스파인 무접촉 — 비었다고 결과를 추론하지 않는다.
        });
        // A NO and a NON-ANSWER are different facts (audit 2026-07-27). This is
        // the return path — the user came back to close a bet and may have typed
        // what happened into the form. Falling through to OUTCOME_REQUIRED would
        // tell the model "the user didn't answer" about a user who did, and the
        // user would see a red error for a wire THEY did not break.
        if (asked.kind === 'no_answer') {
          return noAnswerResult({
            tool: 'argus_settle', ko: pickerLocale === 'ko',
            handBack: {
              ko: `어떻게 됐는지 한 줄로 말씀해주시면 그대로 기록합니다: "${sanitizeLine(current.predicate ?? id, 90)}" (확인일 ${current.check_by ?? '미상'}).`,
              en: `Say in one line what happened and I'll record exactly that: "${sanitizeLine(current.predicate ?? id, 90)}" (check-by ${current.check_by ?? 'unknown'}).`,
            },
            next_actions: ['argus_resolve', 'stop'],
            data: { id, predicate: current.predicate ?? id, check_by: current.check_by ?? null, retry_hint: 'ask the user what happened in chat, then call argus_resolve again with outcome + what_happened' },
          });
        }
        const picked = asked.kind === 'accepted' ? asked.content : null;
        const v = picked?.['outcome'];
        if (v === 'held' || v === 'avoided' || v === 'partial' || v === 'still_pending' || v === 'missed') outcome = v;
        // If the model didn't already supply what_happened, take the user's
        // picker text (their own words) so the settle completes in one round.
        //
        // The picker path enters AFTER zod ran (server.ts validates on entry),
        // so the schema's .max(600) never sees this value — without the cap
        // below, a pasted essay lands uncapped in the append-only ledger and
        // every future replay carries it (2026-08-09 audit; seal.ts guards its
        // reword picker the same way, and sync.ts caps account imports at 4000
        // for the same reason).
        const pickedWhat = typeof picked?.['what_happened'] === 'string' ? (picked['what_happened'] as string).trim() : '';
        if (pickedWhat.length > 600) {
          return toolError({
            ok: false, tool: 'argus_settle', error_code: 'SETTLE_INVALID',
            message: 'What happened is too long for the record (max 600 chars).',
            recovery: 'data.user_input.what_happened below is what the user just typed. Do not make them retype it: offer it back trimmed to the load-bearing part, confirm, then call again with outcome + what_happened.',
            data: { id, user_input: { what_happened: pickedWhat }, retry_hint: 'trim data.user_input.what_happened to <=600 chars with the user, then call argus_resolve again' },
          });
        }
        if (pickedWhat && !(typeof a['what_happened'] === 'string' && (a['what_happened'] as string).trim())) {
          a = { ...a, what_happened: pickedWhat };
        }
      }
      if (!outcome) {
        // The user may have typed what happened into the picker and left the
        // outcome enum blank (the enum is deliberately not `required`, because
        // a required enum blocks Accept). Their sentence is in our hands right
        // now; dropping it here would make them write it twice. Hand it back so
        // the model can read it out and ask only for the one missing pick.
        const typed = typeof a['what_happened'] === 'string' ? (a['what_happened'] as string).trim() : '';
        return toolError({
          ok: false, tool: 'argus_settle', error_code: 'OUTCOME_REQUIRED',
          message: 'Reality has to answer: held, avoided, partial, missed, or still_pending.',
          recovery: typed
            ? 'The user already told us what happened (data.user_input.what_happened). Do not ask them to repeat it: read it back, ask only which outcome it was, and call again passing BOTH.'
            : 'Ask the user what actually happened and pass it as `outcome` — never infer it.',
          // `recovery` is rewritten per-locale by localize-result (KO_ERRORS
          // replaces English-authored copy wholesale), so the instruction that
          // matters cannot live only there — a Korean session would lose it and
          // the model would ask the user to type their sentence a second time.
          // `data` is never localized; this is the channel that survives.
          data: {
            id,
            ...(typed ? {
              user_input: { what_happened: typed },
              retry_hint: 'the user already typed data.user_input.what_happened — read it back to them, ask only which outcome it was, and call again with both. Never make them write it twice.',
            } : {}),
          },
        });
      }
      const checkBy = asDate(current.check_by);

      // Response voice follows what-happened (M4): config > text > env.
      const locale = resolveResponseLocale(dir, a['what_happened'] as string | undefined);
      const T = SURFACES[locale].tools.settle;

      // The DATE part of `now` must equal the tz-aware logical `today`, else a
      // Korea (UTC+9) user settling at 08:00 KST gets a receipt dated yesterday
      // (raw UTC). Keep the real UTC time-of-day for ordering; stamp the logical
      // date. (Same fix as seal.ts; recheck.ts fixed it for premise cadences.)
      const now = logicalNow(today, !!a['today_override']);

      // still_pending = reality has NOT answered yet. This is NOT a settlement —
      // filing it as `settled` (terminal) silently closed the loop and dropped
      // the decision off check_in forever, while the surface lied "what actually
      // happened". Instead: DEFER — re-arm with a new check-by so it comes back.
      if (outcome === 'still_pending') {
        // 조기 defer 허용은 상태기계의 defer-lives-in-due 설계(goalpost 방지)와
        // 충돌한다 — 1.4.x에서 스파인 검토 후에만. 지금은 문구가 정직하게:
        // 확인일이 되면 still_pending+defer_to로 연기할 수 있다고 안내한다.
        if (checkBy && checkBy > today) {
          return toolError({
            ok: false, tool: 'argus_settle', error_code: 'PREMATURE_SETTLE',
            message: `Not due yet (check-by ${checkBy}, today ${today}).`,
            recovery: `Nothing to record before the check-by date. On ${checkBy}, if reality still has no answer, call again with outcome="still_pending" and defer_to to pick a new date.`,
          });
        }
        return await deferStillPending({ dir, id, today, now, locale, T, current, whatHappened: a['what_happened'] as string | undefined, deferTo: a['defer_to'] as string | undefined });
      }

      // A real settlement records what reality did — required for a terminal
      // outcome (still_pending returned above, where it is genuinely optional).
      if (!(typeof a['what_happened'] === 'string' && a['what_happened'].trim())) {
        // Hand back the outcome they just chose. Found on real hardware
        // 2026-07-28: picking "It held" and leaving the sentence blank refused
        // with nothing in `data`, so the model asked them to pick the outcome
        // AGAIN — the same make-them-do-it-twice class as the reword hand-back.
        // Their pick is in our hands at this moment; keep it.
        return toolError({
          ok: false, tool: 'argus_settle', error_code: 'WHAT_HAPPENED_REQUIRED',
          message: 'Record what reality did to the prediction.',
          recovery: outcome
            ? 'The user already picked the outcome (data.user_input.outcome). Do not ask for it again: ask only what actually happened, in their words, and call again passing BOTH.'
            : 'Ask the user what actually happened and pass it as `what_happened` — never infer it.',
          data: {
            id,
            ...(outcome ? {
              user_input: { outcome },
              retry_hint: 'the user already chose data.user_input.outcome — ask only for what happened and call again with both. Never make them choose twice.',
            } : {}),
          },
        });
      }

      // Premise-level attribution (plan v5 P2) — the user's own read of WHICH
      // premise broke. Counts feed track_record frequency statements; never a
      // grade. An invalid ref fails loudly rather than mis-attributing.
      let brokenPremiseId: string | undefined;
      let brokenPremiseRef: string | undefined;
      let brokenPremiseText: string | undefined;
      const bpr = a['broken_premise_ref'];
      if (typeof bpr === 'string' && bpr.trim()) {
        const p = resolvePremiseRef(current.entry?.premises ?? [], bpr); // throws NO_SUCH_PREMISE/AMBIGUOUS_REF
        brokenPremiseId = p.premise_id;
        brokenPremiseRef = `P${p.ordinal}`;
        brokenPremiseText = p.text;
      }

      // §9.4 두 기기 안전: the settle write is a read-check-append sequence —
      // re-guard UNDER the ledger lock so two concurrent sessions can't both
      // pass the check above and double-count the record (the loser sees
      // ALREADY_SETTLED, exactly as if it had arrived second sequentially).
      // Everything the receipt records is read from THIS under-lock snapshot
      // (`fresh`), never the pre-lock `current`: a concurrent amend that moved
      // the predicate/check_by between the two reads would otherwise settle the
      // NEW contract yet print the OLD prediction on the keepsake — a receipt
      // that silently disagrees with the ledger (split-brain).
      let fresh!: ReturnType<typeof resolveContract>;
      const { receipt, v2Mirror } = await withLedgerLock(dir, async () => {
        fresh = resolveContract(dir, id, today);
        guardTransition(fresh.state, 'settle');
        // Deferral history → a neutral fact on the receipt ("originally due X ·
        // deferred N×"). defer_history[0].from is the ORIGINAL check-by. Read
        // from `fresh` so a concurrent defer is reflected on the receipt too.
        const deferCount = fresh.entry?.defer_count ?? 0;
        const originallyDue = fresh.entry?.defer_history?.[0]?.from;
        const appended = await appendLedger(dir, [{ id, event: 'settle', outcome, decision: a['what_happened'] as string, ...(brokenPremiseId ? { broken_premise_id: brokenPremiseId } : {}) }], now);
        return { v2Mirror: appended.v2_mirror, receipt: await writeSettleReceipt(dir, id, {
          what_happened: String(a['what_happened']), outcome, settled_at: now,
          ...(deferCount > 0 ? { deferred_times: deferCount, ...(originallyDue ? { originally_due: originallyDue } : {}) } : {}),
        }, { predicate: fresh.predicate, check_by: fresh.check_by }) };
      });
      const v2Write = asV2WriteField(v2Mirror);

      // 연결 읽기 (정본 §8-§11): 사용자가 어느 전제가 깨졌다고 짚으면, 같은 전제
      // 위에 선 다른 열린 결정을 중립 사실 + 손잡이로 노출한다. best-effort — v2
      // 원장이 없거나 읽기가 실패해도 정산은 그대로 성공한다. 평결 없음: 어느
      // 결정이 같은 가정에 기대는지(사실)와 argus_check_in(손잡이)뿐.
      let connectionLine = '';
      let connections: RelatedDecision[] = [];
      if (brokenPremiseId && brokenPremiseText && brokenPremiseText.trim()) {
        connections = relatedOpenForPremise(dir, today, brokenPremiseText, id);
        if (connections.length > 0) {
          const shown = connections.slice(0, 3).map((c) => c.decision_id);
          const extra = connections.length - shown.length;
          const q = sanitizeLine(brokenPremiseText, 80);
          // "깨진"은 평결 어휘다 (mirror 규칙 — 웹 알림 메일은 같은 단어를 기계
          // 테스트로 금지한다). 움직임은 사실, 깨짐은 판정 — 판정은 사용자 몫.
          connectionLine = locale === 'ko'
            ? `\n방금 움직인 전제("${q}")와 같은 가정이나 근거에 선 다른 열린 결정: ${shown.join(', ')}${extra > 0 ? ` 외 ${extra}개` : ''}. argus_check_in으로 함께 볼 수 있습니다.`
            : `\nOther open decisions rest on the same assumption or fact as the one that just moved ("${q}"): ${shown.join(', ')}${extra > 0 ? ` (+${extra} more)` : ''}. Review them together with argus_check_in.`;
        }
      }

      // Mirror the outcome to the account (opt-in) so a synced prediction stops
      // being "due" — otherwise the Companion Brief would keep re-nudging it.
      // No-op when there's no token or the id was never synced.
      const sync = await pushToAccount({
        action: 'settle', id: accountPushId(dir, id), outcome, what_happened: String(a['what_happened']), settled_at: now,
      });
      // 3-state sync voice (11 S3, same pattern as seal): silence is only honest
      // for the no-token default — a failed mirror means the account keeps
      // listing this as due (and may re-email it), so say so.
      const syncLine = sync.synced
        ? ''
        : sync.reason === 'no_token'
          ? ''
          : T.sync_failed(humanizeSyncReason(String(sync.reason), locale));

      // §9.7 O1 방3 — the FIRST settled receipt is the product's payoff moment
      // (review P1-3: "then vs now, one screen, before any statistics").
      // envelope() serializes the whole payload as JSON into the text content,
      // so on hosts that surface only text the receipt sat inside an escaped
      // string and reached the user only if the model chose to relay it —
      // prose-dependent delivery of the one moment the product exists for.
      // Structural fix: when this settle is the ledger's first completed one,
      // the receipt IS the surface, shown verbatim. Later settles keep the
      // light one-line confirmation (re-printing the plate every time would be
      // ceremony); the receipt stays available in data.receipt_text and the
      // argus://receipts/{id} resource.
      const receiptText = renderReceipt(receipt, receiptPremisesInfo(fresh.entry), locale);
      const firstReceipt = replayLedger(dir, today).stats.total_settled === 1;
      // On the FIRST settle the full receipt below already names the prediction;
      // on later settles only the one-liner shows, so echo the predicate there —
      // else a wrong-id or fabricated settle reads as a bare "Result recorded:
      // held" the user can't catch (LLM-glue: keep the semantic pick visible).
      const echoPred = firstReceipt ? '' : sanitizeLine(fresh.predicate ?? '', 90);

      return envelope({
        ok: true, tool: 'argus_settle',
        surface: T.settled(outcome as 'held' | 'avoided' | 'partial' | 'missed', echoPred) + syncLine + connectionLine
          + (firstReceipt ? `\n\n${receiptText}` : ''),
        next_actions: ['argus_patterns', 'stop'],
        data: {
          id, outcome, outcome_source: 'user_stated',
          // For the MCP Apps settle card's done-view (echoes the user's OWN
          // words back; never model content) + its locale.
          what_happened_echo: a['what_happened'], locale,
          v2_write: v2Write,
          assumption_held: receipt.assumption_held,
          ...(brokenPremiseRef ? { broken_premise: brokenPremiseRef, broken_premise_source: 'user_stated' } : {}),
          ...(connections.length > 0 ? {
            connections: connections.map((c) => c.decision_id),
            connection_reasons: connections.map((c) => ({ id: c.decision_id, reason: c.reason, ...(c.via ? { via: c.via } : {}) })),
          } : {}),
          ai_verdict: null,
          account_synced: sync.synced,
          ...(sync.synced ? {} : { account_sync_reason: sync.reason }),
          ...(firstReceipt ? { first_receipt: true } : {}),
          receipt,
          // The premise set is canonical — the receipt's summary renders from the fold (plan v5 §3.3).
          receipt_text: receiptText,
        },
      });
    } catch (e) {
      return handleToolException('argus_settle', e);
    }
  },
};

type SettleSurface = (typeof SURFACES)['en']['tools']['settle'];

/**
 * still_pending → DEFER (re-arm), never a terminal settle. Reality has not
 * answered at the check-by, so filing a receipt would be a lie and would drop
 * the decision off check_in forever. Instead we move the check_by forward and
 * keep the contract `sealed` (alive), so it comes due again.
 *
 * The new date comes from what the user said (deferTo, captured by the model);
 * failing that we ASK — coarse buckets plus a dismiss escape for a prediction
 * that no longer matters — and failing that (no picker) we return an honest
 * error telling the model to ask, rather than guess a date or terminal-settle.
 *
 * Spine-safe: this is scheduling, not a verdict. The outcome stays genuinely
 * unknown; the deferral is recorded so the eventual receipt states it as a fact.
 */
async function deferStillPending(args: {
  dir: string; id: string; today: string; now: string; locale: SurfaceLocale;
  T: SettleSurface;
  current: { check_by?: string; predicate?: string };
  whatHappened?: string;
  deferTo?: string;
}) {
  const { dir, id, today, now, locale, T, current, whatHappened, deferTo } = args;
  const oldCheckBy = current.check_by ?? today;

  // 1) the date from the conversation (model captured the horizon) wins.
  let newDate: string | undefined;
  const provided = asDate(deferTo);
  if (provided && provided > today) newDate = provided;

  // 2) else ASK — coarse buckets + a dismiss escape (a prediction that no longer
  //    matters should not be forced into a fake future date).
  let dismissChosen = false;
  if (!newDate && canElicit()) {
    // WHICH prediction, again (2026-07-28). This ask opened with a bare "아직
    // 답이 안 나왔군요" — the user is choosing a date for a sentence the screen
    // never shows. The settle picker had the same hole; this one kept it.
    const dq = sanitizeLine(current.predicate ?? id, 96);
    const asked = await elicitDetailed(
      locale === 'ko'
        ? `"${dq}"\n\n아직 답이 나오지 않았습니다. 언제 다시 볼까요?\n하나 고른 뒤 Accept까지 진행하세요. 지금 정하기 어려우면 Decline (확인일은 ${oldCheckBy} 그대로).`
        : `"${dq}"\n\nNot answered yet. When should I look again?\nPick one, then continue to Accept. Decline to leave it (check-by stays ${oldCheckBy}).`,
      // 필수 필드 없음 — 같은 이유. 빈 채 Accept는 Decline과 같은 길로
      // 흐르고(newDate undefined → 아래 정직한 에러), 폼 안에서 막지 않는다.
      { type: 'object', properties: { when: {
        type: 'string', enum: ['week', 'month', 'quarter', 'dismiss'],
        title: locale === 'ko' ? '언제 다시 볼까요' : 'When to look again',
        // The fourth option is NOT a date — it closes the decision for good, and
        // it sat in the list looking like a fourth scheduling choice with no
        // sign that it is terminal (2026-07-28). Say what it does.
        enumNames: locale === 'ko'
          ? ['약 1주 뒤에 다시', '약 1달 뒤에 다시', '약 3달 뒤에 다시', '이 결정은 이제 접습니다 (되돌릴 수 없음)']
          : ['Again in about a week', 'Again in about a month', 'Again in about 3 months', 'Close this decision for good (cannot be undone)'],
        description: locale === 'ko'
          ? '앞의 셋은 확인일만 옮깁니다. 마지막 하나는 이 결정을 영구히 닫습니다.'
          : 'The first three only move the check-by date. The last one closes the decision permanently.',
      } } },
    );
    // The window never answered (host trouble) — say so, and do NOT dress it up
    // as the honest DEFER_DATE_REQUIRED refusal below, which reads as "the user
    // wouldn't pick" about a user who never got the chance.
    if (asked.kind === 'no_answer') {
      return noAnswerResult({
        tool: 'argus_settle', ko: locale === 'ko',
        handBack: {
          ko: `언제 다시 볼지 한마디만 해주세요 (예: "다음 주"). 그 전까지 확인일은 ${oldCheckBy} 그대로입니다.`,
          en: `Just say when to look again (e.g. "next week"). Until then the check-by stays ${oldCheckBy}.`,
        },
        next_actions: ['argus_resolve', 'stop'],
        data: { id, deferred: false, check_by: oldCheckBy, retry_hint: 'ask the user when to look again, then call argus_resolve with outcome="still_pending" and defer_to' },
      });
    }
    const picked = asked.kind === 'accepted' ? asked.content : null;
    const when = picked?.['when'];
    if (when === 'dismiss') dismissChosen = true;
    else if (when === 'week') newDate = addDays(today, 7);
    else if (when === 'month') newDate = addDays(today, 30);
    else if (when === 'quarter') newDate = addDays(today, 90);
    // a declined picker → newDate stays undefined → honest error below.
  }

  // The prediction no longer needs an answer — set aside, don't force a date.
  if (dismissChosen) {
    const mirrorDD = await withLedgerLock(dir, async () => {
      const fresh = resolveContract(dir, id, today);
      guardTransition(fresh.state, 'dismiss');
      // Canonical enum value, not free text — recall/patterns expose
      // dismiss_reason raw, so a prose reason leaked English into ko sessions
      // and diverged from every advertised enum. The mechanism note rides in
      // `decision` (the dismiss event's note field), same as argus_dismiss.
      return (await appendLedger(dir, [{ id, event: 'dismiss', dismiss_reason: 'became_irrelevant', decision: 'still_pending at check-by' }], now)).v2_mirror;
    });
    const v2Write = asV2WriteField(mirrorDD);
    // Tell the account too — a dismissal via this picker is a real dismissal.
    // Without it a synced item stays sealed with its old check-by and the
    // Companion Brief keeps emailing a decision the user set aside (same gap
    // argus_dismiss had). archived, never settled: reality said nothing.
    const sync = await pushToAccount({ action: 'dismiss', id: accountPushId(dir, id) });
    const syncLine = sync.synced || sync.reason === 'no_token' ? '' : T.sync_failed(humanizeSyncReason(String(sync.reason), locale));
    return envelope({ ok: true, tool: 'argus_settle', surface: T.defer_dismissed + syncLine, next_actions: ['argus_patterns', 'stop'], data: { id, status: 'dismissed', v2_write: v2Write, account_synced: sync.synced, ...(sync.synced ? {} : { account_sync_reason: sync.reason }) } });
  }

  // No date and no picker → do NOT guess, and NEVER terminal-settle. Ask.
  if (!newDate) {
    return toolError({
      ok: false, tool: 'argus_settle', error_code: 'DEFER_DATE_REQUIRED',
      message: "Reality hasn't answered yet. This needs a new check-by, not a settlement.",
      recovery: 'Ask the user when to look again and pass it as `defer_to` (YYYY-MM-DD). If the prediction no longer matters, close it with argus_capture action="close".',
    });
  }

  // Re-arm: a `defer` event moves check_by forward; the contract stays sealed.
  // Re-guard under the ledger lock (§9.4 두 기기 안전) exactly like settle.
  const mirrorDefer = await withLedgerLock(dir, async () => {
    const fresh = resolveContract(dir, id, today);
    guardTransition(fresh.state, 'defer'); // due → defer OK; terminal states refuse
    return (await appendLedger(dir, [{ id, event: 'defer', from: oldCheckBy, check_by: newDate, ...(whatHappened && whatHappened.trim() ? { note: whatHappened } : {}) }], now)).v2_mirror;
  });
  const v2Write = asV2WriteField(mirrorDefer);

  // Mirror the NEW check-by to the account (opt-in) so the Companion Brief nudges
  // at the right time, not the stale one. A dedicated `defer` action, NOT a seal
  // re-push: the seal endpoint upserts a freshly built receipt over the row's
  // data, which would wipe premises or edits the user made on the web.
  // No token ⇒ silent no-op; a failure never undoes the local defer.
  const sync = await pushToAccount({
    action: 'defer', id: accountPushId(dir, id), check_by: newDate,
    ...(whatHappened && whatHappened.trim() ? { what_happened: whatHappened } : {}),
  });
  const syncLine = sync.synced || sync.reason === 'no_token' ? '' : T.sync_failed(humanizeSyncReason(String(sync.reason), locale));

  return envelope({
    ok: true, tool: 'argus_settle',
    surface: T.deferred(newDate) + syncLine,
    next_actions: ['argus_check_in', 'stop'],
    data: { id, status: 'sealed', deferred_to: newDate, from_check_by: oldCheckBy, locale, v2_write: v2Write, account_synced: sync.synced, ...(sync.synced ? {} : { account_sync_reason: sync.reason }) },
  });
}

function addDays(day: string, days: number): string {
  const t = Date.parse(day + 'T00:00:00Z');
  if (Number.isNaN(t)) return day;
  return new Date(t + days * 86400000).toISOString().slice(0, 10);
}
