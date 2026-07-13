import { z } from 'zod';
import { createHash } from 'crypto';
import { resolveToolArgusDir } from '../lib/argus-dir.js';
import { resolveToday } from '../lib/resolve-today.js';
import { appendLedger } from '../lib/ledger-append.js';
import { replayLedger } from '../lib/ledger-replay.js';
import { ensurePrivacyGitignore } from '../lib/privacy.js';
import { resolveResponseLocale, SURFACES } from '../lib/surfaces.js';
import { envelope, toolError } from '../lib/envelope.js';
import { handleToolException } from './errors.js';
import { ENVELOPE_OUTPUT_SCHEMA, zArgusDir, zDate, type ToolModule } from './tool-types.js';

/**
 * argus_watch — the daily watch (당직 루프, BLUEPRINT §9).
 *
 * The second, lighter orbit next to the decision voyage: an ANCHOR is today's
 * aim/working hypothesis in the user's own words; a CAPTURE is a swallowed
 * claim / unverified premise / deferred question noted mid-work. Both are
 * NOTES, not bets (§9.2-3):
 *  - no gate: this is a user-requested record, not an intervention — the
 *    over-fire gate governs opening decisions, and this deliberately is not one;
 *  - no verdict, no settlement, no streak: an anchor never enters track_record
 *    (the fold keeps watch events outside contracts — a test pins it);
 *  - the only return is tomorrow's check_in mirroring the anchor back as a
 *    question ("so, how did it go?") — recognition, never a completion check.
 *
 * Promotion is the user's verb: a capture becomes a decision premise via
 * argus_premises (or a decision via argus_open_decision) only when they say so.
 */

/** Stable capture id — deterministic from (date, text) so re-capturing the same
 *  sentence the same day is idempotent, and the id survives replay. */
export function captureId(date: string, text: string): string {
  return 'wc-' + createHash('sha256').update(`${date}|${text}`).digest('hex').slice(0, 8);
}

const inputSchema = z.strictObject({
  argus_dir: zArgusDir,
  op: z.enum(['anchor', 'capture', 'list']).describe(
    'anchor = record today\'s aim/working hypothesis (one line, the user\'s words). ' +
    'capture = note a swallowed claim / unverified premise / deferred question mid-work. ' +
    'list = read the recent watch log (no writes).'),
  text: z.string().min(3).max(300).optional().describe(
    'op=anchor/capture: the user\'s sentence, VERBATIM — including, if they said it, where they currently stand. One sentence is the whole anchor; never a model rewrite, never a summary.'),
  kind: z.enum(['claim', 'premise', 'question']).optional().describe(
    'op=capture: claim = something accepted without checking; premise = an unverified assumption in play; question = a judgment deferred for later.'),
  source: z.enum(['user_stated', 'ai_surfaced']).optional().describe(
    'op=capture provenance. Never forge: user_stated = the user\'s own words; ai_surfaced = model-drafted (requires ai_original).'),
  ai_original: z.string().max(300).optional().describe(
    'REQUIRED when source="ai_surfaced": the model\'s original wording, preserved verbatim.'),
  days: z.number().int().min(1).max(30).optional().describe('op=list: how many days back to list (default 2 — today and yesterday).'),
  today_override: zDate.optional(),
});

export const watch: ToolModule = {
  name: 'argus_watch',
  description:
    'The daily watch (당직) — the light loop next to the decision voyage. ' +
    'op=anchor records today\'s aim or working hypothesis in the user\'s own words; tomorrow\'s check_in mirrors it back as a question ("so, how did it go?") — an anchor is a note, not a bet: it is never evaluated, never graded, never counted in any record. ' +
    'op=capture notes a swallowed claim, unverified premise, or deferred question mid-work, verbatim, without opening a decision. ' +
    'op=list reads the recent watch log. ' +
    'Use it when the USER asks to keep something — do not volunteer it on routine work.',
  inputSchema,
  outputSchema: ENVELOPE_OUTPUT_SCHEMA,
  annotations: { title: 'Keep the daily watch', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (a) => {
    try {
      const dir = resolveToolArgusDir(a['argus_dir']);
      const today = resolveToday({ override: a['today_override'] as string | undefined });
      const op = String(a['op']);
      const now = new Date().toISOString();
      const text = typeof a['text'] === 'string' ? a['text'].trim() : '';
      const locale = resolveResponseLocale(dir, text || undefined);
      const W = SURFACES[locale].tools.watch;

      if (op === 'anchor') {
        if (!text) {
          return toolError({ ok: false, tool: 'argus_watch', error_code: 'TEXT_REQUIRED', message: 'op=anchor needs the user\'s one-line aim in `text`.', recovery: 'Pass the user\'s own sentence verbatim.' });
        }
        await ensurePrivacyGitignore(dir);
        await appendLedger(dir, [{ id: `watch-${today}`, event: 'watch_anchor', text, anchor_date: today }], now);
        return envelope({
          ok: true, tool: 'argus_watch', surface: W.anchored,
          next_actions: ['stop'],
          data: { op: 'anchor', date: today, text },
        });
      }

      if (op === 'capture') {
        if (!text) {
          return toolError({ ok: false, tool: 'argus_watch', error_code: 'TEXT_REQUIRED', message: 'op=capture needs the sentence to keep in `text`.', recovery: 'Pass it verbatim — no rewrite, no summary.' });
        }
        const source = a['source'] === 'ai_surfaced' ? 'ai_surfaced' : a['source'] === 'user_stated' ? 'user_stated' : null;
        if (!source) {
          return toolError({ ok: false, tool: 'argus_watch', error_code: 'PROVENANCE_REQUIRED', message: 'op=capture needs `source` (user_stated | ai_surfaced).', recovery: 'Say who said it — never forge provenance.' });
        }
        if (source === 'ai_surfaced' && !(typeof a['ai_original'] === 'string' && a['ai_original'].trim())) {
          return toolError({ ok: false, tool: 'argus_watch', error_code: 'PROVENANCE_REQUIRED', message: 'source="ai_surfaced" requires `ai_original` (the model\'s original wording, verbatim).', recovery: 'Pass ai_original, or use source="user_stated" if these are the user\'s words.' });
        }
        const kind = a['kind'] === 'claim' || a['kind'] === 'question' ? a['kind'] : 'premise';
        const cid = captureId(today, text);
        await ensurePrivacyGitignore(dir);
        await appendLedger(dir, [{
          id: `watch-${today}`, event: 'watch_capture', capture_id: cid, text, kind, source, anchor_date: today,
          ...(source === 'ai_surfaced' ? { ai_original: String(a['ai_original']).trim() } : {}),
        }], now);
        return envelope({
          ok: true, tool: 'argus_watch', surface: W.captured(kind),
          next_actions: ['argus_capture', 'stop'],
          data: { op: 'capture', capture_id: cid, date: today, kind, text, source },
        });
      }

      // op === 'list' — read-only view of the recent watch log.
      const ledger = replayLedger(dir, today);
      const days = typeof a['days'] === 'number' ? Math.max(1, Math.min(30, Math.floor(a['days']))) : 2;
      const cutoff = new Date(Date.parse(today) - (days - 1) * 86400000).toISOString().slice(0, 10);
      const anchors = [...ledger.watch.anchors.values()].filter((x) => x.date >= cutoff).sort((x, y) => (x.date < y.date ? 1 : -1));
      const captures = ledger.watch.captures.filter((c) => c.date >= cutoff);
      return envelope({
        ok: true, tool: 'argus_watch', surface: W.listed(anchors.length, captures.length),
        next_actions: ['stop'],
        data: { op: 'list', since: cutoff, anchors, captures },
      });
    } catch (e) {
      return handleToolException('argus_watch', e);
    }
  },
};
