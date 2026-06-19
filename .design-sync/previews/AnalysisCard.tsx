import { AnalysisCard } from 'argus';

// The capture freezes the clock (setFixedTime), which stalls framer-motion's
// JS-driven entrance animations mid-flight — every `initial={{opacity:0}}` /
// `height:0` stays frozen at its start frame, so the card renders blank.
// (MotionGlobalConfig.skipAnimations doesn't reach it — argus bundles its own
// framer-motion copy, a different module instance.) The clock-independent fix is
// CSS: framer writes its frozen start values as INLINE styles, and `!important`
// beats inline, so we force the end-state on exactly the elements framer touched.
if (typeof document !== 'undefined') {
  const s = document.createElement('style');
  s.textContent =
    '[style*="opacity"]{opacity:1!important}' +
    '[style*="transform"]{transform:none!important}' +
    '[style*="height: 0"]{height:auto!important}';
  document.head.appendChild(s);
}

// AnalysisCard — "우리가 잡은 항로 / Course we plotted". The living analysis card
// that reframes the surface question, names the load-bearing assumptions, lays
// out the skeleton as a numbered step flow, and optionally pins the execution
// plan. When `prevSnapshot` is newer-versioned, it diffs and animates the delta.

const v1 = {
  version: 1,
  real_question:
    '유료 전환을 "언제" 할지가 아니라, 무료 유저가 돈을 낼 만큼 한 가지 일을 잘 끝내고 있는가?',
  insight:
    '진짜 병목은 가격이 아니라 **활성화**입니다. 코어 유저 18%는 이미 매주 돌아오지만, 나머지는 첫 주에 핵심 가치를 한 번도 경험하지 못합니다.',
  hidden_assumptions: [
    '무료 유저 수가 많으면 유료 전환 모수도 비례해서 크다고 가정하고 있어요.',
    '경쟁사가 유료화했으니 우리도 지금이 적기라고 전제하고 있어요.',
    '가격만 정하면 결제는 따라온다고 보고 있어요 — 결제 경험 설계는 빠져 있어요.',
  ],
  skeleton: [
    '활성화 정의 — 첫 주 안에 코어 액션 3회를 완료한 비율을 기준값으로 잡는다.',
    '코호트 분석 — 활성화한 유저와 안 한 유저의 4주 리텐션 격차를 측정한다.',
    '가격 가설 — 활성화한 유저만을 대상으로 3개 가격대 의향을 테스트한다.',
    '결제 경험 — 업그레이드 동선을 활성화 직후 순간에 붙인다.',
  ],
} as any;

const v2 = {
  version: 2,
  real_question:
    '활성화한 코어 유저에게 "지금" 유료 동선을 보여줄 때, 무료 경험을 해치지 않으면서 전환을 만들 수 있는가?',
  insight:
    '코호트 분석 결과 활성화 유저의 4주 리텐션은 비활성 유저의 **3.4배**였습니다. 모수를 늘리는 것보다 활성화 순간을 결제와 연결하는 설계가 레버리지입니다.',
  hidden_assumptions: [
    '경쟁사가 유료화했으니 우리도 지금이 적기라고 전제하고 있어요.',
    '활성화 직후가 결제 의향이 가장 높은 순간이라고 가정하고 있어요 — 검증 필요.',
  ],
  skeleton: [
    '활성화 정의 — 첫 주 안에 코어 액션 3회를 완료한 비율을 기준값으로 잡는다.',
    '가격 가설 — 활성화한 유저만을 대상으로 3개 가격대 의향을 테스트한다.',
    '결제 경험 — 업그레이드 동선을 활성화 직후 순간에 붙인다.',
    '되돌림 기준 — 무료 활성화율이 2주 내 5%p 떨어지면 동선을 철회한다.',
  ],
  execution_plan: {
    steps: [
      { task: '코호트 리텐션 측정', who: 'ai', output: '활성화 vs 비활성 리텐션 표' },
      { task: '가격 의향 인터뷰', who: 'human', output: '코어 유저 8명 인터뷰 노트' },
      { task: '업그레이드 동선 프로토타입', who: 'both', output: 'Figma 플로우' },
    ],
    key_assumptions: ['활성화 직후가 결제 의향 피크', '무료 경험 훼손 없이 동선 삽입 가능'],
  },
} as any;

// First snapshot — no previous version, so everything renders as "same". Shows
// the sub-line ("이 방향이 맞나요?") that only appears on round 1.
export const FirstSnapshot = () => (
  <div style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
    <AnalysisCard snapshot={v1} prevSnapshot={null} isActive locale="ko" />
  </div>
);

// Refined — v2 over v1. The card diffs: new question, dropped/added assumptions,
// and a reshuffled skeleton, with the execution plan footer pinned.
export const RefinedWithPlan = () => (
  <div style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
    <AnalysisCard
      snapshot={v2}
      prevSnapshot={v1}
      isActive
      showExecutionPlan
      locale="ko"
    />
  </div>
);

// Collapsed peek — the single-line affordance used during the Q&A loop so the
// accumulating analysis doesn't bury the user while they're still answering.
export const CollapsedPeek = () => (
  <div style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
    <AnalysisCard
      snapshot={v2}
      prevSnapshot={v1}
      isActive
      defaultCollapsed
      locale="ko"
    />
  </div>
);
