// PingToast — a short-lived pill (top-right of the main column) confirming the
// user's input reached the team, or that new output landed below. It is driven
// ENTIRELY by useAgentAttentionStore (a zustand store: NOT persisted, NOT event-
// based) — there is no prop, no window event, and no localStorage to seed, so the
// recipe's "dispatch a CustomEvent / seed STORAGE_KEYS" hooks don't apply. The
// store is also not on the `argus` bundle namespace (only components are exported),
// so a bundle-shimmed `import { PingToast } from 'argus'` can't be driven from an
// isolated preview. To render the real component faithfully we therefore import
// BOTH the component and its store from source so they share ONE store instance,
// then fire a ping from a deferred mount effect and re-ping on an interval to keep
// the ~2.1s toast on-screen for capture. Because the store is a shared global,
// this is a SINGLE cell (every instance would mirror the same lastPing*).
//
// Message set (one per PingSource): answer/chat/retry/deploy = input toasts
// (→ ArrowRight); workers_done/mix_done/dm_ready/final_done = output toasts
// (brighter, → ArrowDown, final_done → CheckCircle2). This cell shows mix_done.

import { useEffect } from 'react';
import { PingToast } from '@/components/workspace/progressive/PingToast';
import { useAgentAttentionStore } from '@/stores/useAgentAttentionStore';

if (typeof window !== 'undefined') {
  try { window.localStorage.setItem('sot_settings', JSON.stringify({ language: 'ko' })); } catch {}
}

// The toast pill animates opacity 0→1→0 via framer-motion keyframes. A static
// capture reports no reduced-motion and catches frame 0 (opacity:0) → invisible.
// Force the visible rest state for the screenshot, scoped to .fm-static.
if (typeof document !== 'undefined' && !document.getElementById('fm-static-style')) {
  const s = document.createElement('style');
  s.id = 'fm-static-style';
  s.textContent = '.fm-static, .fm-static *{opacity:1 !important;transform:none !important}';
  document.head.appendChild(s);
}

const stage: React.CSSProperties = {
  position: 'relative',
  width: 460,
  height: 150,
  margin: '0 auto',
  borderRadius: 16,
  border: '1px solid var(--border-subtle)',
  background: 'var(--surface)',
  overflow: 'hidden',
};

// Output toast — "초안이 준비됐어요" (mix_done): brighter pill, ArrowDown. We
// re-ping every 1.2s so the auto-hiding toast stays present for the screenshot.
export const DraftReady = () => {
  useEffect(() => {
    const ping = () => useAgentAttentionStore.getState().ping('mix_done');
    const t = setTimeout(ping, 0);
    const iv = setInterval(ping, 1200);
    return () => { clearTimeout(t); clearInterval(iv); };
  }, []);
  return (
    <div className="fm-static" style={stage}>
      <PingToast />
    </div>
  );
};
