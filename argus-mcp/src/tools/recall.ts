import { resolveToolArgusDir } from '../lib/argus-dir.js';
import { resolveToday } from '../lib/resolve-today.js';
import { replayLedger } from '../lib/ledger-replay.js';
import { resolveContract } from '../lib/resolve-contract.js';
import { readReceipt } from '../lib/receipt.js';
import { renderReceipt, renderWake, type WakeContractRow } from '../lib/render-receipt.js';
import { surfaceLocale, resolveResponseLocale, type SurfaceLocale } from '../lib/surfaces.js';
import { ledgerVoiceText } from '../lib/ambient-due.js';
import type { LedgerState } from '../lib/ledger-replay.js';
import { isMonitored, isDueForRecheck, receiptPremisesInfo, recheckCadenceDays, nextRecheckDue, isReconsiderable, isDueForReconsider, reponderCadenceDays, nextReponderDue, isNudgeArmed } from '../lib/premises.js';
import { z } from 'zod';
import { envelope, toolError } from '../lib/envelope.js';
import { ENVELOPE_OUTPUT_SCHEMA, zArgusDir, zId, zDate, type ToolModule } from './tool-types.js';
import { handleToolException } from './errors.js';

/** check_by ascending; rows without a date sink to the end. */
const byCheckBy = (a: { check_by?: string }, b: { check_by?: string }) =>
  (a.check_by || '9999-99-99') < (b.check_by || '9999-99-99') ? -1 : 1;

/** Neutral chronology only. Historical outcomes remain readable on individual
 * receipts, but are never aggregated into a score-shaped summary. */
function frequencyStatement(s: LedgerState['stats'], locale: SurfaceLocale): string {
  const n = s.total_settled;
  if (n === 0) return locale === 'ko' ? '아직 다시 돌아와 답한 기록이 없습니다.' : 'No records have been revisited yet.';
  return locale === 'ko'
    ? `다시 돌아와 답한 기록 ${n}건이 있습니다.`
    : `${n} record${n === 1 ? '' : 's'} revisited.`;
}

/** Voice for a read view: the view's own text, else any ledger user-text, else
 *  config-or-EN — NEVER env/Intl. (Experience-loop find: an English user on a
 *  Korean-locale machine got a Korean "no premises" line because the textless
 *  path fell through resolveResponseLocale's env fallback.) */
function readVoice(dir: string, ledger: LedgerState, text?: string | null): SurfaceLocale {
  const t = (typeof text === 'string' && text) ? text : ledgerVoiceText(ledger);
  return t ? resolveResponseLocale(dir, t) : surfaceLocale(dir);
}

/** wake_text (P1-E7 = 12 §3.5) — rendered only when a wake exists (at least
 *  one sealed or settled contract); candidates/dismissed never fill the frame. */
function wakeText(ledger: LedgerState, today: string, dir: string): string | undefined {
  const rows = [...ledger.contracts.values()] as WakeContractRow[];
  if (!rows.some((c) => c.status === 'sealed' || c.status === 'settled')) return undefined;
  return renderWake(rows, ledger.stats, today, surfaceLocale(dir), ledger.oldest_ts?.slice(0, 10));
}

const inputSchema = z.strictObject({
  argus_dir: zArgusDir,
  view: z.enum(['bearing', 'contracts', 'receipt', 'track_record', 'premises', 'reflection']),
  id: zId.describe('Required when view = "receipt" or "premises".').optional(),
  today_override: zDate.optional(),
});

export const recall: ToolModule = {
  name: 'argus_recall',
  description:
    'Read your own decision history: a single receipt, open records, or a neutral chronology. Read-only. Answers are not aggregated into scores or performance claims.',
  inputSchema,
  outputSchema: ENVELOPE_OUTPUT_SCHEMA,
  annotations: { title: 'Recall your history', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async (a) => {
    try {
      const dir = resolveToolArgusDir(a['argus_dir']);
      const today = resolveToday({ override: a['today_override'] as string | undefined });
      const view = String(a['view']);

      if (view === 'receipt') {
        const id = a['id'];
        if (typeof id !== 'string' || !id) {
          return toolError({ ok: false, tool: 'argus_recall', error_code: 'RECEIPT_NEEDS_ID', message: 'view "receipt" requires an id.', recovery: 'Pass the decision id.' });
        }
        const r = readReceipt(dir, id);
        if (!r) {
          // A receipt exists only once sealed/settled. If the decision is on the
          // ledger but not there yet, that is an honest STATE, not an error —
          // returning RECEIPT_NOT_FOUND read as "your record vanished" when the
          // user simply hadn't sealed yet (experience loop: marcus & bilingual).
          const contract = replayLedger(dir, today).contracts.get(id);
          if (contract) {
            const locale = resolveResponseLocale(dir, contract.predicate || contract.text || null);
            // A SETTLED decision whose receipt FILE is missing (e.g. the receipt
            // write failed after the ledger append already landed). The fold
            // still holds the outcome and what-happened, so reconstruct the
            // record honestly and NAME the loss — never fall through to "no
            // saved prediction yet", which misreports a decision the user DID
            // settle (LLM-glue: an honest gap, not a plausible-wrong fill).
            if (contract.status === 'settled') {
              const snip = (s: unknown, n: number): string => { const t = String(s ?? '').trim(); return t.length > n ? `${t.slice(0, n)}…` : t; };
              const oword = (locale === 'ko'
                ? { held: '예측대로 됨', avoided: '걱정 피함', partial: '일부', missed: '빗나감' }
                : { held: 'held', avoided: 'avoided', partial: 'partial', missed: 'missed' }
              )[(contract.outcome ?? '') as 'held' | 'avoided' | 'partial' | 'missed'] ?? (locale === 'ko' ? '기록됨' : 'recorded');
              const pred = snip(contract.predicate || contract.text || '', 160);
              const wh = contract.what_happened ? snip(contract.what_happened, 160) : '';
              return envelope({
                ok: true, tool: 'argus_recall',
                surface: locale === 'ko'
                  ? `이 결정은 결과까지 기록됐습니다 (${oword}). 다만 영수증 파일을 지금 불러올 수 없습니다. 기록에 남은 예측: "${pred}"${wh ? `, 실제로 일어난 일: "${wh}"` : ''}.`
                  : `This decision was settled (${oword}), but its receipt file can't be loaded right now. On record — you predicted: "${pred}"${wh ? `; what happened: "${wh}"` : ''}.`,
                next_actions: ['argus_patterns', 'stop'],
                data: { id, status: 'settled', outcome: contract.outcome, receipt_missing: true, ...(contract.check_by ? { check_by: contract.check_by } : {}) },
              });
            }
            const sealed = contract.status === 'sealed';
            return envelope({
              ok: true, tool: 'argus_recall',
              surface: locale === 'ko'
                ? (sealed
                    ? `이 예측은 저장됐고 아직 결과 기록 전입니다 (확인일 ${contract.check_by}). 그날 실제 결과를 알려주시면 영수증이 완성됩니다.`
                    : '이 결정에는 아직 저장한 예측이 없습니다. 나중에 맞았는지 확인할 수 있는 예측을 하나 저장하면 판단 영수증이 생깁니다.')
                : (sealed
                    ? `This prediction is saved and waiting on its check-by (${contract.check_by}). Tell me what happened then, and the receipt completes.`
                    : 'This decision has no saved prediction yet. Save a prediction reality can later check, and a Judgment Receipt begins.'),
              next_actions: sealed ? ['argus_resolve', 'argus_patterns'] : ['argus_predict', 'argus_patterns'],
              data: { id, status: contract.status, ...(contract.check_by ? { check_by: contract.check_by } : {}) },
            });
          }
          return toolError({ ok: false, tool: 'argus_recall', error_code: 'RECEIPT_NOT_FOUND', message: `No decision found for "${id}".`, recovery: 'Check the id with argus_patterns view="all", or save a prediction first.' });
        }
        // The premise set is canonical — the receipt renders its summary from the fold (plan v5 §3.3).
        const cogEntry = replayLedger(dir, today).contracts.get(id);
        const pInfo = receiptPremisesInfo(cogEntry);
        // Receipt voice follows the user's own predicate (FC-2): the keepsake
        // artifact must speak the language it was sealed in.
        const receiptLocale = resolveResponseLocale(dir, r.predicate);
        // The receipt IS the product's payoff — when the user explicitly asks to
        // see it, the surface must carry the prediction-vs-reality line, not a
        // bare "Receipt recalled." that hides the value in data on hosts that
        // don't render it. The full formatted card stays in data.receipt_text as
        // the keepsake. (User-value review, 2026-07-14.)
        const clip = (s: unknown, n: number): string => { const t = String(s ?? '').trim(); return t.length > n ? `${t.slice(0, n)}…` : t; };
        // One word per outcome across the whole flow: surfaces.ts settle uses
        // 부분/대기, so the receipt-recall surface must match (was 부분적/아직 —
        // three words for `partial` in one decision's lifecycle).
        const label = receiptLocale === 'ko'
          ? { held: '예측대로', avoided: '걱정 피함', partial: '일부', missed: '빗나감', still_pending: '대기' }
          : { held: 'held', avoided: 'avoided', partial: 'partial', missed: 'missed', still_pending: 'still pending' };
        const outcomeKey = (r.outcome ?? 'still_pending') as keyof typeof label;
        const receiptSurface = receiptLocale === 'ko'
          ? (r.what_happened
              ? `예측: "${clip(r.predicate, 160)}". 현실: "${clip(r.what_happened, 160)}" (${label[outcomeKey]}). 채점은 없습니다. 예측은 당신이, 답은 현실이 했습니다.`
              : `예측: "${clip(r.predicate, 200)}". 확인일 ${r.check_by}에 현실이 답하면 영수증이 완성됩니다.`)
          : (r.what_happened
              ? `You predicted: "${clip(r.predicate, 160)}". Reality: "${clip(r.what_happened, 160)}" (${label[outcomeKey]}). No grade: you predicted, reality answered.`
              : `You predicted: "${clip(r.predicate, 200)}". The receipt completes when reality answers on ${r.check_by}.`);
        return envelope({
          ok: true, tool: 'argus_recall', surface: receiptSurface,
          next_actions: ['stop'],
          data: {
            receipt: r, receipt_text: renderReceipt(r, pInfo, receiptLocale),
            // 열 때 수집된 인지 문맥(입력 깊이) — 영수증을 다시 볼 때 함께
            // 도달 가능해야 수집이 장식이 아니다. data 전용, 없으면 키도 없다.
            ...(cogEntry?.question ? { question: cogEntry.question } : {}),
            ...(cogEntry?.values?.length ? { values: cogEntry.values } : {}),
            ...(cogEntry?.rejected_alternative ? { rejected_alternative: cogEntry.rejected_alternative } : {}),
            // 귀환이 남긴 규칙 — 영수증을 다시 여는 자리가 이것을 다시 볼 수
            // 있는 유일한 곳이다. 선언만 하고 소비되지 않는 필드를 만들지
            // 않는다(웹의 기록 카드와 같은 규율).
            ...(cogEntry?.lesson ? { lesson: cogEntry.lesson, lesson_authored: 'user' as const } : {}),
          },
        });
      }

      const ledger = replayLedger(dir, today);

      if (view === 'premises') {
        const id = a['id'];
        if (typeof id !== 'string' || !id) {
          return toolError({ ok: false, tool: 'argus_recall', error_code: 'PREMISES_NEEDS_ID', message: 'view "premises" requires an id.', recovery: 'Pass the decision id.' });
        }
        const entry = ledger.contracts.get(id);
        const list = entry?.premises ?? [];
        // Sealing arms the nudge (plan v5 P4). recall applies the SAME gate as
        // check_in/ambient (isNudgeArmed) so a premise on an unsealed decision
        // never reports due_for_* that check_in won't honor — the single-source
        // rule extended to this read (M3: was the recall↔check_in drift).
        const armed = isNudgeArmed(entry, today);
        // Read tools have no fresh user text to sniff, so the decision's own
        // sealed predicate carries the voice (parity with the receipt view).
        const locale = readVoice(dir, ledger, entry?.predicate);
        if (list.length === 0) {
          return envelope({
            ok: true, tool: 'argus_recall',
            surface: locale === 'ko'
              ? '이 결정에 아직 기록된 전제가 없습니다. 이 결정이 딛고 선 전제를 원할 때 적어둘 수 있습니다.'
              : 'No premises tracked on this decision yet. You can add the ones it rests on whenever you like.',
            next_actions: ['leave_as_is'],
            data: { id, premises: [], today },
          });
        }
        const rows = list.map((p) => {
          const last = p.last_recheck?.ts ? p.last_recheck.ts.slice(0, 10) : null;
          const daysStale = last ? Math.round((Date.parse(today) - Date.parse(last)) / 86400000) : null;
          return {
            ref: `P${p.ordinal}`, premise_id: p.premise_id, kind: p.kind, text: p.text,
            status: p.status, external: p.external, load_bearing: p.load_bearing,
            monitored: isMonitored(p),
            // provenance — the declared reader of ai_original (plan v5 §6.4)
            source: p.source,
            ...(p.ai_original && p.ai_original !== p.text ? { ai_original: p.ai_original, edited_by_user: true } : {}),
            // The user's own sentence this rests on. The browser card prints it
            // under every premise as "내가 쓴 말"; the terminal collected it and
            // had nowhere to put it, so a host could only ever echo our wording
            // back at the person who supplied the original.
            ...(p.anchor_quote ? { anchor_quote: p.anchor_quote } : {}),
            edits: p.amend_history.length,
            // staleness, honestly (plan v5 §5-3): never pretend liveness
            last_checked: last,
            staleness: last === null ? 'never re-checked' : `${daysStale}d since last re-check`,
            ...(p.last_recheck ? { last_finding: p.last_recheck.finding, last_source: p.last_recheck.source, last_drifted: p.last_recheck.drifted } : {}),
            // M1 §1.2 — the formalized cadence: effective interval + the next due
            // date (null = due now / not monitored). Data only, never a nag.
            ...(isMonitored(p) ? { recheck_cadence_days: recheckCadenceDays(p), next_recheck_due: nextRecheckDue(p) } : {}),
            // due_for_* is gated by `armed` (sealing arms the nudge) so it agrees
            // with check_in/ambient exactly. The cadence dates above are shown
            // unconditionally (they are facts about the premise, not a claim that
            // it is due now).
            due_for_recheck: armed && isDueForRecheck(p, today),
            // M3 — open_question reconsider cadence: same shape, data only.
            ...(isReconsiderable(p) ? { reponder_cadence_days: reponderCadenceDays(p), next_reponder_due: nextReponderDue(p), due_for_reconsider: armed && isDueForReconsider(p, today) } : {}),
            ...(p.resolved_decision ? { resolved_decision: p.resolved_decision } : {}),
          };
        });
        const monitored = rows.filter((r) => r.monitored).length;
        const due = rows.filter((r) => r.due_for_recheck).length;
        const surface = locale === 'ko'
          ? `이 결정에 전제 ${rows.length}건이 있습니다. ${monitored}건 추적 중, ${due}건 재확인 차례${due > 0 ? ' (argus_capture action="update_fact")' : ''}.`
          : `${rows.length} premise(s) on this decision. ${monitored} monitored, ${due} due for a re-check${due > 0 ? ' (argus_capture action="update_fact")' : ''}.`;
        return envelope({
          ok: true, tool: 'argus_recall',
          surface,
          next_actions: due > 0 ? ['argus_check_in', 'leave_as_is'] : ['leave_as_is'],
          data: { id, premises: rows, today },
        });
      }

      if (view === 'bearing') {
        // JSON side sorted too (P1-E7 / 12 §3.6): check_by ascending, so a
        // past-due contract can never hide between far-future ones.
        const open = [...ledger.contracts.values()]
          .filter((c) => c.status === 'sealed')
          .map((c) => ({ id: c.id, predicate: c.predicate, check_by: c.check_by }))
          .sort(byCheckBy);
        const locale = readVoice(dir, ledger, open[0]?.predicate);
        const surface = ledger.ids.size === 0
          ? (locale === 'ko'
              ? 'Argus는 답을 대신 내리지 않습니다. 결정을 명료하게 정리하고, 예측과 확인일을 저장한 뒤, 그날 실제 결과를 기록합니다.'
              : 'Argus does not decide for you. It clarifies a decision, saves a prediction and check date, then records what actually happened.')
          : (locale === 'ko' ? `결과를 기다리는 예측 ${open.length}건.` : `${open.length} prediction(s) awaiting results.`);
        const wake = wakeText(ledger, today, dir);
        return envelope({ ok: true, tool: 'argus_recall', surface, next_actions: open.length ? ['argus_check_in'] : ['argus_capture'], data: { open, today, ...(wake ? { wake_text: wake } : {}) } });
      }

      if (view === 'contracts') {
        const all = [...ledger.contracts.values()]
          .map((c) => ({ id: c.id, status: c.status, predicate: c.predicate, check_by: c.check_by, outcome: c.outcome, dismiss_reason: c.dismiss_reason }))
          .sort(byCheckBy);
        // 60-row cap (12 §3.6) — the JSON stays a summary, not a wall.
        const shown = all.slice(0, 60);
        const locale = readVoice(dir, ledger, all[0]?.predicate);
        const wake = wakeText(ledger, today, dir);
        // Empty ledger → an on-ramp with a capture handle, not "0 decision(s)" +
        // stop (a "show me my decisions" newcomer must get a next move).
        const allSurface = all.length === 0
          ? (locale === 'ko' ? '아직 기록에 남은 결정이 없습니다. 고민 중인 결정을 말씀해 주시면 거기서 시작합니다.' : 'No decisions on record yet. Describe a decision you are weighing and we\'ll begin there.')
          : (locale === 'ko' ? `기록에 남은 결정 ${all.length}건.` : `${all.length} decision(s) on record.`);
        return envelope({
          ok: true, tool: 'argus_recall', surface: allSurface, next_actions: all.length === 0 ? ['argus_capture'] : ['stop'],
          data: { contracts: shown, ...(all.length > shown.length ? { truncated: all.length - shown.length } : {}), today, ...(wake ? { wake_text: wake } : {}) },
        });
      }

      if (view === 'reflection') {
        // "내 맥락 다시 채우기" (§8-B): a surface for re-reading YOUR OWN past
        // reasoning — the predictions and premises you wrote, and what reality
        // did — to rebuild calibration. It leads with your own sentences; the
        // only meaning-language is the shared frequency statement. No tier, no
        // score, no characterization of who you are (spine rule 2).
        const rl = readVoice(dir, ledger);
        const withReasoning = [...ledger.contracts.values()]
          .filter((c) => c.status === 'settled' || c.status === 'sealed')
          // settled first (that is where calibration lives), then by check_by.
          .sort((a, b) => (a.status === 'settled') !== (b.status === 'settled')
            ? (a.status === 'settled' ? -1 : 1)
            : byCheckBy(a, b));
        // Cap the page, never the count: "되읽을 결정 30건" over a 45-record
        // ledger is a silent truncation lying as a total (the contracts view
        // two branches up ships `truncated` for exactly this reason).
        const reflectionTotal = withReasoning.length;
        const reflections = withReasoning.slice(0, 30).map((c) => ({
          id: c.id, status: c.status, predicate: c.predicate ?? c.text, check_by: c.check_by,
          ...(c.status === 'settled' ? { outcome: c.outcome, ...(c.settled_on ? { settled_on: c.settled_on } : {}) } : {}),
          premises: (c.premises ?? []).map((p) => ({
            ref: `P${p.ordinal}`, text: p.text, kind: p.kind, load_bearing: p.load_bearing, status: p.status,
            // provenance is the line between your reasoning and the model's draft.
            source: p.source,
            ...(p.ai_original && p.ai_original !== p.text ? { ai_original: p.ai_original, edited_by_user: true } : {}),
            // The user's own sentence this rests on. The browser card prints it
            // under every premise as "내가 쓴 말"; the terminal collected it and
            // had nowhere to put it, so a host could only ever echo our wording
            // back at the person who supplied the original.
            ...(p.anchor_quote ? { anchor_quote: p.anchor_quote } : {}),
            ...(c.broken_premise_id && p.premise_id === c.broken_premise_id ? { you_named_broken: true } : {}),
          })),
        }));
        const rfreq = frequencyStatement(ledger.stats, rl);
        const rn = ledger.stats.total_settled;
        const reflectionsShownNote =
          reflectionTotal > reflections.length
            ? (rl === 'ko' ? ` (최근 ${reflections.length}건 표시)` : ` (showing the ${reflections.length} most recent)`)
            : '';
        const framing = reflections.length === 0
          ? (rl === 'ko'
              ? '되읽을 결정이 아직 없습니다. 예측과 전제를 기록하면, 여기서 당신의 판단을 다시 만납니다.'
              : 'Nothing to re-read yet. Once you record predictions and premises, this is where you meet your own judgment again.')
          : (rl === 'ko'
              ? `되읽을 결정 ${reflectionTotal}건${reflectionsShownNote}. 당신이 쓴 예측과 전제, 그리고 현실이 한 일입니다.`
              : `${reflectionTotal} decision(s) to re-read${reflectionsShownNote}: your own predictions and premises, and what reality did.`);
        return envelope({
          ok: true, tool: 'argus_recall',
          surface: rn > 0 ? `${framing} ${rfreq}` : framing,
          next_actions: ledger.ids.size === 0 ? ['argus_capture'] : ['stop'], // empty ledger → a handle, not a dead end
          data: {
            reflections, reflection_count: reflectionTotal,
            ...(reflectionTotal > reflections.length ? { truncated: reflectionTotal - reflections.length } : {}),
            revisit_statement: rfreq,
            revisit_count: rn,
            today,
          },
        });
      }

      // `track_record` remains a wire-compatible legacy view name. Its meaning
      // is now a neutral inventory, not an outcome aggregate.
      const s = ledger.stats;
      const n = s.total_settled;
      const trackLocale = readVoice(dir, ledger);
      const freq = frequencyStatement(s, trackLocale);

      // ── 보정 기록 (입력 깊이 사이클 4) ── 봉인 때 사전등록된 확신도와 현실의
      // 답을 버킷별 **개수 + 근거 케이스 id**로만 집계한다. TWIN 수정조항의
      // 허용 대상 (b): 채점 대상은 사용자가 스스로 사전등록한 예측이지 사용자가
      // 아니다. 규율 셋을 데이터가 스스로 지킨다 — 비율·등급·백분율 없음(비율
      // 부터가 성적이 된다), 표본 임계(5) 미달이면 경향 판단 유보를 명시,
      // 채점 대상을 scored_object로 밝힌다. surface는 건드리지 않는다(집계는
      // 재료지 코칭이 아니다).
      const confSettled = [...ledger.contracts.values()].filter((c) =>
        c.status === 'settled' && c.predicate_confidence
        && c.outcome && c.outcome !== 'still_pending');
      const byConfidence: Record<string, { n: number; outcomes: Record<string, number>; ids: string[] }> = {};
      for (const c of confSettled) {
        const b = (byConfidence[c.predicate_confidence as string] ??= { n: 0, outcomes: {}, ids: [] });
        b.n += 1;
        b.outcomes[c.outcome as string] = (b.outcomes[c.outcome as string] ?? 0) + 1;
        b.ids.push(c.id);
      }

      return envelope({
        ok: true, tool: 'argus_recall',
        surface: freq,
        next_actions: ledger.ids.size === 0 ? ['argus_capture'] : ['stop'], // empty ledger → a handle, not a dead end
        data: {
          revisit_statement: freq,
          revisit_count: n,
          open_count: s.total_sealed,
          ...(confSettled.length > 0 ? {
            confidence_record: {
              scored_object: 'counts pair the user\'s own pre-registered confidence with recorded outcomes; the subject is each prediction, never the person',
              n: confSettled.length,
              by_confidence: byConfidence,
              ...(confSettled.length < 5 ? {
                sample_note: 'Fewer than 5 settled predictions carry a recorded confidence. Counts and case ids only; no tendency claim yet.',
              } : {}),
            },
          } : {}),
        },
      });
    } catch (e) {
      return handleToolException('argus_recall', e);
    }
  },
};
