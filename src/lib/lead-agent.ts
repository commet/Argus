/**
 * Lead Agent — Hierarchical orchestration layer
 *
 * Domain experts lead both decomposition and synthesis:
 * 1. selectLeadAgent: Deterministic lead selection based on domain classification
 * 2. buildLeadDecompositionContext: Injects lead persona into deepening prompt
 * 3. buildLeadSynthesisPrompt: Lead synthesizes all worker results into integrated analysis
 *
 * Activation gate: stakes >= 'important' AND agentCount >= 2.
 * Routine / single-agent tasks skip lead overhead (returns null).
 */

import type { InputClassification, Domain } from './orchestrator-classify';
import { getSkillSet } from './agent-skills';
import { sanitizeForPrompt as sanitize } from './persona-prompt';

// ─── Types ───

export interface LeadAgentConfig {
  agentId: string;
  agentName: string;
  agentNameEn: string;
  agentRole: string;
  agentRoleEn: string;
  expertise: string;
  tone: string;
  domain: Domain;
}

type Locale = 'ko' | 'en';

// ─── Neutral Synthesizer (the user-facing voice) ───
// The lead that SYNTHESIZES and SPEAKS to the user is always the neutral
// navigator (항해장 / 종합 검토자), never a domain specialist. Rationale: every
// reference multi-agent design seats a GENERALIST in the synthesis chair
// (Anthropic: Opus lead over Sonnet workers; Mixture-of-Agents: a strong domain
// proposer is often a poor aggregator). Domain depth lives in the WORKERS; the
// primary domain is passed to the navigator only as a focus lens, not as an
// identity. This also decouples the user-facing voice from the brittle
// keyword-count domain signal — a mis-ranked domains[0] can no longer hand a
// verdict to the wrong specialist. Built as a self-contained constant so lead
// selection never depends on the navigator being in the unlocked roster.
const NAVIGATOR_LEAD: Omit<LeadAgentConfig, 'domain'> = {
  agentId: 'navigator',
  agentName: '항해장',
  agentNameEn: 'Navigator',
  agentRole: '종합 검토자',
  agentRoleEn: 'Chief Reviewer',
  expertise: '팀 전체 결과물을 통합 검토하고, 톤과 논리의 일관성을 맞춥니다.',
  tone: '개별 의견을 존중하되, 전체가 한 목소리로 읽히도록 편집합니다.',
};

// ─── Synthesis Directives (domain-specific instructions for lead synthesis) ───

const SYNTHESIS_DIRECTIVES: Record<string, string> = {
  strategy: 'Synthesize into a coherent strategic narrative. Identify the governing strategic logic across all analyses. Where workers disagree, choose the stronger argument and explain why.',
  research: 'Synthesize research findings into actionable insights. Cross-validate sources between workers. Separate confirmed facts from interpretations.',
  numbers: 'Unify all quantitative findings into a consistent financial picture. Cross-check assumptions between workers. Flag conflicting numbers explicitly.',
  finance: 'Build a coherent financial analysis from the pieces. Reconcile any conflicting assumptions. Present the numbers as a CFO would — precise, sourced, with caveats.',
  marketing: 'Weave findings into a coherent go-to-market or marketing plan. Ensure channel strategy, budget, and messaging align. Identify the primary growth lever.',
  hr: 'Integrate all people-related analyses into a coherent organizational strategy. Ensure hiring, culture, and change management elements align with business goals.',
  legal: 'Consolidate legal analyses into a clear risk/compliance picture. Distinguish must-do from nice-to-do. Flag areas requiring professional counsel.',
  ux: 'Synthesize UX analyses into a prioritized improvement roadmap. Connect user pain points to business metrics. Ensure recommendations are feasible.',
  tech: 'Synthesize technical analyses into a coherent architecture recommendation. Identify integration points and dependency conflicts between proposals.',
  copy: 'Unify the document sections into a cohesive narrative. Ensure consistent tone, logical flow, and that each section builds on the previous.',
  pm: 'Synthesize into a realistic execution plan. Ensure timeline, resources, and dependencies are consistent. Flag any scheduling conflicts between workers.',
  risk: 'Consolidate risk analyses into a prioritized risk register. Deduplicate, rank by severity, and ensure each risk has a concrete mitigation.',
};

// ─── Lead Selection ───

export function selectLeadAgent(
  classification: InputClassification,
): LeadAgentConfig | null {
  // Gate 1: Routine stakes → no lead
  if (classification.stakes === 'routine') return null;

  // Gate 2: Too few agents → no lead overhead
  if (classification.agentCount < 2) return null;

  // The synthesizer is ALWAYS the neutral navigator. The primary domain (top of
  // the keyword-ranked list) is carried only as a focus lens for the synthesis
  // directive — it never changes WHO speaks. Falls back to 'strategy' focus when
  // classification is empty (generalist integration), never null on this branch.
  const focusDomain = (classification.domains[0] ?? 'strategy') as Domain;
  return { ...NAVIGATOR_LEAD, domain: focusDomain };
}

// ─── Lead Decomposition Context (injected into buildDeepeningPrompt) ───

export function buildLeadDecompositionContext(lead: LeadAgentConfig, locale: Locale = 'en'): string {
  const name = locale === 'ko' ? lead.agentName : lead.agentNameEn;
  const role = locale === 'ko' ? lead.agentRole : lead.agentRoleEn;
  const directive = SYNTHESIS_DIRECTIVES[lead.domain] || SYNTHESIS_DIRECTIVES.strategy;

  return locale === 'ko'
    ? `[종합: ${name} (${role})]
${name}이 모든 결과를 하나의 일관된 방향으로 통합합니다. 각 태스크가 그 통합에 기여하도록 설계하세요.
이번 결정의 초점: ${directive}`
    : `[Synthesis: ${name} (${role})]
${name} will weave all results into one coherent orientation. Design each task so it feeds that integration.
Focus for this decision: ${directive}`;
}

// ─── Lead Synthesis Prompt ───

export function buildLeadSynthesisPrompt(
  lead: LeadAgentConfig,
  problemText: string,
  realQuestion: string,
  workerResults: Array<{ agentName: string; agentRole: string; task: string; result: string; taskGroupId?: string }>,
  locale: Locale = 'en',
): { system: string; user: string } {
  const lang = locale === 'ko' ? 'Korean' : 'English';
  const name = locale === 'ko' ? lead.agentName : lead.agentNameEn;
  const role = locale === 'ko' ? lead.agentRole : lead.agentRoleEn;
  const directive = SYNTHESIS_DIRECTIVES[lead.domain] || SYNTHESIS_DIRECTIVES.strategy;

  // Inject skill frameworks if available
  const skills = getSkillSet(lead.agentId);
  const frameworkBlock = skills
    ? `\nYour analysis frameworks:\n${skills.frameworks.map(f => `- ${f}`).join('\n')}`
    : '';

  // Group by task_group_id (fallback to task text). Same-task multi-persona
  // results render as sub-bullets so the Lead synthesizes them as ONE task
  // with multiple lenses, not as multiple unrelated tasks.
  const groupOrder: string[] = [];
  const groupMap = new Map<string, typeof workerResults>();
  for (const w of workerResults) {
    const gid = w.taskGroupId || w.task;
    if (!groupMap.has(gid)) { groupMap.set(gid, []); groupOrder.push(gid); }
    groupMap.get(gid)!.push(w);
  }
  const resultsBlock = groupOrder.map((gid, i) => {
    const members = groupMap.get(gid)!;
    if (members.length === 1) {
      const w = members[0];
      return `[${i + 1}. ${w.agentName}(${w.agentRole}) — ${w.task}]\n${w.result.slice(0, 1500)}`;
    }
    const taskHeader = `[${i + 1}. ${members[0].task}] (${members.length} perspectives — intentional team diversity)`;
    const subBullets = members.map(w => {
      const indented = w.result.slice(0, 1000).split('\n').map(l => `    ${l}`).join('\n');
      return `  · ${w.agentName}(${w.agentRole}):\n${indented}`;
    }).join('\n');
    return `${taskHeader}\n${subBullets}`;
  }).join('\n\n');

  return {
    system: `You are ${name} (${role}) — the neutral integrator who hands the decision-maker ONE coherent orientation once the analyses are in.
${lead.expertise}
${lead.tone}
${frameworkBlock}

Focus lens for this decision: ${directive}

You are weaving several analyses into one. Write entirely as a single navigator's orientation.

HARD RULES (these define the product, not style):
- NEVER reference the team, "agents", "workers", "two analyses", "N perspectives", or the analysis process itself. The reader must see one coherent orientation, not a status report about who-said-what. The internal structure is yours alone — never narrate it.
- DO NOT issue a verdict, a recommendation, or "what you'd advise". You orient; you never decide in the user's stead. No directional statement — not even a hedged or disclaimed one ("this leans toward X but…" is still forbidden).
- DO NOT manufacture tensions, risks, or warnings. If the picture is genuinely clear, say so plainly. Surfacing a fork on a flat decision is worse than surfacing nothing.
- Be specific: use the actual numbers, facts, and findings from the material. Integration should create meaning no single piece showed alone — surface those connections.
- 3-5 key findings, each a genuine insight, not a restatement.

THE ONE OPEN QUESTION (gated — read carefully):
- Fire-or-not FIRST: is there exactly ONE load-bearing unknown that would genuinely change the direction if it were answered? If yes, pose it as a single NEUTRAL question — no lean, no implied answer. If the decision is flat or already clear, return "" (empty string). Never invent a question to seem thorough.

Always respond in ${lang}.`,

    user: `Project: <user-data>${sanitize(problemText)}</user-data>
Core question: ${sanitize(realQuestion)}

Material to integrate:
${resultsBlock}

Weave this into one coherent orientation. Do not reference the material's sources or the process.

JSON:
{
  "integrated_analysis": "1-2 substantive paragraphs weaving the material into one coherent orientation",
  "key_findings": ["Genuine insight 1 (not a restatement)", "Insight 2", "Insight 3"],
  "open_question": "At most ONE neutral crux question, or \"\" if the decision is flat / already clear"
}`,
  };
}
