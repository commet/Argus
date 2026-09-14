import { describe, expect, it } from 'vitest';
import {
  DECISION_CASE_EXCHANGE_VERSION,
  DecisionCaseExchangeProjectionV1Schema,
  parseDecisionCaseExchangeProjectionV1,
} from '../decision-case-exchange';

const projection = {
  schema_version: DECISION_CASE_EXCHANGE_VERSION,
  aggregate_id: 'case_1',
  linked_aggregate_ids: [],
  origin: {
    surface: 'web' as const,
    instance_id: 'web_test',
    canonical_stream: 'semantic_v3' as const,
  },
  baseline: { status: 'not_captured' as const },
  contribution: { status: 'none' as const },
  adoption: { status: 'not_adopted' as const },
  next_move: { status: 'not_captured' as const },
  return: { permission: { status: 'pending' as const }, lifecycle: 'none' as const },
  observations: [],
  lessons: [],
  chronology: { completeness: 'complete' as const, events: [] },
};

describe('Decision Case Exchange projection v1', () => {
  it('survives a JSON transport round-trip without semantic loss', () => {
    const transported = JSON.parse(JSON.stringify(projection)) as unknown;
    expect(parseDecisionCaseExchangeProjectionV1(transported)).toEqual(projection);
  });

  it('rejects undeclared fields instead of silently accepting protocol drift', () => {
    expect(DecisionCaseExchangeProjectionV1Schema.safeParse({
      ...projection,
      inferred_user_quality: 0.91,
    }).success).toBe(false);
  });
});
