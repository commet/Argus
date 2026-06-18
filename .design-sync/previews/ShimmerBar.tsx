import { ShimmerBar } from 'argus';

function WorkingCard({ color, name, activity }: { color: string; name: string; activity: string }) {
  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        minWidth: 280,
        padding: '18px 20px',
        borderRadius: 12,
        border: '1px solid var(--border)',
        background: 'var(--bp-paper)',
      }}
    >
      <ShimmerBar color={color} />
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{name}</div>
      <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-secondary)' }}>{activity}</div>
    </div>
  );
}

export const Default = () => (
  <div style={{ display: 'flex', gap: 16, padding: 20, background: 'var(--surface)' }}>
    <WorkingCard color="#3B82F6" name="다은 · 리서치 애널리스트" activity="시장 신호 추출 중" />
  </div>
);

export const Stack = () => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      padding: 20,
      background: 'var(--surface)',
    }}
  >
    <WorkingCard color="#8B5CF6" name="현우 · 전략 구루" activity="옵션 탐색 중" />
    <WorkingCard color="#10B981" name="규민 · 숫자 분석가" activity="ROI 계산 중" />
    <WorkingCard color="#F59E0B" name="Seoyeon · Copywriter" activity="Polishing prose" />
  </div>
);
