import { AttentionFlash } from 'argus';

function AgentRow({
  color,
  name,
  activity,
  active,
  initial,
}: {
  color?: string;
  name: string;
  activity: string;
  active: boolean;
  initial: string;
}) {
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        minWidth: 300,
        padding: '16px 18px',
        borderRadius: 12,
        border: '1px solid var(--border)',
        background: 'var(--bp-paper)',
      }}
    >
      <AttentionFlash active={active} color={color} />
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: `${color || '#8B5CF6'}18`,
          border: `1.5px solid ${color || '#8B5CF6'}40`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: 13,
          color: color || '#8B5CF6',
        }}
      >
        {initial}
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{name}</div>
        <div style={{ marginTop: 2, fontSize: 12, color: 'var(--text-secondary)' }}>{activity}</div>
      </div>
    </div>
  );
}

export const Active = () => (
  <div style={{ padding: 20, background: 'var(--surface)' }}>
    <AgentRow color="#8B5CF6" name="현우 · 전략 구루" activity="방금 입력을 받았습니다" active initial="현" />
  </div>
);

export const AccentDefault = () => (
  <div style={{ padding: 20, background: 'var(--surface)' }}>
    <AgentRow name="Hyunwoo · Strategy Lead" activity="Just received your input" active initial="H" />
  </div>
);

export const Idle = () => (
  <div style={{ padding: 20, background: 'var(--surface)' }}>
    <AgentRow color="#10B981" name="규민 · 숫자 분석가" activity="대기 중 — 플래시 없음" active={false} initial="규" />
  </div>
);
