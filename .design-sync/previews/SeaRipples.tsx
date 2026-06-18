import { SeaRipples } from 'argus';

// SeaRipples defaults to position:absolute (it overlays a scene). For a
// standalone card, render it inline on a parchment panel so the drifting
// dashed wave layers are visible.
export const Default = () => (
  <div style={{ maxWidth: 560, background: 'var(--bp-paper)', borderRadius: 12, overflow: 'hidden', padding: '24px 0 0' }}>
    <SeaRipples className="w-full pointer-events-none" height={140} />
  </div>
);
