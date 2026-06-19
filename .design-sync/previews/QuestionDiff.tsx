import { QuestionDiff } from 'argus';

// QuestionDiff — the before→after reframe reward ("당신의 질문이 바뀌었습니다"):
// the original framing struck through, the reframed question in accent below,
// with an optional one-line note. Reads locale from useLocale, so we seed
// sot_settings=ko (the header label renders in Korean). It renders NOTHING for a
// no-op diff (after missing, or after === before re-spaced) — so every cell uses
// a genuinely different reframe.

if (typeof window !== 'undefined') {
  try { window.localStorage.setItem('sot_settings', JSON.stringify({ language: 'ko' })); } catch {}
}

const frame: React.CSSProperties = {
  maxWidth: 520,
  margin: '0 auto',
  padding: 20,
  borderRadius: 16,
  border: '1px solid var(--border-subtle)',
  background: 'var(--surface)',
};

// The common case — reframe + a note counting the uncertain assumptions found.
export const WithNote = () => (
  <div style={frame}>
    <QuestionDiff
      before="신사업 기획안을 어떻게 50장으로 잘 정리할까?"
      after="5명 중 2명을 빼서, 경쟁사가 못 하는 걸 4주 안에 만들 수 있는가?"
      note="이 질문 아래 미확인 가정 3개를 찾았어요"
    />
  </div>
);

// No note — just the moved question, the minimal reward moment.
export const WithoutNote = () => (
  <div style={frame}>
    <QuestionDiff
      before="구독 가격을 29만 원으로 할까, 39만 원으로 할까?"
      after="우리가 파는 게 '가격'인가, '전환 비용 절감'인가?"
    />
  </div>
);

// A longer reframe — checks wrapping/line-height on multi-clause questions.
export const LongReframe = () => (
  <div style={frame}>
    <QuestionDiff
      before="이번 분기에 개발자를 한 명 더 뽑아야 할까?"
      after="지금 한 명을 더 뽑는 게 6개월 뒤 런웨이를 4개월 밑으로 끌어내리는가, 아니면 그 채용이 오히려 출시를 당겨 런웨이를 버는가?"
      note="채용 결정의 진짜 변수는 인원이 아니라 현금 흐름이었어요"
    />
  </div>
);
