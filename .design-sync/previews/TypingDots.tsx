import { TypingDots } from 'argus';

const panel: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  gap: 28,
  minWidth: 320,
  minHeight: 80,
  padding: '24px 28px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
};

const label: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--text-secondary)',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
};

export const Default = () => (
  <div style={panel}>
    <span style={{ ...label, fontSize: 18, color: 'var(--text-primary)' }}>
      <TypingDots />
    </span>
  </div>
);

export const Colored = () => (
  <div style={panel}>
    <span style={{ ...label, color: '#3B82F6' }}>
      <TypingDots color="#3B82F6" />
    </span>
    <span style={{ ...label, color: '#10B981' }}>
      <TypingDots color="#10B981" />
    </span>
    <span style={{ ...label, color: '#EF4444' }}>
      <TypingDots color="#EF4444" />
    </span>
  </div>
);

export const InContext = () => (
  <div style={{ ...panel, justifyContent: 'flex-start' }}>
    <span style={{ ...label, fontSize: 14, color: 'var(--text-primary)' }}>
      3명 분석 중
      <TypingDots />
    </span>
  </div>
);
