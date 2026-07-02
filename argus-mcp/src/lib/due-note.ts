import { replayLedger } from './ledger-replay.js';
import { duePremises, groupDuePremises } from './premises.js';
import { resolveToolArgusDir } from './argus-dir.js';
import { resolveToday } from './resolve-today.js';
import type { McpToolResult } from './envelope.js';

/**
 * Dispatch-level due-note piggyback (plan v5 §5-2, restraint rules §3.4).
 *
 * An MCP server is passive — nothing wakes it between seal and settle. The one
 * moment it reliably has is WHEN THE USER IS ALREADY HERE: any successful tool
 * call. So the dispatcher quietly annotates every ok-envelope with what is due.
 *
 * Restraint, by construction:
 *  - counts only, in `data.due_note` — the surface line stays about the tool
 *    that was called; whether to raise the note is the HOST's choice
 *  - absent entirely at zero (an empty nag cannot be expressed)
 *  - argus_check_in is skipped (it IS the due surface — no duplication)
 *  - never overwrites a due_note a tool set itself; never touches errors
 *  - any internal failure returns the result untouched (a broken note must
 *    never tax the tool call that succeeded)
 */
const SKIP_TOOLS = new Set(['argus_check_in']);

export function appendDueNote(
  toolName: string,
  args: Record<string, unknown>,
  result: McpToolResult,
): McpToolResult {
  try {
    if (result.isError || SKIP_TOOLS.has(toolName)) return result;
    const sc = result.structuredContent as Record<string, unknown> | undefined;
    if (!sc || sc['ok'] !== true) return result;

    const dir = resolveToolArgusDir(args['argus_dir']); // unbound → throws → untouched
    const today = resolveToday({ override: args['today_override'] as string | undefined });
    const state = replayLedger(dir, today);

    const contractsDue = state.overdue.length;
    const premiseFactsDue = groupDuePremises(duePremises(state)).length;
    if (contractsDue === 0 && premiseFactsDue === 0) return result;

    const parts: string[] = [];
    if (premiseFactsDue > 0) parts.push(`${premiseFactsDue} premise fact(s) to re-check (argus_recheck)`);
    if (contractsDue > 0) parts.push(`${contractsDue} contract(s) to settle (argus_settle)`);

    const data = (sc['data'] ??= {}) as Record<string, unknown>;
    if (!('due_note' in data)) data['due_note'] = parts.join(' · ');

    const na = sc['next_actions'];
    if (Array.isArray(na) && !na.includes('argus_check_in')) na.push('argus_check_in');

    // Refresh the text mirror — envelope() serialized before this annotation.
    result.content = [{ type: 'text', text: JSON.stringify(sc, null, 2) }];
    return result;
  } catch {
    return result;
  }
}
