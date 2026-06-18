import { QuestionCard } from 'argus';

// The capture freezes the clock, stalling framer-motion's JS entrance animations
// at their `initial` (opacity:0) frame, so the card renders blank. framer writes
// the frozen start values as INLINE styles; `!important` beats inline, so we force
// the end-state on exactly the elements framer touched. (See AnalysisCard preview.)
if (typeof document !== 'undefined') {
  const s = document.createElement('style');
  s.textContent =
    '[style*="opacity"]{opacity:1!important}' +
    '[style*="transform"]{transform:none!important}' +
    '[style*="height: 0"]{height:auto!important}';
  document.head.appendChild(s);
}

// QuestionCard — the Q&A surface inside the progressive flow. The user answers a
// couple of sharpening questions before the crew is deployed. It renders either a
// 2x2 option grid (short options) or a stacked list, always with a free-text
// escape, an optional progress "meta" label, and an optional skip chip.
const noop = (_v: string) => {};

// Multiple-choice — short options render as a 2x2 grid, with the standing
// "or type your own" free-text input below. Meta line gives a sense of progress.
export const MultipleChoice = () => (
  <div style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
    <QuestionCard
      question={{
        id: 'q-pricing-trigger',
        text: '유료 전환을 결정하는 가장 큰 기준은 무엇인가요?',
        subtext: '지금 무료 사용자 4,200명 중 주 3회 이상 쓰는 코어 유저가 약 18%입니다.',
        options: ['리텐션 곡선', '경쟁사 가격', '서버 비용', '투자 라운드'],
      }}
      onAnswer={noop}
      meta="질문 2/3 · 선택"
      locale="ko"
    />
  </div>
);

// Long options stack vertically (each >20 chars) — the grid would wrap and lose
// scannability. English locale.
export const StackedOptions = () => (
  <div style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
    <QuestionCard
      question={{
        id: 'q-hire',
        text: 'Which gap is most urgent to fill in the next quarter?',
        subtext: 'You have budget for exactly one senior hire before the Series A close.',
        options: [
          'A senior backend engineer to de-risk the migration',
          'A growth marketer to lift the activation rate',
          'A product designer to fix the onboarding drop-off',
        ],
      }}
      onAnswer={noop}
      meta="Question 1/3"
      locale="en"
    />
  </div>
);

// No options — pure free-text. The card auto-focuses the input.
export const FreeTextOnly = () => (
  <div style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
    <QuestionCard
      question={{
        id: 'q-real-bet',
        text: '이 결정에서 진짜 걸려 있는 건 뭐라고 보세요?',
        subtext: '한 문장이면 충분해요. 나중에 다듬을 수 있어요.',
      }}
      onAnswer={noop}
      meta="질문 3/3 · 마지막 질문이에요"
      locale="ko"
    />
  </div>
);

// With a skip chip — the team is already assembled, so this question is optional
// and the user gets a visible way out of the question loop.
export const WithSkip = () => (
  <div style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
    <QuestionCard
      question={{
        id: 'q-fork',
        text: '베를린 진출과 도쿄 진출, 둘 중 먼저 가야 할 곳은?',
        options: ['베를린 먼저', '도쿄 먼저', '둘 다 보류'],
      }}
      onAnswer={noop}
      meta="갈림 확인 · 선택"
      onSkip={() => {}}
      skipLabel="건너뛰고 팀 투입"
      locale="ko"
    />
  </div>
);
