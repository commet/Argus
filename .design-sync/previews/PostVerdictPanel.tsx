import { PostVerdictPanel } from 'argus';

// PostVerdictPanel — the block shown right after the boss delivers a verdict. It
// leads with the InnerMonologueCard (the boss's private read on you, driven by the
// `verdict` prop), then exposes secondary actions (try another type / another
// situation / share) and a CollectionProgress strip. It reads the boss store for
// the current type-code + lastSituation; the store isn't persisted, so it falls
// back to its default (ESTJ, no prior situation) — fine, since the visible content
// is driven by the `verdict` prop and the seeded collection. CollectionProgress
// reads BOSS_COLLECTION from localStorage, so we seed a few cleared types to make
// the progress strip read as a real, partially-filled collection.
if (typeof window !== 'undefined') {
  try {
    window.localStorage.setItem('sot_settings', JSON.stringify({ language: 'ko' }));
    window.localStorage.setItem(
      'sot_boss_collection',
      JSON.stringify([
        { typeCode: 'ISTJ', verdict: 'conditional', situation: '4주 베타 시연 일정', completedAt: '2026-06-14T09:00:00.000Z', emoji: '📋' },
        { typeCode: 'ENTJ', verdict: 'approved', situation: '신사업 진입 제안', completedAt: '2026-06-15T09:00:00.000Z', emoji: '🎯' },
        { typeCode: 'INFP', verdict: 'rejected', situation: '주 4일제 도입 건의', completedAt: '2026-06-16T09:00:00.000Z', emoji: '🌱' },
        { typeCode: 'ESFJ', verdict: 'approved', situation: '팀 워크숍 예산 요청', completedAt: '2026-06-17T09:00:00.000Z', emoji: '🤝' },
      ]),
    );
  } catch {}
}
// MOTION SETTLE (see ChatMessage.tsx for the full rationale): framer-motion
// enters via an inline opacity tween the capture can shoot mid-flight; a
// stylesheet `!important` rule pins the settled value so the card is never blank.
// Here it also reveals the InnerMonologueCard's "locked" hero (which sits at
// opacity 0 until tapped) so the panel reads as a complete post-verdict surface.
if (typeof document !== 'undefined' && !document.getElementById('ds-motion-settle')) {
  const s = document.createElement('style');
  s.id = 'ds-motion-settle';
  s.textContent = '[style*="opacity"]{opacity:1!important}';
  document.head.appendChild(s);
}

const noop = () => {};

export const Conditional = () => (
  <PostVerdictPanel
    verdict={{
      verdict: 'conditional',
      reason: '방향은 좋아. 단, 첫 25곳을 어디서 데려올지 한 줄로 정리되면 올려.',
      tip: '확보 경로를 채워서 다시 가져오면 승인 가능성이 높다.',
    }}
    onShare={noop}
  />
);

export const Approved = () => (
  <PostVerdictPanel
    verdict={{
      verdict: 'approved',
      reason: '근거가 명확하고 일정도 현실적이야. 진행해.',
      tip: '주간 시연으로 진척을 보여주면 신뢰가 더 쌓인다.',
    }}
    onShare={noop}
  />
);

export const Rejected = () => (
  <PostVerdictPanel
    verdict={{
      verdict: 'rejected',
      reason: '숫자 없이 "느낌"으로 가져왔잖아. 비용 근거부터.',
      tip: '고객당 확보 비용과 손익분기 시점을 먼저 계산해라.',
    }}
    onShare={noop}
  />
);
