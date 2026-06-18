import { AnimatedPlaceholder } from 'argus';

export const Default = () => (
  <div
    style={{
      position: 'relative',
      maxWidth: 460,
      minHeight: 52,
      border: '1px solid var(--border)',
      borderRadius: 12,
      background: 'var(--surface)',
      padding: '16px 18px',
    }}
  >
    <AnimatedPlaceholder
      visible
      texts={[
        '예: 신규 시장에 올해 진출할지 결정해야 해',
        '예: 핵심 개발자 채용 vs 외주, 무엇이 맞나',
        '예: 가격을 올릴 타이밍인지 모르겠어',
      ]}
    />
  </div>
);
