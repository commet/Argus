import { PlateLabel } from 'argus';

export const Default = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 24, background: 'var(--bp-paper)', borderRadius: 12, maxWidth: 420 }}>
    <PlateLabel numeral="I" title="출항" />
    <PlateLabel numeral="II" title="항해" />
    <PlateLabel numeral="III" title="귀환" align="left" />
  </div>
);
