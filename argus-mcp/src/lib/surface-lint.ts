import { hasUnsafeChars } from './untrusted.js';

/**
 * Surface lint (self-drive loop, blueprint §5 tooling). A DETERMINISTIC,
 * no-model check over the human-facing text an Argus tool actually returns — the
 * MCP analog of a Playwright assertion, but there is no browser to drive: a tool
 * "surface" is just the `surface`/`message` string in the response envelope.
 *
 * Two things it guards, both spine invariants that must never silently rot:
 *   1. CONTRACT — an ok response carries a human line (`surface`) and a handle
 *      (`next_actions`); an error names itself (`error_code`) AND offers a way
 *      out (`recovery` / `recovery_action`). A broken wire here is exactly the
 *      "plausible but empty" failure the LLM-glue invariant forbids.
 *   2. VERDICT LEAK — the free text must not tell the user which way to go. The
 *      directional tells live HERE as the single source; `validate-crux.ts`
 *      imports them so the crux guard and the surface guard can never drift.
 *
 * HONEST LIMIT: the verdict tells are a curated regex, not a proof. They catch
 * the obvious leaks a refactor introduces; a model narrating in chat between
 * tool calls is still out of reach (that is the Tier-2 eval's job, not this).
 */

// Directional / recommendation tells — the SINGLE source, shared with the crux
// guard. Decomposed to real phrases (not bare "id"/"or") to keep false
// positives near zero on ordinary surfaces ("P1 retired", "recorded", …).
export const VERDICT_LEAN =
  /\b(you should|i'd|i would|the (stronger|better|safer|smarter) (case|choice|option|move|bet)|most (teams|people|founders)|the right (call|move|choice)|go with|lean(s)? toward|my (recommendation|advice|take)|honestly,? (i|you)|if i were you)\b/i;
// Two-pole fork tell ("A or B?" framed as the question/answer).
export const VERDICT_FORK = /\b(a or b|option (a|b|1|2)|either\b.*\bor\b.*\?)/i;
// Leading confirmation ("is this the right direction?") — a verdict in disguise.
export const VERDICT_CONFIRM_EN = /\b(does this look right|is this (the )?(right )?(direction|call|approach))\b/i;
export const VERDICT_CONFIRM_KO =
  /이\s*방향(이|으로)?\s*맞(나요|죠|습니까|을까요)|(이게|이\s*방향이)\s*맞다고\s*보(시|나요|죠)/;

const VERDICT_TELLS: RegExp[] = [VERDICT_LEAN, VERDICT_FORK, VERDICT_CONFIRM_EN, VERDICT_CONFIRM_KO];

/** The one directional-language check both the crux guard and surfaces use. */
export function detectVerdictLeak(text: unknown): string | null {
  if (typeof text !== 'string') return null;
  const t = text.normalize('NFC');
  if (!t.trim()) return null;
  for (const re of VERDICT_TELLS) {
    const m = t.match(re);
    if (m) return m[0];
  }
  return null;
}

export interface SurfaceFinding {
  severity: 'red' | 'yellow';
  rule:
    | 'missing-surface'
    | 'no-next-actions'
    | 'missing-error-code'
    | 'missing-recovery'
    | 'verdict-leak'
    | 'unsafe-chars'
    | 'surface-too-long';
  message: string;
  excerpt?: string;
}

const SURFACE_MAX = 600; // a surface is one human line, not a paragraph

/**
 * Lint one tool-response envelope (the parsed `structuredContent`). Pure and
 * deterministic — same input, same findings. RED = a spine/contract break;
 * YELLOW = a smell worth a look, not a failure.
 */
export function lintEnvelope(env: unknown): SurfaceFinding[] {
  const out: SurfaceFinding[] = [];
  if (!env || typeof env !== 'object') {
    return [{ severity: 'red', rule: 'missing-surface', message: 'response has no structured envelope' }];
  }
  const e = env as Record<string, unknown>;

  if (e['ok'] === true) {
    const surface = e['surface'];
    if (typeof surface !== 'string' || !surface.trim()) {
      out.push({ severity: 'red', rule: 'missing-surface', message: 'ok response carries no human-readable surface' });
    } else {
      const leak = detectVerdictLeak(surface);
      if (leak) {
        out.push({ severity: 'red', rule: 'verdict-leak', message: `surface states a verdict ("${leak}")`, excerpt: surface.slice(0, 140) });
      }
      // envelope() strips these, so seeing one here means the surface was built
      // and inspected on a path that bypassed the chokepoint. Fail loud.
      if (hasUnsafeChars(surface)) {
        out.push({ severity: 'red', rule: 'unsafe-chars', message: 'surface carries control/bidi/zero-width characters (terminal-escape or homograph injection vector)' });
      }
      // A keepsake card (seal plate / judgment receipt / logbook — the boxed
      // '┌─ ARGUS' artifacts) is deliberately bigger than a line; length-lint
      // only the prose surfaces.
      if (surface.length > SURFACE_MAX && !surface.includes('┌─ ARGUS')) {
        out.push({ severity: 'yellow', rule: 'surface-too-long', message: `surface is ${surface.length} chars (>${SURFACE_MAX}) — a line, not a paragraph`, excerpt: surface.slice(0, 140) });
      }
    }
    const na = e['next_actions'];
    if (!Array.isArray(na) || na.length === 0) {
      out.push({ severity: 'yellow', rule: 'no-next-actions', message: 'ok response offers no next_actions handle' });
    }
  } else {
    // error envelope: it must name itself and offer a way out.
    if (typeof e['error_code'] !== 'string' || !String(e['error_code']).trim()) {
      out.push({ severity: 'red', rule: 'missing-error-code', message: 'error response has no error_code' });
    }
    const hasRecovery =
      (typeof e['recovery'] === 'string' && String(e['recovery']).trim().length > 0) ||
      (typeof e['recovery_action'] === 'string' && String(e['recovery_action']).trim().length > 0);
    if (!hasRecovery) {
      out.push({ severity: 'red', rule: 'missing-recovery', message: 'error response offers no recovery path (honest-gap violation)' });
    }
    // an error message is human-facing too — it can leak a verdict.
    const leak = detectVerdictLeak(e['message']);
    if (leak) out.push({ severity: 'red', rule: 'verdict-leak', message: `error message states a verdict ("${leak}")`, excerpt: String(e['message']).slice(0, 140) });
  }
  return out;
}
