import type { NextAction } from './spine.js';

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

export function envelope(e: ArgusEnvelope): McpToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(e, null, 2) }],
    structuredContent: e as unknown as Record<string, unknown>,
  };
}

export function toolError(e: ArgusErrorData): McpToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(e, null, 2) }],
    structuredContent: e as unknown as Record<string, unknown>,
    isError: true,
  };
}
