/**
 * orchestrator-framework.ts — 컨텍스트별 프레임워크 배정
 *
 * 에이전트의 전체 스킬셋 중 입력에 가장 적합한 1개 프레임워크를 선택.
 * LLM 호출 없음. 도메인 × decisionType → 프레임워크 매핑 테이블 기반.
 */

import type { InputClassification, Domain } from './orchestrator-classify';
import { getSkillSet } from './agent-skills';
import { agentIdToFrameworkKey } from './agent-registry';

/* ─── 에이전트 persona ID → 선호 프레임워크 매핑 ─── */

// key: "personaId:decisionType" 또는 "personaId:domain" 또는 "personaId:*"
// value: 프레임워크 문자열의 시작 부분 (partial match)
const FRAMEWORK_PRIORITY: Record<string, string[]> = {
  // ─── Researcher (다은) ───
  'researcher:on_fire':        ['Confidence Levels', 'So What'],
  'researcher:needs_analysis': ['Analysis of Competing Hypotheses', 'Triangulation', 'MECE'],
  'researcher:known_path':     ['MECE', 'So What'],
  'researcher:*':              ['Confidence Levels', 'MECE', 'So What'],

  // ─── Strategist (현우) ───
  'strategist:known_path':     ['Playing to Win', 'Value Chain'],
  'strategist:needs_analysis': ['WWHTBT', '7 Powers', 'Jobs-to-be-Done'],
  'strategist:no_answer':      ['WWHTBT', 'Playing to Win', 'Jobs-to-be-Done'],
  'strategist:on_fire':        ['Pre-mortem', 'Playing to Win'],
  'strategist:*':              ['Playing to Win', 'WWHTBT', 'Jobs-to-be-Done'],

  // ─── Numbers (규민) ───
  'numbers:on_fire':           ['Break-even', 'Sensitivity'],
  'numbers:needs_analysis':    ['Market Sizing Convergence', 'Contribution Margin', 'Cohort'],
  'numbers:known_path':        ['Driver-Based', 'Unit Economics'],
  'numbers:*':                 ['Driver-Based', 'Market Sizing Convergence', 'Unit Economics'],

  // ─── Finance (혜연) ───
  'finance:needs_analysis':    ['Valuation Triangulation', 'DuPont', 'Quality of Earnings'],
  'finance:on_fire':           ['Cash Conversion', 'Startup Finance'],
  'finance:known_path':        ['Financial Statement', 'Budget Variance'],
  'finance:*':                 ['Valuation Triangulation', 'Financial Statement'],

  // ─── Marketing (민서) ───
  'marketing:needs_analysis':  ['Growth Loops', 'Growth Accounting', 'North Star'],
  'marketing:on_fire':         ['Channel Strategy', 'Sean Ellis'],
  'marketing:known_path':      ['Channel Strategy', 'JTBD in Marketing'],
  'marketing:*':               ['Growth Loops', 'North Star', 'Channel Strategy'],

  // ─── People & Culture (수진) ───
  'people_culture:needs_analysis': ['Team Topologies', 'Conway', 'OCAI'],
  'people_culture:on_fire':    ['Switch Framework', 'ADKAR'],
  'people_culture:known_path': ['RACI', 'Total Rewards'],
  'people_culture:*':          ['Team Topologies', 'Switch Framework'],

  // ─── Copywriter (서연) ───
  'copywriter:needs_analysis': ['SCQA', 'Pyramid Principle'],
  'copywriter:on_fire':        ['PAS', 'SCQA'],
  'copywriter:known_path':     ['Pyramid Principle', 'StoryBrand'],
  'copywriter:*':              ['SCQA', 'Pyramid Principle', 'PAS'],

  // ─── Critic (동혁) ───
  'critic:on_fire':            ['Pre-mortem', 'Red Team'],
  'critic:needs_analysis':     ['Key Assumptions Check', 'Bow-Tie', 'Pre-mortem'],
  'critic:known_path':         ['Expected Value', 'Second-order', 'Key Assumptions'],
  'critic:no_answer':          ['HILP', 'Pre-mortem', 'Cognitive Bias'],
  'critic:*':                  ['Key Assumptions Check', 'Pre-mortem', 'Expected Value'],

  // ─── UX Designer (지은) ───
  'ux:needs_analysis':         ['Service Blueprint', 'Forces Diagram', 'Laws of UX'],
  'ux:on_fire':                ['Nielsen', 'Laws of UX'],
  'ux:known_path':             ['Laws of UX', 'Gestalt', 'User Journey'],
  'ux:*':                      ['Laws of UX', 'Service Blueprint', 'Nielsen'],

  // ─── Legal (윤석) ───
  'legal:needs_analysis':      ['Contract Analysis', 'IP Assignment', 'AI-Specific'],
  'legal:on_fire':             ['Legal Risk Matrix', 'Privacy'],
  'legal:known_path':          ['Regulatory Compliance', 'Contract Analysis'],
  'legal:*':                   ['Legal Risk Matrix', 'Contract Analysis', 'Privacy'],

  // ─── Intern (하윤) ───
  'intern:*':                  ['Hypothesis-Testing', 'Source Evaluation', '5W1H'],

  // ─── Engineer (준서) ───
  'engineer:needs_analysis':   ['Domain-Driven', 'Monolith-First', 'SRE'],
  'engineer:on_fire':          ['C4 Model', 'ADR'],
  'engineer:known_path':       ['ADR', 'Technology Radar', 'Buy vs Build'],
  'engineer:*':                ['Domain-Driven', 'C4 Model', 'ADR'],

  // ─── PM (예린) ───
  'pm:needs_analysis':         ['Opportunity Solution Tree', 'RICE', 'Working Backwards'],
  'pm:on_fire':                ['RACI', 'Pre-mortem'],
  'pm:known_path':             ['Shape Up', 'Decision Log', 'RACI'],
  'pm:*':                      ['Opportunity Solution Tree', 'RICE', 'RACI'],

  // ─── Research Director (도윤) ───
  'research_director:needs_analysis': ['Pyramid Principle', 'Key Assumptions Check', 'Linchpin'],
  'research_director:on_fire':        ['SCQA', 'Pre-mortem'],
  'research_director:*':              ['Pyramid Principle', 'SCQA', 'Key Assumptions'],

  // ─── Strategy Junior (정민) ───
  'strategy_jr:needs_analysis': ['Rumelt', 'ERRC', 'Decision Classification'],
  'strategy_jr:known_path':     ['Comparison Matrix', 'SWOT'],
  'strategy_jr:*':              ['Rumelt', 'SWOT', 'Decision Classification'],

  // ─── Strategy Chief (승현) ───
  'chief_strategist:needs_analysis': ['Scenario Planning', 'Wardley', 'Real Options'],
  'chief_strategist:on_fire':        ['Kill Criteria', 'Cynefin', 'Scenario Planning'],
  'chief_strategist:no_answer':      ['Wardley', 'Real Options', 'Cynefin'],
  'chief_strategist:*':              ['Scenario Planning', 'Wardley', 'Kill Criteria'],

  // ─── Navigator (항해장) ───
  'navigator:needs_analysis': ['Dialectical Synthesis', 'Assumption Audit', 'Murder Board'],
  'navigator:on_fire':        ['6-Point Cognitive Bias', 'Meta-Pattern'],
  'navigator:*':              ['Dialectical Synthesis', '6-Point Cognitive Bias', 'Assumption Audit'],
};

/* ─── Main ─── */

export function assignFramework(
  agentId: string,
  stepTask: string,
  classification: InputClassification,
): string | null {
  const personaId = agentIdToFrameworkKey(agentId);
  const skillSet = getSkillSet(personaId);
  if (!skillSet || skillSet.frameworks.length === 0) return null;

  // 1. decisionType 키로 우선 탐색
  const dtKey = `${personaId}:${classification.decisionType}`;
  const priorities = FRAMEWORK_PRIORITY[dtKey] || FRAMEWORK_PRIORITY[`${personaId}:*`] || [];

  // 2. 우선순위 목록에서 스킬셋에 실제 있는 것 찾기
  for (const prefix of priorities) {
    const match = skillSet.frameworks.find(f =>
      f.toLowerCase().includes(prefix.toLowerCase())
    );
    if (match) return match;
  }

  // 3. step.task 텍스트와 프레임워크 키워드 직접 매칭
  const taskLower = stepTask.toLowerCase();
  for (const fw of skillSet.frameworks) {
    const fwName = fw.split(':')[0].toLowerCase().trim();
    if (taskLower.includes(fwName)) return fw;
  }

  // 4. 폴백: 첫 번째 프레임워크 (가장 대표적)
  return skillSet.frameworks[0];
}
