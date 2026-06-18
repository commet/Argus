import { PaperGrain } from 'argus';

export const Default = () => (
  <div style={{ position: 'relative', height: 200, maxWidth: 560, background: 'var(--bp-paper)', borderRadius: 12, overflow: 'hidden' }}>
    <PaperGrain opacity={0.6} density="coarse" />
    <div style={{ position: 'relative', padding: 20, color: 'var(--bp-ink)', fontSize: 13, fontWeight: 600 }}>
      양피지 질감 오버레이
    </div>
  </div>
);
