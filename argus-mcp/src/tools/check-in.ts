import { resolveToolArgusDir } from '../lib/argus-dir.js';
import { resolveToday, asDate } from '../lib/resolve-today.js';
import { replayLedger, bearingContracts } from '../lib/ledger-replay.js';
import { duePremises, groupDuePremises } from '../lib/premises.js';
import { readReceipt, SKIPPED } from '../lib/receipt.js';
import { surfacesFor } from '../lib/surfaces.js';
import { z } from 'zod';
import { envelope } from '../lib/envelope.js';
import { ENVELOPE_OUTPUT_SCHEMA, zArgusDir, zDate, type ToolModule } from './tool-types.js';
import { handleToolException } from './errors.js';

const inputSchema = z.strictObject({
  argus_dir: zArgusDir,
  include_upcoming_days: z.number().int().min(0).max(30).default(0).describe('Also list sealed contracts coming due within N days (informational — nothing to settle yet).'),
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

      // Locale brain (P1-E1): all check_in surface strings come from the
      // {ko,en} dictionary, picked by the config's locale.
      const S = surfacesFor(dir).checkin;

      // 닻 거울 (P1-E3): each due item carries its seal date + the user's OWN
      // seal-time words (receipt.human_judgment; omitted when skipped). The
      // mirror is recognition by date arithmetic, never a welcome greeting —
      // and the quote is the user's sentence, not a machine verdict.
      const dueEnriched: Array<typeof due[number] & { sealed_at?: string; days_since_seal?: number; your_words_then?: string }> =
        due.map((d) => {
          const receipt = readReceipt(dir, d.id);
          if (!receipt?.created_at) return d;
          const sealed_at = String(receipt.created_at).slice(0, 10);
          const words = typeof receipt.human_judgment === 'string' &&
            receipt.human_judgment.trim().length > 0 &&
            receipt.human_judgment !== SKIPPED
            ? receipt.human_judgment.trim()
            : undefined;
          return {
            ...d,
            sealed_at,
            days_since_seal: daysBetween(sealed_at, today),
            ...(words ? { your_words_then: words } : {}),
          };
        });

      // include_upcoming_days, actually implemented (11 S2 — an accepted-then-
      // discarded argument is a silent lie in the schema). Sealed contracts whose
      // check-by falls within the window: informational only, nothing to settle.
      const upDays = typeof a['include_upcoming_days'] === 'number'
        ? Math.max(0, Math.min(30, Math.floor(a['include_upcoming_days'] as number)))
        : 0;
      const upcoming: Array<{ id: string; predicate: string; check_by: string }> = [];
      if (upDays > 0) {
        const horizon = addDays(today, upDays);
        for (const [cid, entry] of ledger.contracts.entries()) {
          if (entry.status !== 'sealed' || dueMap.has(cid)) continue;
          const date = asDate(entry.check_by);
          if (date && date > today && date <= horizon) {
            upcoming.push({ id: cid, predicate: entry.text || '', check_by: date });
          }
        }
        upcoming.sort((x, y) => (x.check_by < y.check_by ? -1 : 1));
      }
      const upcomingLine = upcoming.length > 0
        ? S.upcoming(upcoming.length, upDays)
        : '';

      // Ledger-corruption disclosure (11 P2-8): dropped_lines was counted in
      // data.integrity but never SAID. Silence is not kindness — one factual
      // sentence + the backup handle. No blame, no gate.
      const integrityLine = ledger.integrity.dropped_lines > 0
        ? S.dropped_lines(ledger.integrity.dropped_lines)
        : '';

      // Living premises: monitored facts due for a reality re-check, grouped so
      // the same fact under several decisions is ONE re-check (plan v5 P1/P5).
      // groupDuePremises(duePremises()) is the SAME primitive the ambient
      // due-line reads via ambient-due.ts — so the "N to re-check" the session
      // sees on any tool can never disagree with check_in (M1 §1.3, single-source
      // rule; a test pins the equality).
      const TOP = 5;
      const premiseGroups = groupDuePremises(duePremises(ledger));
      const duePrem = premiseGroups.slice(0, TOP).map((g) => ({
        fact: g.text,
        decisions: g.premises.map((p) => ({ decision_id: p.decision_id, decision: p.decision_text, ref: `P${p.ordinal}`, staleness: p.days_stale === null ? 'never re-checked' : `${p.days_stale}d` })),
      }));

      if (due.length === 0 && premiseGroups.length === 0) {
        // Static hint, no network (P1-E4 ③ / master §5-18): check_in stays a
        // local, deterministic read — but a token means the user ALSO seals in
        // their account (web), and "nothing" here must not read as "nothing
        // anywhere". One sentence, argus_sync is the one place that looks.
        const accountHint = (process.env.ARGUS_TOKEN || '').trim()
          ? S.account_hint
          : '';
        return envelope({
          ok: true, tool: 'argus_check_in',
          surface: S.nothing_due + accountHint + upcomingLine + integrityLine,
          next_actions: ['stop'],
          data: { due: [], due_count: 0, due_premises: [], due_premise_count: 0, ...(upDays > 0 ? { upcoming } : {}), today },
        });
      }

      const parts: string[] = [];
      if (due.length > 0) {
        // 닻 거울: the OLDEST due item's seal-time words lead the surface
        // (one quote only — the rest stay in data, no surface bloat). Falls
        // back to the count-only line when there are no words to mirror.
        const oldest = dueEnriched[0];
        parts.push(
          oldest?.your_words_then && typeof oldest.days_since_seal === 'number'
            ? S.anchor_mirror(oldest.days_since_seal, due.length, clip(oldest.your_words_then, 200))
            : S.due_contracts(due.length),
        );
      }
      if (premiseGroups.length > 0) parts.push(S.due_premises(premiseGroups.length));

      return envelope({
        ok: true, tool: 'argus_check_in',
        surface: parts.join(' ') + upcomingLine + integrityLine,
        next_actions: due.length > 0 ? ['argus_settle'] : ['argus_recall'],
        data: {
          due: dueEnriched, due_count: due.length,
          due_premises: duePrem, due_premise_count: premiseGroups.length,
          ...(premiseGroups.length > TOP ? { due_premises_truncated: `${premiseGroups.length} groups, showing ${TOP}` } : {}),
          ...(upDays > 0 ? { upcoming } : {}),
          today, integrity: ledger.integrity,
        },
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

/** Keep the mirrored quote a quote, not a wall — the full text stays in data. */
function clip(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}

function addDays(day: string, days: number): string {
  const t = Date.parse(day + 'T00:00:00Z');
  if (Number.isNaN(t)) return day;
  return new Date(t + days * 86400000).toISOString().slice(0, 10);
}
