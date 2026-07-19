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

/** The ONE canonical meaning-statement (spine rule 2): sample-size-scaled
 *  frequency, never a tier/score/verdict about the user. Shared by track_record
 *  and reflection so the two reads can never drift into two different claims. */
function frequencyStatement(s: LedgerState['stats'], locale: SurfaceLocale): string {
  const n = s.total_settled;
  if (n === 0) return locale === 'ko' ? '아직 결과를 기록한 결정이 없습니다. 요약할 것이 없습니다.' : 'No settled decisions yet; nothing to summarize.';
  return locale === 'ko'
    ? `결과 기록 ${n}건 중: 예측대로 ${s.held} · 걱정 피함 ${s.avoided} · 일부 ${s.partial} · 빗나감 ${s.missed}.`
    : `Of ${n} settled: ${s.held} held, ${s.avoided} avoided, ${s.partial} partial, ${s.missed} missed.`;
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
    "Read your own decision history: a single receipt, the open contracts, or your track record. Read-only. Track record reports sample-size-scaled frequency only — never a tier, score, or verdict about who you are.",
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
        const pInfo = receiptPremisesInfo(replayLedger(dir, today).contracts.get(id));
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
          next_actions: ['stop'], data: { receipt: r, receipt_text: renderReceipt(r, pInfo, receiptLocale) },
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
        const reflections = withReasoning.slice(0, 30).map((c) => ({
          id: c.id, status: c.status, predicate: c.predicate ?? c.text, check_by: c.check_by,
          ...(c.status === 'settled' ? { outcome: c.outcome, ...(c.settled_on ? { settled_on: c.settled_on } : {}) } : {}),
          premises: (c.premises ?? []).map((p) => ({
            ref: `P${p.ordinal}`, text: p.text, kind: p.kind, load_bearing: p.load_bearing, status: p.status,
            // provenance is the line between your reasoning and the model's draft.
            source: p.source,
            ...(p.ai_original && p.ai_original !== p.text ? { ai_original: p.ai_original, edited_by_user: true } : {}),
            ...(c.broken_premise_id && p.premise_id === c.broken_premise_id ? { you_named_broken: true } : {}),
          })),
        }));
        const rfreq = frequencyStatement(ledger.stats, rl);
        const rn = ledger.stats.total_settled;
        const framing = reflections.length === 0
          ? (rl === 'ko'
              ? '되읽을 결정이 아직 없습니다. 예측과 전제를 기록하면, 여기서 당신의 판단을 다시 만납니다.'
              : 'Nothing to re-read yet. Once you record predictions and premises, this is where you meet your own judgment again.')
          : (rl === 'ko'
              ? `되읽을 결정 ${reflections.length}건. 당신이 쓴 예측과 전제, 그리고 현실이 한 일입니다.`
              : `${reflections.length} decision(s) to re-read: your own predictions and premises, and what reality did.`);
        return envelope({
          ok: true, tool: 'argus_recall',
          surface: rn > 0 ? `${framing} ${rfreq}` : framing,
          next_actions: ledger.ids.size === 0 ? ['argus_capture'] : ['stop'], // empty ledger → a handle, not a dead end
          data: {
            judgment_tier: null, judgment_score: null, // spine rule 2 — never a verdict about who you are
            reflections, reflection_count: reflections.length,
            frequency_statement: rfreq,
            sample_size: rn,
            sample_size_caveat: rn > 0 && rn < 10 ? (rl === 'ko' ? '표본이 작습니다. 당신에 대한 패턴이 아니라 기록으로 읽으세요.' : 'Sample is small. Read this as history, not a pattern about you.') : undefined,
            today,
          },
        });
      }

      // track_record — frequency only, sample-size caveated. No tier, no score (spine rule 2).
      const s = ledger.stats;
      const n = s.total_settled;
      const trackLocale = readVoice(dir, ledger);
      const freq = frequencyStatement(s, trackLocale);

      // Premise-level attribution (plan v5 P2) — where accumulation compounds:
      // COUNTS of settles where the user themselves named a broken premise.
      // A frequency statement, never a diagnosis of the person.
      const settled = [...ledger.contracts.values()].filter((c) => c.status === 'settled');
      // "did not hold" = every settled outcome except a clean held: avoided,
      // partial, AND missed. Excluding 'missed' (the clearest not-held case)
      // dropped exactly the settle a broken premise most often explains
      // (dogfood F8: a missed+broken-premise settle vanished from attribution).
      const missedOrPartial = settled.filter((c) => c.outcome === 'avoided' || c.outcome === 'partial' || c.outcome === 'missed');
      const withBroken = missedOrPartial.filter((c) => c.broken_premise_id);
      const premiseAttribution = withBroken.length > 0
        ? (trackLocale === 'ko'
            ? `예측대로 되지 않은 결과 ${missedOrPartial.length}건 중, ${withBroken.length}건에서 당신이 깨진 전제를 직접 지목했습니다.`
            : `Of ${missedOrPartial.length} results that did not hold, you attributed ${withBroken.length} to a named broken premise.`)
        : undefined;

      return envelope({
        ok: true, tool: 'argus_recall',
        surface: premiseAttribution ? `${freq} ${premiseAttribution}` : freq,
        next_actions: ledger.ids.size === 0 ? ['argus_capture'] : ['stop'], // empty ledger → a handle, not a dead end
        data: {
          judgment_tier: null, judgment_score: null, // drift-guard asserts these stay null
          frequency_statement: freq,
          ...(premiseAttribution ? { premise_attribution: premiseAttribution, premise_attribution_counts: { not_held: missedOrPartial.length, with_named_broken_premise: withBroken.length } } : {}),
          sample_size: n,
          sample_size_caveat: n < 10 ? (trackLocale === 'ko' ? '표본이 작습니다. 당신에 대한 패턴이 아니라 기록으로 읽으세요.' : 'Sample is small. Read this as history, not a pattern about you.') : undefined,
          stats: s,
        },
      });
    } catch (e) {
      return handleToolException('argus_recall', e);
    }
  },
};
