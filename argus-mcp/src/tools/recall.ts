import { requireArgusDir } from '../lib/argus-dir.js';
import { resolveToday } from '../lib/resolve-today.js';
import { replayLedger } from '../lib/ledger-replay.js';
import { resolveContract } from '../lib/resolve-contract.js';
import { readReceipt } from '../lib/receipt.js';
import { renderReceipt } from '../lib/render-receipt.js';
import { z } from 'zod';
import { envelope, toolError } from '../lib/envelope.js';
import { ENVELOPE_OUTPUT_SCHEMA, zArgusDir, zId, zDate, type ToolModule } from './tool-types.js';
import { handleToolException } from './errors.js';

const inputSchema = z.strictObject({
  argus_dir: zArgusDir,
  view: z.enum(['bearing', 'contracts', 'receipt', 'track_record']),
  id: zId.describe('Required when view = "receipt".').optional(),
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
      const dir = requireArgusDir(a['argus_dir']);
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
        return envelope({
          ok: true, tool: 'argus_recall', surface: 'Receipt recalled.',
          next_actions: ['stop'], data: { receipt: r, receipt_text: renderReceipt(r) },
        });
      }

      const ledger = replayLedger(dir, today);

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
