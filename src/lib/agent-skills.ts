/**
 * Agent Skill System — defines actual capabilities per agent
 *
 * Each persona has real expertise, not just a name tag:
 * 1. Role-specific frameworks + checklists + output format
 * 2. Junior/Senior/Guru 3-tier depth
 * 3. External tool/data source connection hooks
 */

import type { AgentLevel } from '@/stores/types';
import type { PersonaId } from './agent-registry';

// ─── Level Mapping (session 3-tier ↔ unified system Lv.1-5) ───

export function numericLevelToAgentLevel(lv: number): AgentLevel {
  if (lv >= 5) return 'guru';
  if (lv >= 3) return 'senior';
  return 'junior';
}

/**
 * Worker execution level with "base skill always on".
 *
 * The junior tier is treated as a FLOOR of senior, so a brand-new agent
 * (numeric level 1) already runs at its senior prompt + token budget instead
 * of the 800-token / fast-model junior cap. Earned numeric levels still promote
 * to guru (lv≥5) — XP becomes a bonus on top, not a gate in front. This only
 * reinterprets the numeric level for prompt/token/model selection; the raw
 * `agent.level` is untouched, so planning/tool/routing gates are unaffected.
 *
 * Exception: intern, whose senior/guru levelPrompts are placeholders
 * ("operates at junior level only") — it must stay junior.
 */
export function effectiveWorkerLevel(numericLevel: number, agentId?: string): AgentLevel {
  const personaId = agentId ? agentIdToPersonaId(agentId) : undefined;
  // intern's senior AND guru levelPrompts are placeholders — junior-only by design.
  if (personaId === 'intern') return 'junior';
  const base = numericLevelToAgentLevel(numericLevel);
  // strategy_jr's guru levelPrompt is a placeholder ("operates at senior level max")
  // — cap it at senior so the placeholder never leaks into the system prompt.
  if (personaId === 'strategy_jr' && base === 'guru') return 'senior';
  // Base skill always on: a level-1 (junior) agent already runs at its senior tier.
  return base === 'junior' ? 'senior' : base;
}

// ─── Level System ───

export interface AgentLevelConfig {
  level: AgentLevel;
  label: string;
  maxTokens: number;
  description: string;
}

export const LEVEL_CONFIGS: Record<AgentLevel, AgentLevelConfig> = {
  junior: {
    level: 'junior',
    label: 'Junior',
    maxTokens: 800,
    description: 'Fast and focused. Solid fundamentals.',
  },
  senior: {
    level: 'senior',
    label: 'Senior',
    maxTokens: 1500,
    description: 'Multi-angle analysis. Reads context deeply.',
  },
  guru: {
    level: 'guru',
    label: 'Guru',
    maxTokens: 2500,
    description: 'Insight level. Sees what others miss.',
  },
};

// ─── Tool / Data Source Definition ───

export interface AgentTool {
  id: string;
  name: string;
  description: string;
  type: 'api' | 'database' | 'framework' | 'template';
  url?: string;
  available: boolean;
  minLevel: AgentLevel;
}

// ─── Skill Definition per Persona ───

export interface AgentSkillSet {
  personaId: PersonaId;
  frameworks: string[];
  checkpoints: string[];
  outputFormat: string;
  tools: AgentTool[];
  levelPrompts: Record<AgentLevel, string>;
}

// ─── Global Tools (available to all agents) ───

const GLOBAL_TOOLS: AgentTool[] = [
  { id: 'web_search', name: 'Web Search', description: 'Real-time global web search', type: 'api', available: false, minLevel: 'junior' },
  { id: 'web_fetch', name: 'Web Page Fetch', description: 'URL-based content extraction', type: 'api', available: false, minLevel: 'junior' },
  { id: 'arxiv', name: 'arXiv Papers', description: 'Academic paper search (global)', type: 'api', url: 'https://arxiv.org/api', available: false, minLevel: 'senior' },
  { id: 'wikipedia', name: 'Wikipedia', description: 'Multilingual Wikipedia reference', type: 'api', available: false, minLevel: 'junior' },
];


// ─── 14 Agent Skill Sets (data in agent-skills-data.ts) ───
import { AGENT_SKILLS } from './agent-skills-data';
export { AGENT_SKILLS };


// ─── Lookup (uses agent-registry.ts as single source of truth) ───

import { agentIdToPersonaId } from './agent-registry';

export function getSkillSet(idOrPersonaId: string): AgentSkillSet | undefined {
  const skillId = agentIdToPersonaId(idOrPersonaId);
  return AGENT_SKILLS.find(s => s.personaId === skillId);
}

/**
 * getFrameworkSkill — Extract a specific framework only.
 * Inject guidance for the orchestrator-assigned framework into the prompt.
 * Injects 1 framework instead of the full skill set for token savings + focus.
 */
export function getFrameworkSkill(
  agentIdOrPersonaId: string,
  frameworkName: string,
): { framework: string; checkpoints: string[]; levelPrompts: Record<AgentLevel, string>; outputFormat: string } | undefined {
  const skillSet = getSkillSet(agentIdOrPersonaId);
  if (!skillSet) return undefined;

  const fwLower = frameworkName.trim().toLowerCase();
  if (!fwLower) return undefined;
  const matched = skillSet.frameworks.find(f => f.toLowerCase().includes(fwLower));
  if (!matched) return undefined;

  return {
    framework: matched,
    checkpoints: skillSet.checkpoints,
    levelPrompts: skillSet.levelPrompts,
    outputFormat: skillSet.outputFormat,
  };
}

export function getAvailableTools(personaId: string, level: AgentLevel): AgentTool[] {
  const skills = getSkillSet(personaId);
  const levelOrder: Record<AgentLevel, number> = { junior: 0, senior: 1, guru: 2 };
  const agentTools = skills?.tools ?? [];
  const allTools = [...GLOBAL_TOOLS, ...agentTools];
  return allTools.filter(t => levelOrder[t.minLevel] <= levelOrder[level]);
}
