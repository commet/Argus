import { Button } from 'argus';

export const Variants = () => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
    <Button variant="primary">결정 봉인</Button>
    <Button variant="accent">항해 시작</Button>
    <Button variant="secondary">초안 보기</Button>
    <Button variant="ghost">건너뛰기</Button>
    <Button variant="danger">삭제</Button>
  </div>
);

export const Sizes = () => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
    <Button size="sm">Small</Button>
    <Button size="md">Medium</Button>
    <Button size="lg">Large</Button>
  </div>
);

export const States = () => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
    <Button variant="primary">Enabled</Button>
    <Button variant="primary" disabled>Disabled</Button>
    <Button variant="accent" disabled>Disabled accent</Button>
  </div>
);
