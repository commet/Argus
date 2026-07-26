'use client';

import { useMemo, useState } from 'react';
import { Check, FileText } from 'lucide-react';
import type { JudgmentReceipt } from '@/lib/review';
import { sharedGrounds } from '@/lib/judgment-graph';
import { blastRadius } from '@/lib/judgment-graph-layout';
import { judgmentPortfolioGraph, type PortfolioGraph, type DecisionOrigin } from '@/lib/judgment-portfolio-graph';
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
 * force layout's rests-on topology).
 *
 * TWO NODE FAMILIES, one strong categorical channel (founder review 2026-07-22:
 * "구분이 더 직관적으로"): a PREMISE is a ROUND node (the reused VoyageMarker —
 * the ground you stand on), a DECISION is a ROUNDED-SQUARE tile (a discrete
 * sealed record / receipt). Circle-vs-square reads at a glance with no legend;
 * the palette stays ink+foam with amber reserved solely for drift, so we add a
 * shape channel without adding a colour channel. The square tile deliberately
 * diverges from the sea's all-round vessels because THIS surface's whole job is
 * to tell the two node types apart — a distinction the sea never had to make.
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

/** SOURCE axis label — honest scope (웹 / MCP·CLI / 미상). 미상 is shown, never
 *  hidden, so the disclosed gap stays visible (honest gap over fabrication). */
function originLabel(o: DecisionOrigin, ko: boolean): string {
  if (o === 'web') return ko ? '웹' : 'web';
  if (o === 'mcp_cli') return 'MCP·CLI';
  return ko ? '미상' : 'unknown';
}

/** RECENCY axis label — "N일 전 점검". Pure fact; the map computes it client-side
 *  (the graph lib stays Date-free). Null when no activity ts was recorded. */
function daysAgoLabel(iso: string | undefined, now: number, ko: boolean): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const d = Math.max(0, Math.floor((now - t) / 86_400_000));
  if (d === 0) return ko ? '오늘 점검' : 'checked today';
  return ko ? `${d}일 전 점검` : `checked ${d}d ago`;
}

/** ETA axis label — the re-check due date read as a voyage ETA. Forward-looking
 *  (the alarm the raw age couldn't give): "다음 확인 D-N" ahead, "확인 기한 N일
 *  지남" past. `overdue` drives the brass (due-to-act) tone — distinct from the
 *  amber DRIFT tone, so the two attention signals never collide. Null = no due
 *  date (honest gap: no cadence/anchor yet → no manufactured alarm). */
function etaLabel(dueISO: string | undefined, now: number, ko: boolean): { text: string; overdue: boolean } | null {
  if (!dueISO) return null;
  const due = new Date(`${dueISO}T00:00:00`).getTime();
  if (Number.isNaN(due)) return null;
  const today = new Date(new Date(now).toISOString().slice(0, 10) + 'T00:00:00').getTime();
  const d = Math.round((due - today) / 86_400_000);
  if (d > 0) return { text: ko ? `다음 확인 D-${d}` : `next check in ${d}d`, overdue: false };
  if (d === 0) return { text: ko ? '오늘 확인 예정' : 'check due today', overdue: true };
  return { text: ko ? `확인 기한 ${-d}일 지남` : `check ${-d}d overdue`, overdue: true };
}

/**
 * A DECISION node — a rounded-square "sealed record" tile, mirroring
 * VoyageMarker's plate finish (same gradient/border/shadow) but square, so a
 * decision is instantly distinct from a round premise. A settled decision wears
 * a brass check; a live one, a foam document glyph.
 */
function DecisionTile({ size, completed, title }: { size: number; completed: boolean; title: string }) {
  const glyph = Math.max(10, Math.round(size * 0.5));
  return (
    <span
      aria-label={title}
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
        background: completed
          ? 'radial-gradient(circle at 35% 28%, #174845 0%, #082a29 58%, #051b1b 100%)'
          : 'radial-gradient(circle at 35% 28%, #123c3a 0%, #072625 58%, #041918 100%)',
        border: `1px solid ${completed ? N.brass : N.foam}`,
        boxShadow: `inset 0 0 0 1px ${N.foam}16, 0 2px 7px #00100fb8`,
      }}
    >
      {completed ? (
        <Check size={glyph} color={N.brass} strokeWidth={2.4} aria-hidden />
      ) : (
        <FileText size={glyph} color={N.foam} strokeWidth={1.9} aria-hidden />
      )}
    </span>
  );
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
  const ko = locale === 'ko';
  const now = Date.now();
  const [hubsOnly, setHubsOnly] = useState(false);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  // Hover-to-trace: pointing at any node lights its own edges + neighbours and
  // dims the rest, so "what connects to what" is explorable without committing
  // to focus mode. Presentation-only; the graph data never changes.
  const [hovered, setHovered] = useState<string | null>(null);

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

  // The traced node (hover) and everything one edge away from it. Empty set ⇒
  // nothing is dimmed (the resting state shows the whole map).
  const litNodes = new Set<string>();
  if (hovered) {
    litNodes.add(hovered);
    for (const e of layout.edges) {
      if (e.premise === hovered || e.decision === hovered) {
        litNodes.add(e.premise);
        litNodes.add(e.decision);
      }
    }
  }
  const isLit = (id: string) => litNodes.size === 0 || litNodes.has(id);
  const edgeLit = (e: { premise: string; decision: string }) =>
    litNodes.size === 0 || e.premise === hovered || e.decision === hovered;

  return (
    <section aria-labelledby="portfolio-map-h" className="mt-10">
      {/* Static component-scoped keyframes (no user data). A hot edge's dashes
          crawl outward from the moved premise — the movement it caused is
          literally travelling down to the bets that rest on it. */}
      <style>{`
        @keyframes jg-flow { to { stroke-dashoffset: -10 } }
        .jg-hot-edge { animation: jg-flow 1.1s linear infinite }
        .jg-node { transition: opacity .2s ease }
        @media (prefers-reduced-motion: reduce) { .jg-hot-edge { animation: none } }
      `}</style>
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
            {/* rests-on edges. Cold = quiet dashed hairline; hot = amber
                dashes crawling outward from the moved premise. Edges not
                touching the traced node dim so a hover reads as one clean web. */}
            <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 z-[1] h-full w-full">
              {layout.edges.map((e) => (
                <line
                  key={e.id}
                  className={e.hot ? 'jg-hot-edge' : undefined}
                  x1={e.x1}
                  y1={e.y1}
                  x2={e.x2}
                  y2={e.y2}
                  stroke={e.hot ? N.edgeHot : N.edge}
                  strokeWidth={e.hot ? 1.3 : 0.8}
                  strokeDasharray={e.hot ? '3 2.2' : '1.5 2'}
                  vectorEffect="non-scaling-stroke"
                  style={{ opacity: edgeLit(e) ? 1 : 0.1, transition: 'opacity .2s ease' }}
                />
              ))}
            </svg>

            {/* premise (round) + decision (square) nodes */}
            {layout.nodes.map((node) => {
              const label =
                node.kind === 'premise' ? node.premise!.text : node.decision!.title;
              const title = node.kind === 'premise' ? `「${label}」` : label;
              const lit = isLit(node.id);

              if (node.kind === 'decision') {
                const origin = node.decision!.origin;
                const recency = daysAgoLabel(node.decision!.lastActivity, now, ko);
                const decTitle = `${title} · ${originLabel(origin, ko)}${recency ? ` · ${recency}` : ''}`;
                return (
                  <div
                    key={node.id}
                    className="jg-node absolute z-[2] flex flex-col items-center"
                    style={{ left: `${node.x}%`, top: `${node.y}%`, transform: 'translate(-50%,-50%)', opacity: lit ? 1 : 0.22 }}
                    title={decTitle}
                    onMouseEnter={() => setHovered(node.id)}
                    onMouseLeave={() => setHovered((h) => (h === node.id ? null : h))}
                  >
                    <DecisionTile size={node.size} completed={!node.decision!.live} title={decTitle} />
                    {showsLabel(node) && (
                      <span
                        className="mt-1 max-w-[110px] text-center text-[10px] leading-tight"
                        style={{ color: '#f5f0e5b0' }}
                      >
                        {clip(label, 26)}
                      </span>
                    )}
                    {/* SOURCE axis — a quiet honest tag (웹 / MCP·CLI / 미상). Text,
                        not a new colour/shape channel, so the circle-vs-square
                        distinction stays the load-bearing one. */}
                    {showsLabel(node) && (
                      <span
                        className="mt-0.5 rounded-sm px-1 text-[8.5px] font-mono uppercase tracking-wide"
                        style={{
                          color: origin === 'unknown' ? '#f5f0e566' : '#d8ad55c0',
                          background: '#f5f0e50f',
                        }}
                      >
                        {originLabel(origin, ko)}
                      </span>
                    )}
                  </div>
                );
              }

              const isHub = node.premise!.degree >= 2;
              const d = node.premise!.drift;
              const delta =
                d && typeof d.baseline_numeric === 'number' && typeof d.current_numeric === 'number'
                  ? `${d.baseline_numeric} → ${d.current_numeric}`
                  : null;
              const eta = etaLabel(node.premise!.recheckDue, now, ko);

              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => setFocusKey(node.premise!.key)}
                  onMouseEnter={() => setHovered(node.id)}
                  onMouseLeave={() => setHovered((h) => (h === node.id ? null : h))}
                  onFocus={() => setHovered(node.id)}
                  onBlur={() => setHovered((h) => (h === node.id ? null : h))}
                  title={title}
                  aria-label={L(`전제 집중: ${label}`, `Focus premise: ${label}`)}
                  className="jg-node absolute z-[3] flex flex-col items-center bg-transparent cursor-pointer"
                  style={{ left: `${node.x}%`, top: `${node.y}%`, transform: 'translate(-50%,-50%)', opacity: lit ? 1 : 0.22 }}
                >
                  {/* the drift value, inline — so "현실에서 움직였다" reads without
                      a click: this footing's number went baseline → today. */}
                  {node.hot && delta && (
                    <span
                      className="mb-1 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold tabular-nums"
                      style={{ background: '#e39a561f', color: N.amber, border: '1px solid #e39a5640' }}
                    >
                      {delta}
                    </span>
                  )}
                  <VoyageMarker state={node.hot ? 'adrift' : 'docked'} size={node.size} title={title} />
                  {showsLabel(node) && (
                    <span
                      className="mt-1 max-w-[130px] text-center text-[10.5px] leading-tight"
                      style={{ color: isHub ? N.foam : '#f5f0e59a', fontWeight: isHub ? 600 : 400 }}
                    >
                      「{clip(label, isHub ? 40 : 22)}」
                    </span>
                  )}
                  {/* ETA axis — the re-check due read as a voyage ETA, on the
                      load-bearing hubs only. Brass when overdue (due to act),
                      quiet ivory when still ahead. A fact, not a verdict. */}
                  {showsLabel(node) && isHub && eta && (
                    <span
                      className="mt-0.5 text-center text-[8.5px] font-medium tabular-nums"
                      style={{ color: eta.overdue ? N.brass : '#f5f0e566' }}
                    >
                      {eta.text}
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
          <div className="flex flex-col items-end gap-0.5 text-right">
            {(() => {
              const last = daysAgoLabel(focus.ground.last_activity, now, ko);
              const eta = etaLabel(focus.ground.recheck_due, now, ko);
              if (!last && !eta) return null;
              return (
                <p className="text-[11px] tabular-nums" style={{ color: eta?.overdue ? undefined : 'var(--text-tertiary)' }}>
                  {last && <span style={{ color: 'var(--text-tertiary)' }}>{L('마지막으로 ', 'last ')}{last}</span>}
                  {last && eta && <span style={{ color: 'var(--text-tertiary)' }}> · </span>}
                  {eta && <span style={{ color: eta.overdue ? 'var(--warning)' : 'var(--text-tertiary)', fontWeight: eta.overdue ? 600 : 400 }}>{eta.text}</span>}
                </p>
              );
            })()}
            {focus.ground.record && (
              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
                {L(
                  `이 전제로 돌아와 답한 기록 ${focus.ground.record.revisited}건`,
                  `${focus.ground.record.revisited} record${focus.ground.record.revisited === 1 ? '' : 's'} revisited on this ground`,
                )}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-2 flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-3 w-3 rounded-full" style={{ border: '1.5px solid var(--text-secondary)' }} />
              {L('동그라미 = 전제(딛고 선 자리)', 'circle = premise (the footing)')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-3 w-3" style={{ border: '1.5px solid var(--text-secondary)', borderRadius: 3 }} />
              {L('사각 = 결정(기록)', 'square = decision (a record)')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-3 w-3 rounded-full" style={{ background: N.amber }} />
              {L('호박색 = 봉인 뒤 현실이 그만큼 움직임', 'amber = reality moved it since sealing')}
            </span>
          </div>
          <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
            {L(
              '결정 밑 작은 표: 웹 = 웹에서 올린 문서 · MCP·CLI = 터미널에서 온 것 · 미상 = 출처를 알 수 없음(아직 Claude Code↔Codex 구분은 없어요). 허브 밑 “다음 확인 D-N”은 그 전제를 다시 확인할 항해 ETA — 기한이 지나면 브라스색 “확인 기한 지남”으로 바뀝니다.',
              'The tag under a decision: web = uploaded on the web · MCP·CLI = came from a terminal · unknown = surface not recorded (Claude Code vs Codex isn’t distinguished yet). "next check in N days" under a hub is that premise’s re-check ETA — it turns brass ("check overdue") once the date passes.',
            )}
          </p>
          <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
            {L(
              '점에 마우스를 올리면 무엇과 연결됐는지 밝아지고, 전제를 누르면 그 위에 선 열린 내기가 열립니다. 색은 사실만 — 호박색도 “틀렸다”가 아니라 “여기 봐라”입니다.',
              'Hover any point to light what it connects to; click a premise to open the bets standing on it. Color is fact-only — amber says “look here,” never “you were wrong.”',
            )}
          </p>
        </div>
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
