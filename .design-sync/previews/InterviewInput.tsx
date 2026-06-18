import { InterviewInput } from 'argus';

// InterviewInput — a stepped, one-question-at-a-time intake. It opens on the
// first step (a chip question) with a progress bar; chips auto-advance.
// Data mirrors the real "synthesize / compare" interview in the app.

const steps = [
  {
    key: 'sourceType',
    question: '어떤 것들을 비교하고 싶으세요?',
    label: '소스 유형',
    type: 'chips' as const,
    required: true,
    options: [
      { value: 'ai_tools', label: 'AI 도구별 답변', emoji: '🤖' },
      { value: 'team', label: '팀원/부서 의견', emoji: '👥' },
      { value: 'research', label: '리서치 자료', emoji: '📑' },
      { value: 'external', label: '외부 보고서', emoji: '🌐' },
      { value: 'options', label: '선택지/대안 비교', emoji: '⚖️' },
    ],
  },
  {
    key: 'purpose',
    question: '비교해서 뭘 하려는 건가요?',
    label: '비교 목적',
    type: 'chips' as const,
    options: [
      { value: 'decision', label: '의사결정' },
      { value: 'report', label: '보고서 작성' },
      { value: 'strategy', label: '전략 수립' },
      { value: 'consensus', label: '합의점 도출' },
    ],
  },
  {
    key: 'content',
    question: '비교할 내용을 붙여넣어주세요',
    label: '비교 내용',
    hint: '각 소스를 구분해서 붙여넣으면 더 정확하게 분석합니다.',
    type: 'textarea' as const,
    placeholder: 'ChatGPT 답변:\n시장 규모는 약 500억 원으로...\n\nClaude 답변:\n해당 시장은 300~700억 원 사이로...',
    required: true,
    rows: 6,
  },
];

export const Default = () => (
  <div style={{ maxWidth: 560, background: 'var(--surface)', borderRadius: 12, padding: 24 }}>
    <InterviewInput
      steps={steps}
      submitLabel="AI 분석 시작"
      onSubmit={() => {}}
    />
  </div>
);

const stepsEn = [
  {
    key: 'role',
    question: 'What are you deciding about?',
    label: 'Decision area',
    type: 'chips' as const,
    required: true,
    options: [
      { value: 'hire', label: 'A hire', emoji: '🧑‍💼' },
      { value: 'vendor', label: 'A vendor', emoji: '🤝' },
      { value: 'feature', label: 'A feature', emoji: '🧩' },
      { value: 'pricing', label: 'Pricing', emoji: '💲' },
    ],
  },
  {
    key: 'reversible',
    question: 'How reversible is this call?',
    label: 'Reversibility',
    hint: 'Irreversible calls get a deeper pass.',
    type: 'chips' as const,
    options: [
      { value: 'easy', label: 'Easy to undo', emoji: '🟢' },
      { value: 'costly', label: 'Costly to undo', emoji: '🟡' },
      { value: 'oneway', label: 'One-way door', emoji: '🔴' },
    ],
  },
  {
    key: 'detail',
    question: 'Describe the decision in your own words',
    label: 'Detail',
    type: 'textarea' as const,
    placeholder: 'We can migrate off the legacy billing system now or wait two quarters. Engineering wants to wait; finance wants it done before the audit.',
    required: true,
    rows: 5,
  },
];

export const English = () => (
  <div style={{ maxWidth: 560, background: 'var(--surface)', borderRadius: 12, padding: 24 }}>
    <InterviewInput
      steps={stepsEn}
      submitLabel="Start analysis"
      onSubmit={() => {}}
    />
  </div>
);
