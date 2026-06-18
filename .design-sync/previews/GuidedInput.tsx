import { GuidedInput } from 'argus';

// GuidedInput — chip-group context selectors + a free-text decision prompt.
// Realistic Argus decision-framing data (Korean + English variants).

const chipGroups = [
  {
    key: 'stakes',
    label: '이 결정의 무게',
    options: [
      { value: 'critical', label: '되돌리기 어려움', emoji: '🔴' },
      { value: 'moderate', label: '중간' },
      { value: 'low', label: '가볍게 참고', emoji: '🟢' },
    ],
  },
  {
    key: 'horizon',
    label: '판단 시점',
    options: [
      { value: 'now', label: '지금 당장' },
      { value: 'week', label: '이번 주 안' },
      { value: 'quarter', label: '이번 분기' },
    ],
  },
];

export const Default = () => (
  <div style={{ maxWidth: 560, background: 'var(--surface)', borderRadius: 12, padding: 24 }}>
    <GuidedInput
      chipGroups={chipGroups}
      textLabel="어떤 결정을 앞두고 있나요?"
      textPlaceholder="시리즈 A 텀시트를 받았는데 밸류에이션은 좋지만 보드 의석을 하나 내줘야 합니다. 받아들여야 할까요?"
      textHint="결정의 맥락을 함께 적으면 더 정확하게 짚어드립니다."
      submitLabel="판단 시작"
      onSubmit={() => {}}
    />
  </div>
);

const chipGroupsEn = [
  {
    key: 'stakes',
    label: 'Weight of this call',
    options: [
      { value: 'critical', label: 'Hard to reverse', emoji: '🔴' },
      { value: 'moderate', label: 'Moderate' },
      { value: 'low', label: 'Light reference', emoji: '🟢' },
    ],
  },
  {
    key: 'domain',
    label: 'Domain',
    options: [
      { value: 'hiring', label: 'Hiring' },
      { value: 'pricing', label: 'Pricing' },
      { value: 'roadmap', label: 'Roadmap' },
    ],
  },
];

export const English = () => (
  <div style={{ maxWidth: 560, background: 'var(--surface)', borderRadius: 12, padding: 24 }}>
    <GuidedInput
      chipGroups={chipGroupsEn}
      textLabel="What decision are you weighing?"
      textPlaceholder="Two strong final candidates for the lead role — one is a culture fit, the other is technically far stronger. Which do we extend the offer to?"
      textHint="Add the context around the call and we'll surface the load-bearing assumption."
      submitLabel="Start analysis"
      onSubmit={() => {}}
    />
  </div>
);

export const AnimatedPlaceholders = () => (
  <div style={{ maxWidth: 560, background: 'var(--surface)', borderRadius: 12, padding: 24 }}>
    <GuidedInput
      chipGroups={chipGroups}
      textLabel="무엇을 고민 중이신가요?"
      textPlaceholder=""
      animatedPlaceholders={[
        '지금 쓰는 벤더를 갈아탈지 말지...',
        '이 기능을 이번 릴리스에 넣을지...',
        '연봉 협상안을 받아들일지...',
      ]}
      submitLabel="판단 시작"
      onSubmit={() => {}}
    />
  </div>
);
