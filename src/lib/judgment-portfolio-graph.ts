/**
 * Portfolio judgment graph (BLUEPRINT §9.9 V2a, founder redesign 2026-07-21).
 *
 * The founder's vision, corrected from the first cut: NOT "the shared ground is
 * the protagonist" — the MAP itself is. Every premise is a visible node, every
 * decision is a visible node, and the "rests-on" links are drawn so you can
 * browse each premise and see what stands on it (and, through decisions, which
 * other premises are co-used). A SHARED ground is not a special surface here —
 * it simply shows up as a premise node with degree ≥ 2 (a hub). Drift is a
 * visual emphasis on the map, never its subject.
 *
 * Built by REUSING sharedGrounds with minMembers:1 (single source of truth for
 * the premise-grouping, drift, settled record, and live-bet computation) — a
 * premise node IS a ground; a degree-1 premise is a leaf, a shared one a hub.
 *
 * PURE and deterministic (no time/random/DOM). The layout + component add the
 * positions, theme, and interaction on top.
 *
 * SPINE: facts + counts only (degree, live bets, held/broke tally, drift).
 * Nothing here computes a grade or a verdict about the user.
 */
import type { JudgmentReceipt, SourceKind } from '@/lib/review';
import { sharedGrounds, receiptIsLive, type GroundDrift, type GroundRecord } from './judgment-graph';

/**
 * SOURCE axis (BLUEPRINT §9.9 V2, axis #2) — HONEST scope (founder 2026-07-22:
 * "정직 라벨, 경계 안"). The blueprint asked for a Claude Code / Codex / web
 * tag, but no agent-surface signal exists on a receipt (only `source_kind`, a
 * document-input discriminator) and wiring a real one would cross V2's 무접촉
 * 경계 (plugin/MCP/schema). So we surface only what the data honestly supports:
 *   - `web`     — a document pasted/uploaded through the web review door.
 *   - `mcp_cli` — came in through the MCP/CLI door (`mcp_file`).
 *   - `unknown` — the input kind doesn't disclose a surface (`pr_diff`,
 *                 `llm_answer`, or absent). NEVER guessed.
 * The finer Claude Code vs Codex split is a DISCLOSED GAP, blocked on an
 * upstream signal outside this track. Honest gap over fabrication.
 */
export type DecisionOrigin = 'web' | 'mcp_cli' | 'unknown';

export function decisionOrigin(sourceKind?: SourceKind): DecisionOrigin {
  switch (sourceKind) {
    case 'mcp_file':
      return 'mcp_cli';
    case 'paste':
    case 'markdown':
    case 'txt':
    case 'pdf':
    case 'docx':
    case 'pptx':
    case 'hwpx':
    case 'image':
    case 'transcript':
      return 'web';
    // 'pr_diff' / 'llm_answer' / undefined → the surface is genuinely unknown.
    default:
      return 'unknown';
  }
}

export interface PremiseNode {
  id: string;
  kind: 'premise';
  key: string;
  text: string;
  /** distinct decisions resting on it (recurrence / hub-ness). */
  degree: number;
  /** open sealed bets standing on it (live structural exposure). */
  liveBets: number;
  drift?: GroundDrift;
  record?: GroundRecord;
  /** RECENCY axis: latest ISO ts this ground was touched (from its members'
   *  re-check / add-time). Absent = honest gap. The surface prints "N일 전". */
  lastActivity?: string;
  /** ETA axis: the soonest YYYY-MM-DD this ground is next due for a re-check.
   *  The surface renders it as a voyage ETA ("다음 확인 D-N" / "확인 기한 지남"). */
  recheckDue?: string;
}

export interface DecisionNode {
  id: string;
  kind: 'decision';
  receiptId: string;
  title: string;
  /** sealed or carrying an open bet — vs fully settled. */
  live: boolean;
  /** SOURCE axis (honest): which door this decision came through. */
  origin: DecisionOrigin;
  /** RECENCY axis: the receipt's last-updated ISO ts. Absent = honest gap. */
  lastActivity?: string;
}

export type PortfolioNode = PremiseNode | DecisionNode;

export interface PortfolioEdge {
  id: string;
  /** DecisionNode id. */
  decision: string;
  /** PremiseNode id. */
  premise: string;
  /** the premise drifted since seal — the link runs hot (amber). */
  hot: boolean;
}

export interface PortfolioGraph {
  premises: PremiseNode[];
  decisions: DecisionNode[];
  edges: PortfolioEdge[];
}

export function judgmentPortfolioGraph(receipts: JudgmentReceipt[]): PortfolioGraph {
  // minMembers:1 → EVERY monitored premise becomes a node, not only shared ones.
  const grounds = sharedGrounds(receipts, { minMembers: 1 });
  const receiptById = new Map((receipts ?? []).map((r) => [r.receipt_id, r]));

  const premises: PremiseNode[] = [];
  const decisionIds = new Set<string>();
  const titleByReceipt = new Map<string, string>();
  const edges: PortfolioEdge[] = [];

  for (const g of grounds) {
    const distinct = [...new Set(g.members.map((m) => m.receipt_id))];
    premises.push({
      id: `premise:${g.key}`,
      kind: 'premise',
      key: g.key,
      text: g.text,
      degree: distinct.length,
      liveBets: g.live_bets.length,
      drift: g.drift,
      record: g.record,
      lastActivity: g.last_activity,
      recheckDue: g.recheck_due,
    });
    for (const m of g.members) {
      if (!titleByReceipt.has(m.receipt_id)) titleByReceipt.set(m.receipt_id, m.source_title);
    }
    for (const rid of distinct) {
      decisionIds.add(rid);
      edges.push({
        id: `${rid}::${g.key}`,
        decision: `decision:${rid}`,
        premise: `premise:${g.key}`,
        hot: Boolean(g.drift),
      });
    }
  }

  const decisions: DecisionNode[] = [];
  for (const rid of decisionIds) {
    const r = receiptById.get(rid);
    decisions.push({
      id: `decision:${rid}`,
      kind: 'decision',
      receiptId: rid,
      title: r?.source_title || titleByReceipt.get(rid) || rid,
      live: r ? receiptIsLive(r) : false,
      origin: decisionOrigin(r?.source_kind),
      lastActivity: r?.updated_at || undefined,
    });
  }

  return { premises, decisions, edges };
}
