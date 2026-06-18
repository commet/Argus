import { HorizonGlow } from 'argus';

export const Default = () => (
  <div style={{ position: 'relative', height: 200, maxWidth: 560, background: 'var(--bp-paper)', borderRadius: 12, overflow: 'hidden' }}>
    <HorizonGlow intensity={0.45} />
    <div style={{ position: 'relative', padding: 20, color: 'var(--bp-ink-soft)', fontSize: 12 }}>
      dawn-harbour 글로우 — 하단에서 피어오르는 골드 빛
    </div>
  </div>
);
