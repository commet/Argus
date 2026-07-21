/**
 * Force layout for the portfolio bipartite graph (BLUEPRINT §9.9 V2a).
 *
 * Hard-rolled, deterministic spring layout — no d3-force dependency, same
 * philosophy as VoyageSea's hand-rolled scatter+relax (src/components/projects/
 * VoyageSea.tsx). Every node starts on a ring placed purely from its index and
 * a stable hash of its id (never Math.random/Date.now, so the same graph
 * always draws the same map), then a fixed number of iterations lets edges
 * pull connected premise/decision pairs together while every pair of nodes
 * pushes apart — the standard Fruchterman-Reingold shape, small enough to
 * hand-write and unit-test. PURE + deterministic (no time/random/DOM), same
 * guarantee as judgment-graph-layout.ts.
 *
 * Hairball defense (CLAUDE.md V2a brief: "필터/클러스터·degree 기반 크기"):
 *  - A premise's marker size is driven by its degree — a leaf stays a small
 *    dot, a hub reads large without needing a permanent label.
 *  - When the graph exceeds MAX_PREMISE_NODES, the lowest-degree premises are
 *    dropped (ties broken by drift, then key) and the drop is surfaced as an
 *    honest `overflow` count — never a silent truncation.
 *  - Callers that want a "shared ground only" declutter view pre-filter the
 *    PortfolioGraph before calling this function; this module only lays out
 *    whatever graph it is given.
 */
import type { PortfolioGraph, PremiseNode, DecisionNode } from './judgment-portfolio-graph';

export interface PortfolioLayoutNode {
  id: string;
  kind: 'premise' | 'decision';
  /** % of plate width. */
  x: number;
  /** % of plate height. */
  y: number;
  /** marker px, degree-scaled for premises. */
  size: number;
  /** drifted premise, or a decision touching one — the one visual alarm. */
  hot: boolean;
  premise?: PremiseNode;
  decision?: DecisionNode;
}

export interface PortfolioLayoutEdge {
  id: string;
  /** PremiseNode id — carried through so the component can highlight a node's
   *  own edges on hover without re-parsing ids. */
  premise: string;
  /** DecisionNode id. */
  decision: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  hot: boolean;
}

export interface PortfolioLayout {
  nodes: PortfolioLayoutNode[];
  edges: PortfolioLayoutEdge[];
  /** premises dropped for exceeding MAX_PREMISE_NODES — surfaced, never silent. */
  overflow: number;
}

/** At most this many premise nodes are laid out; the rest are an honest "+N". */
export const MAX_PREMISE_NODES = 60;

const ITERATIONS = 180;
const IDEAL_EDGE = 20; // U-units — the spring's rest length
const REPEL_K = 260;
const ATTRACT_K = 0.02;
const CENTER_K = 0.006;
const MIN_DIST = 3;

/** Deterministic pseudo-random unit float from an id + salt (FNV-1a). Never
 *  Math.random — the same graph must draw the same map every time. */
function hash01(id: string, salt: number): number {
  let h = (2166136261 ^ salt) >>> 0;
  for (let i = 0; i < id.length; i++) h = (h ^ id.charCodeAt(i)) * 16777619;
  return ((h >>> 0) % 100000) / 100000;
}

/** Degree-1 leaves stay small dots; a shared hub reads big at a glance. */
function premiseSize(degree: number): number {
  return Math.max(14, Math.min(50, 14 + degree * 7));
}
function decisionSize(edgeCount: number): number {
  return Math.max(16, Math.min(30, 16 + edgeCount * 2));
}

export function portfolioLayout(graph: PortfolioGraph, aspect = 16 / 9): PortfolioLayout {
  const allPremises = [...graph.premises].sort((a, b) => {
    if (b.degree !== a.degree) return b.degree - a.degree;
    if (!!b.drift !== !!a.drift) return b.drift ? 1 : -1;
    return a.key < b.key ? -1 : 1;
  });
  const kept = allPremises.slice(0, MAX_PREMISE_NODES);
  const overflow = Math.max(0, allPremises.length - kept.length);
  const keptPremiseIds = new Set(kept.map((p) => p.id));

  const edges = graph.edges.filter((e) => keptPremiseIds.has(e.premise));
  const decisionEdgeCount = new Map<string, number>();
  const decisionHot = new Map<string, boolean>();
  for (const e of edges) {
    decisionEdgeCount.set(e.decision, (decisionEdgeCount.get(e.decision) ?? 0) + 1);
    if (e.hot) decisionHot.set(e.decision, true);
  }
  const decisions = graph.decisions.filter((d) => decisionEdgeCount.has(d.id));

  const nodeIds = [...kept.map((p) => p.id), ...decisions.map((d) => d.id)];
  const n = nodeIds.length;
  if (n === 0) return { nodes: [], edges: [], overflow };

  // Deterministic ring start: index spacing + a stable per-id jitter so
  // same-degree nodes don't begin perfectly coincident.
  const xU = new Map<string, number>();
  const yU = new Map<string, number>();
  nodeIds.forEach((id, i) => {
    const theta = (2 * Math.PI * i) / n + hash01(id, 1) * 0.6;
    const r = 26 + hash01(id, 2) * 8;
    xU.set(id, r * Math.cos(theta));
    yU.set(id, r * Math.sin(theta));
  });

  const edgePairs = edges.map((e) => ({ a: e.premise, b: e.decision }));

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const fx = new Map<string, number>(nodeIds.map((id) => [id, 0]));
    const fy = new Map<string, number>(nodeIds.map((id) => [id, 0]));

    for (let i = 0; i < n; i++) {
      const idA = nodeIds[i];
      for (let j = i + 1; j < n; j++) {
        const idB = nodeIds[j];
        let dx = xU.get(idA)! - xU.get(idB)!;
        let dy = yU.get(idA)! - yU.get(idB)!;
        let dist = Math.hypot(dx, dy);
        if (dist < MIN_DIST) {
          // deterministic nudge direction from the pair's own hash — never Math.random.
          const t = hash01(`${idA}::${idB}`, 3) * 2 * Math.PI;
          dx = Math.cos(t) * MIN_DIST;
          dy = Math.sin(t) * MIN_DIST;
          dist = MIN_DIST;
        }
        const f = REPEL_K / (dist * dist);
        const ux = dx / dist;
        const uy = dy / dist;
        fx.set(idA, fx.get(idA)! + ux * f);
        fy.set(idA, fy.get(idA)! + uy * f);
        fx.set(idB, fx.get(idB)! - ux * f);
        fy.set(idB, fy.get(idB)! - uy * f);
      }
    }

    for (const { a, b } of edgePairs) {
      const dx = xU.get(b)! - xU.get(a)!;
      const dy = yU.get(b)! - yU.get(a)!;
      const dist = Math.max(MIN_DIST, Math.hypot(dx, dy));
      const f = ATTRACT_K * (dist - IDEAL_EDGE);
      const ux = dx / dist;
      const uy = dy / dist;
      fx.set(a, fx.get(a)! + ux * f);
      fy.set(a, fy.get(a)! + uy * f);
      fx.set(b, fx.get(b)! - ux * f);
      fy.set(b, fy.get(b)! - uy * f);
    }

    const decay = (1 - iter / ITERATIONS) * 0.9;
    for (const id of nodeIds) {
      const cx = xU.get(id)!;
      const cy = yU.get(id)!;
      const nfx = fx.get(id)! - CENTER_K * cx;
      const nfy = fy.get(id)! - CENTER_K * cy;
      xU.set(id, cx + nfx * decay);
      yU.set(id, cy + nfy * decay);
    }
  }

  // Normalize U-space into % coordinates. x is divided by `aspect` so a
  // circle in U-space draws as a circle on the (wider-than-tall) plate — the
  // same convention judgment-graph-layout's blastRadius ring uses.
  let maxR = 1;
  for (const id of nodeIds) maxR = Math.max(maxR, Math.hypot(xU.get(id)!, yU.get(id)!));
  const SCALE = 40 / maxR;

  const posOf = (id: string) => ({
    x: Math.max(4, Math.min(96, 50 + (xU.get(id)! * SCALE) / aspect)),
    y: Math.max(4, Math.min(96, 50 + yU.get(id)! * SCALE)),
  });

  const nodes: PortfolioLayoutNode[] = [];
  for (const p of kept) {
    const { x, y } = posOf(p.id);
    nodes.push({ id: p.id, kind: 'premise', x, y, size: premiseSize(p.degree), hot: !!p.drift, premise: p });
  }
  for (const d of decisions) {
    const { x, y } = posOf(d.id);
    nodes.push({
      id: d.id,
      kind: 'decision',
      x,
      y,
      size: decisionSize(decisionEdgeCount.get(d.id) ?? 1),
      hot: !!decisionHot.get(d.id),
      decision: d,
    });
  }

  const posById = new Map(nodes.map((nd) => [nd.id, nd]));
  const layoutEdges: PortfolioLayoutEdge[] = edges.map((e) => {
    const a = posById.get(e.premise)!;
    const b = posById.get(e.decision)!;
    return { id: e.id, premise: e.premise, decision: e.decision, x1: a.x, y1: a.y, x2: b.x, y2: b.y, hot: e.hot };
  });

  return { nodes, edges: layoutEdges, overflow };
}
