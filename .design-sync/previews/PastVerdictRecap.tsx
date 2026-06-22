import { PastVerdictRecap, AgentHub } from 'argus';

// PastVerdictRecap — shown when a SAVED boss is reloaded: it restores the boss's
// last private verdict from agent.inner_monologue_archive as an "이전 결론" card,
// expandable to reveal the full inner monologue + the day's mood.
//
// STORE HYDRATION: this reads useAgentStore reactively and returns null when no
// matching agent is in the store. The store starts as agents: [] and does NOT
// auto-hydrate (the app shell calls loadAgents()). The store isn't exported and
// the DS package is externalized to a prebuilt global, so a relative store import
// would hit a SEPARATE instance — setState there can't reach the render. The way
// in is to drive the SAME store instance through an exported component that
// hydrates it: AgentHub calls loadAgents() on mount, which loads our seeded
// sot_agents synchronously into the shared store. We render AgentHub hidden purely
// for that side-effect; PastVerdictRecap then finds the seeded boss and re-renders.
//
// MOTION SETTLE (see ChatMessage.tsx): the recap enters via an inline opacity
// tween the capture can shoot mid-flight; a `!important` rule pins it visible.
if (typeof window !== 'undefined') {
  try {
    window.localStorage.setItem('sot_settings', JSON.stringify({ language: 'ko' }));
    window.localStorage.setItem(
      'sot_agents',
      JSON.stringify([
        {
          id: 'boss-istj-saved',
          name: '신뢰의 관리자 팀장',
          role: '직속 팀장',
          emoji: '📋',
          color: '#b8963e',
          origin: 'boss',
          capabilities: [],
          group: 'boss',
          chain_id: null,
          unlock_condition: { type: 'always', required: 0 },
          unlocked: true,
          personality_code: 'ISTJ',
          boss_gender: '남',
          birth_year: 1988,
          birth_month: 4,
          birth_day: 9,
          chat_history: [
            { role: 'user', content: '신사업 베타를 4주 안에 시연하는 일정으로 가도 될까요?', timestamp: 1718500000000 },
            { role: 'assistant', content: '방향은 나쁘지 않아. 근데 첫 고객을 어디서 데려올지가 비어 있어.', timestamp: 1718500050000 },
          ],
          inner_monologue_archive: [
            {
              id: 'im-1',
              created_at: '2026-06-16T09:30:00.000Z',
              text: '4주는 빠듯하지. 근데 이 친구 일정은 늘 보수적으로 잡는 편이라 오히려 신뢰가 가. 첫 고객 확보만 막히지 않으면 갈 만해. 거기서 한 번 더 짚어줘야겠다.',
              verdict: 'conditional',
              verdict_reason: '방향은 좋다. 첫 25곳 확보 경로가 정리되면 승인.',
              situation: '신사업 베타 4주 시연 일정',
              daily_mood: 'light',
              daily_mood_label: '평온한 편',
              daily_name: '무오',
            },
          ],
          xp: 120,
          level: 3,
          observations: [],
          is_builtin: false,
          archived: false,
          last_used_at: '2026-06-16T09:30:00.000Z',
          created_at: '2026-06-10T02:00:00.000Z',
          updated_at: '2026-06-16T09:30:00.000Z',
        },
      ]),
    );
  } catch {}
}
if (typeof document !== 'undefined' && !document.getElementById('ds-motion-settle')) {
  const s = document.createElement('style');
  s.id = 'ds-motion-settle';
  s.textContent = '[style*="opacity"]{opacity:1!important}';
  document.head.appendChild(s);
}

export const RestoredVerdict = () => (
  <>
    {/* Hidden — mounted only to run loadAgents() into the shared store instance. */}
    <div style={{ display: 'none' }} aria-hidden>
      <AgentHub />
    </div>
    <PastVerdictRecap agentId="boss-istj-saved" />
  </>
);
