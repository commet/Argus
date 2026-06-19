import { UpdateSummaryChip } from 'argus';

// The capture freezes the clock, stalling framer-motion's JS entrance animation
// at its `initial` (opacity:0) frame, so the chip renders blank. framer writes the
// frozen start values as INLINE styles; `!important` beats inline, so we force the
// end-state on exactly the elements framer touched. (See AnalysisCard preview.)
if (typeof document !== 'undefined') {
  const s = document.createElement('style');
  s.textContent =
    '[style*="opacity"]{opacity:1!important}' +
    '[style*="transform"]{transform:none!important}' +
    '[style*="height: 0"]{height:auto!important}';
  document.head.appendChild(s);
}

// UpdateSummaryChip — "반영해서 다시 봤어요 / Refined with your input". A quiet
// summary of what changed since the previous snapshot, shown near the next CTA so
// the user sees the evolution they just triggered. Renders the question
// before/after and a +/- tally of steps and assumptions. Returns null when the
// only change is the version counter.

const prev = {
  version: 1,
  real_question: '유료 전환을 언제 시작해야 하나?',
  hidden_assumptions: [
    '무료 유저가 많으면 전환 모수도 크다.',
    '경쟁사가 유료화했으니 지금이 적기다.',
    '가격만 정하면 결제는 따라온다.',
  ],
  skeleton: ['활성화 정의', '코호트 분석', '가격 가설'],
} as any;

const next = {
  version: 2,
  real_question:
    '활성화한 코어 유저에게 "지금" 유료 동선을 보여줄 때, 무료 경험을 해치지 않고 전환을 만들 수 있는가?',
  hidden_assumptions: [
    '경쟁사가 유료화했으니 지금이 적기다.',
    '활성화 직후가 결제 의향이 가장 높은 순간이다.',
  ],
  skeleton: ['활성화 정의', '가격 가설', '결제 경험', '되돌림 기준'],
} as any;

// Full delta — the question rewrote, steps net +1 (added 결제 경험·되돌림 기준,
// dropped 코호트 분석), assumptions net -1. Includes the "see full" link.
export const QuestionAndDeltas = () => (
  <div style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
    <UpdateSummaryChip
      snapshot={next}
      prevSnapshot={prev}
      onSeeDetail={() => {}}
      locale="ko"
    />
  </div>
);

// Counts only — same wording change, English locale, no see-detail link.
const enPrev = {
  version: 1,
  real_question: 'When should we launch the paid tier?',
  hidden_assumptions: ['More free users means a bigger paid pool.', 'Competitors went paid, so now is the time.'],
  skeleton: ['Define activation', 'Cohort analysis'],
} as any;

const enNext = {
  version: 2,
  real_question:
    'Can we show a paid path to activated core users without hurting the free experience?',
  hidden_assumptions: [
    'Competitors went paid, so now is the time.',
    'The moment right after activation is peak willingness-to-pay.',
    'We can insert the upgrade path without friction.',
  ],
  skeleton: ['Define activation', 'Price hypothesis', 'Checkout experience'],
} as any;

export const CountsOnly = () => (
  <div style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
    <UpdateSummaryChip snapshot={enNext} prevSnapshot={enPrev} locale="en" />
  </div>
);
