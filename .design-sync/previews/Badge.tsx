import { Badge } from 'argus';

export const Roles = () => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
    <Badge variant="ai">AI</Badge>
    <Badge variant="human">사람</Badge>
    <Badge variant="both">협업</Badge>
    <Badge variant="gold">현재 방위</Badge>
    <Badge variant="checkpoint">체크포인트</Badge>
    <Badge variant="default">기본</Badge>
  </div>
);

export const Risk = () => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
    <Badge variant="risk-critical">치명적 위험</Badge>
    <Badge variant="risk-manageable">관리 가능</Badge>
    <Badge variant="risk-unspoken">암묵적 위험</Badge>
  </div>
);
