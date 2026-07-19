import fs from 'fs';
import { replayLedger } from './ledger-replay.js';
import { resolveToolArgusDir } from './argus-dir.js';
import { resolveToday } from './resolve-today.js';
import { configPath } from './layout.js';
import { ambientDueFromState, ambientLine } from './ambient-due.js';
import { stripUnsafeChars } from './untrusted.js';
import type { McpToolResult } from './envelope.js';

/**
 * Dispatch-level ambient due-note (plan v5 §5-2 · M1 §1.3, restraint rules §3.4).
 *
 * An MCP server is passive — nothing wakes it between seal and settle. The one
 * moment it reliably has is WHEN THE USER IS ALREADY HERE: any successful tool
 * call. So the dispatcher quietly annotates every ok-envelope with what is due,
 * on TWO channels sharing ONE due count (ambient-due.ts — single source, so this
 * can never drift from check_in):
 *
 *  1. data.due_note — machine counts (host-choice; unchanged, back-compat).
 *  2. surface tail  — ONE localized FACT line so a due item is not forgotten
 *     mid-session (M1 §1.3). Appended LAST so it never obscures the tool's own
 *     result; a fact + the argus_check_in handle, never a directive.
 *
 * Restraint, by construction:
 *  - absent entirely at zero (an empty nag cannot be expressed)
 *  - the surface line fires AT MOST ONCE per session/process (not on every tool
 *    call) — the count channel still annotates each call for hosts that read it
 *  - `ambient_mute: true` in config.yaml silences the surface line (the escape)
 *  - argus_check_in is skipped (it IS the due surface — no duplication)
 *  - never overwrites a due_note a tool set itself; never touches errors
 *  - any internal failure returns the result untouched (a broken note must
 *    never tax the tool call that succeeded)
 */
const SKIP_TOOLS = new Set(['argus_check_in']);

/** Session-once gate for the SURFACE line: one stdio process = one session, so a
 *  process-lifetime Set keyed by argus_dir fires the ambient line only on the
 *  first eligible tool call and stays quiet after (the count channel is not
 *  gated). Reset for tests via resetAmbientSession(). */
const ambientShownFor = new Set<string>();
export function resetAmbientSession(): void {
  ambientShownFor.clear();
}

function ambientMuted(argusDir: string): boolean {
  try {
    const cfg = fs.readFileSync(configPath(argusDir), 'utf8');
    return /^ambient_mute:\s*true\b/m.test(cfg);
  } catch {
    return false; // no config → not muted
  }
}

export function appendDueNote(
  toolName: string,
  args: Record<string, unknown>,
  result: McpToolResult,
): McpToolResult {
  try {
    if (result.isError) return result;
    if (SKIP_TOOLS.has(toolName)) {
      // check_in IS the due surface — a session that saw it has had its ambient
      // budget spent. Without this mark, the tail re-fired on the NEXT call and
      // read as a debt count at the worst moment (experience loop: it rode the
      // settle right after a check_in triage — "one done, here are your 2 left").
      try { ambientShownFor.add(resolveToolArgusDir(args['argus_dir'])); } catch { /* unbound → nothing to mark */ }
      return result;
    }
    const sc = result.structuredContent as Record<string, unknown> | undefined;
    if (!sc || sc['ok'] !== true) return result;

    const dir = resolveToolArgusDir(args['argus_dir']); // unbound → throws → untouched
    const today = resolveToday({ override: args['today_override'] as string | undefined });
    const state = replayLedger(dir, today);
    const due = ambientDueFromState(state); // SINGLE SOURCE (shared with check_in via ambient-due)
    if (due.contractsDue === 0 && due.premiseFactsDue === 0 && due.openQuestionsDue === 0) return result;

    // ── channel 1: machine counts (host-choice; unchanged) ──
    const parts: string[] = [];
    if (due.premiseFactsDue > 0) parts.push(`${due.premiseFactsDue} premise fact(s) to re-check (argus_capture action=update_fact)`);
    if (due.openQuestionsDue > 0) parts.push(`${due.openQuestionsDue} open question(s) to reconsider (argus_capture)`);
    if (due.contractsDue > 0) parts.push(`${due.contractsDue} prediction result(s) to record (argus_resolve)`);
    const data = (sc['data'] ??= {}) as Record<string, unknown>;
    if (!('due_note' in data)) data['due_note'] = parts.join(' · ');

    const na = sc['next_actions'];
    if (Array.isArray(na) && !na.includes('argus_check_in')) na.push('argus_check_in');

    // ── channel 2: the surface tail — session-once, mute-respecting, localized ──
    if (!ambientShownFor.has(dir) && !ambientMuted(dir)) {
      // This tail is appended AFTER envelope() already ran sanitizeOutput, so it
      // must be sanitized itself — ambientLine reads ledger text (via `state`),
      // and one future change that quotes the ledger's words would otherwise
      // inject past the sanitizer.
      const line = stripUnsafeChars(ambientLine(dir, due, state));
      if (line && typeof sc['surface'] === 'string') {
        sc['surface'] = String(sc['surface']) + line;
        data['ambient_shown'] = true;
      }
      ambientShownFor.add(dir); // once per session regardless (mute or empty line included)
    }

    // Refresh the text mirror — envelope() serialized before this annotation.
    result.content = [{ type: 'text', text: JSON.stringify(sc, null, 2) }];
    return result;
  } catch {
    return result;
  }
}
