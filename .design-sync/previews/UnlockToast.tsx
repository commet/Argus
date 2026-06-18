import { AgentHub, UnlockToast } from 'argus';

// UnlockToast — the celebratory bottom-center toast stack that springs in when
// crew are newly unlocked (emoji + name + "{role} 해금!"). It reads `agents` +
// `lastUnlockedIds` from useAgentStore. That store lives inside the argus bundle
// — a different module instance from anything the preview imports — so we can't
// set its state directly. Instead we seed localStorage with two crew that are
// still locked (unlock_condition 'always'), then mount an off-screen AgentHub:
// AgentHub is a bundle component that shares the same store and calls loadAgents
// on mount → checkUnlocks flips the two crew and writes their ids into
// lastUnlockedIds → the toast picks them up and fires.

const TS = '2026-06-17T08:00:00.000Z';
const lockedCrew = (id: string, name: string, role: string, emoji: string, color: string, group: string) => ({
  id, name, role, emoji, color, group, chain_id: null,
  origin: 'custom', capabilities: ['task_execution'],
  unlock_condition: { type: 'always', required: 0 }, unlocked: false,
  observations: [], xp: 0, level: 1,
  is_builtin: false, archived: false, last_used_at: null, created_at: TS, updated_at: TS,
});

if (typeof window !== 'undefined') {
  try {
    const ls = window.localStorage;
    ls.setItem('sot_settings', JSON.stringify({ language: 'ko' }));
    // Two crew still locked → checkUnlocks (type 'always') flips both on load.
    ls.setItem('sot_agents', JSON.stringify([
      lockedCrew('crew_chief_strategist', '승현', '수석 전략가', '🏛️', '#6D28D9', 'strategy'),
      lockedCrew('crew_research_director', '도윤', '리서치 디렉터', '🧠', '#1D4ED8', 'research'),
    ]));
    ls.setItem('sot_agent_chains', JSON.stringify([]));
  } catch {}
}

// The capture freezes the clock (setFixedTime), stalling framer-motion's
// spring-in at its opacity:0 start frame. Force the end-state with `!important`
// (beats framer's inline styles) so the toasts are visible. The container's own
// centering transform is a CSS class (not inline), so it's untouched.
if (typeof document !== 'undefined') {
  const s = document.createElement('style');
  s.textContent =
    '[style*="opacity"]{opacity:1!important}' +
    '[style*="transform"]{transform:none!important}';
  document.head.appendChild(s);
}

export const Unlocked = () => (
  <>
    {/* Off-screen trigger: mounts the shared store and runs loadAgents → checkUnlocks. */}
    <div aria-hidden style={{ position: 'fixed', left: -99999, top: 0, width: 1, height: 1, overflow: 'hidden' }}>
      <AgentHub />
    </div>
    {/* `contain: paint` makes this box the containing block for the toast's
        `position: fixed` stack, so it renders inside the captured cell. */}
    <div style={{ width: 520, height: 420, position: 'relative', contain: 'paint', background: 'var(--bg)' }}>
      <UnlockToast />
    </div>
  </>
);
