/**
 * agent-lens.ts — the 7 lenses (WHO), grouping the 17 agents.
 *
 * A lens is a distinct *way of looking*, not a person. The 17 agents keep all
 * their knowledge/frameworks/voice; this layer just groups them so routing
 * works at the lens level (7 non-overlapping perspectives) instead of fighting
 * over near-identical neighbors. Diversity rule: at most one worker per lens in
 * a run, which dissolves the chain-hierarchy ties (e.g. hayoon~sujin, both
 * Scout) we measured in the routing audit — the higher score wins the lens, the
 * rest of the run goes to other lenses.
 *
 * Mapping mirrors docs/AGENT-LENS-PATTERN-DESIGN-2026-06-26.md. Kept separate
 * from agent-registry so this is additive and reversible.
 */

export type Lens =
  | 'scout'      // 탐색 — fast facts, evidence, cases
  | 'quant'      // 수치 — estimation, ROI, finance
  | 'strategy'   // 전략 — direction, framing, options
  | 'skeptic'    // 검증 — risk, counter-view, legal
  | 'operator'   // 실행 — people, org, schedule, feasibility
  | 'craft'      // 전달 — write-to-be-read, UX
  | 'conductor'; // 지휘 — synthesize, surface contradictions

const LENS_BY_AGENT: Record<string, Lens> = {
  hayoon: 'scout',
  sujin: 'scout',
  minjae: 'quant',
  hyeyeon: 'quant',
  strategy_jr: 'strategy',
  hyunwoo: 'strategy',
  chief_strategist: 'strategy',
  donghyuk: 'skeptic',
  taejun: 'skeptic',
  sujin_hr: 'operator',
  yerin: 'operator',
  junseo: 'operator',
  seoyeon: 'craft',
  jieun: 'craft',
  research_director: 'conductor',
  navigator: 'conductor',
};

/** The lens an agent belongs to, or null for unmapped/custom agents
 *  (which are exempt from the one-per-lens diversity rule). */
export function lensOf(agentId: string): Lens | null {
  return LENS_BY_AGENT[agentId] ?? null;
}
