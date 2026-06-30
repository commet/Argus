import type { McpToolResult } from '../lib/envelope.js';

export interface ToolAnnotations {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

export interface ToolModule {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  annotations?: ToolAnnotations;
  handler: (args: Record<string, unknown>) => Promise<McpToolResult>;
}

/** Shared envelope output schema fragment (structuredContent contract). */
export const ENVELOPE_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    tool: { type: 'string' },
    surface: { type: 'string' },
    next_actions: { type: 'array', items: { type: 'string' } },
    data: { type: 'object' },
    over_fire_gate: { type: 'object' },
    error_code: { type: 'string' },
    message: { type: 'string' },
  },
  required: ['ok', 'tool'],
} as const;
