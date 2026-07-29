import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseLedger } from '../plugin-parse';

/**
 * MCP↔web parity (BLUEPRINT §5) for the ONE fact the spine will not compromise:
 * who authored the sealed line.
 *
 * The plugin has always recorded `predicate_owner` on argus_seal, and its own
 * surfaces render an unconfirmed draft differently from a line the user
 * dictated. The webapp bridge dropped the field entirely — so a draft Argus
 * wrote crossed into the account looking exactly like the user's own judgment.
 * That is CLAUDE.md rule 1 ("never lie about authorship") failing at a surface
 * boundary, where no single-surface test could see it.
 */
describe('plugin bridge — provenance survives the crossing', () => {
  const ledger = (events: Record<string, unknown>[]) =>
    events.map((e) => JSON.stringify(e)).join('\n');

  it('carries an ai_surfaced seal across as ai_surfaced', () => {
    const out = parseLedger(ledger([
      { event: 'harvest', id: 'd1', decision: 'Move billing', at: '2026-07-20T09:00:00Z' },
      { event: 'seal', id: 'd1', predicate: 'Billing migrated by Aug 5', check_by: '2026-08-05', predicate_owner: 'ai_surfaced', at: '2026-07-20T09:05:00Z' },
    ]));
    expect(out[0].predicate_owner).toBe('ai_surfaced');
  });

  it("carries a user-dictated seal across as the user's", () => {
    const out = parseLedger(ledger([
      { event: 'harvest', id: 'd2', decision: 'Hold the price', at: '2026-07-20T09:00:00Z' },
      { event: 'seal', id: 'd2', predicate: 'No price change before Q4', check_by: '2026-10-01', predicate_owner: 'user', at: '2026-07-20T09:05:00Z' },
    ]));
    expect(out[0].predicate_owner).toBe('user');
  });

  it('leaves a pre-2026-07 ledger UNKNOWN — absence is never upgraded to "user"', () => {
    const out = parseLedger(ledger([
      { event: 'harvest', id: 'd3', decision: 'Old one', at: '2026-05-01T09:00:00Z' },
      { event: 'seal', id: 'd3', predicate: 'Shipped by June', check_by: '2026-06-01', at: '2026-05-01T09:05:00Z' },
    ]));
    expect(out[0].predicate_owner).toBeUndefined();
  });

  it('ignores a garbage provenance value rather than trusting it', () => {
    const out = parseLedger(ledger([
      { event: 'harvest', id: 'd4', decision: 'X', at: '2026-07-20T09:00:00Z' },
      { event: 'seal', id: 'd4', predicate: 'p', check_by: '2026-08-05', predicate_owner: 'definitely_the_user', at: '2026-07-20T09:05:00Z' },
    ]));
    expect(out[0].predicate_owner).toBeUndefined();
  });
});

/**
 * The parser above can only read what the WRITER emits. The two live in
 * different packages, so nothing in the type system connects them: if the MCP
 * seal stopped writing `predicate_owner`, every test above would still pass and
 * provenance would quietly go blank again. Pin the producer at the source.
 */
describe('plugin bridge — the producing side still writes provenance', () => {
  const sealSrc = readFileSync(join(process.cwd(), 'argus-mcp/src/tools/seal.ts'), 'utf8');

  it('argus_seal records predicate_owner on the ledger seal event itself', () => {
    const sealEvent = sealSrc.slice(
      sealSrc.indexOf("events.push({"),
      sealSrc.indexOf("events.push({") + 500,
    );
    expect(sealEvent).toContain("event: 'seal'");
    expect(sealEvent).toContain('predicate_owner');
  });

  it('the ledger event type still declares the field the web bridge reads', () => {
    const appendSrc = readFileSync(join(process.cwd(), 'argus-mcp/src/lib/ledger-append.ts'), 'utf8');
    expect(appendSrc).toMatch(/predicate_owner\?:\s*'user'\s*\|\s*'ai_surfaced'/);
  });
});

describe('plugin bridge — a seal without its harvest is not silently lost', () => {
  it('self-creates the decision instead of dropping it (parity with ledger-replay B1)', () => {
    // A truncated or partially-synced ledger loses the harvest line first (it is
    // the oldest). The old `if (cur)` guard discarded the entire sealed decision
    // with no error and no trace — the loudest possible silent data loss for a
    // product whose whole promise is "your prediction comes back".
    const out = parseLedger([
      JSON.stringify({ event: 'seal', id: 'orphan1', predicate: 'Churn under 3% by Sep', check_by: '2026-09-01', predicate_owner: 'user', at: '2026-07-20T09:05:00Z' }),
    ].join('\n'));
    expect(out).toHaveLength(1);
    expect(out[0].ledger_id).toBe('orphan1');
    expect(out[0].status).toBe('sealed');
    expect(out[0].predicate).toBe('Churn under 3% by Sep');
    expect(out[0].predicate_owner).toBe('user');
  });

  it('still settles an orphan-sealed decision', () => {
    const out = parseLedger([
      JSON.stringify({ event: 'seal', id: 'orphan2', predicate: 'p', check_by: '2026-09-01', at: '2026-07-20T09:05:00Z' }),
      JSON.stringify({ event: 'settle', id: 'orphan2', outcome: 'happened', at: '2026-09-02T09:05:00Z' }),
    ].join('\n'));
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe('settled');
    expect(out[0].outcome).toBe('happened');
  });
});
