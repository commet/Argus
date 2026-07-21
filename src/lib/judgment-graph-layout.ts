/**
 * Blast-radius layout for the judgment knowledge graph (BLUEPRINT §9.9 V2a).
 *
 * The research (3-stream: OSS libs · prior art · codebase) converged on ONE
 * default view, not a global hairball: a **drift-triggered local blast-radius** —
 * a single load-bearing ground at the center, the still-open bets that rest on
 * it radiating out. This is the Defender/PR "propagation path from the moved node
 * to its at-risk targets" pattern, and it dodges the ~200-node ornamental-hairball
 * cliff that kills second-brain graphs.
 *
 * This module is PURE and deterministic (no time, no random, no DOM) — like the
 * rest of VoyageSea's positioning — so it is unit-testable and SSR-safe. The
 * component adds live concerns (due-ness, theme) on top.
 *
 * SPINE: encodes only facts. Position = the rests-on topology. Drift is the one
 * alarm (`hot`), carried as the ground's own `adrift` state, never a verdict.
 * Settlement counts travel as data for the component to print as "2✓ · 1✗" — a
 * neutral tally, never a grade.
 */
import type { SharedGround } from './judgment-graph';
import type { VoyageState } from './voyage-state';

export interface GraphNode {
  id: string;
  role: 'ground' | 'bet';
  label: string;
  /** % of container width (0–100). */
  x: number;
  /** % of container height (0–100). */
  y: number;
  /** drives the VoyageMarker glyph/tone. */
  state: VoyageState;
  /** for bets: the check-by date (YYYY-MM-DD). */
  detail?: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  /** true when the ground has drifted — the blast radius is "hot". */
  hot: boolean;
}

export interface BlastRadius {
  ground: SharedGround;
  center: GraphNode;
  spokes: GraphNode[];
  edges: GraphEdge[];
  /** open bets beyond the displayed cap — surfaced as "+N", never silently dropped. */
  overflow: number;
  /** the ground drifted since it was sealed. */
  hot: boolean;
}

/** At most this many spokes are drawn; the rest are surfaced as an honest "+N". */
export const MAX_SPOKES = 8;

/**
 * The one ground worth centering. Drift wins first (a real recorded event —
 * the mirror clause: fire on signal, not on a flat day); among the rest, the
 * most live exposure. A ground with neither drift nor an open bet is not worth
 * a blast-radius view — return null and the surface stays silent.
 */
export function pickFocusGround(grounds: SharedGround[]): SharedGround | null {
  const candidates = grounds.filter((g) => g.drift || g.live_bets.length > 0);
  if (candidates.length === 0) return null;
  const drifted = candidates.filter((g) => g.drift);
  const pool = drifted.length ? drifted : candidates;
  return [...pool].sort((a, b) => b.live_bets.length - a.live_bets.length)[0];
}

/**
 * Radial positions in % coordinates. The center ground sits at (50, 50); each
 * open bet is placed evenly around it, starting at the top and going clockwise.
 * `aspect` (width / height of the plate) circularizes the ring so it doesn't
 * squash on a wide plate: x-radius is divided by the aspect ratio.
 */
export function blastRadius(ground: SharedGround, aspect = 16 / 9): BlastRadius {
  const hot = Boolean(ground.drift);
  const shown = ground.live_bets.slice(0, MAX_SPOKES);
  const overflow = Math.max(0, ground.live_bets.length - shown.length);

  const CX = 50;
  const CY = 50;
  const R = 34; // ring radius as % of height

  const center: GraphNode = {
    id: `ground:${ground.key}`,
    role: 'ground',
    label: ground.text,
    x: CX,
    y: CY,
    // adrift = the footing is moving (amber Waves); docked = solid anchor.
    state: hot ? 'adrift' : 'docked',
  };

  const n = Math.max(1, shown.length);
  const spokes: GraphNode[] = shown.map((bet, i) => {
    const theta = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return {
      id: `bet:${bet.receipt_id}:${bet.followup_id}`,
      role: 'bet' as const,
      label: bet.predicate,
      x: CX + (R / aspect) * Math.cos(theta),
      y: CY + R * Math.sin(theta),
      state: 'sailing' as VoyageState,
      detail: bet.check_by,
    };
  });

  const edges: GraphEdge[] = spokes.map((s) => ({ from: center.id, to: s.id, hot }));

  return { ground, center, spokes, edges, overflow, hot };
}
