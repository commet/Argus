import { VerdictShareCard } from 'argus';

// VerdictShareCard — the shareable card produced from a boss verdict. It pulls the
// personality (emoji / name / signature line) from the pure personality library by
// `typeCode`, renders the verdict + reason, the boss's signature catchphrase, and a
// prominent copy-to-clipboard button. It also reads the boss store for chat
// `messages` (to surface the boss's best quote) and `birthYear` (for the for-fun
// 결/kyeol line); the store isn't persisted, so in isolation there's no quote block
// and no kyeol line, and the card falls back to the verdict reason as its body —
// still a complete, representative card. Korean locale seeded.
// MOTION SETTLE (see ChatMessage.tsx for the full rationale): framer-motion
// enters via an inline opacity tween the capture can shoot mid-flight; a
// stylesheet `!important` rule pins the settled value so the card is never blank.
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

const noop = () => {};

export const Conditional = () => (
  <VerdictShareCard
    typeCode="ISTJ"
    situation="신사업 베타를 4주 안에 셀러 한 명 앞에서 시연하는 일정"
    verdict={{
      verdict: 'conditional',
      reason: '방향은 좋아. 단, 첫 25곳을 어디서 데려올지 한 줄로 정리되면 올려.',
    }}
    onClose={noop}
  />
);

export const Approved = () => (
  <VerdictShareCard
    typeCode="ENTJ"
    situation="신사업 진입 제안 — 이커머스 셀러 전용 AI 상담"
    verdict={{
      verdict: 'approved',
      reason: '근거가 명확하고 일정도 현실적이야. 진행해.',
    }}
    onClose={noop}
  />
);

export const Rejected = () => (
  <VerdictShareCard
    typeCode="INFP"
    situation="주 4일제 도입 건의"
    verdict={{
      verdict: 'rejected',
      reason: '마음은 알겠는데, 지금 팀 상황에선 무리야. 다음 분기에 다시 보자.',
    }}
    onClose={noop}
  />
);
