import { EmailButton } from 'argus';

// EmailButton — secondary-styled button that opens the user's mail client
// pre-filled with a subject and body (via mailto). In the app it sits in the
// ShareBar next to CopyButton; we pass realistic subject/body getters.

const SUBJECT = '[Argus] 일본 시장 진입 결정 브리프';
const BODY = `아래는 이번 결정에 대한 요약입니다.

핵심 질문: 일본 시장에 지금 진입할 것인가?
가장 위험한 가정: 현지 파트너 없이도 CAC가 국내의 1.5배를 넘지 않는다.
확인 방법: 8주 소프트런칭으로 CAC·D7 리텐션을 실측한다.

— Argus`;

export const Default = () => (
  <EmailButton getSubject={() => SUBJECT} getBody={() => BODY} />
);

export const CustomLabel = () => (
  <EmailButton getSubject={() => SUBJECT} getBody={() => BODY} label="이메일로 보내기" />
);
