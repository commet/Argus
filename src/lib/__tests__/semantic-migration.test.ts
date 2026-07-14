import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260714_project_semantic_events.sql'),
  'utf8',
);

describe('project semantic ledger migration contract', () => {
  it('keeps browser writes closed and the append RPC service-role only', () => {
    expect(migration).toContain('ALTER TABLE public.project_semantic_events ENABLE ROW LEVEL SECURITY');
    expect(migration).not.toMatch(/CREATE POLICY[\s\S]{0,200}FOR\s+(INSERT|UPDATE|DELETE|ALL)/i);
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.append_project_semantic_events(uuid, uuid, jsonb) FROM PUBLIC');
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.append_project_semantic_events(uuid, uuid, jsonb) FROM anon, authenticated');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.append_project_semantic_events(uuid, uuid, jsonb) TO service_role');
  });

  it('atomically binds a first seal to the project pointer without overwriting another judgment', () => {
    expect(migration).toContain("WHERE value->>'event' = 'judgment_sealed'");
    expect(migration).toContain("'{semantic_judgment_id}'");
    expect(migration).toContain("decision_contract->>'semantic_judgment_id' = v_judgment_id");
    expect(migration).toContain("RAISE EXCEPTION 'SEMANTIC_JUDGMENT_CONFLICT'");
  });

  it('retains atomic retry and per-project serialization guards', () => {
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toContain("RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'");
    expect(migration).toContain("RAISE EXCEPTION 'EVENT_ID_CONFLICT'");
  });
});
