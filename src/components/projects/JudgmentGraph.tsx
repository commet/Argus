'use client';

import { useMemo, useState } from 'react';
import type { JudgmentReceipt } from '@/lib/review';
import { sharedGrounds } from '@/lib/judgment-graph';
import { blastRadius } from '@/lib/judgment-graph-layout';
import { judgmentPortfolioGraph, type PortfolioGraph } from '@/lib/judgment-portfolio-graph';
import { portfolioLayout, type PortfolioLayoutNode } from '@/lib/judgment-portfolio-layout';
import { VoyageMarker } from './VoyageMarker';

/**
 * Judgment portfolio map — the whole-account premise⇄decision bipartite graph
 * (BLUEPRINT §9.9 V2a, founder redesign 2026-07-21). Every monitored premise
 * and every decision that carries one is a browsable node; a "rests-on" edge
 * connects a decision to each premise it stands on. A shared ground is not a
 * separate surface here — it simply shows up as a premise node with degree
 * ≥ 2 (a hub), sized larger by the layout. Clicking a premise switches to the
 * existing drift-triggered blast-radius view (judgment-graph-layout.ts) as a
 * focused "zoom in on this one" mode; a back link returns to the whole map.
 *
 * This is a CHART, not an illustration: the fixed dark plate carries mood,
 * every datum is an exact HTML/SVG layer on top, and position IS data (the
 * force layout's rests-on topology). VoyageMarker is reused so a premise or
 * decision here is the same visual object as a ship on the sea.
 *
 * SPINE (CLAUDE.md §Zero-Judgment, BLUEPRINT §9.8/§9.9):
 *  - Facts + counts only. The settled record in focus mode renders as a bare
 *    "2 ✓ 1 ✗" tally, explicitly labelled "facts, not a grade" — never a
 *    score/tier/verdict.
 *  - Amber = attention (a footing that moved), never a red "you were wrong".
 *  - Every premise is quoted verbatim; the graph invents no relationship —
 *    edges exist only where the ledger asserts the same ground
 *    (judgment-graph.ts's exact-text matching).
 *  - Restraint: renders nothing unless at least one premise recurs across two
 *    or more decisions. A map of only unrelated single premises adds nothing
 *    over the existing per-decision lists — a blank surface is honest there.
 *  - Hairball defense: node size follows degree (a leaf stays a small dot), a
 *    "공유 지반만" filter can hide leaves entirely, and a hard cap on premise
 *    nodes surfaces its drop as an honest "+N" rather than silently thinning.
 */

// On-plate ink is theme-STABLE (it always sits over the fixed dark chart), the
// same rule VoyageSea/VoyageMarker follow. Surrounding chrome uses CSS vars.
const N = {
  foam: '#f5f0e5',
  brass: '#d8ad55',
  amber: '#e39a56',
  edge: '#f5f0e526',
  edgeHot: '#e39a56aa',
  grid: '#f5f0e512',
};

// Small portfolios can afford a persistent label under every node; beyond
// this the plate switches to hover-only labels for everything but the
// top hubs, the same "dense mode" threshold VoyageSea uses at 14 ships.
const DENSE_NODE_THRESHOLD = 14;
const DENSE_LABELED_HUBS = 5;

function clip(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function hubsOnlyGraph(graph: PortfolioGraph): PortfolioGraph {
  const hubs = new Set(graph.premises.filter((p) => p.degree >= 2).map((p) => p.id));
  const premises = graph.premises.filter((p) => hubs.has(p.id));
  const edges = graph.edges.filter((e) => hubs.has(e.premise));
  const liveDecisionIds = new Set(edges.map((e) => e.decision));
  const decisions = graph.decisions.filter((d) => liveDecisionIds.has(d.id));
  return { premises, decisions, edges };
}

export function JudgmentGraph({
  receipts,
  locale = 'ko',
}: {
  receipts: JudgmentReceipt[];
  locale?: 'ko' | 'en';
}) {
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const [hubsOnly, setHubsOnly] = useState(false);
  const [focusKey, setFocusKey] = useState<string | null>(null);

  const graph = useMemo(() => judgmentPortfolioGraph(receipts), [receipts]);
  const hasHub = graph.premises.some((p) => p.degree >= 2);

  const shownGraph = hubsOnly ? hubsOnlyGraph(graph) : graph;
  const layout = useMemo(() => portfolioLayout(shownGraph), [shownGraph]);

  // Full SharedGround (with live_bets/record) for the focused premise, if
  // any — minMembers:1 so a just-clicked leaf premise still resolves.
  const focusGround = useMemo(() => {
    if (!focusKey) return null;
    return sharedGrounds(receipts, { minMembers: 1 }).find((g) => g.key === focusKey) ?? null;
  }, [receipts, focusKey]);
  const focus = focusGround ? blastRadius(focusGround) : null;

  if (!hasHub) return null;

  const dense = layout.nodes.length > DENSE_NODE_THRESHOLD;
  const topHubIds = new Set(
    [...graph.premises]
      .filter((p) => p.degree >= 2)
      .sort((a, b) => b.degree - a.degree)
      .slice(0, DENSE_LABELED_HUBS)
      .map((p) => p.id),
  );
  const showsLabel = (node: PortfolioLayoutNode) => !dense || topHubIds.has(node.id);

  return (
    <section aria-labelledby="portfolio-map-h" className="mt-10">
      <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2
            id="portfolio-map-h"
            className="text-[15px] font-semibold"
            style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
          >
            {focus
              ? L('전제 하나에 집중', 'Focused on one premise')
              : L('판단 지도 — 전제와 결정이 서 있는 자리', 'Judgment map — where premises and decisions stand')}
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {focus
              ? L(
                  '이 전제 위에 선 열린 내기가 무엇인지 봅니다. 그 전제가 움직이면, 이 내기들이 함께 흔들립니다.',
                  'The open bets standing on this one premise. If it moves, every one of them moves with it.',
                )
              : L(
                  '전제 하나하나, 결정 하나하나가 지도의 점이에요. 두 결정 이상이 같은 전제 위에 서면 그 전제가 커집니다.',
                  'Every premise and every decision is a point on this map. A premise that two or more decisions stand on grows larger.',
                )}
          </p>
        </div>
        {!focus && (
          <button
            type="button"
            onClick={() => setHubsOnly((v) => !v)}
            aria-pressed={hubsOnly}
            className="shrink-0 rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors"
            style={
              hubsOnly
                ? { background: 'var(--accent)', color: 'var(--bg-primary)' }
                : { background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }
            }
          >
            {L('공유 전제만', 'Shared only')}
          </button>
        )}
      </header>

      <div
        className="relative overflow-hidden rounded-2xl"
        style={{
          aspectRatio: '16 / 9',
          minHeight: 340,
          background: 'radial-gradient(120% 92% at 50% 0%, #0e3533 0%, #082625 56%, #051b1a 100%)',
          border: '1px solid #f5f0e51f',
        }}
      >
        {/* graticule — the plotting sheet */}
        <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          {[20, 40, 60, 80].map((p) => (
            <line key={`v${p}`} x1={p} y1={0} x2={p} y2={100} stroke={N.grid} strokeWidth={0.15} vectorEffect="non-scaling-stroke" />
          ))}
          {[25, 50, 75].map((p) => (
            <line key={`h${p}`} x1={0} y1={p} x2={100} y2={p} stroke={N.grid} strokeWidth={0.15} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>

        {focus ? (
          <FocusPlate focus={focus} locale={locale} />
        ) : (
          <>
            {/* rests-on edges — hot (amber) when the premise drifted */}
            <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 z-[1] h-full w-full">
              {layout.edges.map((e) => (
                <line
                  key={e.id}
                  x1={e.x1}
                  y1={e.y1}
                  x2={e.x2}
                  y2={e.y2}
                  stroke={e.hot ? N.edgeHot : N.edge}
                  strokeWidth={e.hot ? 1.1 : 0.7}
                  strokeDasharray={e.hot ? undefined : '1.5 2'}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>

            {/* premise + decision nodes */}
            {layout.nodes.map((node) => {
              const label =
                node.kind === 'premise' ? node.premise!.text : node.decision!.title;
              const title = node.kind === 'premise' ? `「${label}」` : label;
              const isHub = node.kind === 'premise' && node.premise!.degree >= 2;

              if (node.kind === 'decision') {
                return (
                  <div
                    key={node.id}
                    className="absolute z-[2] flex flex-col items-center"
                    style={{ left: `${node.x}%`, top: `${node.y}%`, transform: 'translate(-50%,-50%)' }}
                    title={title}
                  >
                    <VoyageMarker
                      state={node.decision!.live ? 'sailing' : 'arrived'}
                      size={node.size}
                      kind="receipt"
                      title={title}
                    />
                    {showsLabel(node) && (
                      <span
                        className="mt-1 max-w-[110px] text-center text-[10px] leading-tight"
                        style={{ color: '#f5f0e5b0' }}
                      >
                        {clip(label, 26)}
                      </span>
                    )}
                  </div>
                );
              }

              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => setFocusKey(node.premise!.key)}
                  title={title}
                  aria-label={L(`전제 집중: ${label}`, `Focus premise: ${label}`)}
                  className="absolute z-[3] flex flex-col items-center bg-transparent cursor-pointer"
                  style={{ left: `${node.x}%`, top: `${node.y}%`, transform: 'translate(-50%,-50%)' }}
                >
                  <VoyageMarker state={node.hot ? 'adrift' : 'docked'} size={node.size} title={title} />
                  {showsLabel(node) && (
                    <span
                      className="mt-1 max-w-[130px] text-center text-[10.5px] leading-tight"
                      style={{ color: isHub ? N.foam : '#f5f0e59a', fontWeight: isHub ? 600 : 400 }}
                    >
                      「{clip(label, isHub ? 40 : 22)}」
                    </span>
                  )}
                </button>
              );
            })}

            {layout.overflow > 0 && (
              <span
                className="absolute bottom-3 right-3 z-[4] rounded-full px-2.5 py-1 text-[11px]"
                style={{ background: '#f5f0e514', color: '#f5f0e5cc', border: '1px solid #f5f0e524' }}
              >
                {L(`+${layout.overflow}개 전제 더`, `+${layout.overflow} more premises`)}
              </span>
            )}
          </>
        )}
      </div>

      {focus ? (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setFocusKey(null)}
            className="text-[12px] font-medium underline"
            style={{ color: 'var(--text-secondary)' }}
          >
            ← {L('전체 지도로', 'Back to the whole map')}
          </button>
          {focus.ground.record && (
            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
              {L(
                `✓ 지켜짐 ${focus.ground.record.held} · ✗ 깨짐 ${focus.ground.record.broke}${focus.ground.record.mixed ? ` · ~ 혼재 ${focus.ground.record.mixed}` : ''} — 사실, 평가가 아닙니다.`,
                `✓ held ${focus.ground.record.held} · ✗ broke ${focus.ground.record.broke}${focus.ground.record.mixed ? ` · ~ mixed ${focus.ground.record.mixed}` : ''} — facts, not a grade.`,
              )}
            </p>
          )}
        </div>
      ) : (
        <p className="mt-2 text-[11px] leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
          {L(
            '점을 눌러 그 전제 위에 선 열린 내기를 봅니다. 색은 사실만 나타냅니다 — 호박색은 전제가 움직였다는 뜻, 평가가 아닙니다.',
            'Click a premise to see the open bets standing on it. Color is fact-only — amber means the premise moved, never a verdict.',
          )}
        </p>
      )}
    </section>
  );
}

/** The single-ground blast-radius view, reused verbatim as this map's "zoom
 *  in on one premise" focus mode (judgment-graph-layout.ts:blastRadius). */
function FocusPlate({
  focus,
  locale,
}: {
  focus: NonNullable<ReturnType<typeof blastRadius>>;
  locale: 'ko' | 'en';
}) {
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const { center, spokes, edges, overflow, hot, ground } = focus;
  const drift = ground.drift;
  const driftLine = drift
    ? typeof drift.baseline_numeric === 'number' && typeof drift.current_numeric === 'number'
      ? `${drift.baseline_numeric} → ${drift.current_numeric}`
      : clip(drift.current_text || drift.finding, 48)
    : '';

  return (
    <>
      {/* rests-on edges — hot (amber, solid) when the ground drifted */}
      <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 z-[1] h-full w-full">
        {edges.map((e, i) => {
          const s = spokes[i];
          return (
            <line
              key={e.to}
              x1={center.x}
              y1={center.y}
              x2={s.x}
              y2={s.y}
              stroke={hot ? N.edgeHot : N.edge}
              strokeWidth={hot ? 1.4 : 1}
              strokeDasharray={hot ? undefined : '2 2.5'}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>

      {spokes.map((s) => (
        <div
          key={s.id}
          className="absolute z-[2] flex flex-col items-center"
          style={{ left: `${s.x}%`, top: `${s.y}%`, transform: 'translate(-50%,-50%)', width: 132 }}
        >
          <VoyageMarker state={s.state} size={22} title={s.label} />
          <span className="mt-1 text-center text-[10px] leading-tight" style={{ color: '#f5f0e5cc' }}>
            {clip(s.label, 30)}
          </span>
          {s.detail && (
            <span className="text-[9px] tabular-nums" style={{ color: '#d8ad55c4' }}>
              {s.detail}
            </span>
          )}
        </div>
      ))}

      <div
        className="absolute z-[3] flex flex-col items-center"
        style={{ left: `${center.x}%`, top: `${center.y}%`, transform: 'translate(-50%,-50%)', width: 208 }}
      >
        <VoyageMarker state={center.state} size={44} title={center.label} />
        <span className="mt-1.5 text-center text-[12px] font-medium leading-tight" style={{ color: N.foam }}>
          「{clip(center.label, 42)}」
        </span>
        <span className="mt-0.5 text-center text-[10px] tabular-nums" style={{ color: '#f5f0e599' }}>
          {L(`열린 내기 ${ground.live_bets.length}건`, `${ground.live_bets.length} open bets`)}
        </span>
      </div>

      {hot && (
        <div
          className="absolute left-3 top-3 z-[4] max-w-[60%] rounded-lg px-3 py-2"
          style={{ background: '#e39a5616', border: '1px solid #e39a5638' }}
        >
          <p className="text-[11px] font-medium" style={{ color: N.amber }}>
            {L('이 전제, 봉인 후 현실이 움직였어요', 'Reality moved this assumption since it was sealed')}
          </p>
          {driftLine && (
            <p className="mt-0.5 text-[11px] tabular-nums" style={{ color: '#f5f0e5cc' }}>
              {driftLine}
            </p>
          )}
        </div>
      )}

      {overflow > 0 && (
        <span
          className="absolute bottom-3 right-3 z-[4] rounded-full px-2.5 py-1 text-[11px]"
          style={{ background: '#f5f0e514', color: '#f5f0e5cc', border: '1px solid #f5f0e524' }}
        >
          {L(`+${overflow}건 더`, `+${overflow} more`)}
        </span>
      )}
    </>
  );
}
