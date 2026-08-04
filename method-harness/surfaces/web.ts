// Web surface — the PRIMARY surface (v1.0 §11.2): the six-sentence grammar
// rendered in full. Conversation, small Decision Card, delta, return queue.
// Every block this surface can render is a projection of one of the six
// sentences — renderable blocks carry their sentence index so the grammar
// check (§2.1: "어느 문장의 projection인가") is machine-visible, not vibes.

import { projectCard, semanticCore, type SemanticCore } from '../projection';
import { type ArgusTurn, type CaseState, type ValidationResult } from '../types';

// The six sentences (v1.0 §2.1) — the product's visible constitution.
export const SIX_SENTENCES = [
  '말해 주세요.',
  '제가 이해한 핵심은 이것입니다.',
  '지금 가장 도움이 되는 한 가지를 같이 보겠습니다.',
  '그래서 달라진 것은 이것입니다.',
  '이제 결정하거나, 확인하거나, 멈출 수 있습니다.',
  '현실이 답하면 다시 가져오겠습니다 — 그때는 먼저 무슨 일이 있었는지 듣겠습니다.',
] as const;

export type SentenceIndex = 0 | 1 | 2 | 3 | 4 | 5;

export interface WebBlock {
  sentence: SentenceIndex; // which sentence this block projects — the §2.1 gate
  kind: 'input' | 'understanding' | 'primary_move' | 'question' | 'recommendation' | 'delta' | 'adoption' | 'card' | 'return_queue' | 'validator_notice';
  title: string;
  body: string;
  meta?: Record<string, string>;
}

export interface WebView {
  grammar: typeof SIX_SENTENCES;
  blocks: WebBlock[];
  core?: SemanticCore; // parity anchor with MCP (§11.3)
}

export function renderTurn(result: ValidationResult, state: CaseState): WebView {
  const blocks: WebBlock[] = [];
  const turn = result.turn;

  // Honesty first: what the machine did to the model's output is user-visible.
  for (const d of result.downgrades) {
    blocks.push({ sentence: 2, kind: 'validator_notice', title: '조정됨', body: d.detail, meta: { code: d.code } });
  }
  for (const r of result.rejections) {
    blocks.push({ sentence: 2, kind: 'validator_notice', title: '차단됨', body: r.detail, meta: { code: r.code } });
  }

  blocks.push({
    sentence: 1,
    kind: 'understanding',
    title: '제가 이해한 핵심',
    body: turn.primaryMove.whyNow,
    meta: { phase: turn.phase, route: turn.route },
  });

  blocks.push({
    sentence: 2,
    kind: 'primary_move',
    title: moveTitle(turn),
    body: turn.primaryMove.content,
    meta: turn.primaryMove.falsifier ? { falsifier: turn.primaryMove.falsifier } : {},
  });

  if (turn.question) {
    blocks.push({ sentence: 2, kind: 'question', title: '하나만 여쭙니다', body: turn.question.text, meta: { effect: turn.question.materialEffect } });
  }

  if (turn.recommendation) {
    blocks.push({
      sentence: 2,
      kind: 'recommendation',
      title: `권고 (${turn.recommendation.kind})`,
      body: `${turn.recommendation.proposal}\n조건: ${turn.recommendation.changeCondition}`,
      meta: { readiness: turn.recommendation.readiness, authority: 'Argus의 제안 — 채택 전에는 사용자의 결정이 아닙니다' },
    });
  }

  if (turn.decisionRecordCandidate) {
    blocks.push({
      sentence: 4,
      kind: 'adoption',
      title: 'Decision Card 후보 — 채택은 한 번의 행위입니다',
      body: `${turn.decisionRecordCandidate.question} → ${turn.decisionRecordCandidate.choiceOrPolicy}`,
      meta: { actions: 'accept · edit · decline' },
    });
  }

  if (state.card) {
    const projection = projectCard(state, 'web');
    blocks.push({ sentence: 3, kind: 'card', title: '채택된 결정', body: projection.text });
  }

  return { grammar: SIX_SENTENCES, blocks, core: state.card ? semanticCore(state) : undefined };
}

export function renderReturnQueue(states: CaseState[]): WebBlock[] {
  return states
    .filter((s) => s.activeReturn)
    .map((s) => ({
      sentence: 5 as SentenceIndex,
      kind: 'return_queue' as const,
      title: `귀환 대기 · ${s.activeReturn!.contract.kind}`,
      body: s.card?.question ?? s.caseId,
      meta: { state: s.state },
    }));
}

function moveTitle(turn: ArgusTurn): string {
  const titles: Record<string, string> = {
    mirror: '지금 들리는 것',
    reframe: '결정을 다시 잡으면',
    value_clarification: '무엇을 지키려는지부터',
    alternative_generation: '세 번째 길',
    research: '확인할 사실',
    claim_source_split: '아는 것과 믿는 것',
    competing_hypotheses: '다른 설명',
    outside_view: '바깥에서 보면',
    premortem: '실패했다고 가정하면',
    tradeoff_comparison: '맞바꾸는 것',
    experiment_design: '되돌릴 수 있는 실험',
    recommendation: '권고',
    next_action_concretion: '오늘의 다음 행동',
    deliberate_defer: '의도적 보류',
    stop: '여기서 멈추는 이유',
  };
  return titles[turn.primaryMove.type] ?? turn.primaryMove.type;
}
