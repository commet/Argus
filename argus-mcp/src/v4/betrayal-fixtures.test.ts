import { describe, expect, it } from 'vitest';
import {
  AssertionSchema,
  SemanticEventSchema,
  type Assertion,
  type SemanticEvent,
} from './types.js';
import {
  canUseRelationForCoaching,
  fold,
  foldAsOf,
  projectDecision,
} from './reducer.js';
import { validateRelationCandidate } from './relation-validation.js';
import { canWatchAssertion, evaluateWatchCheck } from './watch.js';
import { isV4ShadowEnabled, shadowWrite } from './shadow.js';

const T0 = '2026-07-16T00:00:00.000Z';
const T1 = '2026-07-17T00:00:00.000Z';
const T2 = '2026-07-18T00:00:00.000Z';

const human = {
  originated_by: { kind: 'human' as const, id: 'human:local:test' },
  recorded_by: { kind: 'host' as const, id: 'fixture' },
  authorized_by: { kind: 'human' as const, id: 'human:local:test' },
  authorization_mode: 'explicit_confirmation' as const,
  authorization_ref: { kind: 'command_digest' as const, ref: 'sha256:fixture' },
};

const ai = {
  originated_by: { kind: 'ai' as const, id: 'model:test' },
  recorded_by: { kind: 'host' as const, id: 'fixture' },
};

const system = {
  originated_by: { kind: 'system' as const, id: 'argus:test' },
  recorded_by: { kind: 'system' as const, id: 'argus:test' },
};

const base = (eventId: string, recordedAt = T0) => ({
  event_id: eventId,
  v: 4 as const,
  space_id: 'space:test',
  idempotency_key: `idem:${eventId}`,
  time: { recorded_at: recordedAt, temporal_mode: 'contemporaneous' as const },
});

const decisionOpened = (): SemanticEvent => SemanticEventSchema.parse({
  ...base('decision:opened'),
  authority: human,
  event: 'decision_opened',
  decision_id: 'decision:launch',
  question: 'Should we launch this week?',
});

const prediction = (id = 'assertion:prediction:initial', proposition = 'Launch will reach 20 teams by August.'): Assertion =>
  AssertionSchema.parse({
    assertion_id: id,
    role: 'prediction',
    proposition,
    scope: {
      subject_ref: 'product:argus',
      predicate_ref: 'metric:active_teams',
      metric: 'active_teams',
      unit: 'teams',
      valid_time: { from: '2026-08-01T00:00:00.000Z', to: '2026-08-31T23:59:59.000Z' },
    },
    modality: 'expected',
    polarity: 'positive',
  });

const predictionRecorded = (): SemanticEvent => SemanticEventSchema.parse({
  ...base('prediction:recorded'),
  authority: human,
  event: 'assertion_recorded',
  assertion: prediction(),
});

const firstJudgment = (): SemanticEvent => SemanticEventSchema.parse({
  ...base('judgment:1'),
  authority: human,
  event: 'judgment_sealed',
  judgment_id: 'judgment:launch:1',
  decision_id: 'decision:launch',
  version: 1,
  statement: 'Launch this week.',
  assertion_refs: ['assertion:prediction:initial'],
  basis_known_as_of: T0,
});

const evidence = (id: string): SemanticEvent => SemanticEventSchema.parse({
  ...base(`evidence:${id}`),
  authority: system,
  provenance: { source_kind: 'host_report', source_ref: `https://example.test/${id}`, verification: 'host_reported' },
  event: 'evidence_recorded',
  evidence: {
    evidence_id: id,
    kind: 'url',
    locator: `https://example.test/${id}`,
    content_hash: `sha256:${id}`,
    retrieved_at: T0,
    access: 'available',
  },
});

const premise = (id: string, subjectRef = 'team:support'): Assertion => AssertionSchema.parse({
  assertion_id: id,
  role: 'premise',
  proposition: 'Support capacity is 30 onboardings per day.',
  scope: {
    subject_ref: subjectRef,
    predicate_ref: 'capacity:onboarding',
    metric: 'daily_onboarding_capacity',
    unit: 'accounts/day',
    valid_time: { from: '2026-07-01T00:00:00.000Z', to: '2026-07-31T23:59:59.000Z' },
  },
  modality: 'is',
  polarity: 'positive',
});

describe('§14.1 authorship betrayal fixtures', () => {
  it('does not turn an AI proposal into an adopted premise without human authorization', () => {
    const proposal = SemanticEventSchema.parse({
      ...base('proposal:premise'),
      authority: ai,
      event: 'assertion_proposed',
      proposal_id: 'proposal:premise',
      assertion: premise('assertion:premise:capacity'),
    });
    const forgedAdoption = {
      ...base('adopt:forged'),
      authority: ai,
      event: 'assertion_adopted',
      proposal_id: 'proposal:premise',
      decision_id: 'decision:launch',
      assertion: premise('assertion:premise:capacity'),
    };

    expect(SemanticEventSchema.safeParse(forgedAdoption).success).toBe(false);
    const state = fold([decisionOpened(), proposal, forgedAdoption]);
    expect(state.assertions.has('assertion:premise:capacity')).toBe(false);
    expect(state.proposals.get('proposal:premise')?.status).toBe('active');
  });

  it('does not let AI seal a JudgmentVersion', () => {
    const forged = { ...firstJudgment(), event_id: 'judgment:ai', idempotency_key: 'idem:judgment:ai', authority: ai };
    expect(SemanticEventSchema.safeParse(forged).success).toBe(false);
  });

  it('does not let a system-derived relation alter a user resolution or lifecycle', () => {
    const relation = SemanticEventSchema.parse({
      ...base('relation:derived'),
      authority: system,
      event: 'relation_proposed',
      relation: {
        relation_id: 'relation:derived',
        type: 'supports',
        from_ref: { kind: 'assertion', id: 'assertion:prediction:initial' },
        to_ref: { kind: 'judgment', id: 'judgment:launch:1' },
        direction: 'directed',
        evidence_refs: [],
        status: 'proposed',
        proposed_by: { kind: 'system', id: 'argus:test' },
      },
    });
    const state = fold([decisionOpened(), predictionRecorded(), firstJudgment(), relation]);
    const projected = projectDecision(state, 'decision:launch');
    expect(projected?.judgments).toHaveLength(1);
    expect(projected?.judgments[0]?.resolution).toBeUndefined();
    expect(projected?.judgments[0]?.lifecycle).toBe('sealed');
  });

  it('audits the exact items covered by one atomic approval', () => {
    const adopted = ['capacity', 'security'].map((suffix) => SemanticEventSchema.parse({
      ...base(`adopt:${suffix}`),
      authority: human,
      atomic_batch_id: 'batch:premises-and-watch',
      event: 'assertion_adopted',
      proposal_id: `proposal:${suffix}`,
      decision_id: 'decision:launch',
      assertion: premise(`assertion:${suffix}`, suffix === 'capacity' ? 'team:support' : 'requirement:security'),
    }));
    const events = [
      decisionOpened(),
      ...adopted.map((event, index) => ({
        ...base(`proposal:${index === 0 ? 'capacity' : 'security'}`),
        authority: ai,
        event: 'assertion_proposed' as const,
        proposal_id: event.proposal_id,
        assertion: event.assertion,
      })),
      ...adopted,
    ];
    const state = fold(events);
    expect(state.atomic_batches.get('batch:premises-and-watch')).toEqual({
      authorization_ref: 'sha256:fixture',
      event_ids: ['adopt:capacity', 'adopt:security'],
    });
  });
});

describe('§14.2 time and no-overwrite betrayal fixtures', () => {
  it('never overwrites the initial pre-AI prediction during later capture', () => {
    const capture = SemanticEventSchema.parse({
      ...base('capture:later', T1),
      authority: ai,
      event: 'assertion_proposed',
      proposal_id: 'proposal:prediction:rewrite',
      assertion: prediction('assertion:prediction:rewrite', 'Launch will reach 100 teams by August.'),
    });
    const state = fold([decisionOpened(), predictionRecorded(), firstJudgment(), capture]);
    expect(state.assertions.get('assertion:prediction:initial')?.assertion.proposition)
      .toBe('Launch will reach 20 teams by August.');
    expect(state.proposals.get('proposal:prediction:rewrite')?.status).toBe('active');
  });

  it('records a revised judgment as a new version and retains the original', () => {
    const rationale = SemanticEventSchema.parse({
      ...base('rationale:recorded', T1),
      authority: human,
      event: 'assertion_recorded',
      assertion: {
        assertion_id: 'assertion:rationale:security',
        role: 'rationale',
        proposition: 'A newly confirmed security review requires two weeks.',
        scope: { subject_ref: 'decision:launch' },
        modality: 'is',
        polarity: 'positive',
      },
    });
    const revision = SemanticEventSchema.parse({
      ...base('judgment:2', T1),
      authority: human,
      event: 'judgment_sealed',
      judgment_id: 'judgment:launch:2',
      decision_id: 'decision:launch',
      version: 2,
      statement: 'Launch in two weeks.',
      assertion_refs: ['assertion:prediction:initial'],
      basis_known_as_of: T1,
      supersedes_judgment_id: 'judgment:launch:1',
      change_rationale_ref: 'assertion:rationale:security',
    });
    const state = fold([decisionOpened(), predictionRecorded(), firstJudgment(), rationale, revision]);
    expect(state.judgments.get('judgment:launch:1')?.statement).toBe('Launch this week.');
    expect(state.judgments.get('judgment:launch:1')?.superseded_by).toBe('judgment:launch:2');
    expect(state.judgments.get('judgment:launch:2')?.version).toBe(2);
  });

  it('keeps a later-recorded observation out of an earlier as-of projection', () => {
    const observed = SemanticEventSchema.parse({
      ...base('observation:late', T2),
      authority: { ...system, observed_by: { kind: 'host', id: 'source:test' } },
      provenance: { source_kind: 'host_report', source_ref: 'evidence:security', verification: 'host_reported' },
      event: 'observation_recorded',
      observation: {
        observation_id: 'observation:late',
        report: 'Security review now takes two weeks.',
        valid_time: { from: T1, to: T2 },
        evidence_refs: ['evidence:security'],
        confidence: 0.9,
      },
    });
    const state = foldAsOf([decisionOpened(), evidence('evidence:security'), observed], T1);
    expect(state.observations.has('observation:late')).toBe(false);
  });

  it('compares as-of timestamps by instant rather than ISO string shape', () => {
    const observed = SemanticEventSchema.parse({
      ...base('observation:offset', '2026-07-16T10:00:00.000+09:00'),
      authority: { ...system, observed_by: { kind: 'host', id: 'source:test' } },
      provenance: { source_kind: 'host_report', source_ref: 'evidence:offset', verification: 'host_reported' },
      event: 'observation_recorded',
      observation: {
        observation_id: 'observation:offset',
        report: 'Offset timestamp observation.',
        valid_time: { from: '2026-07-16T10:00:00.000+09:00', to: '2026-07-16T02:00:00.000Z' },
        evidence_refs: ['evidence:offset'],
        confidence: 0.9,
      },
    });
    const state = foldAsOf([evidence('evidence:offset'), observed], '2026-07-16T01:30:00.000Z');
    expect(state.observations.has('observation:offset')).toBe(true);
  });

  it('keeps retrospective rationale explicitly retrospective', () => {
    const retrospective = SemanticEventSchema.parse({
      ...base('rationale:retro', T2),
      time: { occurred_at: T0, recorded_at: T2, authorized_at: T2, temporal_mode: 'retrospective' },
      authority: human,
      event: 'assertion_recorded',
      assertion: {
        assertion_id: 'assertion:rationale:retro',
        role: 'rationale',
        proposition: 'In retrospect, security uncertainty drove the delay.',
        scope: { subject_ref: 'decision:launch' },
        modality: 'is',
        polarity: 'positive',
      },
    });
    const state = fold([decisionOpened(), retrospective]);
    expect(state.assertions.get('assertion:rationale:retro')?.time.temporal_mode).toBe('retrospective');
    expect(foldAsOf([decisionOpened(), retrospective], T1).assertions.size).toBe(0);
  });
});

describe('§14.3 evidence betrayal fixtures', () => {
  it('lets one EvidenceArtifact support multiple observations without copying it', () => {
    const observations = ['one', 'two'].map((suffix) => SemanticEventSchema.parse({
      ...base(`observation:${suffix}`, T1),
      authority: { ...system, observed_by: { kind: 'host', id: 'source:test' } },
      provenance: { source_kind: 'host_report', source_ref: 'evidence:shared', verification: 'host_reported' },
      event: 'observation_recorded',
      observation: {
        observation_id: `observation:${suffix}`,
        report: `Observation ${suffix}`,
        valid_time: { from: T0, to: T1 },
        evidence_refs: ['evidence:shared'],
        confidence: 0.8,
      },
    }));
    const state = fold([evidence('evidence:shared'), ...observations]);
    expect(state.evidence.size).toBe(1);
    expect(state.observations.get('observation:one')?.evidence_refs).toEqual(['evidence:shared']);
    expect(state.observations.get('observation:two')?.evidence_refs).toEqual(['evidence:shared']);
  });

  it('invalidates coaching eligibility when referenced evidence becomes restricted', () => {
    const relation = SemanticEventSchema.parse({
      ...base('relation:confirmed', T1),
      authority: human,
      event: 'relation_confirmed',
      relation: {
        relation_id: 'relation:confirmed',
        type: 'supports',
        from_ref: { kind: 'assertion', id: 'assertion:a' },
        to_ref: { kind: 'assertion', id: 'assertion:b' },
        direction: 'directed',
        evidence_refs: ['evidence:a', 'evidence:b'],
        endpoint_evidence: { from: ['evidence:a'], to: ['evidence:b'] },
        status: 'human_confirmed',
        proposed_by: { kind: 'ai', id: 'model:test' },
      },
    });
    const restricted = SemanticEventSchema.parse({
      ...base('evidence:restrict', T2),
      authority: system,
      event: 'evidence_access_changed',
      evidence_id: 'evidence:b',
      access: 'restricted',
    });
    const events = [
      evidence('evidence:a'), evidence('evidence:b'),
      { ...base('assertion:a'), authority: human, event: 'assertion_recorded', assertion: premise('assertion:a') },
      { ...base('assertion:b'), authority: human, event: 'assertion_recorded', assertion: premise('assertion:b') },
      relation,
    ];
    expect(canUseRelationForCoaching(fold(events), 'relation:confirmed')).toBe(true);
    expect(canUseRelationForCoaching(fold([...events, restricted]), 'relation:confirmed')).toBe(false);
  });

  it('keeps Evidence access and Observation challenge as independent state', () => {
    const observation = SemanticEventSchema.parse({
      ...base('observation:challenge', T1),
      authority: { ...system, observed_by: { kind: 'host', id: 'source:test' } },
      provenance: { source_kind: 'host_report', source_ref: 'evidence:challenge', verification: 'host_reported' },
      event: 'observation_recorded',
      observation: {
        observation_id: 'observation:challenge', report: 'Capacity is 30.',
        valid_time: { from: T0, to: T1 }, evidence_refs: ['evidence:challenge'], confidence: 0.7,
      },
    });
    const challenged = SemanticEventSchema.parse({
      ...base('observation:challenged', T2), authority: human,
      event: 'observation_challenged', observation_id: 'observation:challenge', reason: 'The sample excluded weekends.',
    });
    const state = fold([evidence('evidence:challenge'), observation, challenged]);
    expect(state.evidence.get('evidence:challenge')?.access).toBe('available');
    expect(state.observations.get('observation:challenge')?.status).toBe('challenged');
  });

  it('rejects an observation with neither provenance nor an explicit observer', () => {
    const unsourced = {
      ...base('observation:unsourced'), authority: system, event: 'observation_recorded',
      observation: {
        observation_id: 'observation:unsourced', report: 'Something changed.',
        valid_time: { from: T0, to: T1 }, evidence_refs: [], confidence: 0.3,
      },
    };
    expect(SemanticEventSchema.safeParse(unsourced).success).toBe(false);
  });
});

describe('§14.4 relation betrayal fixtures', () => {
  it('does not call same words about different entities the same fact', () => {
    const result = validateRelationCandidate({
      type: 'same_fact',
      from: premise('assertion:a', 'company:alpha'),
      to: premise('assertion:b', 'company:beta'),
      evidence_refs: ['evidence:a', 'evidence:b'],
    });
    expect(result).toEqual({ eligible: false, reason: 'SUBJECT_MISMATCH' });
  });

  it('does not call the same metric at non-overlapping times a contradiction', () => {
    const earlier = premise('assertion:earlier');
    const later = AssertionSchema.parse({
      ...premise('assertion:later'),
      scope: { ...premise('assertion:later').scope, valid_time: { from: '2026-08-01T00:00:00.000Z', to: '2026-08-31T23:59:59.000Z' } },
      polarity: 'negative',
    });
    expect(validateRelationCandidate({ type: 'contradicts', from: earlier, to: later, evidence_refs: ['evidence:a', 'evidence:b'] }))
      .toEqual({ eligible: false, reason: 'TIME_SCOPE_MISMATCH' });
  });

  it('compares relation time scopes by instant rather than offset string order', () => {
    const left = AssertionSchema.parse({
      ...premise('assertion:offset:left'),
      scope: {
        ...premise('assertion:offset:left').scope,
        valid_time: { from: '2026-07-16T10:00:00.000+09:00', to: '2026-07-16T02:00:00.000Z' },
      },
    });
    const right = AssertionSchema.parse({
      ...premise('assertion:offset:right'),
      scope: {
        ...premise('assertion:offset:right').scope,
        valid_time: { from: '2026-07-16T01:30:00.000Z', to: '2026-07-16T12:00:00.000+09:00' },
      },
    });
    expect(validateRelationCandidate({ type: 'same_fact', from: left, to: right, evidence_refs: ['evidence:a'] }))
      .toEqual({ eligible: true, reason: 'TYPE_CONTRACT_SATISFIED' });
  });

  it('does not treat a prediction miss as an automatic semantic contradiction', () => {
    const observed = AssertionSchema.parse({
      ...prediction('assertion:observed', 'Observed active teams were below 20.'),
      role: 'premise',
      polarity: 'negative',
      modality: 'is',
    });
    expect(validateRelationCandidate({
      type: 'contradicts', from: prediction(),
      to: observed,
      evidence_refs: ['evidence:a', 'evidence:b'],
    })).toEqual({ eligible: false, reason: 'PREDICTION_REQUIRES_RESOLUTION' });
  });

  it('allows a shared constraint only after human confirmation, never LLM self-verification', () => {
    const forged = {
      ...base('relation:shared'), authority: system, event: 'relation_verified',
      relation: {
        relation_id: 'relation:shared', type: 'shared_constraint',
        from_ref: { kind: 'assertion', id: 'constraint:a' },
        to_ref: { kind: 'assertion', id: 'constraint:b' },
        direction: 'symmetric', evidence_refs: ['evidence:a', 'evidence:b'],
        endpoint_evidence: { from: ['evidence:a'], to: ['evidence:b'] },
        status: 'system_verified', proposed_by: { kind: 'ai', id: 'model:test' },
      },
      verification_basis: 'llm_similarity',
    };
    expect(SemanticEventSchema.safeParse(forged).success).toBe(false);
  });

  it('does not let semantic inference types become system_verified with a deterministic-looking basis', () => {
    const forged = {
      ...base('relation:shared:structural'), authority: system, event: 'relation_verified',
      relation: {
        relation_id: 'relation:shared:structural', type: 'shared_constraint',
        from_ref: { kind: 'assertion', id: 'constraint:a' },
        to_ref: { kind: 'assertion', id: 'constraint:b' },
        direction: 'symmetric', evidence_refs: ['evidence:a', 'evidence:b'],
        endpoint_evidence: { from: ['evidence:a'], to: ['evidence:b'] },
        status: 'system_verified', proposed_by: { kind: 'system', id: 'argus:test' },
      },
      verification_basis: 'structural',
    };
    expect(SemanticEventSchema.safeParse(forged).success).toBe(false);
  });

  it('still permits exact identity relations to be system_verified', () => {
    const verified = {
      ...base('relation:same-fact:exact'), authority: system, event: 'relation_verified',
      relation: {
        relation_id: 'relation:same-fact:exact', type: 'same_fact',
        from_ref: { kind: 'assertion', id: 'assertion:a' },
        to_ref: { kind: 'assertion', id: 'assertion:b' },
        direction: 'symmetric', evidence_refs: ['evidence:a', 'evidence:b'],
        status: 'system_verified', proposed_by: { kind: 'system', id: 'argus:test' },
      },
      verification_basis: 'same_content_hash',
    };
    expect(SemanticEventSchema.safeParse(verified).success).toBe(true);
  });

  it('withholds coaching eligibility if either endpoint lacks evidence', () => {
    const relation = SemanticEventSchema.parse({
      ...base('relation:one-sided'), authority: human, event: 'relation_confirmed',
      relation: {
        relation_id: 'relation:one-sided', type: 'supports',
        from_ref: { kind: 'assertion', id: 'assertion:a' }, to_ref: { kind: 'assertion', id: 'assertion:b' },
        direction: 'directed', evidence_refs: ['evidence:a'],
        endpoint_evidence: { from: ['evidence:a'], to: [] },
        status: 'human_confirmed', proposed_by: { kind: 'ai', id: 'model:test' },
      },
    });
    const state = fold([evidence('evidence:a'), relation]);
    expect(canUseRelationForCoaching(state, 'relation:one-sided')).toBe(false);
  });

  it('does not resurface a user-rejected relation with the same signature and evidence', () => {
    const proposed = SemanticEventSchema.parse({
      ...base('relation:proposal'), authority: system, event: 'relation_proposed',
      relation: {
        relation_id: 'relation:proposal', type: 'supports',
        from_ref: { kind: 'assertion', id: 'assertion:a' }, to_ref: { kind: 'assertion', id: 'assertion:b' },
        direction: 'directed', evidence_refs: ['evidence:a', 'evidence:b'], status: 'proposed',
        proposed_by: { kind: 'ai', id: 'model:test' },
      },
    });
    const rejected = SemanticEventSchema.parse({
      ...base('relation:rejected', T1), authority: human, event: 'relation_rejected',
      relation_id: 'relation:proposal', reason: 'The causal link is wrong.',
    });
    const resurfaced = {
      ...proposed,
      event_id: 'relation:proposal:again', idempotency_key: 'idem:relation:proposal:again',
      relation: { ...proposed.relation, relation_id: 'relation:proposal:again' },
    };
    const state = fold([proposed, rejected, resurfaced]);
    expect(state.relations.has('relation:proposal:again')).toBe(false);
    expect(state.anomalies.some((item) => item.code === 'REJECTED_RELATION_REPROPOSED')).toBe(true);
  });
});

describe('§14.5 watch betrayal fixtures', () => {
  it('never proposes web monitoring for a normative criterion', () => {
    const criterion = AssertionSchema.parse({
      assertion_id: 'criterion:quality', role: 'criterion', proposition: 'The product should feel trustworthy.',
      scope: { subject_ref: 'product:argus' }, modality: 'should', polarity: 'positive',
    });
    expect(canWatchAssertion(criterion)).toBe(false);
  });

  it('uses the first successful check as baseline without alerting', () => {
    expect(evaluateWatchCheck({
      previous: undefined, current: 30, source_verified: true,
      materiality: { kind: 'delta', threshold: 5 },
    })).toEqual({ alert: false, reason: 'BASELINE_ESTABLISHED', baseline: 30 });
  });

  it('stays silent below materiality', () => {
    expect(evaluateWatchCheck({
      previous: 30, current: 32, source_verified: true,
      materiality: { kind: 'delta', threshold: 5 },
    })).toEqual({ alert: false, reason: 'BELOW_MATERIALITY' });
  });

  it('stays silent when source verification fails', () => {
    expect(evaluateWatchCheck({
      previous: 30, current: 10, source_verified: false,
      materiality: { kind: 'delta', threshold: 5 },
    })).toEqual({ alert: false, reason: 'SOURCE_UNVERIFIED' });
  });

  it('records material drift without mutating the user JudgmentVersion', () => {
    const drift = SemanticEventSchema.parse({
      ...base('watch:drift', T2), authority: system, event: 'watch_check_recorded',
      check_id: 'check:capacity', assertion_id: 'assertion:prediction:initial',
      previous_value: 30, current_value: 10, source_verified: true,
      evidence_refs: ['evidence:capacity'], material: true,
    });
    const before = fold([decisionOpened(), predictionRecorded(), firstJudgment()]);
    const after = fold([decisionOpened(), predictionRecorded(), firstJudgment(), evidence('evidence:capacity'), drift]);
    expect(after.judgments.get('judgment:launch:1')).toEqual(before.judgments.get('judgment:launch:1'));
    expect(after.watch_checks.get('check:capacity')?.material).toBe(true);
  });
});

describe('K1 shadow-only boundary', () => {
  it('is off by default and only accepts the exact opt-in value', () => {
    expect(isV4ShadowEnabled({})).toBe(false);
    expect(isV4ShadowEnabled({ ARGUS_SEMANTIC_V4_SHADOW: 'true' })).toBe(false);
    expect(isV4ShadowEnabled({ ARGUS_SEMANTIC_V4_SHADOW: '1' })).toBe(true);
  });

  it('never lets shadow sink failure escape into the legacy success path', async () => {
    const result = await shadowWrite([decisionOpened()], {
      append: async () => { throw new Error('shadow unavailable'); },
    }, { ARGUS_SEMANTIC_V4_SHADOW: '1' });
    expect(result).toEqual({ status: 'failed', written: 0, error_code: 'SHADOW_WRITE_FAILED' });
  });
});
