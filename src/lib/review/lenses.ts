/**
 * Lens library — 9 MVP lenses (design doc §"Lens Library"). A lens is a
 * structured review unit, NOT a prompt fragment: it declares what it applies
 * to, what it asks, and which sentences count as failure (generic advice).
 *
 * "Argus의 품질은 좋은 lens를 많이 만드는 것보다 맞는 lens를 고르는 것에서 나온다."
 * So keep this list small and let routing.ts choose.
 */

import { type JudgmentLens, type LensId, type ReviewLocale } from './schema';

export const LENS_VERSION = '1' as const;

/** User-facing lens names in English. The Korean names live on each lens's
 *  `label` (also used inside the Korean lens prompt); this map is the display
 *  name for an English-locale reader. Keep the two in sync when adding a lens. */
export const LENS_LABEL_EN: Record<LensId, string> = {
  core_question: 'Core question',
  claim_evidence: 'Claim vs evidence',
  hidden_assumption: 'Hidden assumptions',
  human_judgment: 'Human judgment',
  stakeholder_objection: 'Stakeholder objections',
  execution_risk: 'Execution risk',
  reversibility: 'Reversibility',
  falsifiable_followup: 'Falsifiable follow-up',
  deck_narrative: 'Deck narrative',
};

/** Localized, user-facing label for a lens. */
export function lensLabel(id: LensId, lang: ReviewLocale): string {
  return lang === 'en' ? LENS_LABEL_EN[id] : LENSES[id].label;
}

export const LENSES: Record<LensId, JudgmentLens> = {
  core_question: {
    id: 'core_question',
    version: LENS_VERSION,
    label: '핵심 질문',
    applies_to: {},
    purpose: '이 문서가 겉으로 묻는 질문과 실제로 결정해야 하는 질문이 같은지 가른다.',
    input_requirements: ['core_question', 'decision_points'],
    review_questions: [
      '이 문서가 진짜로 결정하려는 것은 무엇인가?',
      '겉 질문과 실제 결정이 다른가?',
    ],
    failure_modes: ['목표를 명확히 하세요', '무엇을 원하는지 정의하세요'],
  },
  claim_evidence: {
    id: 'claim_evidence',
    version: LENS_VERSION,
    label: '주장-근거',
    applies_to: {},
    purpose: '핵심 주장마다 근거가 원문 안에 있는지, 아니면 추정인지 가른다.',
    input_requirements: ['main_claims', 'evidence_items'],
    review_questions: [
      '이 주장의 근거가 문서 안에 있는가, 밖에서 끌어온 추정인가?',
      '근거 없이 단정한 수치/사실은 어느 것인가?',
    ],
    failure_modes: ['근거를 더 조사하세요', '데이터를 보강하세요'],
  },
  hidden_assumption: {
    id: 'hidden_assumption',
    version: LENS_VERSION,
    label: '숨은 가정',
    applies_to: {},
    purpose: '문서가 말하지 않았지만 의존하는 가정과, 그것이 틀렸을 때 무너지는 것을 짚는다.',
    input_requirements: ['assumptions'],
    review_questions: [
      '이 결론이 성립하려면 참이어야 하는, 말하지 않은 가정은 무엇인가?',
      '그 가정이 틀리면 무엇이 무너지는가?',
    ],
    failure_modes: ['가정을 검토하세요', '리스크를 고려하세요'],
  },
  human_judgment: {
    id: 'human_judgment',
    version: LENS_VERSION,
    label: '사람이 판단할 것',
    applies_to: {},
    purpose: 'AI나 문서가 대신 결정하면 안 되는, 사람이 직접 lean을 가져야 하는 지점을 분리한다.',
    input_requirements: ['decision_points'],
    review_questions: [
      '이 문서에서 사람만 판단할 수 있는 항목은 무엇인가?',
      '왜 이것은 모델이나 근거로 대체할 수 없는가?',
    ],
    failure_modes: ['신중하게 결정하세요', '전문가와 상의하세요'],
  },
  stakeholder_objection: {
    id: 'stakeholder_objection',
    version: LENS_VERSION,
    label: '이해관계자 반론',
    applies_to: { min_stakes: 'medium' },
    purpose: '핵심 의사결정자가 이 문서의 특정 claim에 가장 먼저 던질 반론을 미리 꺼낸다.',
    input_requirements: ['stakeholders', 'main_claims'],
    review_questions: [
      '예산/승인을 쥔 사람이 어느 claim에서 먼저 "근거가 뭐냐"고 물을까?',
      '그 반론은 문서의 어느 문장에 걸리는가?',
    ],
    failure_modes: ['이해관계자를 고려하세요', '반대 의견에 대비하세요'],
  },
  execution_risk: {
    id: 'execution_risk',
    version: LENS_VERSION,
    label: '실행 리스크',
    applies_to: {},
    purpose: '실행 단계에서 막힐 dependency, sequencing, owner gap을 문서 안에서 찾는다.',
    input_requirements: ['decision_points', 'tradeoffs'],
    review_questions: [
      '실행 순서상 먼저 풀리지 않으면 막히는 dependency는 무엇인가?',
      '누가 책임지는지 비어 있는 지점은 어디인가?',
    ],
    failure_modes: ['실행 계획을 세우세요', '일정을 관리하세요'],
  },
  reversibility: {
    id: 'reversibility',
    version: LENS_VERSION,
    label: '되돌릴 수 있는가',
    applies_to: { document_type: ['rfc', 'adr', 'strategy_memo', 'proposal'] },
    purpose: '이 결정이 되돌릴 수 있는지, 되돌릴 수 없다면 어떤 proof가 더 필요한지 가른다.',
    input_requirements: ['decision_points'],
    review_questions: [
      '이 결정은 되돌릴 수 있는가, 일방향 문인가?',
      '되돌릴 수 없다면 지금 부족한 proof는 무엇인가?',
    ],
    failure_modes: ['위험을 관리하세요', '신중히 진행하세요'],
  },
  falsifiable_followup: {
    id: 'falsifiable_followup',
    version: LENS_VERSION,
    label: '반증 가능한 후속',
    applies_to: {},
    purpose: '나중에 현실이 pass/fail로 답할 수 있는 predicate를 1-3개 만든다.',
    input_requirements: ['core_question', 'main_claims'],
    review_questions: [
      '언제 무엇을 보면 이 판단이 맞았다/틀렸다고 할 수 있는가?',
      'pass 조건과 fail 조건, check-by는 무엇인가?',
    ],
    failure_modes: ['결과를 추적하세요', '지표를 모니터링하세요'],
  },
  deck_narrative: {
    id: 'deck_narrative',
    version: LENS_VERSION,
    label: '덱 설득 흐름',
    applies_to: { deck_only: true },
    purpose: 'deck이 어떤 순서로 청중을 설득하는지, 핵심 ask가 언제 드러나고 어디서 논리가 점프하는지 본다.',
    input_requirements: ['main_claims'],
    review_questions: [
      '첫 3장 안에 핵심 질문과 ask가 드러나는가?',
      '핵심 claim이 처음 등장하는 슬라이드와 근거를 받는 슬라이드가 연결되는가?',
    ],
    failure_modes: ['슬라이드를 정리하세요', '스토리를 다듬으세요'],
  },
};

export function getLens(id: LensId): JudgmentLens {
  return LENSES[id];
}

export const ALL_LENS_IDS: LensId[] = Object.keys(LENSES) as LensId[];
