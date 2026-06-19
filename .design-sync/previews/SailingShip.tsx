import { SailingShip } from 'argus';

export const Default = () => (
  <figure style={{ maxWidth: 520, padding: 8, margin: 0, textAlign: 'center' }}>
    <SailingShip animate={false} />
    <figcaption className="bp-mono" style={{ marginTop: 10, fontSize: 11, letterSpacing: '0.08em', color: 'var(--text-tertiary)' }}>
      SAILING SHIP — 항해 중인 배
    </figcaption>
  </figure>
);
