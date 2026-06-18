import { DMFeedback } from 'argus';

// DMFeedback — a stakeholder/decision-maker's simulated review of the draft.
// Reviewer avatar + first reaction blockquote, strengths, a list of toggleable
// concerns ("이것만 고치면" — each with severity + a one-line fix and an
// Applied/Skip switch), the approval condition, and (deep mode) the questions
// they'd also ask. Korean locale so the severity chips read 필수/권장/참고.

if (typeof window !== 'undefined') {
  try { window.localStorage.setItem('sot_settings', JSON.stringify({ language: 'ko' })); } catch {}
}

// The capture freezes the clock, which stalls framer-motion's JS-driven entrance
// animations mid-flight — every `initial={{opacity:0}}` stays at its start frame,
// rendering the card blank. framer writes its frozen start values as INLINE
// styles, and `!important` beats inline, so force the end-state on what it touched.
if (typeof document !== 'undefined') {
  const s = document.createElement('style');
  s.textContent =
    '[style*="opacity"]{opacity:1!important}' +
    '[style*="transform"]{transform:none!important}' +
    '[style*="height: 0"]{height:auto!important}';
  document.head.appendChild(s);
}

// A first-pass review: applauds the positioning, flags two concrete fixes, sets
// a clear approval bar. One concern already toggled on to show the applied state.
const standardReview = {
  persona_name: '박 이사',
  persona_role: '사업 총괄 이사 · 결재권자',
  first_reaction: '경쟁사를 직접 써보고 약점을 짚은 첫 줄은 좋아요. 다만 "세팅 1일"을 진짜 지킬 수 있는지부터 설득이 안 되면, 그 아래 숫자는 안 읽혀요.',
  good_parts: [
    '경쟁사 대비 1/3 가격이라는 포지셔닝이 한 줄로 분명하다.',
    '4주 안에 작동하는 베타를 시연한다는 검증 가능한 목표가 있다.',
  ],
  concerns: [
    { text: '첫 25곳(손익분기) 고객을 어디서 데려올지 경로가 비어 있다.', severity: 'critical', fix_suggestion: '기존 셀러 DB 1,200곳 중 CS 문의 상위 200곳에 베타를 먼저 연다.', applied: true },
    { text: '고객당 확보 비용 12만 원의 근거가 약하다.', severity: 'important', fix_suggestion: '지난 분기 리텐션 캠페인 단가(9.4만 원)를 출처로 붙인다.', applied: false },
    { text: '기존 사업과의 시너지 설명이 없다.', severity: 'minor', fix_suggestion: '한 문단으로 "같은 셀러풀을 공유한다"는 점만 명시.', applied: false },
  ],
  would_ask: [],
  approval_condition: '첫 25곳 확보 경로가 한 문단으로 구체화되면, 다음 주 임원회의 안건으로 올린다.',
};

export const FirstReview = () => (
  <DMFeedback fb={standardReview} onToggle={() => {}} onFinalize={() => {}} onDeepen={() => {}} busy={false} />
);

// Deep mode — the reviewer has gone a level deeper and now also surfaces the
// questions they'd press in the room ("이것도 물어볼 거다"). No 더 깊이 link.
const deepReview = {
  persona_name: '김 대표',
  persona_role: 'CEO',
  first_reaction: '방향은 사겠어요. 근데 6개월 뒤 이게 안 되면 우리가 잃는 게 뭔지, 거기서부터 다시 봅시다.',
  good_parts: ['속도(4주)와 차별점(1일 세팅)이 한 화면에 잡힌다.'],
  concerns: [
    { text: '실패 시 매몰 비용과 철수 기준이 문서에 없다.', severity: 'critical', fix_suggestion: '8주차 Go/No-Go 게이트와 "전환율 X% 미달이면 중단"을 명시.', applied: false },
    { text: '전담 2명을 빼면 기존 제품 장애 대응이 비는 시점이 있다.', severity: 'important', fix_suggestion: '온콜 백업 1명을 주 4시간으로 지정해 공백을 메운다.', applied: false },
  ],
  would_ask: [
    '6개월 뒤 실패하면, 우리가 실제로 잃는 금액은 얼마예요?',
    '이 2명이 빠지는 동안 기존 제품은 누가 봐요?',
    '경쟁사가 가격을 따라 내리면 우리한테 남는 한 가지는 뭐예요?',
  ],
  approval_condition: '철수 기준과 온콜 백업이 명시되면, 이번 분기 예산으로 승인한다.',
};

export const DeepReview = () => (
  <DMFeedback fb={deepReview} onToggle={() => {}} onFinalize={() => {}} busy={false} />
);
