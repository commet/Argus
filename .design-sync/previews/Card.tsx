import { Card } from 'argus';

const Body = ({ title, text }: { title: string; text: string }) => (
  <>
    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 6 }}>{title}</div>
    <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{text}</div>
  </>
);

export const Variants = () => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, maxWidth: 820 }}>
    <Card variant="default"><Body title="기본 카드" text="중립적인 표면. 대부분의 콘텐츠에 사용." /></Card>
    <Card variant="ai"><Body title="AI 작업" text="AI가 생성한 내용임을 표시하는 카드." /></Card>
    <Card variant="human"><Body title="사람 판단" text="사람이 직접 정한 영역을 표시." /></Card>
    <Card variant="success"><Body title="협업 완료" text="합의에 도달한 결과." /></Card>
    <Card variant="checkpoint"><Body title="체크포인트" text="결정을 봉인하기 전 확인 지점." /></Card>
    <Card variant="elevated"><Body title="강조 카드" text="골드 상단 보더 + 더 깊은 그림자." /></Card>
  </div>
);

export const Hoverable = () => (
  <div style={{ maxWidth: 360 }}>
    <Card variant="default" hoverable><Body title="호버 가능한 카드" text="마우스를 올리면 떠오릅니다 — 클릭 가능한 항목에." /></Card>
  </div>
);
