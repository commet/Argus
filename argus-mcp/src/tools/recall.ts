import { resolveToolArgusDir } from '../lib/argus-dir.js';
import { resolveToday } from '../lib/resolve-today.js';
import { replayLedger } from '../lib/ledger-replay.js';
import { resolveContract } from '../lib/resolve-contract.js';
import { readReceipt } from '../lib/receipt.js';
import { renderReceipt } from '../lib/render-receipt.js';
import { isMonitored, isDueForRecheck, receiptPremisesInfo } from '../lib/premises.js';
import { z } from 'zod';
import { envelope, toolError } from '../lib/envelope.js';
import { ENVELOPE_OUTPUT_SCHEMA, zArgusDir, zId, zDate, type ToolModule } from './tool-types.js';
import { handleToolException } from './errors.js';

const inputSchema = z.strictObject({
  argus_dir: zArgusDir,
  view: z.enum(['bearing', 'contracts', 'receipt', 'track_record', 'premises']),
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
          return toolError({ ok: false, tool: 'argus_recall', error_code: 'RECEIPT_NOT_FOUND', message: `No receipt for "${id}".`, recovery: 'Check the id, or seal the decision first.' });
        }
        // The premise set is canonical — the receipt renders its summary from the fold (plan v5 §3.3).
        const pInfo = receiptPremisesInfo(replayLedger(dir, today).contracts.get(id));
        return envelope({
          ok: true, tool: 'argus_recall', surface: 'Receipt recalled.',
          next_actions: ['stop'], data: { receipt: r, receipt_text: renderReceipt(r, pInfo) },
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
        if (list.length === 0) {
          return envelope({
            ok: true, tool: 'argus_recall',
            surface: 'No premises tracked on this decision. Record the facts it rests on with argus_premises (op=add).',
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
            due_for_recheck: isDueForRecheck(p, today),
            ...(p.resolved_decision ? { resolved_decision: p.resolved_decision } : {}),
          };
        });
        const monitored = rows.filter((r) => r.monitored).length;
        const due = rows.filter((r) => r.due_for_recheck).length;
        return envelope({
          ok: true, tool: 'argus_recall',
          surface: `${rows.length} premise(s) on this decision — ${monitored} monitored, ${due} due for a reality re-check${due > 0 ? ' (argus_recheck)' : ''}.`,
          next_actions: due > 0 ? ['argus_check_in', 'leave_as_is'] : ['leave_as_is'],
          data: { id, premises: rows, today },
        });
      }

      if (view === 'bearing') {
        const open = [...ledger.contracts.values()].filter((c) => c.status === 'sealed').map((c) => ({ id: c.id, predicate: c.predicate, check_by: c.check_by }));
        const surface = ledger.ids.size === 0
          ? 'Argus does not answer. It records a prediction + a check-by date, and meets reality on that date. Open your first decision with argus_open_decision.'
          : `${open.length} open bearing(s).`;
        return envelope({ ok: true, tool: 'argus_recall', surface, next_actions: open.length ? ['argus_check_in'] : ['argus_open_decision'], data: { open, today } });
      }

      if (view === 'contracts') {
        const all = [...ledger.contracts.values()].map((c) => ({ id: c.id, status: c.status, predicate: c.predicate, check_by: c.check_by, outcome: c.outcome, dismiss_reason: c.dismiss_reason }));
        return envelope({ ok: true, tool: 'argus_recall', surface: `${all.length} decision(s) on record.`, next_actions: ['stop'], data: { contracts: all, today } });
      }

      // track_record — frequency only, sample-size caveated. No tier, no score (spine rule 2).
      const s = ledger.stats;
      const n = s.total_settled;
      const freq = n === 0
        ? 'No settled decisions yet — nothing to summarize.'
        : `Of ${n} settled: ${s.held} held, ${s.avoided} avoided, ${s.partial} partial.`;
      return envelope({
        ok: true, tool: 'argus_recall',
        surface: freq,
        next_actions: ['stop'],
        data: {
          judgment_tier: null, judgment_score: null, // drift-guard asserts these stay null
          frequency_statement: freq,
          sample_size: n,
          sample_size_caveat: n < 10 ? 'Sample is small — read this as history, not a pattern about you.' : undefined,
          stats: s,
        },
      });
    } catch (e) {
      return handleToolException('argus_recall', e);
    }
  },
};
