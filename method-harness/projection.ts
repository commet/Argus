// Surface projection — v1.0 §11. Web and MCP render differently but must carry
// identical MEANING: decision, rationale, assumptions, next action, return.
// The parity test compares the semantic core field-by-field, not the strings.

import { type CaseState } from './types';

export interface SemanticCore {
  question: string;
  choiceOrPolicy: string;
  values: string[];
  materialBeliefs: Array<{ belief: string; confidence: string }>;
  nextAction?: { action: string; owner: string; byOrWhen: string };
  returnKind?: string;
  authorship: 'user_adopted';
  baselineLean?: string;
}

export function semanticCore(state: CaseState): SemanticCore {
  if (!state.card) throw new Error('semanticCore requires an adopted card');
  const c = state.card;
  return {
    question: c.question,
    choiceOrPolicy: c.choiceOrPolicy,
    values: [...c.rationale.values],
    materialBeliefs: c.rationale.materialBeliefs.map((b) => ({ belief: b.belief, confidence: b.confidence })),
    nextAction: c.nextAction ? { ...c.nextAction } : undefined,
    returnKind: state.activeReturn?.contract.kind ?? c.returnContract?.kind,
    authorship: 'user_adopted',
    baselineLean: state.baseline && state.baseline !== 'not_captured' ? state.baseline.lean : undefined,
  };
}

export interface Projection {
  surface: 'web' | 'mcp';
  text: string;
  core: SemanticCore; // the parity contract rides along with every projection
}

export function projectCard(state: CaseState, surface: 'web' | 'mcp'): Projection {
  const core = semanticCore(state);
  if (surface === 'web') {
    const lines = [
      `결정: ${core.choiceOrPolicy}`,
      core.baselineLean ? `처음: ${core.baselineLean}` : undefined,
      `이유: ${core.values.join(' · ')}`,
      ...core.materialBeliefs.map((b) => `중요 가정: ${b.belief} [${b.confidence}]`),
      core.nextAction ? `다음 행동: ${core.nextAction.action} — owner: ${core.nextAction.owner}, ${core.nextAction.byOrWhen}` : undefined,
      core.returnKind ? `귀환: ${core.returnKind}` : undefined,
    ].filter((l): l is string => Boolean(l));
    return { surface, text: lines.join('\n'), core };
  }
  // MCP: compact single-paragraph rendering; capability differs, meaning must not.
  const compact = [
    `[Argus] ${core.question} → ${core.choiceOrPolicy} (사용자 채택)`,
    core.nextAction ? `다음: ${core.nextAction.action} (${core.nextAction.owner}, ${core.nextAction.byOrWhen})` : undefined,
    core.returnKind ? `귀환 대기: ${core.returnKind}` : undefined,
  ]
    .filter(Boolean)
    .join(' · ');
  return { surface, text: compact, core };
}
