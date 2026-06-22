import { AvatarRipple } from 'argus';

const panel: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  gap: 44,
  minWidth: 320,
  minHeight: 110,
  padding: '32px 44px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
};

function AvatarDisc({ color, initial }: { color: string; initial: string }) {
  return (
    <div
      style={{
        position: 'relative',
        width: 40,
        height: 40,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: `${color}18`,
        border: `1.5px solid ${color}40`,
        fontWeight: 700,
        fontSize: 15,
        color,
      }}
    >
      {initial}
      <AvatarRipple color={color} />
    </div>
  );
}

export const Default = () => (
  <div style={panel}>
    <AvatarDisc color="#8B5CF6" initial="현" />
  </div>
);

export const MultipleAgents = () => (
  <div style={panel}>
    <AvatarDisc color="#3B82F6" initial="다" />
    <AvatarDisc color="#10B981" initial="규" />
    <AvatarDisc color="#EF4444" initial="동" />
  </div>
);
