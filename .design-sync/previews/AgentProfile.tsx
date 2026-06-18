import { AgentProfile } from 'argus';

// AgentProfile — the full crew-member detail sheet (a fixed overlay/modal opened
// from the roster). Header carries the avatar tinted with the agent's color, the
// name/role/group, and a Lv + XP bar with current/next XP. The body shows the
// agent's expertise + tone (in voice), an accumulated Observations list sorted by
// confidence (with category tags + confidence %), and a Stats row (XP / Obs /
// last used). This is a builtin agent (origin 'builtin'), so it renders the
// observation list rather than the boss-only PersonaRefinementSection/CTAs.
// One rich cell — the component is large and fills the viewport as a sheet.
// Locale is seeded Korean to match the set.

if (typeof window !== 'undefined') {
  try {
    window.localStorage.setItem('sot_settings', JSON.stringify({ language: 'ko' }));
  } catch {}
}

// The capture freezes the clock (setFixedTime), stalling framer-motion's
// JS-driven entrance animation at its `initial` frame — the whole sheet stays
// at opacity:0 and renders blank. framer writes the frozen start values as
// INLINE styles, so forcing the end-state with `!important` (which beats inline)
// reveals the sheet. (Same fix AnalysisCard uses; argus bundles its own
// framer-motion copy so MotionGlobalConfig can't reach it.)
if (typeof document !== 'undefined') {
  const s = document.createElement('style');
  s.textContent =
    '[style*="opacity"]{opacity:1!important}' +
    '[style*="transform"]{transform:none!important}';
  document.head.appendChild(s);
}

const TS = '2026-06-12T08:00:00.000Z';
const RECENT = '2026-06-17T22:30:00.000Z';

/* eslint-disable @typescript-eslint/no-explicit-any */
const obs = (category: string, observation: string, confidence: number, evidence_count: number): any => ({
  id: `o-${category}`, category, observation, confidence, evidence_count, created_at: TS, source: 'auto',
});

const STELLA: any = {
  id: 'minseo', name: '민서', nameEn: 'Stella', role: '마케팅·그로스 전략가', roleEn: 'Marketing & Growth',
  emoji: '📣', color: '#E11D48', origin: 'builtin', capabilities: ['task_execution'],
  group: 'production', chain_id: null,
  unlock_condition: { type: 'always', required: 0 }, unlocked: true,
  expertise: '채널 전략, 캠페인 설계, 퍼널 최적화, 그로스 루프, 마케팅 예산 배분에 강합니다. 전략을 실행 가능한 마케팅 계획으로 전환합니다.',
  tone: '데이터 기반으로 채널과 예산을 설계하되, 고객 심리를 놓치지 않습니다.',
  keywords: ['마케팅', '캠페인', '채널', '퍼널', '그로스'],
  xp: 340, level: 3,
  observations: [
    obs('preference', '정량 지표(CAC, 전환율)를 먼저 제시하면 더 신뢰합니다.', 0.84, 6),
    obs('work_pattern', '완성본보다 거친 초안을 빠르게 보고 함께 다듬는 흐름을 선호합니다.', 0.67, 4),
    obs('communication_style', '근거 없는 형용사보다 숫자 한 줄을 좋아합니다.', 0.58, 3),
    obs('skill_gap', '채널별 예산 배분의 근거가 약할 때 불안해합니다.', 0.46, 2),
  ],
  is_builtin: true, archived: false,
  last_used_at: RECENT, created_at: TS, updated_at: RECENT,
};

// AgentProfile is a `position: fixed` sheet. `contain: paint` makes the wrapper
// the containing block for the fixed overlay (so it renders inside the captured
// cell instead of escaping to the iframe viewport) WITHOUT using a `transform`
// — which the animation-unstall style above would have reset to none.
export const Detail = () => (
  <div style={{ width: 480, height: 700, position: 'relative', contain: 'paint', background: 'var(--bg)' }}>
    <AgentProfile agent={STELLA} onClose={() => {}} />
  </div>
);
