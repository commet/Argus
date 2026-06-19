import { BossConfirmation } from 'argus';

// BossConfirmation — the "boss ready" interstitial shown after setup, just before
// the chat opens. It echoes the chosen personality (emoji / name / vibe), a
// for-fun Saju mini-preview when a birth date is set, and the situation the user
// will discuss, then auto-advances (or the user taps "대화 시작"). The auto-advance
// timer just fires the onContinue callback (a noop here) — it doesn't unmount, so
// the card stays on screen for the capture. Uses only props (typeData object +
// situation + birth fields + sajuLoading + onContinue). Korean locale seeded.
// MOTION SETTLE (see ChatMessage.tsx for the full rationale): framer-motion
// enters via an inline opacity tween the capture can shoot mid-flight; a
// stylesheet `!important` rule pins the settled value so the card is never blank.
if (typeof window !== 'undefined') {
  try {
    window.localStorage.setItem('sot_settings', JSON.stringify({ language: 'ko' }));
  } catch {}
}
if (typeof document !== 'undefined' && !document.getElementById('ds-motion-settle')) {
  const s = document.createElement('style');
  s.id = 'ds-motion-settle';
  s.textContent = '[style*="opacity"]{opacity:1!important}';
  document.head.appendChild(s);
}

const noop = () => {};

// A full PersonalityType — BossConfirmation reads emoji / name / bossVibe; the
// rest are real fields kept plausible so the object matches the shape.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ISTJ = {
  code: 'ISTJ',
  name: '신뢰의 관리자',
  emoji: '📋',
  shortDesc: '약속과 체계를 지키는 사람',
  communicationStyle: '간결하고 사실 위주. 전례와 날짜를 정확히 인용.',
  decisionPattern: '전례와 규정 기반. 검증된 방법 우선.',
  conflictStyle: '규칙을 근거로 냉정하게 판단.',
  feedbackStyle: '짧고 직접적. 문제는 날짜와 숫자로 짚음.',
  triggers: '약속 이행, 프로세스 준수, 근거 있는 주장',
  speechPatterns: ['그거 지난번에 말한 거랑 다른데?', '관련 자료 보내줘', '기한이 언제야?'],
  bossVibe: '말은 적지만 다 보고 있고, 한번 맡기면 끝까지 믿어주는 타입',
  speechLevel: 'mixed',
} as any;

export const ReadyWithSaju = () => (
  <BossConfirmation
    typeData={ISTJ}
    situation="신사업 베타를 4주 안에 셀러 한 명 앞에서 시연하는 일정으로 가도 될까요?"
    birthYear={1988}
    birthMonth={4}
    birthDay={9}
    sajuLoading={false}
    onContinue={noop}
  />
);

export const LoadingSaju = () => (
  <BossConfirmation
    typeData={ISTJ}
    situation="연봉 협상에서 15% 인상을 요구하려고 합니다. 근거는 지난 분기 성과예요."
    birthYear={1992}
    birthMonth={9}
    birthDay={21}
    sajuLoading={true}
    onContinue={noop}
  />
);

export const NoBirthData = () => (
  <BossConfirmation
    typeData={ISTJ}
    situation="금요일까지 못 끝낼 것 같아 마감을 다음 주 화요일로 미루겠다고 보고하려 합니다."
    birthYear={0}
    sajuLoading={false}
    onContinue={noop}
  />
);
