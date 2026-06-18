import { Graticule } from 'argus';

// Graticule renders position:absolute; inset-0 — the faint lat/long grid of a
// sea chart. It only shows inside a sized, position:relative parchment box, so
// each cell wraps it in one. Opacity/spacing swept to match real app usage
// (workspace ~0.02–0.04, error/not-found ~0.11).

const Panel = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      position: 'relative',
      width: 360,
      height: 200,
      background: 'var(--bp-paper)',
      borderRadius: 12,
      overflow: 'hidden',
      border: '1px solid var(--border-subtle)',
    }}
  >
    {children}
  </div>
);

export const Default = () => (
  <Panel>
    <Graticule opacity={0.11} spacing={26} />
  </Panel>
);

export const Faint = () => (
  <Panel>
    <Graticule opacity={0.04} spacing={22} />
  </Panel>
);

export const Dense = () => (
  <Panel>
    <Graticule opacity={0.14} spacing={14} />
  </Panel>
);

export const WithLabel = () => (
  <Panel>
    <Graticule opacity={0.11} spacing={26} />
    <span
      className="bp-mono"
      style={{
        position: 'absolute',
        top: 12,
        left: 16,
        fontSize: 10,
        letterSpacing: '0.26em',
        color: 'var(--text-tertiary)',
      }}
    >
      CHART · 37.2°N
    </span>
  </Panel>
);
