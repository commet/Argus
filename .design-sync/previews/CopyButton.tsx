import { CopyButton } from 'argus';

// CopyButton — primary-styled button that copies a generated brief to the
// clipboard and flips to a success state for 2s. In the app it carries a
// decision brief or a share URL; we pass realistic getText functions.

const BRIEF = `결정 브리프 — 신규 시장 진입 여부

핵심 질문: 일본 시장에 지금 진입할 것인가, 6개월 더 국내 PMF를 다질 것인가?
숨은 전제: 현재 국내 리텐션(D30 41%)이 해외에서도 재현된다.
가장 위험한 가정: 현지 파트너 없이 직접 진출해도 CAC가 국내의 1.5배를 넘지 않는다.
확인 방법: 8주 소프트런칭으로 CAC·D7 리텐션을 실측한다.`;

export const Default = () => (
  <CopyButton getText={() => BRIEF} />
);

export const CustomLabel = () => (
  <CopyButton getText={() => BRIEF} label="브리프 복사" />
);

export const EnglishCopyLink = () => (
  <CopyButton
    getText={() => 'https://argus.app/s/9f3a-decision-brief'}
    label="Copy link"
  />
);
