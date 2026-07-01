import { z } from 'zod';
import type { McpToolResult } from '../lib/envelope.js';

export interface ToolAnnotations {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

/**
 * A tool's input schema is a Zod object — the SINGLE source of truth. It powers
 * BOTH runtime validation (safeParse at dispatch, in server.ts) AND the JSON
 * Schema advertised in tools/list (generated via z.toJSONSchema). No hand-kept
 * JSON schema to drift from the validator (mcp-builder best-practices §Zod).
 */
export type ToolInputSchema = z.ZodType;

export interface ToolModule {
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
  /** kept for reference; the server advertises z.toJSONSchema(inputSchema). */
  outputSchema?: Record<string, unknown>;
  annotations?: ToolAnnotations;
  handler: (args: Record<string, unknown>) => Promise<McpToolResult>;
}

// ── Shared field builders (DRY — argus_dir / id / date recur on every tool) ──
export const zArgusDir = z.string().describe('Absolute path to the .argus directory. No "..".');
export const zId = z.string().regex(/^[A-Za-z0-9._-]+$/, 'id may only contain A-Z a-z 0-9 . _ -');
export const zDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');

/** JSON Schema for tools/list, generated from the Zod source (drop $schema noise). */
export function toolJsonSchema(schema: ToolInputSchema): Record<string, unknown> {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  delete json['$schema'];
  return json;
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
