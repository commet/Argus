import { hasIndependentRealitySupport } from './domain/decide';
import type {
  AuthorityCounterexample,
  AuthorityGrantState,
  AuthoritySupportUnit,
  ClaimAuthorityState,
} from './domain/types';

export interface ClaimSourceProjection {
  support_unit_id: string;
  case_id: string;
  observation_ref: string;
  resolution_event_ref: string;
  observation_authority: 'user' | 'external_reality';
  valid_time?: string;
  source_cluster_id: string;
  causal_cluster_id: string;
  drilldown?: {
    observation: CanonicalSourceEventProjection;
    resolution: CanonicalSourceEventProjection;
  };
}

export interface CanonicalSourceEventProjection {
  project_id: string;
  event_id: string;
  event_type: string;
  occurred_at: string;
  excerpt: string;
}

export interface CounterexampleProjection {
  counterexample_ref: string;
  observation: string;
  provenance: AuthorityCounterexample['authored']['provenance'];
  material: boolean;
  recorded_at: string;
}

export interface GrantProjection {
  grant_id: string;
  revision: number;
  effect: AuthorityGrantState['effect'];
  surfaces: AuthorityGrantState['surfaces'];
  scope: AuthorityGrantState['scope']['value'];
  starts_at: string;
  expires_at?: string;
  status: AuthorityGrantState['status'];
}

export interface ClaimReviewCardProjection {
  claim_id: string;
  statement: string;
  claim_kind: NonNullable<ClaimAuthorityState['claim_kind']>;
  lifecycle: ClaimAuthorityState['lifecycle'];
  support_state: ClaimAuthorityState['support_state'];
  authority_epoch: number;
  aggregate_version: number;
  independent_source_count: number;
  scope: NonNullable<ClaimAuthorityState['scope']>['value'];
  sources: ClaimSourceProjection[];
  counterexamples: CounterexampleProjection[];
  limitations: string[];
  limitations_en: string[];
  review_question: string;
  review_question_en: string;
  active_grants: GrantProjection[];
}

export type ClaimReviewExclusionReason =
  | 'not_candidate'
  | 'claim_incomplete'
  | 'support_not_resolved'
  | 'independent_reality_support_below_three';

export type ClaimReviewProjectionResult =
  | { eligible: true; card: ClaimReviewCardProjection }
  | { eligible: false; claim_id: string; reason: ClaimReviewExclusionReason };

export type PatternDimensionId =
  | 'outcome_frequency'
  | 'authorship_trajectory'
  | 'causal_structure'
  | 'cross_decision_scope'
  | 'transfer_question';

export interface PatternDimensionProjection {
  dimension: PatternDimensionId;
  available: boolean;
  summary: string;
  summary_en: string;
  source_refs: string[];
}

export interface PublicPatternProjection {
  claim: ClaimReviewCardProjection;
  dimensions: PatternDimensionProjection[];
}

const unique = (values: readonly string[]): string[] => [...new Set(values.filter(Boolean))];

export function independentSourceCount(sources: readonly ClaimSourceProjection[]): number {
  return new Set(sources.map((source) => source.source_cluster_id).filter(Boolean)).size;
}

function sourceProjection(unit: AuthoritySupportUnit): ClaimSourceProjection | null {
  if (unit.verification_state !== 'resolved' || unit.observation_authority === 'ai_only') return null;
  if (!unit.support_unit_id || !unit.case_id || !unit.observation_ref
    || !unit.resolution_event_ref || !unit.source_cluster_id || !unit.causal_cluster_id) return null;
  return {
    support_unit_id: unit.support_unit_id,
    case_id: unit.case_id,
    observation_ref: unit.observation_ref,
    resolution_event_ref: unit.resolution_event_ref,
    observation_authority: unit.observation_authority,
    valid_time: unit.valid_time,
    source_cluster_id: unit.source_cluster_id,
    causal_cluster_id: unit.causal_cluster_id,
  };
}

function grantProjection(grant: AuthorityGrantState): GrantProjection {
  return {
    grant_id: grant.grant_id,
    revision: grant.revision,
    effect: grant.effect,
    surfaces: grant.surfaces,
    scope: grant.scope.value,
    starts_at: grant.starts_at,
    expires_at: grant.expires_at,
    status: grant.status,
  };
}

function baseCard(state: ClaimAuthorityState): ClaimReviewCardProjection | null {
  if (!state.statement || !state.claim_kind || !state.scope) return null;
  const sources = state.support_units.flatMap((unit) => {
    const projected = sourceProjection(unit);
    return projected ? [projected] : [];
  });
  const counterexamples = state.counterexamples.map((counterexample) => ({
    counterexample_ref: counterexample.counterexample_ref,
    observation: counterexample.authored.value,
    provenance: counterexample.authored.provenance,
    material: counterexample.material,
    recorded_at: counterexample.authored.recorded_at,
  }));
  const limitations = [
    ...(counterexamples.length === 0
      ? ['기록에 연결된 반례가 없습니다. 반례가 존재하지 않는다는 뜻은 아닙니다.'] : []),
    ...(state.scope.value.review_by ? [`${state.scope.value.review_by} 전에 다시 검토해야 합니다.`] : []),
    '이 기록은 성격 진단이나 미래 행동 지시가 아닙니다.',
  ];
  const limitationsEn = [
    ...(counterexamples.length === 0
      ? ['No counterexample is attached to the record. This does not prove none exists.'] : []),
    ...(state.scope.value.review_by ? [`Review again before ${state.scope.value.review_by}.`] : []),
    'This record is not a personality diagnosis or an instruction for future behavior.',
  ];
  return {
    claim_id: state.claim_id,
    statement: state.statement.value,
    claim_kind: state.claim_kind,
    lifecycle: state.lifecycle,
    support_state: state.support_state,
    authority_epoch: state.authority_epoch,
    aggregate_version: state.aggregate_version,
    independent_source_count: independentSourceCount(sources),
    scope: state.scope.value,
    sources,
    counterexamples,
    limitations,
    limitations_en: limitationsEn,
    review_question: '이 표현이 지금의 당신과 맞나요?',
    review_question_en: 'Does this wording fit who you are now?',
    active_grants: Object.values(state.grants)
      .filter((grant) => grant.status === 'active')
      .map(grantProjection),
  };
}

export function projectClaimReviewCard(state: ClaimAuthorityState): ClaimReviewProjectionResult {
  if (state.lifecycle !== 'candidate') {
    return { eligible: false, claim_id: state.claim_id, reason: 'not_candidate' };
  }
  const card = baseCard(state);
  if (!card) return { eligible: false, claim_id: state.claim_id, reason: 'claim_incomplete' };
  if (state.support_state !== 'supported') {
    return { eligible: false, claim_id: state.claim_id, reason: 'support_not_resolved' };
  }
  if (!hasIndependentRealitySupport(state.support_units) || card.independent_source_count < 3) {
    return {
      eligible: false,
      claim_id: state.claim_id,
      reason: 'independent_reality_support_below_three',
    };
  }
  return { eligible: true, card };
}

function patternDimensions(card: ClaimReviewCardProjection): PatternDimensionProjection[] {
  const refs = unique(card.sources.flatMap((source) => [source.observation_ref, source.resolution_event_ref]));
  const projects = unique(card.scope.project_ids ?? []);
  const causalClusters = unique(card.sources.map((source) => source.causal_cluster_id));
  return [
    {
      dimension: 'outcome_frequency',
      available: card.independent_source_count >= 3,
      summary: `서로 독립된 해결 사례 ${card.independent_source_count}건에서 관찰됐습니다.`,
      summary_en: `Observed across ${card.independent_source_count} independent resolved cases.`,
      source_refs: refs,
    },
    {
      dimension: 'authorship_trajectory',
      available: true,
      summary: '현재 문구의 저자성과 검토 상태를 원본 사건과 분리해 보존합니다.',
      summary_en: 'Authorship and review status are preserved separately from the source events.',
      source_refs: refs,
    },
    {
      dimension: 'causal_structure',
      available: card.claim_kind === 'causal_hypothesis' && causalClusters.length >= 3,
      summary: card.claim_kind === 'causal_hypothesis'
        ? `독립 인과 묶음 ${causalClusters.length}개를 연결한 가설이며, 인과 사실로 확정하지 않습니다.`
        : '이 기록만으로 인과를 주장하지 않습니다.',
      summary_en: card.claim_kind === 'causal_hypothesis'
        ? `This hypothesis links ${causalClusters.length} independent causal clusters; it is not established as causal fact.`
        : 'This record alone does not establish causation.',
      source_refs: refs,
    },
    {
      dimension: 'cross_decision_scope',
      available: projects.length >= 2,
      summary: projects.length >= 2
        ? `검토된 적용 범위에 결정 ${projects.length}건이 포함됩니다.`
        : '교차 결정 영향 범위는 아직 확인되지 않았습니다.',
      summary_en: projects.length >= 2
        ? `The reviewed scope includes ${projects.length} decisions.`
        : 'Cross-decision impact has not been established.',
      source_refs: refs,
    },
    {
      dimension: 'transfer_question',
      available: false,
      summary: '현재 판단과의 검증된 연결이 생기기 전에는 과거 패턴을 코칭으로 전이하지 않습니다.',
      summary_en: 'The past pattern is not transferred into coaching until a verified connection to a current judgment exists.',
      source_refs: [],
    },
  ];
}

/** Public Patterns consumes only user-endorsed, independently supported authority. */
export function projectPublicPatterns(states: readonly ClaimAuthorityState[]): PublicPatternProjection[] {
  return states.flatMap((state) => {
    if (state.lifecycle !== 'endorsed' || state.support_state !== 'supported'
      || !hasIndependentRealitySupport(state.support_units)) return [];
    const claim = baseCard(state);
    if (!claim || claim.independent_source_count < 3) return [];
    return [{ claim, dimensions: patternDimensions(claim) }];
  });
}
