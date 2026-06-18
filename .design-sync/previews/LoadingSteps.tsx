import { LoadingSteps } from 'argus';

export const Default = () => (
  <div style={{ maxWidth: 420 }}>
    <LoadingSteps
      steps={['상황을 읽는 중', '진짜 질문을 찾는 중', '숨은 가정을 분석하는 중', '뼈대를 작성하는 중']}
    />
  </div>
);
