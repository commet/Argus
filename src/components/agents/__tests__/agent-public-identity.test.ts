import { describe, expect, it } from 'vitest';
import { publicAgentLabel } from '@/components/agents/agent-format';
import type { Agent } from '@/stores/agent-types';

const base = {
  id: 'minjae', name: '규민', nameEn: 'Ethan', role: '숫자 분석', roleEn: 'Numbers', emoji: '📊', color: '#987',
  origin: 'builtin', capabilities: ['review'], group: 'research', chain_id: null,
  unlock_condition: { type: 'always', required: 0 }, unlocked: true, xp: 80, level: 3,
  observations: [], is_builtin: true, archived: false, last_used_at: null,
  created_at: '', updated_at: '',
} satisfies Agent;

describe('public agent identity', () => {
  it('names built-in machinery by function, never by fictional coworker', () => {
    expect(publicAgentLabel(base, 'ko')).toBe('근거 확인');
    expect(publicAgentLabel(base, 'en')).toBe('Evidence check');
  });

  it('preserves a persona the user actually created', () => {
    const custom = { ...base, origin: 'custom', is_builtin: false, name: '김 팀장', nameEn: undefined } satisfies Agent;
    expect(publicAgentLabel(custom, 'ko')).toBe('김 팀장');
    expect(publicAgentLabel(custom, 'en')).toBe('김 팀장');
  });
});
