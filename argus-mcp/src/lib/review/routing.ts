/**
 * Dynamic lens routing (design doc §"Dynamic Lens Routing").
 *
 * "Argus의 품질은 좋은 lens를 많이 만드는 것보다 맞는 lens를 고르는 것에서 나온다."
 * Routing is deterministic and testable: it reads the profile + the deck flag +
 * the user's concern chips and returns which lenses run, which are skipped (with
 * a reason), and a user-facing disclosure line — the routing is never hidden.
 */

import {
  type DocumentProfile,
  type JudgmentLens,
  type LensId,
  type LensRoutingResult,
  type ReviewConcern,
  type Stakes,
  type CanonicalArtifact,
} from './schema.js';
import { LENSES, ALL_LENS_IDS } from './lenses.js';

const STAKES_ORDER: Record<Stakes, number> = { low: 0, medium: 1, high: 2 };

/** Lenses that always run — the judgment spine of any review. */
const BASE: LensId[] = [
  'core_question',
  'claim_evidence',
  'hidden_assumption',
  'human_judgment',
  'falsifiable_followup',
];

const CONCERN_TO_LENS: Record<ReviewConcern, LensId[]> = {
  strategic_fit: ['core_question', 'hidden_assumption'],
  evidence: ['claim_evidence'],
  stakeholder_objection: ['stakeholder_objection'],
  execution_risk: ['execution_risk'],
  ai_answer_trust: ['claim_evidence', 'human_judgment'],
  full_judgment_review: [...ALL_LENS_IDS],
};

export function routeLenses(
  profile: DocumentProfile,
  artifact: CanonicalArtifact,
  opts: { concerns?: ReviewConcern[]; maxLensCalls: number } = { maxLensCalls: 7 },
): LensRoutingResult {
  const isDeck = artifact.detected_structure.is_deck;
  const concerns = opts.concerns ?? [];

  // Candidate set: base + profile-driven + concern-driven, filtered by applies_to.
  const wanted = new Set<LensId>(BASE);

  if (isDeck) wanted.add('deck_narrative');
  if (STAKES_ORDER[profile.stakes] >= STAKES_ORDER.medium) wanted.add('stakeholder_objection');
  if (profile.intent === 'request_approval' || profile.intent === 'persuade' || profile.intent === 'pitch') {
    wanted.add('stakeholder_objection');
  }
  if (['prd', 'proposal', 'strategy_memo'].includes(profile.document_type)) wanted.add('execution_risk');
  if (['rfc', 'adr', 'strategy_memo', 'proposal'].includes(profile.document_type)) wanted.add('reversibility');

  const concernRequested = new Set<LensId>();
  for (const c of concerns) for (const id of CONCERN_TO_LENS[c] ?? []) { wanted.add(id); concernRequested.add(id); }

  // Keep lenses that pass structural gates (deck/document-type — never bypassed).
  // Soft gates (stakes/intent/audience/maturity) can be bypassed when the user
  // explicitly asked for the lens via a concern chip.
  const matched = [...wanted].filter(
    (id) => appliesStructural(LENSES[id], profile, isDeck) && (concernRequested.has(id) || appliesSoft(LENSES[id], profile)),
  );

  // Priority: base spine first, then deck/objection/execution, cap at budget.
  const priority = orderByPriority(matched, concerns);
  const selected = priority.slice(0, Math.max(1, opts.maxLensCalls));
  const cutForBudget = priority.slice(selected.length);

  const skipped: LensRoutingResult['skipped'] = [];
  for (const id of ALL_LENS_IDS) {
    if (selected.includes(id)) continue;
    if (cutForBudget.includes(id)) {
      skipped.push({ id, reason: '분석 예산(렌즈 수) 초과로 이번엔 제외' });
    } else if (!applies(LENSES[id], profile, isDeck)) {
      skipped.push({ id, reason: skipReason(id, profile, isDeck) });
    } else {
      skipped.push({ id, reason: '이 문서에는 우선순위가 낮아 제외' });
    }
  }

  return { selected, skipped, disclosure: buildDisclosure(selected, profile) };
}

/** Structural gates — a lens simply cannot apply to this document shape. */
export function appliesStructural(lens: JudgmentLens, profile: DocumentProfile, isDeck: boolean): boolean {
  const f = lens.applies_to;
  if (f.deck_only && !isDeck) return false;
  if (f.document_type && !f.document_type.includes(profile.document_type)) return false;
  return true;
}

/** Soft gates — relevance heuristics a user concern may override. */
export function appliesSoft(lens: JudgmentLens, profile: DocumentProfile): boolean {
  const f = lens.applies_to;
  if (f.artifact_maturity && !f.artifact_maturity.includes(profile.artifact_maturity)) return false;
  if (f.intent && !f.intent.includes(profile.intent)) return false;
  if (f.audience && !f.audience.includes(profile.audience)) return false;
  if (f.min_stakes && STAKES_ORDER[profile.stakes] < STAKES_ORDER[f.min_stakes]) return false;
  return true;
}

/** Full applies check (structural + soft), used by callers that don't route. */
export function applies(lens: JudgmentLens, profile: DocumentProfile, isDeck: boolean): boolean {
  return appliesStructural(lens, profile, isDeck) && appliesSoft(lens, profile);
}

function orderByPriority(ids: LensId[], concerns: ReviewConcern[]): LensId[] {
  const concernBoost = new Set<LensId>();
  for (const c of concerns) for (const id of CONCERN_TO_LENS[c] ?? []) concernBoost.add(id);

  const rank = (id: LensId): number => {
    let r = BASE.includes(id) ? 0 : 5;
    if (id === 'deck_narrative') r = 2; // decks: narrative is load-bearing
    if (concernBoost.has(id)) r -= 3; // user asked for it
    return r;
  };
  return [...ids].sort((a, b) => rank(a) - rank(b) || ALL_LENS_IDS.indexOf(a) - ALL_LENS_IDS.indexOf(b));
}

function skipReason(id: LensId, profile: DocumentProfile, isDeck: boolean): string {
  if (id === 'deck_narrative' && !isDeck) return '덱이 아니어서 제외';
  if (id === 'reversibility') return '되돌림 판단이 핵심이 아닌 문서 유형이어서 제외';
  if (id === 'stakeholder_objection') return '이해관계/stakes가 낮아 제외';
  void profile;
  return '이 문서에 해당하지 않아 제외';
}

function buildDisclosure(selected: LensId[], profile: DocumentProfile): string {
  const labels = selected.map((id) => LENSES[id].label).join(', ');
  const typeKo = documentTypeKo(profile.document_type);
  return `적용한 검수 렌즈: ${labels}. 이유: 이 문서는 ${typeKo}이고, 핵심 주장과 사람이 책임질 판단을 우선 확인했습니다.`;
}

function documentTypeKo(t: DocumentProfile['document_type']): string {
  const map: Partial<Record<DocumentProfile['document_type'], string>> = {
    strategy_memo: '전략 메모',
    prd: '제품 요구사항 문서(PRD)',
    rfc: 'RFC',
    adr: 'ADR',
    strategy_deck: '전략 덱',
    pitch_deck: '피치 덱',
    board_deck: '보드 덱',
    sales_deck: '세일즈 덱',
    investor_update: '투자자 업데이트',
    research_report: '리서치 리포트',
    meeting_notes: '회의록',
    llm_answer: 'AI 답변',
    proposal: '제안서',
    unknown: '문서',
  };
  return map[t] ?? '문서';
}
