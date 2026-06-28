/**
 * agent-lens.ts — the 10 lenses (WHO), grouping the 16 routable agents.
 *
 * A lens is a distinct *way of looking*, not a person. The agents keep all their
 * knowledge/frameworks/voice; this layer just groups them so routing works at
 * the lens level (non-overlapping perspectives) instead of fighting over
 * near-identical neighbors. Diversity rule: at most one worker per lens in a
 * run, which dissolves the chain-hierarchy ties (e.g. hayoon~sujin, both Scout)
 * we measured in the routing audit — the higher score wins the lens, the rest
 * of the run goes to other lenses.
 *
 * legal is its OWN lens (split from skeptic): legal/compliance is a genuinely
 * different competence than risk/pre-mortem, so a decision needing both gets a
 * legal worker AND a risk worker instead of one-of-each-blocking-the-other.
 *
 * Mapping mirrors docs/AGENT-LENS-PATTERN-DESIGN-2026-06-26.md. Kept separate
 * from agent-registry so this is additive and reversible.
 */

export type Lens =
  | 'scout'      // 탐색 — fast facts, evidence, cases
  | 'quant'      // 수치 — estimation, sizing, unit-economics, ROI (minjae)
  | 'finance'    // 재무 — statements, valuation, audit (hyeyeon; split from quant — different competence)
  | 'strategy'   // 전략 — direction, framing, options (firm-level)
  | 'marketing'  // 마케팅 — GTM, channels, growth (minseo; split from strategy)
  | 'skeptic'    // 검증 — risk, counter-view, pre-mortem
  | 'legal'      // 법무 — legal/compliance/contract review
  | 'operator'   // 실행 — people, org, schedule, feasibility
  | 'craft'      // 전달 — write-to-be-read, UX
  | 'conductor'; // 지휘 — synthesize, surface contradictions

const LENS_BY_AGENT: Record<string, Lens> = {
  hayoon: 'scout',
  sujin: 'scout',
  minjae: 'quant',
  hyeyeon: 'finance',
  strategy_jr: 'strategy',
  hyunwoo: 'strategy',
  chief_strategist: 'strategy',
  minseo: 'marketing',   // GTM/채널/그로스 — split from strategy (firm-strategy ≠ go-to-market)
  donghyuk: 'skeptic',
  taejun: 'legal',
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
