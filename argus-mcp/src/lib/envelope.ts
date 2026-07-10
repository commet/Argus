import type { NextAction } from './spine.js';
import { sanitizeOutput } from './untrusted.js';

/**
 * Common tool output envelope (blueprint §2). `next_actions` is a closed enum
 * with no judgment member (the absence is the enforcement). It is a HINT — the
 * real enforcement is the server-side guards, not this list (m5).
 *
 * Every tool returns BOTH `structuredContent` (for hosts that validate against
 * outputSchema) AND a `text` mirror (spec-required fallback for non-structured
 * clients).
 */
export interface ArgusEnvelope {
  ok: true;
  tool: string;
  surface: string;            // one spine-safe human line
  next_actions: NextAction[]; // hint, not enforcement
  data: Record<string, unknown>;
  over_fire_gate?: { fired: boolean; reason: string };
}

export interface ArgusErrorData {
  ok: false;
  tool: string;
  error_code: string;
  message: string;            // written so the model can recover
  recovery_action?: NextAction;
  recovery?: string;
}

export interface McpToolResult {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

/**
 * Every tool's output funnels through these two functions, which makes them the
 * one place a trust boundary can be enforced without relying on a dozen
 * interpolation sites remembering to. Recorded text (a user's anchor, a premise
 * lifted from a document, a `source_title` off the account API) is echoed into
 * `surface` and `data`, and the host model reads all of it as trusted output.
 *
 * `sanitizeOutput` removes the MECHANICAL vectors — ANSI/terminal escapes,
 * carriage-return overwrites, bidi overrides, zero-width smuggling — so the
 * bytes the human sees and the bytes the model reads are the same bytes.
 * Semantic injection is not solvable here; see lib/untrusted.ts.
 */
export function envelope(e: ArgusEnvelope): McpToolResult {
  const safe = sanitizeOutput(e);
  return {
    content: [{ type: 'text', text: JSON.stringify(safe, null, 2) }],
    structuredContent: safe as unknown as Record<string, unknown>,
  };
}

export function toolError(e: ArgusErrorData): McpToolResult {
  const safe = sanitizeOutput(e);
  return {
    content: [{ type: 'text', text: JSON.stringify(safe, null, 2) }],
    structuredContent: safe as unknown as Record<string, unknown>,
    isError: true,
  };
}
