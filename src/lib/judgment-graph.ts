/**
 * Judgment graph — cross-receipt relationships, derived deterministically.
 *
 * v1 models ONE relationship: SHARED GROUND. Several judgments can stand on
 * the same premise (same fact, same evidence). When that ground moves, the
 * blast radius is a portfolio question no single-receipt surface can answer:
 * "which of my live bets are standing on the thing that just moved?"
 *
 * This is the web counterpart of the MCP ledger's `groupDuePremises` /
 * `matchingMonitoredPremises` (argus-mcp/src/lib/premises.ts) — the SAME
 * matching rule, `normalizePremiseText` exact equality. No fuzzy matching,
 * no LLM inference: a relationship exists only where the ledgers literally
 * assert the same normalized sentence. (Honest structure: a broken wire here
 * yields a MISSING group in tests, never a fabricated relation.)
 *
 * Spine (CLAUDE.md Zero-Judgment):
 *  - The spotlight fires only on a REAL event (a recorded drifted re-check on
 *    shared ground with live dependents). No drift → null → render nothing.
 *    Manufacturing a daily "insight" out of flat data is over-fire.
 *  - Output is facts + counts (which premise, sealed baseline → today's value,
 *    source, which bets, their check-by dates). Never a score, never advice.
 */

import type { JudgmentReceipt, FalsifiableFollowup } from '@/lib/review';
import {
  isMonitored,
  nextRecheckDue,
  normalizePremiseText,
  type PremiseState,
} from '@/lib/premises-core';

export interface GroundMember {
  receipt_id: string;
  source_title: string;
  premise: PremiseState;
}

export interface LiveBet {
  receipt_id: string;
  source_title: string;
  followup_id: string;
  predicate: string;
  /** YYYY-MM-DD */
  check_by: string;
}

/** The most recent drifted re-check on this ground, flattened for display. */
export interface GroundDrift {
  finding: string;
  baseline_text?: string;
  current_text?: string;
  baseline_numeric?: number;
  current_numeric?: number;
  source?: string;
  source_detail?: string;
  ts?: string;
}

/** Neutral revisit inventory for records standing on this ground. Outcome
 * buckets are intentionally absent: a held/broke tally becomes a proxy score
 * even when it is introduced as "facts only". */
export interface GroundRecord {
  revisited: number;
}

export interface SharedGround {
  /** normalizePremiseText key — the identity of the ground. */
  key: string;
  /** Representative original wording (first member's). */
  text: string;
  members: GroundMember[];
  /** Sealed, unsettled predicates on member receipts — what stands on this ground. */
  live_bets: LiveBet[];
  drift?: GroundDrift;
  /** Settled outcomes of the bets on this ground (execution tier). Absent when
   *  nothing has settled yet — an honest gap, never a fabricated 0-of-0 grade. */
  record?: GroundRecord;
  /** RECENCY axis (BLUEPRINT §9.9 V2, axis #3): the most recent ISO timestamp
   *  this ground was touched — the latest re-check among its member premises,
   *  falling back to a premise's own add-time. Absent = never re-checked and no
   *  add-time recorded (an honest gap; the surface computes "N일 전" from it, and
   *  this module stays pure — no Date.now here). A fact, never a verdict. */
  last_activity?: string;
  /** ETA axis (BLUEPRINT §9.9 V2, founder 2026-07-22 항해 ETA): the SOONEST
   *  YYYY-MM-DD any premise on this ground next comes due for a reality re-check
   *  (nextRecheckDue, the pinned cadence). The surface renders it as a voyage
   *  ETA — "다음 확인 D-N" ahead, "확인 기한 지남" past. Absent = no cadence/anchor
   *  yet (honest gap, no manufactured alarm). Pure date arithmetic, no clock read. */
  recheck_due?: string;
}

/** The armed rule — same expression as review-sync.ts / PremiseTracker.tsx.
 *  (Sealing the receipt, or sealing a follow-up, is what puts bets in play.) */
export function receiptIsLive(r: JudgmentReceipt): boolean {
  const followups = r.falsifiable_followups ?? [];
  return r.state === 'sealed' || followups.some((f) => f.sealed_at && !f.settled_at);
}

function openSealedFollowups(r: JudgmentReceipt): FalsifiableFollowup[] {
  return (r.falsifiable_followups ?? []).filter((f) => f.sealed_at && !f.settled_at);
}

function driftOf(p: PremiseState): GroundDrift | null {
  const rc = p.last_recheck;
  if (!rc || !rc.drifted) return null;
  return {
    finding: rc.finding,
    baseline_text: rc.baseline_finding,
    current_text: rc.finding,
    baseline_numeric: rc.baseline_numeric_value,
    current_numeric: rc.numeric_value,
    source: rc.source,
    source_detail: rc.source_detail,
    ts: rc.ts,
  };
}

/**
 * Group active monitored premises across receipts by normalized text.
 * A ground is SHARED only when ≥ 2 distinct receipts carry it — a premise
 * appearing under one receipt is that receipt's own business (PremiseTracker
 * already covers it; duplicating it here would be noise).
 *
 * Sort: drifted grounds first, then most live bets, then widest membership.
 */
export function sharedGrounds(
  receipts: JudgmentReceipt[],
  opts: { minMembers?: number } = {},
): SharedGround[] {
  // Default ≥2 (a SHARED ground). The portfolio graph passes 1 to get EVERY
  // premise as a node — a degree-1 premise is a leaf, a shared one is a hub.
  const minMembers = opts.minMembers ?? 2;
  const byKey = new Map<string, SharedGround>();

  for (const r of receipts ?? []) {
    for (const p of r.tracked_premises ?? []) {
      if (!isMonitored(p)) continue;
      const key = normalizePremiseText(p.text);
      if (!key) continue;
      let g = byKey.get(key);
      if (!g) {
        g = { key, text: p.text, members: [], live_bets: [] };
        byKey.set(key, g);
      }
      g.members.push({ receipt_id: r.receipt_id, source_title: r.source_title, premise: p });
    }
  }

  const grounds: SharedGround[] = [];
  for (const g of byKey.values()) {
    const distinct = new Set(g.members.map((m) => m.receipt_id));
    if (distinct.size < minMembers) continue;

    // Live bets standing on this ground (dedup receipts; a receipt can carry
    // several open predicates — each is its own bet).
    const seen = new Set<string>();
    for (const m of g.members) {
      if (seen.has(m.receipt_id)) continue;
      seen.add(m.receipt_id);
      const r = (receipts ?? []).find((x) => x.receipt_id === m.receipt_id);
      if (!r || !receiptIsLive(r)) continue;
      for (const f of openSealedFollowups(r)) {
        g.live_bets.push({
          receipt_id: r.receipt_id,
          source_title: r.source_title,
          followup_id: f.followup_id,
          predicate: f.predicate,
          check_by: f.check_by,
        });
      }
    }
    g.live_bets.sort((a, b) => (a.check_by < b.check_by ? -1 : 1));

    // Most recent drifted re-check among members = the ground's drift.
    let drift: GroundDrift | undefined;
    for (const m of g.members) {
      const d = driftOf(m.premise);
      if (d && (!drift || (d.ts ?? '') > (drift.ts ?? ''))) drift = d;
    }
    if (drift) g.drift = drift;

    // Neutral revisit count. Preserve individual answers on their own records,
    // but never roll them up into held/broke/mixed buckets here.
    const recSeen = new Set<string>();
    let revisited = 0;
    for (const m of g.members) {
      if (recSeen.has(m.receipt_id)) continue;
      recSeen.add(m.receipt_id);
      const r = (receipts ?? []).find((x) => x.receipt_id === m.receipt_id);
      if (!r) continue;
      for (const f of r.falsifiable_followups ?? []) {
        if (!f.settled_at || !f.outcome || f.outcome === 'unclear') continue;
        revisited += 1;
      }
    }
    if (revisited > 0) g.record = { revisited };

    // RECENCY (axis #3): latest touch on this ground — most recent member
    // re-check ts, else a member's add-time. Pure string max (ISO sorts lexically).
    let lastActivity = '';
    for (const m of g.members) {
      const t = m.premise.last_recheck?.ts || m.premise.added_ts || '';
      if (t > lastActivity) lastActivity = t;
    }
    if (lastActivity) g.last_activity = lastActivity;

    // ETA: the soonest next re-check due among members — the most urgent
    // reality-check this ground owes. (Date-only strings sort lexically.)
    let due = '';
    for (const m of g.members) {
      const d = nextRecheckDue(m.premise);
      if (d && (!due || d < due)) due = d;
    }
    if (due) g.recheck_due = due;

    grounds.push(g);
  }

  grounds.sort((a, b) => {
    if (!!b.drift !== !!a.drift) return b.drift ? 1 : -1;
    if (b.live_bets.length !== a.live_bets.length) return b.live_bets.length - a.live_bets.length;
    return b.members.length - a.members.length;
  });
  return grounds;
}

/**
 * The one event worth a tier-1 surface: shared ground that has actually
 * DRIFTED while live bets stand on it. Null on a flat day — the restraint
 * default is silence, not a manufactured highlight.
 */
export function groundSpotlight(receipts: JudgmentReceipt[]): SharedGround | null {
  const g = sharedGrounds(receipts)[0];
  return g && g.drift && g.live_bets.length >= 1 ? g : null;
}

/**
 * For a single premise: how many OTHER receipts carry the same ground.
 * (PremiseTracker's quiet cross-link line — a count, nothing more.)
 */
export function sharedGroundCount(
  receipts: JudgmentReceipt[],
  ownReceiptId: string,
  premiseText: string,
): number {
  const key = normalizePremiseText(premiseText ?? '');
  if (!key) return 0;
  const others = new Set<string>();
  for (const r of receipts ?? []) {
    if (r.receipt_id === ownReceiptId) continue;
    for (const p of r.tracked_premises ?? []) {
      if (isMonitored(p) && normalizePremiseText(p.text) === key) others.add(r.receipt_id);
    }
  }
  return others.size;
}
