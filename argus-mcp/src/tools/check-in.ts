import { resolveToolArgusDir } from '../lib/argus-dir.js';
import { resolveToday } from '../lib/resolve-today.js';
import { replayLedger, bearingContracts } from '../lib/ledger-replay.js';
import { z } from 'zod';
import { envelope } from '../lib/envelope.js';
import { ENVELOPE_OUTPUT_SCHEMA, zArgusDir, zDate, type ToolModule } from './tool-types.js';
import { handleToolException } from './errors.js';

const inputSchema = z.strictObject({
  argus_dir: zArgusDir,
  include_upcoming_days: z.number().int().min(0).max(30).default(0).describe('Also list contracts due within N days.'),
  today_override: zDate.optional(),
});

export const checkIn: ToolModule = {
  name: 'argus_check_in',
  description:
    'Return decision contracts whose check-by date has arrived (and optionally upcoming ones). A return nudge — reads and routes to argus_settle. If nothing is due, it says so and stops; it does not manufacture engagement.',
  inputSchema,
  outputSchema: ENVELOPE_OUTPUT_SCHEMA,
  annotations: { title: 'Check what is due', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async (a) => {
    try {
      const dir = resolveToolArgusDir(a['argus_dir']);
      const today = resolveToday({ override: a['today_override'] as string | undefined });
      const ledger = replayLedger(dir, today);
      const seeds = bearingContracts(dir, today, ledger);

      const dueMap = new Map<string, { id: string; predicate: string; check_by: string; days_overdue: number; source: string }>();
      for (const c of ledger.overdue) {
        dueMap.set(c.id, { id: c.id, predicate: c.text, check_by: c.date, days_overdue: daysBetween(c.date, today), source: 'ledger' });
      }
      for (const s of seeds) {
        if (!dueMap.has(s.id)) dueMap.set(s.id, { id: s.id, predicate: s.predicate, check_by: s.check_by, days_overdue: daysBetween(s.date, today), source: 'bearing' });
      }
      const due = Array.from(dueMap.values()).sort((x, y) => x.check_by < y.check_by ? -1 : 1);

      if (due.length === 0) {
        return envelope({
          ok: true, tool: 'argus_check_in',
          surface: 'Nothing is due. Nothing to nudge.',
          next_actions: ['stop'],
          data: { due: [], due_count: 0, today },
        });
      }

      return envelope({
        ok: true, tool: 'argus_check_in',
        surface: `${due.length} decision contract(s) past check-by. Time to check them against reality.`,
        next_actions: ['argus_settle'],
        data: { due, due_count: due.length, today, integrity: ledger.integrity },
      });
    } catch (e) {
      return handleToolException('argus_check_in', e);
    }
  },
};

function daysBetween(from: string, to: string): number {
  const a = Date.parse(from + 'T00:00:00Z');
  const b = Date.parse(to + 'T00:00:00Z');
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86400000);
}
