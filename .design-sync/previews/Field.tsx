import { Field } from 'argus';

export const Default = () => (
  <div style={{ maxWidth: 460 }}>
    <Field
      label="어떤 상황인가요?"
      hint="한 줄만 적어도 시작할 수 있어요"
      placeholder="예: 다음 주까지 보고서를 써야 하는데 어디서 시작할지 모르겠어"
      rows={3}
    />
  </div>
);

export const Filled = () => (
  <div style={{ maxWidth: 460 }}>
    <Field
      label="결정 내용"
      hint="구체적일수록 좋아요"
      defaultValue={'신규 시장 진출을 올해 안에 결정해야 한다.\n예산은 한정적이고 팀은 작다.'}
      rows={3}
    />
  </div>
);
