import { Cartouche } from 'argus';

export const Default = () => (
  <div style={{ display: 'flex', gap: 20, padding: 20, background: 'var(--bp-paper)', borderRadius: 12 }}>
    <Cartouche>
      <div style={{ color: 'var(--bp-ink)', fontSize: 13, fontWeight: 600 }}>항해 일지</div>
    </Cartouche>
    <Cartouche active>
      <div style={{ color: 'var(--bp-ink)', fontSize: 13, fontWeight: 600 }}>현재 위치 · 활성</div>
    </Cartouche>
  </div>
);
