import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { deriveDecisionKind } from './kind.js';
import type { DecisionKind } from './types.js';

interface KindCase {
  id: string;
  statement: string;
  explicit_kind?: DecisionKind;
  record_only?: boolean;
  has_return_handle?: boolean;
  expected_kind: DecisionKind;
  expected_rule: string;
}

const fixture = JSON.parse(readFileSync(
  new URL('../../../data/contracts/judgment-foundation-conformance.json', import.meta.url),
  'utf8',
)) as { kind_cases: KindCase[] };

describe('MCP shared foundation conformance', () => {
  it.each(fixture.kind_cases)('$id', (item) => {
    expect(deriveDecisionKind({
      statement: item.statement,
      explicit_kind: item.explicit_kind,
      record_only: item.record_only,
      has_return_handle: item.has_return_handle,
    })).toEqual({
      kind: item.expected_kind,
      rule: item.expected_rule,
    });
  });
});
