import { ChatMessage } from 'argus';

// ChatMessage — one chat bubble in the boss (stakeholder pressure-check) thread.
// `role` flips the whole layout: 'assistant' gets the boss avatar (emoji) on the
// left + a tap-to-copy "share this line" affordance; 'user' is a right-aligned
// bubble with a tail. `bossType` only supplies the avatar emoji + code, so a
// minimal personality object is enough. `isStreaming` adds the blinking caret.
// Pure props — no store. We seed Korean locale so the copy-affordance label reads
// in Korean, matching the rest of the boss set.
//
// MOTION SETTLE: every boss surface enters with a framer-motion tween
// (initial opacity:0 → animate opacity:1). The capture can shoot before that
// tween finishes (a cached re-navigation reaches `networkidle` almost instantly,
// so the enter animation is still at t≈0 → opacity 0 → a blank card). framer-motion
// drives this via an INLINE `style="opacity:…"`, so a stylesheet `!important` rule
// beats it and pins the settled value for the static capture. Scoped to elements
// that actually carry an inline opacity (i.e. the animating ones), so design-time
// translucency declared in CSS classes is untouched.
if (typeof window !== 'undefined') {
  try {
    window.localStorage.setItem('sot_settings', JSON.stringify({ language: 'ko' }));
  } catch {}
}
if (typeof document !== 'undefined' && !document.getElementById('ds-motion-settle')) {
  const s = document.createElement('style');
  s.id = 'ds-motion-settle';
  s.textContent = '[style*="opacity"]{opacity:1!important}';
  document.head.appendChild(s);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ISTJ = { code: 'ISTJ', emoji: '📋' } as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ENTJ = { code: 'ENTJ', emoji: '🎯' } as any;

export const BossReply = () => (
  <ChatMessage
    role="assistant"
    bossType={ISTJ}
    content="이거 지난번에 말한 거랑 숫자가 다른데? 손익분기 25곳은 어디서 데려올 건지부터 한 줄로 정리해서 다시 가져와. 방향은 나쁘지 않아."
  />
);

export const UserLine = () => (
  <ChatMessage
    role="user"
    content="팀장님, 신사업 베타를 4주 안에 셀러 한 명 앞에서 시연하는 걸 목표로 잡았습니다. 진행해도 될까요?"
  />
);

export const StreamingReply = () => (
  <ChatMessage
    role="assistant"
    bossType={ENTJ}
    isStreaming
    content="Numbers first. Show me the customer-acquisition cost before we talk timeline—"
  />
);
