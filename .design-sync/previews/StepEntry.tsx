import { StepEntry } from 'argus';

const steps = [
  {
    key: 'urgency',
    question: '얼마나 급한 결정인가요?',
    options: [
      { value: 'now', label: '당장', emoji: '🔥' },
      { value: 'week', label: '이번 주', emoji: '📅' },
      { value: 'someday', label: '언젠가', emoji: '🌱' },
    ],
  },
];

export const Default = () => (
  <div style={{ maxWidth: 560 }}>
    <StepEntry
      steps={steps}
      textLabel="상황을 적어주세요"
      textPlaceholder="예: 신규 시장 진출을 올해 안에 결정해야 한다"
      textHint="한 줄이면 충분해요"
      submitLabel="시작"
      onSubmit={() => {}}
    />
  </div>
);
