import type {
  LegacyStructuredSynthesis,
  Persona,
  RehearsalResult,
  StructuredSynthesis,
  SyntheticModelLineage,
  SyntheticPerspectiveSet,
} from '@/stores/types';

export const SYNTHETIC_PERSPECTIVE_PROMPT_VERSION = 'rehearse-synthesis-v2';

type Locale = 'ko' | 'en';
type SynthesisOutput = Record<string, unknown> | null | undefined;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim()).filter(Boolean))];
}

function lineage(sourceCaseId: string): SyntheticModelLineage {
  return {
    provider: 'runtime_router',
    model_family: 'unreported',
    model_id: 'unreported',
    prompt_version: SYNTHETIC_PERSPECTIVE_PROMPT_VERSION,
    source_input_cluster_ids: [sourceCaseId],
  };
}

export function isSyntheticPerspectiveSet(
  value: StructuredSynthesis | undefined,
): value is SyntheticPerspectiveSet {
  const candidate = record(value);
  return candidate?.artifact_kind === 'synthetic_perspective_set'
    && candidate.schema_version === 2
    && candidate.independence_units === 1
    && Array.isArray(candidate.perspectives)
    && Array.isArray(candidate.convergent_simulated_concerns)
    && candidate.convergent_simulated_concerns.every((item) => {
      const entry = record(item);
      return typeof entry?.statement === 'string'
        && Array.isArray(entry.perspective_ids)
        && Array.isArray(entry.source_refs);
    })
    && Array.isArray(candidate.team_contradictions)
    && candidate.team_contradictions.every((item) => {
      const entry = record(item);
      return typeof entry?.topic === 'string' && Array.isArray(entry.positions);
    })
    && !!record(candidate.strongest_dissent)
    && Array.isArray(candidate.unknowns_that_block_judgment)
    && candidate.unknowns_that_block_judgment.every((item) => typeof item === 'string')
    && Array.isArray(candidate.reality_check_questions)
    && candidate.reality_check_questions.every((item) => typeof item === 'string');
}

export function isLegacyStructuredSynthesis(
  value: StructuredSynthesis | undefined,
): value is LegacyStructuredSynthesis {
  return !!value && !isSyntheticPerspectiveSet(value)
    && Array.isArray((value as LegacyStructuredSynthesis).common_agreements)
    && (value as LegacyStructuredSynthesis).common_agreements.every((item) => typeof item === 'string')
    && Array.isArray((value as LegacyStructuredSynthesis).key_conflicts)
    && (value as LegacyStructuredSynthesis).key_conflicts.every((item) =>
      typeof item?.topic === 'string' && Array.isArray(item.positions)
      && item.positions.every((position) =>
        typeof position?.persona_id === 'string' && typeof position.stance === 'string'))
    && Array.isArray((value as LegacyStructuredSynthesis).priority_actions)
    && (value as LegacyStructuredSynthesis).priority_actions.every((item) =>
      typeof item?.action === 'string' && typeof item.requested_by === 'string'
      && (item.priority === 'high' || item.priority === 'medium'));
}

export function syntheticPerspectiveSystem(locale: Locale): string {
  return locale === 'ko'
    ? `같은 자료를 읽은 여러 가상 이해관계자의 반응을 비교하세요. 이것은 현실 증거나 투표가 아니라 하나의 synthetic perspective set입니다.

JSON 필드:
- convergent_simulated_concerns[]: {statement, perspective_ids[], source_refs[]} — 반복된 가상 우려. 공통 결론·사실·우선순위라고 부르지 마세요.
- team_contradictions[]: {topic, positions:[{perspective_id, stance}]}
- strongest_dissent: {kind:"observed|elicited_counter_lens|none_found", statement, source_refs[], search_method}
- unknowns_that_block_judgment[]
- reality_check_questions[]

규칙:
- 이 세트의 independence_units는 관점 수와 무관하게 1입니다.
- persona 수, 반복 횟수, 영향력은 evidence/confidence/truth/priority를 올리지 않습니다.
- 실제 입력에 반대가 있으면 observed, 반대 렌즈를 별도로 구성했으면 elicited_counter_lens입니다. 둘을 섞지 마세요.
- 모르는 현실 정보는 추정하지 말고 unknown과 구체적인 reality check 질문으로 남기세요.
- 행동 우선순위나 사용자에 대한 verdict를 만들지 마세요. JSON만 출력하세요.`
    : `Compare reactions from multiple simulated stakeholders who read the same material. This is one synthetic perspective set, not reality evidence or a vote.

JSON fields:
- convergent_simulated_concerns[]: {statement, perspective_ids[], source_refs[]} — recurring simulated concerns. Never call them a shared conclusion, fact, or priority.
- team_contradictions[]: {topic, positions:[{perspective_id, stance}]}
- strongest_dissent: {kind:"observed|elicited_counter_lens|none_found", statement, source_refs[], search_method}
- unknowns_that_block_judgment[]
- reality_check_questions[]

Rules:
- This set has exactly one independence unit regardless of perspective count.
- Persona count, repetition, and influence never increase evidence, confidence, truth, or priority.
- Use observed only for dissent present in the input; use elicited_counter_lens for a separately constructed counter-lens. Never mix them.
- Do not guess missing reality. Preserve it as an unknown and a concrete reality-check question.
- Do not create action rankings or a verdict about the user. Output JSON only.`;
}

function parseConvergence(value: unknown, knownPerspectiveIds: Set<string>) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const entry = record(item);
    const statement = typeof entry?.statement === 'string' ? entry.statement.trim() : '';
    if (!statement) return [];
    const perspectiveIds = strings(entry?.perspective_ids)
      .filter((id) => knownPerspectiveIds.has(id));
    const sourceRefs = strings(entry?.source_refs);
    if (perspectiveIds.length < 2 || sourceRefs.length === 0) return [];
    return [{
      statement,
      perspective_ids: perspectiveIds,
      source_refs: sourceRefs,
    }];
  });
}

function parseContradictions(value: unknown, knownPerspectiveIds: Set<string>) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const entry = record(item);
    const topic = typeof entry?.topic === 'string' ? entry.topic.trim() : '';
    if (!topic || !Array.isArray(entry?.positions)) return [];
    const positions = entry.positions.flatMap((position) => {
      const p = record(position);
      const perspectiveId = typeof p?.perspective_id === 'string' ? p.perspective_id.trim() : '';
      const stance = typeof p?.stance === 'string' ? p.stance.trim() : '';
      return perspectiveId && stance && knownPerspectiveIds.has(perspectiveId)
        ? [{ perspective_id: perspectiveId, stance }]
        : [];
    });
    return new Set(positions.map((position) => position.perspective_id)).size >= 2
      ? [{ topic, positions }]
      : [];
  });
}

function parseStrongestDissent(value: unknown): SyntheticPerspectiveSet['strongest_dissent'] {
  const dissent = record(value);
  const kind = dissent?.kind;
  if ((kind === 'observed' || kind === 'elicited_counter_lens')
    && typeof dissent?.statement === 'string' && dissent.statement.trim()
    && typeof dissent?.search_method === 'string' && dissent.search_method.trim()) {
    return {
      kind,
      statement: dissent.statement.trim(),
      source_refs: strings(dissent.source_refs),
      search_method: dissent.search_method.trim(),
    };
  }
  if (kind === 'none_found' && typeof dissent?.search_method === 'string'
    && dissent.search_method.trim()) {
    return {
      kind,
      statement: typeof dissent.statement === 'string' ? dissent.statement.trim() : '',
      source_refs: strings(dissent.source_refs),
      search_method: dissent.search_method.trim(),
    };
  }
  return {
    kind: 'none_found',
    statement: '',
    source_refs: [],
    search_method: 'Structured dissent extraction was unavailable; no dissent was inferred.',
  };
}

export function buildSyntheticPerspectiveSet(args: {
  setId: string;
  sourceCaseId: string;
  results: RehearsalResult[];
  personas: Persona[];
  synthesisOutput?: SynthesisOutput;
}): SyntheticPerspectiveSet {
  const modelLineage = lineage(args.sourceCaseId);
  const perspectives = args.results.map((result) => {
    const persona = args.personas.find((item) => item.id === result.persona_id);
    return {
      perspective_id: `perspective:${result.persona_id}`,
      seat: {
        owns: persona?.role?.trim() || 'unreported',
        goals: persona?.priorities?.trim() ? [persona.priorities.trim()] : [],
        authority: persona?.influence || 'unreported',
      },
      model_lineage: modelLineage,
      concerns: strings(result.concerns),
      source_claim_refs: [`rehearsal-result:${result.persona_id}`],
    };
  });
  const knownPerspectiveIds = new Set(perspectives.map((item) => item.perspective_id));
  const output = record(args.synthesisOutput);
  const unknowns = strings(output?.unknowns_that_block_judgment);
  const realityChecks = strings(output?.reality_check_questions);

  return {
    artifact_kind: 'synthetic_perspective_set',
    schema_version: 2,
    set_id: args.setId,
    source_case_id: args.sourceCaseId,
    generator_lineage: modelLineage,
    prompt_version: SYNTHETIC_PERSPECTIVE_PROMPT_VERSION,
    independence_units: 1,
    perspectives,
    convergent_simulated_concerns: parseConvergence(
      output?.convergent_simulated_concerns,
      knownPerspectiveIds,
    ),
    team_contradictions: parseContradictions(output?.team_contradictions, knownPerspectiveIds),
    strongest_dissent: parseStrongestDissent(output?.strongest_dissent),
    unknowns_that_block_judgment: output ? unknowns : [
      'Cross-perspective synthesis was unavailable; no shared conclusion was inferred.',
    ],
    reality_check_questions: realityChecks.length > 0 ? realityChecks : [
      'Which concern is confirmed by evidence outside this simulation?',
    ],
  };
}

export function summarizeSyntheticPerspectiveSet(
  set: SyntheticPerspectiveSet,
  locale: Locale,
): string {
  const convergence = set.convergent_simulated_concerns.map((item) => item.statement).join(', ');
  const dissent = set.strongest_dissent.statement;
  return locale === 'ko'
    ? `반복된 가상 우려: ${convergence || '확인되지 않음'}. 가장 강한 반대 렌즈: ${dissent || '확인되지 않음'}. 현실 확인 필요: ${set.reality_check_questions[0]}`
    : `Recurring simulated concerns: ${convergence || 'none established'}. Strongest dissent lens: ${dissent || 'none established'}. Reality check: ${set.reality_check_questions[0]}`;
}

export function projectLegacySynthesis(value: LegacyStructuredSynthesis) {
  return {
    legacy_simulated_convergence: value.common_agreements,
    team_contradictions: value.key_conflicts,
    review_items: value.priority_actions.map((item) => ({
      statement: item.action,
      source: item.requested_by,
    })),
  };
}
