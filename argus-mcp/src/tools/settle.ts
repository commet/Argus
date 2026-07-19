import { resolveToolArgusDir } from '../lib/argus-dir.js';
import { resolveToday, asDate } from '../lib/resolve-today.js';
import { resolveContract } from '../lib/resolve-contract.js';
import { guardTransition } from '../lib/state-machine.js';
import { appendLedger, withLedgerLock } from '../lib/ledger-append.js';
import { asV2WriteField } from '../v2/mirror.js';
import { writeSettleReceipt } from '../lib/receipt.js';
import { pushToAccount } from '../lib/push-account.js';
import { elicit, canElicit } from '../lib/elicit.js';
import { renderReceipt } from '../lib/render-receipt.js';
import { resolveResponseLocale, SURFACES, humanizeSyncReason, type SurfaceLocale } from '../lib/surfaces.js';
import { accountPushId } from '../lib/install-id.js';
import { resolvePremiseRef, receiptPremisesInfo } from '../lib/premises.js';
import { replayLedger } from '../lib/ledger-replay.js';
import { relatedOpenForPremise } from '../v2/connection-io.js';
import type { RelatedDecision } from '../v2/connection.js';
import { sanitizeLine } from '../v2/sanitize.js';
import { z } from 'zod';
import { envelope, toolError } from '../lib/envelope.js';
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
      guardTransition(current.state, 'settle'); // NO_PRIOR_SEAL / ALREADY_SETTLED / DECISION_CLOSED

      // Outcome is the user's — recorded, never inferred. If the model didn't
      // supply it, ask the USER directly with a structured choice (spine-safe:
      // this is reality, not a verdict). Falls back to requiring it on hosts
      // without elicitation.
      let outcome = a['outcome'] as 'held' | 'avoided' | 'partial' | 'still_pending' | 'missed' | undefined;
      if (!outcome && canElicit()) {
        // Localize the picker like every other elicitation (ambient-elicit does):
        // a bilingual "그렇게 됐다 (held)" mishmash showed to BOTH a Korean and an
        // English user. Voice follows the language the decision was sealed in.
        const pickerLocale = resolveResponseLocale(dir, current.predicate ?? null);
        const picked = await elicit(pickerLocale === 'ko' ? '현실이 어떻게 답했나요?' : 'What did reality do?', {
          type: 'object',
          properties: {
            outcome: {
              type: 'string',
              enum: ['held', 'avoided', 'partial', 'still_pending', 'missed'],
              enumNames: pickerLocale === 'ko'
                ? ['그렇게 됐다', '피했다', '부분적으로', '아직 불분명', '빗나갔다 (내 예측이 틀렸다)']
                : ['It held', 'Avoided', 'Partially', 'Still unclear', 'Missed — my read was wrong'],
              description: pickerLocale === 'ko' ? '봉인한 예측에 현실이 어떻게 답했는지 고르세요.' : 'What reality did to your sealed prediction.',
            },
          },
          required: ['outcome'],
        });
        const v = picked?.['outcome'];
        if (v === 'held' || v === 'avoided' || v === 'partial' || v === 'still_pending' || v === 'missed') outcome = v;
      }
      if (!outcome) {
        return toolError({
          ok: false, tool: 'argus_settle', error_code: 'OUTCOME_REQUIRED',
          message: 'Reality has to answer: held, avoided, partial, missed, or still_pending.',
          recovery: 'Ask the user what actually happened and pass it as `outcome` — never infer it.',
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
      const now = a['today_override']
        ? `${today}T12:00:00.000Z`
        : `${today}T${new Date().toISOString().slice(11)}`;

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
        return toolError({
          ok: false, tool: 'argus_settle', error_code: 'WHAT_HAPPENED_REQUIRED',
          message: 'Record what reality did to the prediction.',
          recovery: 'Ask the user what actually happened and pass it as `what_happened` — never infer it.',
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

      // Deferral history → a neutral fact on the receipt ("originally due X ·
      // deferred N×"). defer_history[0].from is the ORIGINAL check-by.
      const deferCount = current.entry?.defer_count ?? 0;
      const originallyDue = current.entry?.defer_history?.[0]?.from;
      // §9.4 두 기기 안전: the settle write is a read-check-append sequence —
      // re-guard UNDER the ledger lock so two concurrent sessions can't both
      // pass the check above and double-count the record (the loser sees
      // ALREADY_SETTLED, exactly as if it had arrived second sequentially).
      const { receipt, v2Mirror } = await withLedgerLock(dir, async () => {
        const fresh = resolveContract(dir, id, today);
        guardTransition(fresh.state, 'settle');
        const appended = await appendLedger(dir, [{ id, event: 'settle', outcome, decision: a['what_happened'] as string, ...(brokenPremiseId ? { broken_premise_id: brokenPremiseId } : {}) }], now);
        return { v2Mirror: appended.v2_mirror, receipt: await writeSettleReceipt(dir, id, {
          what_happened: String(a['what_happened']), outcome, settled_at: now,
          ...(deferCount > 0 ? { deferred_times: deferCount, ...(originallyDue ? { originally_due: originallyDue } : {}) } : {}),
        }, { predicate: current.predicate, check_by: current.check_by }) };
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
          connectionLine = locale === 'ko'
            ? `\n방금 깨진 전제("${q}")와 같은 가정이나 근거에 선 다른 열린 결정: ${shown.join(', ')}${extra > 0 ? ` 외 ${extra}개` : ''}. argus_check_in으로 함께 볼 수 있어요.`
            : `\nOther open decisions rest on the same assumption or fact as the one that just broke ("${q}"): ${shown.join(', ')}${extra > 0 ? ` (+${extra} more)` : ''}. Review them together with argus_check_in.`;
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
      const receiptText = renderReceipt(receipt, receiptPremisesInfo(current.entry), locale);
      const firstReceipt = replayLedger(dir, today).stats.total_settled === 1;

      return envelope({
        ok: true, tool: 'argus_settle',
        surface: T.settled(outcome as 'held' | 'avoided' | 'partial' | 'missed') + syncLine + connectionLine
          + (firstReceipt ? `\n\n${receiptText}` : ''),
        next_actions: ['argus_patterns', 'stop'],
        data: {
          id, outcome, outcome_source: 'user_stated',
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
    const picked = await elicit(
      locale === 'ko' ? '아직 답이 안 나왔군요. 언제 다시 볼까요?' : "Not answered yet. When should I look again?",
      { type: 'object', required: ['when'], properties: { when: {
        type: 'string', enum: ['week', 'month', 'quarter', 'dismiss'],
        enumNames: locale === 'ko'
          ? ['약 1주 뒤', '약 1달 뒤', '약 3달 뒤', '이제 상관없어 (접기)']
          : ['In about a week', 'In about a month', 'In about 3 months', 'It no longer matters (set aside)'],
        description: locale === 'ko' ? '언제 다시 확인할지 고르세요.' : 'When to check this again.',
      } } },
    );
    const when = picked?.['when'];
    if (when === 'dismiss') dismissChosen = true;
    else if (when === 'week') newDate = addDays(today, 7);
    else if (when === 'month') newDate = addDays(today, 30);
    else if (when === 'quarter') newDate = addDays(today, 90);
    // a declined/cancelled picker → newDate stays undefined → honest error below.
  }

  // The prediction no longer needs an answer — set aside, don't force a date.
  if (dismissChosen) {
    const mirrorDD = await withLedgerLock(dir, async () => {
      const fresh = resolveContract(dir, id, today);
      guardTransition(fresh.state, 'dismiss');
      return (await appendLedger(dir, [{ id, event: 'dismiss', dismiss_reason: 'no longer relevant (still_pending at check-by)' }], now)).v2_mirror;
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
      message: "Reality hasn't answered yet — this needs a new check-by, not a settlement.",
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
    data: { id, status: 'sealed', deferred_to: newDate, from_check_by: oldCheckBy, v2_write: v2Write, account_synced: sync.synced, ...(sync.synced ? {} : { account_sync_reason: sync.reason }) },
  });
}

function addDays(day: string, days: number): string {
  const t = Date.parse(day + 'T00:00:00Z');
  if (Number.isNaN(t)) return day;
  return new Date(t + days * 86400000).toISOString().slice(0, 10);
}
