import { describe, it, expect } from 'vitest';
import { TOOLS } from '../index.js';
import { toolJsonSchema } from '../tool-types.js';
import { seal } from '../seal.js';
import { settle } from '../settle.js';
import { sync } from '../sync.js';
import { openDecision } from '../open-decision.js';

describe('Zod source → JSON Schema (tools/list)', () => {
  it.each(TOOLS.map((t) => [t.name, t] as const))('%s generates a clean object JSON schema', (_name, tool) => {
    const json = toolJsonSchema(tool.inputSchema) as Record<string, unknown>;
    expect(json.type).toBe('object');
    expect('$schema' in json).toBe(false); // stripped for MCP cleanliness
    expect(json.properties).toBeTruthy();
  });

  it('marks required vs optional correctly (seal)', () => {
    const json = toolJsonSchema(seal.inputSchema) as { required?: string[]; additionalProperties?: boolean };
    expect(json.required).toEqual(expect.arrayContaining(['id', 'predicate', 'check_by', 'predicate_owner']));
    expect(json.required).not.toContain('basis'); // optional
    // argus_dir is intentionally OPTIONAL — resolves from the ARGUS_DIR env var.
    expect(json.required).not.toContain('argus_dir');
    expect(json.additionalProperties).toBe(false); // strict
  });

  it('argus_dir is optional on every tool that takes it (ARGUS_DIR env fallback)', () => {
    for (const t of TOOLS) {
      const json = toolJsonSchema(t.inputSchema) as { properties?: Record<string, unknown>; required?: string[] };
      if (json.properties && 'argus_dir' in json.properties) {
        expect(json.required ?? []).not.toContain('argus_dir');
      }
    }
  });

  it('gives every advertised input field a Korean description', () => {
    const missing: string[] = [];
    const visit = (toolName: string, node: unknown, path = ''): void => {
      if (!node || typeof node !== 'object') return;
      const record = node as Record<string, unknown>;
      const properties = record.properties;
      if (properties && typeof properties === 'object') {
        for (const [key, raw] of Object.entries(properties as Record<string, unknown>)) {
          const field = raw as Record<string, unknown>;
          const description = String(field.description ?? '');
          if (!/[가-힣]/.test(description)) missing.push(`${toolName}:${path}${key}`);
          visit(toolName, field, `${path}${key}.`);
        }
      }
      if (record.items) visit(toolName, record.items, path);
      for (const branch of ['anyOf', 'oneOf', 'allOf']) {
        if (Array.isArray(record[branch])) {
          for (const child of record[branch] as unknown[]) visit(toolName, child, path);
        }
      }
    };
    for (const tool of TOOLS) visit(tool.name, toolJsonSchema(tool.inputSchema));
    expect(missing).toEqual([]);
  });
});

describe('tool annotations are complete (mcp-builder §Annotations)', () => {
  it.each(TOOLS.map((t) => [t.name, t] as const))('%s declares a title + all four hints', (_name, tool) => {
    const a = tool.annotations ?? {};
    expect(typeof a.title).toBe('string');
    expect(typeof a.readOnlyHint).toBe('boolean');
    expect(typeof a.destructiveHint).toBe('boolean');
    expect(typeof a.idempotentHint).toBe('boolean');
    expect(typeof a.openWorldHint).toBe('boolean');
  });

  it('no argus tool is destructive (append-only ledger, no deletes)', () => {
    for (const t of TOOLS) expect(t.annotations?.destructiveHint).toBe(false);
  });

  it('the two network-touching tools (seal, settle) declare openWorldHint', () => {
    expect(seal.annotations?.openWorldHint).toBe(true);
    expect(settle.annotations?.openWorldHint).toBe(true);
  });
});

describe('runtime input validation (what the server dispatch enforces)', () => {
  it('seal: rejects a too-short predicate and a bad date', () => {
    const bad = seal.inputSchema.safeParse({ argus_dir: '/x', id: 'd1', predicate: 'short', check_by: 'soon', predicate_owner: 'user' });
    expect(bad.success).toBe(false);
  });

  it('seal: accepts a valid input', () => {
    const ok = seal.inputSchema.safeParse({ argus_dir: '/x', id: 'd1', predicate: 'cutover under five min', check_by: '2027-01-01', predicate_owner: 'user' });
    expect(ok.success).toBe(true);
  });

  it('seal: forbids the wrong predicate_owner enum + unknown keys (strict)', () => {
    expect(seal.inputSchema.safeParse({ argus_dir: '/x', id: 'd1', predicate: 'a valid predicate here', check_by: '2027-01-01', predicate_owner: 'model' }).success).toBe(false);
    expect(seal.inputSchema.safeParse({ argus_dir: '/x', id: 'd1', predicate: 'a valid predicate here', check_by: '2027-01-01', predicate_owner: 'user', bogus: 1 }).success).toBe(false);
  });

  it('settle: outcome is optional but outcome_source must be user_stated', () => {
    expect(settle.inputSchema.safeParse({ argus_dir: '/x', id: 'd1', outcome_source: 'user_stated', what_happened: 'x' }).success).toBe(true);
    expect(settle.inputSchema.safeParse({ argus_dir: '/x', id: 'd1', outcome_source: 'ai_inferred', what_happened: 'x' }).success).toBe(false);
  });

  it('sync: applies the limit default and enforces the max', () => {
    const parsed = sync.inputSchema.safeParse({});
    expect(parsed.success).toBe(true);
    expect(parsed.success && (parsed.data as { limit: number }).limit).toBe(50);
    expect(sync.inputSchema.safeParse({ limit: 9999 }).success).toBe(false);
  });

  it('open_decision: enforces the id pattern and stakes enum', () => {
    const base = { argus_dir: '/x', decision: 'do the thing', reversibility: 'one_way_door', status_quo: 'nothing' };
    expect(openDecision.inputSchema.safeParse({ ...base, id: 'bad id!', stakes: 'high' }).success).toBe(false); // space + !
    expect(openDecision.inputSchema.safeParse({ ...base, id: 'ok-id', stakes: 'huge' }).success).toBe(false); // bad enum
    expect(openDecision.inputSchema.safeParse({ ...base, id: 'ok-id', stakes: 'high' }).success).toBe(true);
  });
});
