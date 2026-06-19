import { AgentCard } from 'argus';

// AgentCard — a single crew member on the roster (선원 명부). It renders the
// agent's emoji, role, name, level pill, observation count, and an XP progress
// bar tinted with the agent's color. Three real states from the product:
//   • unlocked builtin agents (the common case — all 17 crew are aboard from
//     the first voyage; XP/level are cosmetic growth)
//   • the Navigator (항해장) — special card styling (agent-card-navigator)
//   • a locked card — exercises LockedAgentCard + the unlock-condition copy
// The card reads locale from localStorage; we seed Korean to match the set.
// Agents are the real BUILTIN_AGENTS (names/roles/colors/emoji verbatim), with
// realistic XP/level/observation counts layered on.

if (typeof window !== 'undefined') {
  try {
    window.localStorage.setItem('sot_settings', JSON.stringify({ language: 'ko' }));
  } catch {}
}

const TS = '2026-06-17T08:00:00.000Z';

/* eslint-disable @typescript-eslint/no-explicit-any */
const obs = (category: string, observation: string, confidence: number): any => ({
  id: `o-${Math.random().toString(36).slice(2, 8)}`,
  category, observation, confidence, evidence_count: 3, created_at: TS, source: 'auto',
});

const make = (a: Record<string, unknown>): any => ({
  origin: 'builtin', capabilities: ['task_execution'], chain_id: null,
  unlock_condition: { type: 'always', required: 0 }, unlocked: true,
  observations: [], is_builtin: true, archived: false,
  last_used_at: TS, created_at: TS, updated_at: TS, ...a,
});

const RILEY = make({
  id: 'hayoon', name: '하윤', nameEn: 'Riley', role: '리서치 인턴', roleEn: 'Research Intern',
  emoji: '📝', color: '#06B6D4', group: 'research', chain_id: 'research', xp: 70, level: 1,
});
const STELLA = make({
  id: 'minseo', name: '민서', nameEn: 'Stella', role: '마케팅·그로스 전략가', roleEn: 'Marketing & Growth',
  emoji: '📣', color: '#E11D48', group: 'production', xp: 340, level: 3,
  observations: [obs('preference', '정량 지표를 먼저 제시하면 신뢰합니다.', 0.82), obs('work_pattern', '초안을 빠르게 보고 반복 수정합니다.', 0.61)],
});
const VICTOR = make({
  id: 'chief_strategist', name: '승현', nameEn: 'Victor', role: '수석 전략가', roleEn: 'Chief Strategist',
  emoji: '🏛️', color: '#6D28D9', group: 'strategy', chain_id: 'strategy', xp: 720, level: 4,
  observations: [obs('communication_style', '결론을 먼저, 근거는 한 줄로 원합니다.', 0.74)],
});
const BLAKE = make({
  id: 'donghyuk', name: '동혁', nameEn: 'Blake', role: '리스크 검토자', roleEn: 'Risk Reviewer',
  emoji: '⚠️', color: '#EF4444', group: 'validation', xp: 150, level: 2,
  observations: [obs('skill_gap', '낙관 시나리오에 치우치는 경향이 있습니다.', 0.55)],
});
const NAVIGATOR = make({
  id: 'navigator', name: '항해장', nameEn: 'Navigator', role: 'Navigator', roleEn: 'Navigator',
  emoji: '🧭', color: '#D97706', group: 'special', capabilities: ['review'], xp: 420, level: 3,
});
const LOCKED = make({
  id: 'locked_specialist', name: '데이터 사이언티스트', nameEn: 'Data Scientist', role: '데이터 분석',
  emoji: '🔬', color: '#0EA5E9', group: 'production', xp: 0, level: 1, unlocked: false, is_builtin: false,
  unlock_condition: { type: 'total_tasks', required: 10 },
});

const Grid = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 160px)', gap: 12, padding: 20, background: 'var(--bg)' }}>
    {children}
  </div>
);

export const Crew = () => (
  <Grid>
    <AgentCard agent={STELLA} onClick={() => {}} />
    <AgentCard agent={VICTOR} onClick={() => {}} />
    <AgentCard agent={BLAKE} onClick={() => {}} />
    <AgentCard agent={RILEY} onClick={() => {}} />
  </Grid>
);

export const Navigator = () => (
  <Grid>
    <AgentCard agent={NAVIGATOR} onClick={() => {}} />
  </Grid>
);

export const Locked = () => (
  <Grid>
    <AgentCard agent={LOCKED} />
  </Grid>
);
