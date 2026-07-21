/**
 * Portfolio force layout — determinism, bipartite fidelity, degree-based
 * sizing, honest overflow, and on-plate bounds. Pins the hairball defenses.
 */
import { describe, it, expect } from 'vitest';
import type { PortfolioGraph } from '@/lib/judgment-portfolio-graph';
import { portfolioLayout, MAX_PREMISE_NODES } from '@/lib/judgment-portfolio-layout';

function graph(over: Partial<PortfolioGraph> = {}): PortfolioGraph {
  return { premises: [], decisions: [], edges: [], ...over };
}

describe('portfolioLayout — determinism', () => {
  it('empty graph → empty layout, no throw', () => {
    const r = portfolioLayout(graph());
    expect(r.nodes).toHaveLength(0);
    expect(r.edges).toHaveLength(0);
    expect(r.overflow).toBe(0);
  });

  it('the same graph always draws the same map', () => {
    const g = graph({
      premises: [
        { id: 'premise:a', kind: 'premise', key: 'a', text: 'A', degree: 2, liveBets: 0 },
        { id: 'premise:b', kind: 'premise', key: 'b', text: 'B', degree: 1, liveBets: 0 },
      ],
      decisions: [
        { id: 'decision:r1', kind: 'decision', receiptId: 'r1', title: 'R1', live: true },
        { id: 'decision:r2', kind: 'decision', receiptId: 'r2', title: 'R2', live: false },
      ],
      edges: [
        { id: 'r1::a', decision: 'decision:r1', premise: 'premise:a', hot: false },
        { id: 'r2::a', decision: 'decision:r2', premise: 'premise:a', hot: false },
        { id: 'r1::b', decision: 'decision:r1', premise: 'premise:b', hot: false },
      ],
    });
    const a = portfolioLayout(g);
    const b = portfolioLayout(g);
    expect(a).toEqual(b);
  });
});

describe('portfolioLayout — bipartite fidelity', () => {
  it('every premise and every decision touched by a kept edge becomes a node', () => {
    const g = graph({
      premises: [{ id: 'premise:a', kind: 'premise', key: 'a', text: 'A', degree: 2, liveBets: 0 }],
      decisions: [
        { id: 'decision:r1', kind: 'decision', receiptId: 'r1', title: 'R1', live: true },
        { id: 'decision:r2', kind: 'decision', receiptId: 'r2', title: 'R2', live: false },
      ],
      edges: [
        { id: 'r1::a', decision: 'decision:r1', premise: 'premise:a', hot: false },
        { id: 'r2::a', decision: 'decision:r2', premise: 'premise:a', hot: true },
      ],
    });
    const r = portfolioLayout(g);
    expect(r.nodes.map((n) => n.id).sort()).toEqual(['decision:r1', 'decision:r2', 'premise:a'].sort());
    expect(r.edges).toHaveLength(2);
    expect(r.edges.find((e) => e.id === 'r2::a')!.hot).toBe(true);
    expect(r.edges.find((e) => e.id === 'r1::a')!.hot).toBe(false);
    // edges carry their endpoint ids so the component can trace a node's own
    // connections on hover without re-parsing id strings.
    const e2 = r.edges.find((e) => e.id === 'r2::a')!;
    expect(e2.premise).toBe('premise:a');
    expect(e2.decision).toBe('decision:r2');
  });

  it('a decision with no edges into the graph never appears as a node', () => {
    const g = graph({
      premises: [{ id: 'premise:a', kind: 'premise', key: 'a', text: 'A', degree: 1, liveBets: 0 }],
      decisions: [
        { id: 'decision:r1', kind: 'decision', receiptId: 'r1', title: 'R1', live: true },
        { id: 'decision:orphan', kind: 'decision', receiptId: 'orphan', title: 'Orphan', live: false },
      ],
      edges: [{ id: 'r1::a', decision: 'decision:r1', premise: 'premise:a', hot: false }],
    });
    const r = portfolioLayout(g);
    expect(r.nodes.some((n) => n.id === 'decision:orphan')).toBe(false);
  });
});

describe('portfolioLayout — degree-based sizing (hairball defense)', () => {
  it('a hub premise renders larger than a leaf premise', () => {
    const g = graph({
      premises: [
        { id: 'premise:hub', kind: 'premise', key: 'hub', text: 'Hub', degree: 5, liveBets: 0 },
        { id: 'premise:leaf', kind: 'premise', key: 'leaf', text: 'Leaf', degree: 1, liveBets: 0 },
      ],
      decisions: [{ id: 'decision:r1', kind: 'decision', receiptId: 'r1', title: 'R1', live: true }],
      edges: [
        { id: 'e1', decision: 'decision:r1', premise: 'premise:hub', hot: false },
        { id: 'e2', decision: 'decision:r1', premise: 'premise:leaf', hot: false },
      ],
    });
    const r = portfolioLayout(g);
    const hub = r.nodes.find((n) => n.id === 'premise:hub')!;
    const leaf = r.nodes.find((n) => n.id === 'premise:leaf')!;
    expect(hub.size).toBeGreaterThan(leaf.size);
  });
});

describe('portfolioLayout — honest overflow, never a silent cap', () => {
  it('drops the lowest-degree premises past MAX_PREMISE_NODES and reports the count', () => {
    const premises = Array.from({ length: MAX_PREMISE_NODES + 7 }, (_, i) => ({
      id: `premise:p${i}`,
      kind: 'premise' as const,
      key: `p${i}`,
      text: `P${i}`,
      degree: i === 0 ? 9 : 1, // one clear hub, the rest tied leaves
      liveBets: 0,
    }));
    const g = graph({ premises });
    const r = portfolioLayout(g);
    expect(r.overflow).toBe(7);
    expect(r.nodes.filter((n) => n.kind === 'premise')).toHaveLength(MAX_PREMISE_NODES);
    expect(r.nodes.some((n) => n.id === 'premise:p0')).toBe(true); // the hub always survives the cut
  });
});

describe('portfolioLayout — on-plate bounds', () => {
  it('keeps every node within [0,100] on both axes for a larger connected graph', () => {
    const premises = Array.from({ length: 12 }, (_, i) => ({
      id: `premise:p${i}`,
      kind: 'premise' as const,
      key: `p${i}`,
      text: `P${i}`,
      degree: i === 0 ? 8 : 1,
      liveBets: 0,
    }));
    const decisions = Array.from({ length: 8 }, (_, i) => ({
      id: `decision:r${i}`,
      kind: 'decision' as const,
      receiptId: `r${i}`,
      title: `R${i}`,
      live: i % 2 === 0,
    }));
    const edges = decisions.flatMap((d, i) => [
      { id: `${d.id}::hub`, decision: d.id, premise: 'premise:p0', hot: false },
      { id: `${d.id}::leaf`, decision: d.id, premise: `premise:p${(i % 11) + 1}`, hot: false },
    ]);
    const r = portfolioLayout(graph({ premises, decisions, edges }));
    for (const node of r.nodes) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x).toBeLessThanOrEqual(100);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeLessThanOrEqual(100);
    }
  });
});
