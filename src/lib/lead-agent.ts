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

import type { Agent } from '@/stores/agent-types';
import type { InputClassification, Domain, Stakes } from './orchestrator-classify';
import type { LeadSynthesisResult } from '@/stores/types';
import { getSkillSet } from './agent-skills';
import { sanitizeForPrompt as sanitize } from './persona-prompt';
import { getCurrentLanguage } from '@/lib/i18n';

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

// ─── Domain → Lead Agent Mapping ───
// Chain agents escalate by stakes: important → senior, critical → master

const LEAD_DOMAIN_MAP: Record<string, { default: string; critical: string }> = {
  strategy:  { default: 'hyunwoo',  critical: 'chief_strategist' },
  research:  { default: 'sujin',    critical: 'research_director' },
  numbers:   { default: 'minjae',   critical: 'minjae' },
  finance:   { default: 'hyeyeon',  critical: 'hyeyeon' },
  marketing: { default: 'minseo',   critical: 'minseo' },
  hr:        { default: 'sujin_hr', critical: 'sujin_hr' },
  legal:     { default: 'taejun',   critical: 'taejun' },
  ux:        { default: 'jieun',    critical: 'jieun' },
  tech:      { default: 'junseo',   critical: 'junseo' },
  copy:      { default: 'seoyeon',  critical: 'seoyeon' },
  pm:        { default: 'yerin',    critical: 'yerin' },
  risk:      { default: 'donghyuk', critical: 'donghyuk' },
};

const DEFAULT_LEAD = 'hyunwoo'; // Nathan — generalist business strategist

// ─── Synthesis Directives (domain-specific instructions for lead synthesis) ───

const SYNTHESIS_DIRECTIVES: Record<string, string> = {
  strategy: 'Synthesize into a coherent strategic narrative. Identify the governing strategic logic across all analyses. Where workers disagree, surface the disagreement as an open tension — name both sides, do NOT pick a winner.',
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
  unlockedAgents: Agent[],
): LeadAgentConfig | null {
  // Gate 1: Routine stakes → no lead
  if (classification.stakes === 'routine') return null;

  // Gate 2: Too few agents → no lead overhead
  if (classification.agentCount < 2) return null;

  // Primary domain
  const primaryDomain = classification.domains[0];
  if (!primaryDomain) return null;

  const isCritical = classification.stakes === 'critical';

  // Look up candidate from domain map
  const mapping = LEAD_DOMAIN_MAP[primaryDomain];
  const candidateId = mapping
    ? mapping[isCritical ? 'critical' : 'default']
    : DEFAULT_LEAD;

  // Try candidate → fallback default tier → fallback Nathan → null
  const candidates = [
    candidateId,
    mapping?.default,
    DEFAULT_LEAD,
  ].filter((id, i, arr) => id && arr.indexOf(id) === i); // dedupe

  for (const id of candidates) {
    if (!id) continue;
    const agent = unlockedAgents.find(a => a.id === id && !a.archived);
    if (agent) return buildConfig(agent, primaryDomain as Domain);
  }

  return null;
}

function buildConfig(agent: Agent, domain: Domain): LeadAgentConfig {
  return {
    agentId: agent.id,
    agentName: agent.name,
    agentNameEn: agent.nameEn || agent.name,
    agentRole: agent.role,
    agentRoleEn: agent.roleEn || agent.role,
    expertise: agent.expertise || '',
    tone: agent.tone || '',
    domain,
  };
}

// ─── Lead Decomposition Context (injected into buildDeepeningPrompt) ───

export function buildLeadDecompositionContext(lead: LeadAgentConfig, locale: Locale = 'en'): string {
  const name = locale === 'ko' ? lead.agentName : lead.agentNameEn;
  const role = locale === 'ko' ? lead.agentRole : lead.agentRoleEn;
  const directive = SYNTHESIS_DIRECTIVES[lead.domain] || SYNTHESIS_DIRECTIVES.strategy;

  return locale === 'ko'
    ? `[리드 에이전트: ${name} (${role})]
이 분석은 ${name}이 이끕니다. 실행 계획을 설계할 때 ${role}의 관점에서 각 팀원에게 무엇이 필요한지 판단하세요.
${name}이 최종적으로 모든 결과를 통합할 것이므로, 각 태스크가 통합 분석에 기여하도록 설계하세요.`
    : `[Lead Agent: ${name} (${role})]
This analysis is led by ${name}. When designing the execution plan, think from the perspective of a ${role} about what each team member needs to deliver.
${name} will ultimately synthesize all results, so design each task to feed into a coherent integrated analysis.`;
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
    system: `You are ${name}, ${role}.
${lead.expertise}
${lead.tone}
${frameworkBlock}

Your team has completed their individual analyses. As the lead, your job is to SYNTHESIZE all of their findings into ONE integrated analysis.

${directive}

Rules:
- This is NOT a summary of each worker's output. It's YOUR expert synthesis — an integrated view that creates meaning no single worker could produce alone.
- Identify connections between workers' findings that they couldn't see individually.
- A task labeled "(N perspectives — intentional team diversity)" means the user deliberately assigned multiple personas to that task; the sub-bullets are different lenses on the SAME task. Synthesize where they agree and surface where they meaningfully diverge — but treat it as one task in your integrated analysis, not N tasks.
- If workers contradict each other (across DIFFERENT tasks), surface it as an unresolved tension ("X says A, Y says B") and add it to unresolved_tensions — do NOT pick a winner or collapse it into a consensus. The user resolves it.
- Be specific. Use actual numbers, names, and facts from the worker results.
- 3-5 key findings. Each must be a genuine insight, not a restatement.
- Do NOT state which option you'd choose or what you'd advise (no verdict, no lean). Instead, name the single open question this decision turns on — the one unresolved thing that, once known, would settle it. A neutral question, never a recommendation.
Always respond in ${lang}.`,

    user: `Project: <user-data>${sanitize(problemText)}</user-data>
Core question: ${sanitize(realQuestion)}

Team results:
${resultsBlock}

Synthesize these into your integrated analysis.

JSON:
{
  "integrated_analysis": "Your expert synthesis — 1-2 substantive paragraphs weaving all findings together",
  "key_findings": ["Genuine insight 1 (not a restatement)", "Insight 2", "Insight 3"],
  "unresolved_tensions": ["Contradictions or gaps that remain (if any) — including any cross-task worker disagreements, phrased 'X says A, Y says B'"],
  "open_question": "The single unresolved question this decision turns on — a neutral question, not advice or a recommendation"
}`,
  };
}
