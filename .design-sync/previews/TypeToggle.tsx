import { TypeToggle } from 'argus';

// TypeToggle — the 4-axis MBTI pill selector (E/I · S/N · T/F · J/P) used in
// BossSetup. Each axis shows the active pill (gold spring-animated background)
// plus a boss-specific Korean description line below. It's a self-contained
// store-backed control: it reads/writes the boss store's `axes` (default ESTJ),
// so the at-rest preview shows E·S·T·J selected with their descriptions. The
// axis labels/descriptions are Korean by design (sourced from AXES).

// Real placement width inside the BossSetup form.
export const Default = () => (
  <div style={{ width: 360, padding: 20, background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border-subtle)' }}>
    <TypeToggle />
  </div>
);

// Wider container — the four axis rows breathing out.
export const Wide = () => (
  <div style={{ width: 480, padding: 24, background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border-subtle)' }}>
    <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-tertiary)', margin: '0 0 12px' }}>
      우리 팀장은 어떤 유형?
    </p>
    <TypeToggle />
  </div>
);
