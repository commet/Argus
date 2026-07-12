'use client';

import { useMemo } from 'react';
import {
  getVoyageState,
  daysUntilWreck,
  wreckPin,
  VOYAGE_STATE_META,
  type VoyageLeg,
  type VoyageState,
} from '@/lib/voyage-state';
import { contractStatus } from '@/lib/decision-contract';
import { firstVoyageInscription } from '@/lib/record-summary';
import { sharedGrounds, groundSpotlight } from '@/lib/judgment-graph';
import type { JudgmentReceipt } from '@/lib/review';
import type {
  Project,
  ReframeItem,
  RecastItem,
  SynthesizeItem,
  FeedbackRecord,
  ProgressiveSession,
} from '@/stores/types';

/**
 * VoyageSea — the project overview rendered as a NIGHT SEA under a lighthouse.
 * Replaces FleetChart (the single-line band the founder killed on 07-10).
 *
 * The founder's brief: the WHOLE top of the screen is the user's journey map —
 * ships under way, ships gone quiet, ships home — legible at a glance, never
 * chaotic. Position encodes state:
 *
 *          ┌────────────────────────────── 먼바다 (sailing) ──┐
 *   표류 → │ left margin: adrift, pushed off the lanes        │
 *          │        ◆ beacon — the due decision, beam-lit     │
 *   여울 → │ shoal (bottom-left): wrecked, aground, dimmed    │
 *          └── 항구 quay: arrived/verified moored · pier: docked ┘
 *
 * SPINE (거울 조항, rewritten for this surface — the old FleetChart test pinned
 * "no state grouping"; the founder explicitly re-decided that for this map, and
 * voyage-sea.test.tsx pins the NEW gate):
 *  - Emphasis is by ATTENTION only, never by verdict. The ONE enlarged, gold,
 *    beam-lit ship is the ship whose CHECK-IN DATE the user themselves promised
 *    (useDueCount → dueProjectIds). Wrecked/adrift are DIMMED, never enlarged,
 *    never red — 난파 is a derived emotional state, refloated by opening it.
 *  - No score / % / grade / streak / comparison string anywhere on the sheet.
 *  - The beacon notice quotes the user's OWN sealed predicate verbatim (honest
 *    provenance); when the contract has no predicate text we say so plainly
 *    instead of inventing a stand-in (honest gap over fabrication).
 *  - Ships are click-to-open only. The single CTA lives on the beacon notice
 *    and routes to the same settle surface as the due strip below.
 *  - Quiet sea = quiet sheet: with nothing due there is no beacon, no notice,
 *    and the caption says "부를 배가 없어요" — restraint, not manufactured urgency.
 *
 * CRAFT constraints (07-11 session): no hand-authored SVG art — the scene is
 * pure CSS geometry (clip-path sails, gradient water, conic beam). The plate is
 * a committed-dark nocturne in the engraved-logbook family; its internal palette
 * is theme-stable ON PURPOSE (a framed night painting on the parchment page),
 * while everything under the plate uses page tokens and pairs with both themes.
 */

// ── nocturne plate palette (internal, theme-stable — see header comment) ──
const N = {
  seaHi: '#201c16',
  sea: '#15110b',
  seaDeep: '#0e0b07',
  land: '#0b0906',
  paper: '#e8dcc3', // etched light — matches the dark-mode ink token for family kinship
  gold: '#d4b968', // plate-internal gold (deliberately NOT the landing ceremony token)
};

const DAY_MS = 86_400_000;

// Project-list step index → voyage leg (page order: reframe, recast, rehearse, synthesize)
const STEP_IDX_TO_LEG: ReadonlyArray<VoyageLeg> = ['reframe', 'recast', 'rehearse', 'synthesize'];

interface SeaShip {
  id: string;
  name: string;
  /** Which harbor the vessel sailed from — a project voyage or a sealed
   *  review/MCP receipt. One sea; the kind only routes the click. */
  kind: 'project' | 'receipt';
  state: VoyageState;
  /** The one promised return: this ship's check-in date has arrived. */
  due: boolean;
  /** Days past / until check-in (negative = still ahead), when promised. */
  dueDays: number | null;
  /** The user's own sealed bet text, for the beacon quote. Null = none sealed. */
  premise: string | null;
  /** One quiet fact line under the name (state · elapsed), locale-resolved. */
  sub: string;
  /** Y-axis value 0..1 (1 = home/resolved). Derived from state via RESOLUTION. */
  resolution: number;
  /** Days since last activity — the X-axis (recency) input. */
  idleDays: number;
  createdAt: string;
}

/**
 * ── THE CHART'S TWO AXES (2026-07-12: 슬롯 스캐터 → 좌표계) ─────────────────
 * The sea is a scatter plot wearing a nautical skin. Every ship's position is
 * COMPUTED from its own data on two orthogonal axes, so the layout is a system
 * (scales from 3 ships to 60, position carries meaning) rather than hand-placed
 * scenery:
 *
 *   Y = RESOLUTION — how close the voyage is to closing its loop.
 *       bottom = 항구 (arrived / verified / at the pier), top = 먼바다 (out,
 *       unresolved). Monotonic in the derived state.
 *   X = ACTIVITY RECENCY — right = 최근에 손댐, left = 오래 손 놓음
 *       (log-scaled idle days, normalized across the fleet).
 *
 * The payoff the founder asked for — "직관적으로 놓친 프로젝트" — falls out of the
 * geometry: unresolved (high) + long-untended (left) ⇒ the TOP-LEFT waters.
 * A finished voyage moored at the bottom is safe no matter how old (X is just
 * moorage order there). Nothing is grouped or ranked by success; the danger
 * corner is "untended", never "failed" (거울 조항).
 */
const RESOLUTION: Record<VoyageState, number> = {
  verified: 0.98, // reckoned — fully home
  arrived: 0.88, // landed, awaiting reckoning
  docked: 0.80, // still at the pier — never sailed (home, low urgency)
  sailing: 0.46, // out on the voyage
  adrift: 0.30, // drifted off the lane
  wrecked: 0.15, // far out, long lost
};

/** Deterministic sub-pixel jitter from an id, so ships sharing a cell don't
 *  stack. Small (±) — never enough to cross an axis band. */
function hashJitter(id: string): { jx: number; jy: number } {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = (h ^ id.charCodeAt(i)) * 16777619;
  const a = ((h >>> 0) % 1000) / 1000;
  const b = ((h >>> 11) % 1000) / 1000;
  return { jx: (a - 0.5) * 8.5, jy: (b - 0.5) * 5.5 };
}

/** The plate's fixed aspect on sm+ (aspect-[16/7.2]) — lets current chords be
 *  computed as pure math (angle/length from % coords), no layout measurement.
 *  Height of the plate expressed in width-percent units: 100 / (16/7.2). */
const PLATE_H_IN_W = 45;

/** An undersea current — a shared premise literally connecting the ships that
 *  stand on it (judgment graph, normalized-text equality; nothing inferred). */
interface SeaCurrent {
  key: string;
  text: string;
  drifted: boolean;
  /** Chained chord segments between adjacent member ships, precomputed. */
  segs: Array<{ x: number; y: number; len: number; deg: number }>;
}

function relativeDays(iso: string, now: number, locale: 'ko' | 'en'): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const d = Math.floor((now - t) / DAY_MS);
  if (locale === 'ko') return d <= 0 ? '오늘' : d === 1 ? '어제' : `${d}일 전`;
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d}d ago`;
}

/** The ship silhouette — pure CSS geometry (hull crescent, mast, clip-path
 *  sails). State changes posture and finish, never adds badges:
 *  sailing = full canvas · adrift = luffing, heeled, faded · wrecked = bare
 *  heeled hull, half-lost · docked/arrived = furled at moorings · verified =
 *  furled + a fleck of gold at the masthead · beacon = gold canvas + halo.
 *
 *  Craft (07-12 고급화):
 *  - Every floating ship casts a REFLECTION on the water (mirrored silhouette,
 *    masked fade). Moored ships reflect more sharply than ships under way —
 *    calm water against the quay. Wrecks, aground on the shoal, cast none.
 *  - `heading` (deterministic per-ship, ±3°) breaks the stamped-fleet look.
 *  - The ENSIGN tells the door the vessel sailed from — an honest fact, not a
 *    grade: project voyages fly a triangular pennant, review/MCP receipts a
 *    small rectangular flag. */
function ShipMark({
  state,
  due,
  size,
  kind = 'project',
  heading = 0,
  plain = false,
}: {
  state: VoyageState;
  due: boolean;
  size: number;
  kind?: 'project' | 'receipt';
  heading?: number;
  /** Key/legend usage — silhouette only, no wake and no reflection. */
  plain?: boolean;
}) {
  const w = size;
  const h = Math.round(size * 1.12);
  const sail = due ? N.gold : N.paper;
  const heel = state === 'adrift' ? -11 : heading;

  if (state === 'wrecked') {
    // Aground on the shoal: heeled bare hull + stump of mast, sinking into the
    // hatch. Dimmed — never enlarged, never colored as failure. No reflection:
    // she is out of the water.
    return (
      <span aria-hidden className="relative block" style={{ width: w, height: h, opacity: 0.5 }}>
        <span className="absolute block" style={{ left: '8%', right: '8%', bottom: '18%', height: '17%', background: N.paper, borderRadius: '2px 2px 12px 12px / 2px 2px 100% 100%', transform: 'rotate(21deg)' }} />
        <span className="absolute block" style={{ left: '52%', bottom: '30%', width: 1.5, height: '34%', background: N.paper, transform: 'rotate(28deg)' }} />
      </span>
    );
  }

  const furled = state === 'docked' || state === 'arrived' || state === 'verified';
  const silhouette = (
    <>
      {/* hull */}
      <span className="absolute block" style={{ left: '6%', right: '6%', bottom: 0, height: '16%', background: N.paper, borderRadius: '2px 2px 12px 12px / 2px 2px 100% 100%' }} />
      {/* mast */}
      <span className="absolute block" style={{ left: '50%', bottom: '14%', width: 1.5, height: '74%', background: N.paper, transform: 'translateX(-50%)' }} />
      {furled ? (
        // canvas struck and lashed along the boom — a ship at her moorings.
        <>
          <span className="absolute block" style={{ left: '34%', bottom: '30%', width: '34%', height: '8%', background: sail, opacity: 0.9, borderRadius: 2 }} />
          <span className="absolute block" style={{ left: '42%', bottom: '40%', width: '22%', height: '5%', background: sail, opacity: 0.6, borderRadius: 2 }} />
        </>
      ) : (
        <>
          {/* mainsail — vertical luff on the mast, clew trailing aft */}
          <span
            className="absolute block"
            style={{
              left: '52%', bottom: '22%', width: '42%', height: '64%',
              background: sail, opacity: state === 'adrift' ? 0.3 : 0.95,
              clipPath: 'polygon(0% 0%, 0% 100%, 100% 96%)',
            }}
          />
          {/* jib — struck when the wind is lost */}
          {state !== 'adrift' && (
            <span
              className="absolute block"
              style={{
                right: '52%', bottom: '22%', width: '30%', height: '46%',
                background: sail, opacity: 0.8,
                clipPath: 'polygon(100% 0%, 100% 100%, 0% 96%)',
              }}
            />
          )}
        </>
      )}
      {/* ensign — pennant for a project voyage, rectangular flag for a receipt */}
      {kind === 'receipt' ? (
        <span className="absolute block" style={{ left: '52%', top: '2%', width: '26%', height: '9%', background: sail, opacity: 0.85, borderRadius: 0.5 }} />
      ) : state === 'verified' ? (
        <span className="absolute block" style={{ left: '50%', top: 0, width: 4, height: 4, background: N.gold, borderRadius: 1 }} />
      ) : null}
    </>
  );

  return (
    <span aria-hidden className="relative block" style={{ width: w, height: h, transform: heel ? `rotate(${heel}deg)` : undefined }}>
      {/* wake — only a ship under way leaves one */}
      {state === 'sailing' && !plain && (
        <>
          <span className="absolute block" style={{ left: '-52%', bottom: '9%', width: '48%', height: 1, background: `linear-gradient(to right, transparent, ${N.paper}66)` }} />
          <span className="absolute block" style={{ left: '-34%', bottom: '3%', width: '30%', height: 1, background: `linear-gradient(to right, transparent, ${N.paper}44)` }} />
        </>
      )}
      {silhouette}
      {/* reflection — the whole silhouette mirrored below the waterline,
          fading with depth. Calmer water at the moorings → a slightly
          clearer image. (Mask is authored in local space so the flip lands
          the strong edge at the waterline.) */}
      {!plain && (
      <span
        className="absolute left-0 block w-full pointer-events-none"
        style={{
          top: '100%',
          height: '100%',
          transform: 'scaleY(-1)',
          opacity: furled ? 0.17 : 0.11,
          maskImage: 'linear-gradient(0deg, black 0%, transparent 60%)',
          WebkitMaskImage: 'linear-gradient(0deg, black 0%, transparent 60%)',
          filter: 'blur(0.5px)',
        }}
      >
        {silhouette}
      </span>
      )}
    </span>
  );
}

export function VoyageSea({
  projects,
  reframeItems,
  recastItems,
  synthesizeItems,
  feedbackHistory,
  progressiveSessions,
  dueProjectIds,
  locale,
  onSelect,
  onReview,
  receipts,
  onSelectReceipt,
}: {
  projects: Project[];
  reframeItems: ReframeItem[];
  recastItems: RecastItem[];
  synthesizeItems: SynthesizeItem[];
  feedbackHistory: FeedbackRecord[];
  progressiveSessions: ProgressiveSession[];
  /** Due check-ins from useDueCount — the SAME source as the return strip and
   *  header badge, so the beacon can never disagree with the numbers below. */
  dueProjectIds: string[];
  locale: 'ko' | 'en';
  onSelect: (projectId: string) => void;
  /** Beacon CTA — routes to the settle surface (re-arms the settle question). */
  onReview: (projectId: string) => void;
  /** Sealed review/MCP receipts join the same sea (one harbor, P0-6 ①). */
  receipts?: JudgmentReceipt[];
  onSelectReceipt?: (receiptId: string) => void;
}) {
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);

  // Same signal brain as projectMetricsMap / the old FleetChart — the ONE
  // derived-state source (getVoyageState). Two deliberate departures from
  // FleetChart, both founder-decided (07-10): unsealed-but-started voyages
  // now sail here too (the living map is the whole harbor, not only the
  // sealed record — adrift/wrecked ARE the neglected ships this map exists
  // to surface), and retro practice runs stay excluded (W1 invariant).
  const ships = useMemo<SeaShip[]>(() => {
    const now = Date.now();
    const dueSet = new Set(dueProjectIds);
    const list: SeaShip[] = [];
    for (const p of projects) {
      if (p.decision_contract?.origin === 'retro') continue;
      const r = reframeItems.filter((d) => d.project_id === p.id);
      const rc = recastItems.filter((o) => o.project_id === p.id);
      const sy = synthesizeItems.filter((s) => s.project_id === p.id);
      const fb = feedbackHistory.filter((f) => f.project_id === p.id);
      const lastR = r[r.length - 1];
      const lastRc = rc[rc.length - 1];
      const lastF = fb[fb.length - 1];
      const lastS = sy[sy.length - 1];

      const legacyDone =
        (lastR?.status === 'done' ? 1 : 0) +
          (lastRc?.status === 'done' ? 1 : 0) +
          (lastF ? 1 : 0) +
          (sy.length > 0 ? 1 : 0) ===
        4;
      const hasProgress = !!lastR || !!lastRc || !!lastF || sy.length > 0;

      const voyageSession = progressiveSessions.find((s) => s.project_id === p.id);
      const contract = p.decision_contract;
      const contractSealed = !!contract;
      const cs = contract ? contractStatus(contract, now) : null;
      const contractAllGraded = !!cs?.allGraded;
      const voyageComplete = voyageSession?.phase === 'complete';
      const startedEff = hasProgress || !!voyageSession || contractSealed;
      const doneEff = legacyDone || voyageComplete || contractAllGraded;

      const candidates: Array<{ idx: number; at: string }> = [];
      if (lastR?.updated_at || lastR?.created_at) candidates.push({ idx: 0, at: lastR.updated_at || lastR.created_at });
      if (lastRc?.updated_at || lastRc?.created_at) candidates.push({ idx: 1, at: lastRc.updated_at || lastRc.created_at });
      if (lastF?.created_at) candidates.push({ idx: 2, at: lastF.created_at });
      if (lastS?.created_at) candidates.push({ idx: 3, at: lastS.created_at });
      candidates.sort((a, b) => b.at.localeCompare(a.at));
      const lastActivityStepIdx = candidates[0]?.idx ?? -1;
      const lastActivityAt = candidates[0]?.at || p.updated_at || p.created_at || '';

      const signals = {
        started: startedEff,
        completedAllLegs: doneEff || contractSealed,
        lastActivityAt,
        hasCoda: !!p.meta_reflection || contractAllGraded,
        lastLeg: lastActivityStepIdx >= 0 ? STEP_IDX_TO_LEG[lastActivityStepIdx] : null,
        outcomeVerdict: contractAllGraded ? ('mixed' as const) : p.outcome?.verdict,
      };
      const state = getVoyageState(signals, now);

      const idle = lastActivityAt
        ? Math.max(0, Math.floor((now - new Date(lastActivityAt).getTime()) / DAY_MS))
        : 0;

      // The user's own sealed bet, verbatim — their lean first, then the
      // governing idea. Honest gap: null when nothing was sealed in words.
      const preds = Array.isArray(contract?.predicates) ? contract.predicates : [];
      const premise =
        preds.find((x) => x.source === 'user_lean')?.text ||
        preds.find((x) => x.source === 'governing_idea')?.text ||
        preds[0]?.text ||
        null;

      const due = dueSet.has(p.id);
      const meta = VOYAGE_STATE_META[state];
      const untilWreck = daysUntilWreck(signals, now);
      let sub: string;
      if (state === 'wrecked') {
        const pin = wreckPin(signals.lastLeg, locale);
        sub = pin
          ? `${pin} · ${L(`${idle}일`, `${idle}d`)}`
          : L(`${idle}일째 멈춤`, `still for ${idle}d`);
      } else if (state === 'adrift') {
        sub =
          untilWreck != null
            ? L(`${idle}일째 잠잠`, `quiet for ${idle}d`)
            : L(meta.ko, meta.en);
      } else if (state === 'verified') {
        sub = L('정산 완료', 'reckoned');
      } else if (state === 'arrived') {
        sub = L('정산 대기', 'awaiting reckoning');
      } else if (state === 'docked') {
        sub = L('출항 전', 'not yet under way');
      } else {
        sub = relativeDays(lastActivityAt, now, locale);
      }
      if (due && cs?.daysUntilCheckIn != null) {
        const d = cs.daysUntilCheckIn;
        sub =
          d === 0
            ? L('확인일 오늘', 'check-in today')
            : L(`확인일 ${-d}일 지남`, `check-in ${-d}d past`);
      }

      list.push({
        id: p.id,
        name: p.name,
        kind: 'project',
        state,
        due,
        dueDays: cs?.daysUntilCheckIn ?? null,
        premise,
        sub,
        resolution: RESOLUTION[state],
        idleDays: idle,
        createdAt: p.created_at || lastActivityAt || '',
      });
    }

    // Sealed review/MCP receipts are vessels too — one sea, every committed
    // decision, whichever door it sailed from (P0-6 ①). Same derived-state
    // brain as the contracts above (§2-1 handoff mapping) — no second state
    // machine. Their due-ness stays on the return strip (dueReceipts); the
    // beacon remains a project-contract promise.
    for (const r of receipts ?? []) {
      const sealedFollowups = (r.falsifiable_followups ?? []).filter((f) => f.sealed_at);
      if (sealedFollowups.length === 0) continue;
      const settled = r.state === 'settled' || sealedFollowups.every((f) => !!f.settled_at);
      const createdAt = sealedFollowups.map((f) => f.sealed_at!).sort()[0] || r.created_at || '';
      const state = getVoyageState(
        {
          started: true,
          completedAllLegs: true,
          lastActivityAt: r.updated_at || createdAt,
          hasCoda: settled,
          lastLeg: null,
          outcomeVerdict: settled ? 'mixed' : 'pending',
        },
        now,
      );
      list.push({
        id: r.receipt_id,
        name: r.source_title || L('검수한 문서', 'Reviewed document'),
        kind: 'receipt',
        state,
        due: false,
        dueDays: null,
        premise: null,
        sub:
          state === 'verified'
            ? L('검수 · 정산 완료', 'review · reckoned')
            : `${L('검수 봉인', 'review seal')} · ${relativeDays(r.updated_at || createdAt, now, locale)}`,
        resolution: RESOLUTION[state],
        idleDays: (() => {
          const t = new Date(r.updated_at || createdAt).getTime();
          return Number.isNaN(t) ? 0 : Math.max(0, Math.floor((now - t) / DAY_MS));
        })(),
        createdAt,
      });
    }

    // Stable assignment order inside each zone: oldest voyage first.
    list.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, reframeItems, recastItems, synthesizeItems, feedbackHistory, progressiveSessions, dueProjectIds, receipts, locale]);

  // Below two ships there is no sea to chart — the page's list carries it.
  if (ships.length < 2) return null;

  // ── DENSITY (07-12: validated at 43 real projects, not 11 fixtures) ──
  // Project names are whole user sentences; you cannot label 40 of them on any
  // chart. Above a threshold the map switches to the standard dense-scatter
  // mode: ships become small marks, names move to hover, and only the due
  // decision keeps a persistent label. Small fleets stay richly labeled.
  const dense = ships.length > 14;

  // ── zone assignment. The beacon = the FIRST due ship (most overdue). Other
  //    due ships keep their zone but fly gold canvas. ──
  const dueShips = ships.filter((s) => s.due);
  const beacon = dueShips.length
    ? [...dueShips].sort((a, b) => (a.dueDays ?? 0) - (b.dueDays ?? 0))[0]
    : null;

  // ── the drifted current's VOICE — computed BEFORE placement so the slots
  //    can clear the water under the notice. Same single-event restraint
  //    brain as SharedGroundCard (groundSpotlight: fires only when shared
  //    ground actually drifted AND live bets stand on it; flat day → null).
  const spotlight = receipts?.length ? groundSpotlight(receipts) : null;
  const spotGauge = (() => {
    if (!spotlight?.drift) return null;
    const d = spotlight.drift;
    if (d.baseline_numeric != null && d.current_numeric != null) {
      return { from: String(d.baseline_numeric), to: String(d.current_numeric) };
    }
    const trim = (s?: string) => (s && s.length > 16 ? `${s.slice(0, 16)}…` : s);
    if (d.baseline_text && d.current_text) return { from: trim(d.baseline_text)!, to: trim(d.current_text)! };
    return { from: null, to: trim(d.finding) ?? null } as { from: string | null; to: string | null };
  })();

  // ── PLACEMENT = the two axes, computed (no hand-placed slots). Y from
  //    resolution (home at the bottom), X from activity recency (recent at the
  //    right), log-scaled and normalized across the fleet so one ancient
  //    voyage doesn't crush the rest against the edge. Deterministic jitter
  //    de-stacks cell-mates. This is why the map scales and why the top-left
  //    (unresolved + long-untended) reads as "needs you" at a glance.
  const TOP = 16;
  const BOT = 85;
  const maxIdle = Math.max(1, ...ships.map((s) => s.idleDays));
  const logMax = Math.log1p(maxIdle);

  type Placed = SeaShip & { x: number; y: number; beacon: boolean };
  const placed: Placed[] = ships.map((s) => {
    const isBeacon = !!beacon && s.id === beacon.id;
    const t = logMax > 0 ? Math.log1p(s.idleDays) / logMax : 0; // 0 recent .. 1 idle
    const { jx, jy } = hashJitter(s.id);
    let x = 88 - t * 76 + jx; // recent → right (88), long-idle → left (12)
    let y = TOP + s.resolution * (BOT - TOP) + jy; // home → bottom
    // keep ships from hiding under the floating notices — the beacon card
    // (top-right) and the drift chip (top-left sky band). The beacon ship is
    // exempt; it sits at its true coordinate wherever that is.
    if (!isBeacon) {
      if (beacon && x > 62 && y < 44) x = 60 - (44 - y) * 0.18;
      if (spotlight && x < 26 && y < 21) y = 23 + (26 - x) * 0.2;
    }
    x = Math.max(4, Math.min(94, x));
    y = Math.max(TOP - 3, Math.min(88, y));
    return { ...s, x, y, beacon: isBeacon };
  });

  // De-overlap: a few DETERMINISTIC relaxation passes so name labels don't
  // collide (the classic scatter problem). Separations are sized in each axis'
  // own %-units (x ≈ plate width, y ≈ plate height). The nudges are small
  // enough that the gross reading — neglect top-left, harbor bottom — survives;
  // this is dodge/beeswarm, not re-ranking. The beacon is the immovable anchor.
  // Dense mode packs by MARK size (no labels competing) → the true
  // distribution shows; sparse mode reserves label footprint.
  const SEPX = dense ? 4.6 : 10;
  const SEPY = dense ? 7 : 9.5;
  for (let pass = 0; pass < 26; pass++) {
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i];
        const b = placed[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const adx = Math.abs(dx);
        const ady = Math.abs(dy);
        if (adx >= SEPX || ady >= SEPY) continue;
        const px = (SEPX - adx) / 2;
        const py = (SEPY - ady) / 2;
        // push apart along the axis of shallower penetration (less distortion)
        if (px / SEPX < py / SEPY) {
          const s = dx === 0 ? ((i + j) % 2 ? 1 : -1) : Math.sign(dx);
          if (a.beacon) b.x += s * px * 2;
          else if (b.beacon) a.x -= s * px * 2;
          else { a.x -= s * px; b.x += s * px; }
        } else {
          const s = dy === 0 ? ((i + j) % 2 ? 1 : -1) : Math.sign(dy);
          if (a.beacon) b.y += s * py * 2;
          else if (b.beacon) a.y -= s * py * 2;
          else { a.y -= s * py; b.y += s * py; }
        }
      }
    }
  }
  for (const p of placed) {
    p.x = Math.max(4, Math.min(94, p.x));
    p.y = Math.max(TOP - 3, Math.min(89, p.y));
  }

  const counts = {
    adrift: ships.filter((s) => s.state === 'adrift').length,
    wrecked: ships.filter((s) => s.state === 'wrecked').length,
  };
  const untended = counts.adrift + counts.wrecked;

  // ── undersea currents — shared ground between charted vessels (the judgment
  //    graph made spatial). Relationship = normalizePremiseText EXACT equality
  //    only (§4-1: a broken wire yields a missing chord, never an invented
  //    one). Steady ground = ink-quiet; ground whose last re-check DRIFTED =
  //    var(--warning), a fact color, not a verdict (§4-3). Chords chain
  //    adjacent members sorted by x, computed as pure math from the plate's
  //    fixed aspect — no layout measurement, no SVG.
  const currents: SeaCurrent[] = [];
  if (receipts?.length) {
    const pos = new Map(placed.map((s) => [s.id, s]));
    for (const g of sharedGrounds(receipts)) {
      const members = [...new Set(g.members.map((m) => m.receipt_id))]
        .map((id) => pos.get(id))
        .filter((s): s is Placed => !!s)
        .sort((a, b) => a.x - b.x);
      if (members.length < 2) continue;
      const segs = members.slice(0, -1).map((a, i) => {
        const b = members[i + 1];
        const dx = b.x - a.x;
        const dy = (b.y - a.y) * (PLATE_H_IN_W / 100);
        return {
          x: a.x,
          y: a.y,
          len: Math.hypot(dx, dy),
          deg: (Math.atan2(dy, dx) * 180) / Math.PI,
        };
      });
      currents.push({ key: g.key, text: g.text, drifted: !!g.drift, segs });
    }
  }

  // Engraved plate inscription — the pure elapsed fact (shared wording brain
  // with the Logbook via record-summary, so it can never drift) + fleet size.
  const firstDate = ships[0]?.createdAt ? String(ships[0].createdAt).slice(0, 10) : undefined;
  const inscription = firstVoyageInscription(firstDate, Date.now(), locale);

  // Honest caption — plain facts in the calm register, no manufactured urgency.
  const caption = beacon
    ? L(
        `지금 다시 볼 결정 ${dueShips.length}건 — 등대가 비추고 있어요.`,
        `${dueShips.length} decision${dueShips.length === 1 ? '' : 's'} to revisit — the light is on ${dueShips.length === 1 ? 'it' : 'them'}.`,
      )
    : untended > 0
      ? L(
          `왼쪽 위 ${untended}척이 오래 손을 놓았어요 — 열면 다시 뜹니다.`,
          `${untended} ship${untended === 1 ? '' : 's'} sit long-untended, top-left — open one and it refloats.`,
        )
      : L(
          `부를 배가 없어요. ${ships.length}척 모두 제 항로에 있어요.`,
          `Nothing calls you back. All ${ships.length} ships are on course.`,
        );


  return (
    <section aria-label={L('항해 지도 — 결정들의 현재 위치', 'Voyage chart — where each decision is now')}>
      {/* Component-scoped keyframes. Plain static CSS (no user data). */}
      <style>{`
        @keyframes vsea-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-4px) } }
        @keyframes vsea-in { from { opacity: 0; transform: translateY(7px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes vsea-beam { 0%,100% { transform: translateX(-50%) rotate(-44deg) } 50% { transform: translateX(-50%) rotate(34deg) } }
        @keyframes vsea-halo { 0%,100% { opacity: .35; transform: translate(-50%,-50%) scale(.88) } 50% { opacity: .8; transform: translate(-50%,-50%) scale(1.1) } }
        @keyframes vsea-pulse { 0%,100% { opacity: .45 } 50% { opacity: 1 } }
        @keyframes vsea-flow { to { background-position: 13px 0 } }
        .vsea-flow { animation: vsea-flow 1.6s linear infinite }
        .vsea-in { opacity: 0; animation: vsea-in .7s cubic-bezier(.32,.72,0,1) forwards }
        .vsea-bob { animation: vsea-bob 6s ease-in-out infinite }
        .vsea-beam { animation: vsea-beam 26s ease-in-out infinite }
        .vsea-halo { animation: vsea-halo 3.2s ease-in-out infinite }
        .vsea-pulse { animation: vsea-pulse 2.6s ease-in-out infinite }
        @media (prefers-reduced-motion: reduce) {
          .vsea-in { animation: none; opacity: 1 }
          .vsea-bob, .vsea-beam, .vsea-halo, .vsea-pulse, .vsea-flow { animation: none }
        }
      `}</style>

      {/* ── the night sea plate (committed dark — a framed nocturne). The
            beacon notice is a SIBLING of the plate: absolute over the water on
            desktop, a normal block right below it on mobile — never mixed into
            the ships layer (07-11 mobile-overlap fix). ── */}
      <div className="relative">
      <div
        className="relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] shadow-[var(--shadow-md)] min-h-[400px] sm:min-h-0 sm:aspect-[16/7.2]"
        style={{
          background: `linear-gradient(176deg, ${N.seaHi} 0%, ${N.sea} 52%, ${N.seaDeep} 100%)`,
          // engraved plate: a whisper of an inner rule inside the outer border
          boxShadow: `inset 0 0 0 1px ${N.paper}0f, inset 0 1px 0 ${N.paper}14`,
        }}
      >
        {/* corner registration ticks — the plate signature */}
        {(['top-2 left-2 border-t border-l', 'top-2 right-2 border-t border-r', 'bottom-2 left-2 border-b border-l', 'bottom-2 right-2 border-b border-r'] as const).map((pos) => (
          <span key={pos} aria-hidden className={`absolute w-2.5 h-2.5 z-[2] pointer-events-none ${pos}`} style={{ borderColor: `${N.paper}38` }} />
        ))}
        {/* swell — engraved hairlines in PERSPECTIVE: tight near the horizon,
            widening toward the foreground. Two masked layers, still paper. */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background: `repeating-linear-gradient(180deg, transparent 0 21px, ${N.paper}0a 21px 22px)`,
            maskImage: 'linear-gradient(180deg, transparent 6%, black 24%, black 46%, transparent 60%)',
            WebkitMaskImage: 'linear-gradient(180deg, transparent 6%, black 24%, black 46%, transparent 60%)',
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background: `repeating-linear-gradient(180deg, transparent 0 42px, ${N.paper}10 42px 43.5px)`,
            maskImage: 'linear-gradient(180deg, transparent 40%, black 58%, black 86%, transparent 98%)',
            WebkitMaskImage: 'linear-gradient(180deg, transparent 40%, black 58%, black 86%, transparent 98%)',
          }}
        />
        {/* night air — starlight, a breath of moon, and the moonglade: a
            faint column of light lying on the water. All static. */}
        <div aria-hidden className="absolute inset-0" style={{ background: `radial-gradient(42% 30% at 33% 0%, ${N.paper}10, transparent 70%)` }} />
        <div
          aria-hidden
          className="absolute pointer-events-none"
          style={{
            left: '29%', top: '4%', width: '9%', height: '78%',
            background: `linear-gradient(180deg, ${N.paper}0c, ${N.paper}05 45%, transparent 90%)`,
            maskImage: 'linear-gradient(90deg, transparent, black 35%, black 65%, transparent)',
            WebkitMaskImage: 'linear-gradient(90deg, transparent, black 35%, black 65%, transparent)',
          }}
        />
        <div
          aria-hidden
          className="absolute top-[7%] left-[12%] w-px h-px rounded-full"
          style={{ background: `${N.paper}55`, boxShadow: `14vw 2vh 0 0 ${N.paper}33, 34vw -1vh 0 0 ${N.paper}44, 52vw 3vh 0 0 ${N.paper}2e, 63vw -2vh 0 0 ${N.paper}40, 26vw 6vh 0 0 ${N.paper}26, 44vw 1vh 0 0 ${N.paper}2a` }}
        />
        {/* depth vignette — the plate darkens toward its edges */}
        <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(115% 95% at 50% 34%, transparent 58%, rgba(0,0,0,.30) 100%)' }} />

        {/* the shoal — hatched shallows where wrecks lie aground */}
        <div
          aria-hidden
          className="absolute left-0 bottom-[10%] w-[27%] h-[15%]"
          style={{
            background: `repeating-linear-gradient(45deg, transparent 0 5px, ${N.paper}0c 5px 6px)`,
            borderRadius: '0 60% 45% 0 / 0 80% 60% 0',
            borderTop: `1px solid ${N.paper}17`,
          }}
        />

        {/* the home quay — arrived ships moor here; the pier holds the not-yet-sailed */}
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[11%]" style={{ background: N.land, borderTop: `1px solid ${N.paper}1f` }} />

        {/* the lighthouse — Argus, keeping watch. A real silhouette now:
            rock mole → tapered banded tower → gallery → lamp room. Its beam
            is the sheet's one bold move; reduced-motion holds it still. */}
        <div aria-hidden className="absolute" style={{ left: '75%', bottom: '10.2%', width: 34, height: 9, background: N.land, borderRadius: '50% 50% 0 0 / 100% 100% 0 0', transform: 'translateX(-50%)', boxShadow: `inset 0 1px 0 ${N.paper}1c` }} />
        <div
          aria-hidden
          className="absolute"
          style={{
            left: '75%', bottom: 'calc(10.2% + 8px)', width: 9, height: 30,
            transform: 'translateX(-50%)',
            clipPath: 'polygon(24% 0%, 76% 0%, 100% 100%, 0% 100%)',
            background: `repeating-linear-gradient(180deg, ${N.paper}70 0 5px, ${N.paper}3d 5px 10px)`,
          }}
        />
        <div aria-hidden className="absolute" style={{ left: '75%', bottom: 'calc(10.2% + 37px)', width: 13, height: 1.5, background: `${N.paper}80`, transform: 'translateX(-50%)' }} />
        <div aria-hidden className="absolute" style={{ left: '75%', bottom: 'calc(10.2% + 38.5px)', width: 6, height: 5, background: `${N.paper}30`, transform: 'translateX(-50%)', borderRadius: 1 }} />
        <div aria-hidden className="absolute rounded-full" style={{ left: '75%', bottom: 'calc(10.2% + 39.5px)', width: 4, height: 4, background: N.gold, transform: 'translateX(-50%)', boxShadow: `0 0 12px 3px ${N.gold}59` }} />
        <div aria-hidden className="absolute" style={{ left: '75%', bottom: 'calc(10.2% + 43.5px)', width: 8, height: 4, background: `${N.paper}66`, transform: 'translateX(-50%)', clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)' }} />
        <div
          aria-hidden
          className="vsea-beam absolute"
          style={{
            left: '75%',
            bottom: 'calc(10.2% + 41px)',
            width: 'min(58vw, 620px)',
            aspectRatio: '1',
            transformOrigin: '50% 100%',
            transform: 'translateX(-50%) rotate(-8deg)',
            background: `conic-gradient(from -10deg at 50% 100%, transparent 0deg, ${N.gold}12 7deg, ${N.gold}1f 10deg, ${N.gold}12 13deg, transparent 20deg)`,
          }}
        />

        {/* ── the axes, drawn as chart furniture so position reads as data ──
              Y = resolution (먼바다 위 → 항구 아래), X = activity recency
              (오래 방치 왼쪽 → 최근 오른쪽). A faint graticule + edge captions
              turn the sea into a scatter you can actually read. */}
        {/* neutral "untended waters" wash — top-left is unresolved + long-idle.
            A fact of attention, never a mark of failure (거울 조항). Only when
            ships actually sit there. */}
        {untended > 0 && (
          <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(46% 52% at 6% 4%, color-mix(in srgb, var(--warning) 8%, transparent), transparent 62%)' }} />
        )}
        {/* graticule: horizon (resolution mid) + a recency mid-meridian */}
        <div aria-hidden className="absolute left-0 right-0 pointer-events-none" style={{ top: '50%', height: 1, background: `linear-gradient(90deg, transparent, ${N.paper}12 12%, ${N.paper}12 88%, transparent)` }} />
        <div aria-hidden className="absolute top-[13%] bottom-[14%] pointer-events-none" style={{ left: '50%', width: 1, background: `linear-gradient(180deg, transparent, ${N.paper}0e 20%, ${N.paper}0e 80%, transparent)` }} />

        {/* Y-axis captions */}
        <span className="absolute top-[5.5%] left-1/2 -translate-x-1/2 text-[8.5px] font-mono uppercase tracking-[0.24em] pointer-events-none" style={{ color: `${N.paper}4d` }}>
          {L('먼바다 · 항해 중', 'OPEN SEA')}
        </span>
        <span className="absolute bottom-[3%] left-1/2 -translate-x-1/2 text-[8.5px] font-mono uppercase tracking-[0.24em] pointer-events-none" style={{ color: `${N.paper}59` }}>
          {L('항구 · 도착', 'HARBOR')}
        </span>
        {/* X-axis captions */}
        <span className="absolute top-1/2 -translate-y-1/2 left-[2%] text-[8.5px] font-mono uppercase tracking-[0.14em] pointer-events-none hidden sm:block" style={{ color: `${N.paper}4d` }}>
          ← {L('오래 방치', 'LONG UNTENDED')}
        </span>
        <span className="absolute top-1/2 -translate-y-1/2 right-[2%] text-[8.5px] font-mono uppercase tracking-[0.14em] text-right pointer-events-none hidden sm:block" style={{ color: `${N.paper}4d` }}>
          {L('최근 활동', 'RECENT')} →
        </span>
        {/* plate inscription — the elapsed fact (shared brain with the Logbook) */}
        <span className="absolute top-[4%] right-[3%] text-[9px] font-mono tracking-[0.12em] tabular-nums pointer-events-none hidden md:block" style={{ color: `${N.paper}40` }}>
          {inscription ? `${inscription} · ` : ''}
          {L(`${ships.length}척`, `${ships.length} ships`)}
        </span>

        {/* ── undersea currents — beneath the ships, above the water. A line
              exists only where two charted vessels literally stand on the same
              normalized premise. Desktop-only: at mobile density the chords
              read as clutter, and the SharedGroundCard (①) carries the event. */}
        {currents.length > 0 && (
          <div aria-hidden className="absolute inset-0 z-[1] hidden sm:block">
            {currents.map((c) =>
              c.segs.map((s, i) => (
                <div
                  key={`${c.key}-${i}`}
                  data-testid="fleet-current"
                  data-drifted={c.drifted ? '1' : '0'}
                  className={`absolute ${c.drifted ? 'vsea-flow' : ''}`}
                  style={{
                    left: `${s.x}%`,
                    top: `${s.y}%`,
                    width: `${s.len}%`,
                    height: c.drifted ? 1.5 : 1,
                    // a plotted, dashed water-course; the drifted one FLOWS
                    // (background-position drifts along the chord)
                    background: c.drifted
                      ? 'repeating-linear-gradient(90deg, var(--warning) 0 7px, transparent 7px 13px)'
                      : `repeating-linear-gradient(90deg, ${N.paper}40 0 5px, transparent 5px 12px)`,
                    opacity: c.drifted ? 0.85 : 0.8,
                    maskImage: 'linear-gradient(90deg, transparent, black 12%, black 88%, transparent)',
                    WebkitMaskImage: 'linear-gradient(90deg, transparent, black 12%, black 88%, transparent)',
                    transformOrigin: '0 50%',
                    transform: `rotate(${s.deg}deg)`,
                  }}
                />
              )),
            )}
          </div>
        )}

        {/* ── the ships ── */}
        <div role="list" className="absolute inset-0 z-[2]">
          {placed.map((s, i) => {
            const meta = VOYAGE_STATE_META[s.state];
            const stateLabel = s.beacon ? L('다시 볼 때', 'due back') : L(meta.ko, meta.en);
            const attention = s.state === 'adrift' || s.state === 'wrecked';
            const size = s.beacon ? 42 : dense ? (attention ? 17 : 15) : 24;
            // Persistent labels only where the sheet can hold them. Sentence-
            // length names can't stack — even 6 in the neglect corner collide —
            // so a dense fleet labels ONLY the due beacon. The untended ships
            // instead carry a soft amber under-glow (below) so the top-left
            // reads as "needs you" at a glance; names come from hover and from
            // the due-strip beneath the map (which already lists them).
            const showLabel = !dense || s.beacon;
            return (
              <button
                key={s.id}
                type="button"
                role="listitem"
                onClick={() =>
                  s.kind === 'receipt' ? onSelectReceipt?.(s.id) : s.due ? onReview(s.id) : onSelect(s.id)
                }
                title={`${s.name} — ${stateLabel} · ${s.sub}`}
                aria-label={`${s.name} — ${stateLabel} · ${s.sub}`}
                className="vsea-in absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 p-1.5 sm:p-2 rounded-lg cursor-pointer group hover:z-40 focus-visible:z-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] transition-transform duration-300 hover:-translate-y-[calc(50%+3px)]"
                style={{ left: `${s.x}%`, top: `${s.y}%`, animationDelay: `${Math.min(i, 8) * 70}ms` }}
              >
                {s.beacon && (
                  <span
                    aria-hidden
                    className="vsea-halo absolute left-1/2 top-[34%] -z-[1] rounded-full"
                    style={{ width: 130, height: 130, background: `radial-gradient(circle, ${N.gold}3d 0%, transparent 62%)`, transform: 'translate(-50%,-50%)' }}
                  />
                )}
                {/* dense fleet: untended ships glow faint amber so the neglect
                    corner reads at a glance without labels (fact color, not a
                    verdict — 거울 조항). */}
                {dense && attention && !s.beacon && (
                  <span
                    aria-hidden
                    className="absolute left-1/2 top-[42%] -z-[1] rounded-full"
                    style={{ width: 44, height: 44, background: 'radial-gradient(circle, color-mix(in srgb, var(--warning) 40%, transparent) 0%, transparent 66%)', transform: 'translate(-50%,-50%)' }}
                  />
                )}
                <span className={s.state === 'wrecked' || s.state === 'docked' ? '' : 'vsea-bob'} style={{ animationDelay: `${(i % 5) * 1.1}s` }}>
                  <ShipMark
                    state={s.state}
                    due={s.due}
                    size={size}
                    kind={s.kind}
                    plain={dense && !s.beacon}
                    // deterministic per-ship heading (±3°) — a fleet, not a stamp
                    heading={s.state === 'sailing' ? (([...s.id].reduce((a, c) => a + c.charCodeAt(0), 0) % 7) - 3) : 0}
                  />
                </span>
                {showLabel ? (
                  <>
                    <span
                      className={`${s.beacon ? '' : 'hidden sm:block'} max-w-[96px] text-center text-[10.5px] leading-[1.3] break-keep line-clamp-2 font-medium`}
                      style={{ color: s.beacon ? N.paper : `${N.paper}b8`, fontFamily: 'var(--font-display)' }}
                    >
                      {s.name}
                    </span>
                    <span
                      className={`${s.beacon ? '' : 'hidden sm:block opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity'} text-[8px] font-mono uppercase tracking-[0.08em] whitespace-nowrap`}
                      style={{ color: s.beacon ? N.gold : `${N.paper}66` }}
                    >
                      {stateLabel} · {s.sub}
                    </span>
                  </>
                ) : (
                  /* dense: name + state as a hover/focus tooltip, raised above
                     neighbours — only ever one is shown at a time, so it can't
                     collide. */
                  <span
                    className="hidden sm:flex flex-col items-center gap-0.5 absolute top-[calc(100%+2px)] left-1/2 -translate-x-1/2 w-max max-w-[190px] px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity pointer-events-none z-40"
                    style={{ background: `${N.seaDeep}f2`, border: `1px solid ${N.paper}24` }}
                  >
                    <span className="text-center text-[10.5px] leading-[1.25] break-keep line-clamp-2 font-medium" style={{ color: N.paper, fontFamily: 'var(--font-display)' }}>
                      {s.name}
                    </span>
                    <span className="text-[8px] font-mono uppercase tracking-[0.08em] whitespace-nowrap" style={{ color: s.due ? N.gold : `${N.paper}80` }}>
                      {stateLabel} · {s.sub}
                    </span>
                  </span>
                )}
              </button>
            );
          })}
        </div>

      </div>

      {/* ── beacon notice — the sheet's single voice, only when a promised
            check-in has actually arrived. Sibling of the plate: floats over
            the water on sm+, flows below it on mobile. ── */}
      {beacon && (
          <div className="static sm:absolute sm:right-[2.5%] sm:top-[7%] z-[3] mt-3 sm:mt-0 sm:max-w-[300px] rounded-xl border p-4" style={{ background: `${N.seaDeep}d9`, borderColor: `${N.paper}24`, backdropFilter: 'blur(3px)' }}>
            <p className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.16em] font-semibold" style={{ color: N.gold }}>
              <span aria-hidden className="vsea-pulse inline-block w-1.5 h-1.5 rounded-full" style={{ background: N.gold }} />
              {L('그래서, 어떻게 됐어요?', 'So, how did it go?')}
            </p>
            <p className="mt-2 text-[15px] font-bold leading-snug break-keep" style={{ color: N.paper, fontFamily: 'var(--font-display)' }}>
              {beacon.name}
            </p>
            {beacon.premise ? (
              <p className="mt-2 rounded-lg px-3 py-2 text-[12px] leading-relaxed break-keep" style={{ background: `${N.paper}0d`, color: `${N.paper}b8` }}>
                {L('봉인한 내기 — ', 'Your sealed bet — ')}
                <em style={{ color: N.paper }}>「{beacon.premise.length > 64 ? `${beacon.premise.slice(0, 64)}…` : beacon.premise}」</em>
              </p>
            ) : (
              <p className="mt-2 text-[12px] leading-relaxed break-keep" style={{ color: `${N.paper}a1` }}>
                {L('약속한 확인일이 왔어요. 봉인할 때의 눈으로 지금을 재볼 시간.', 'The check-in you promised has arrived. Time to reread now with the eyes you sealed it with.')}
              </p>
            )}
            <button
              type="button"
              onClick={() => onReview(beacon.id)}
              className="mt-3 inline-flex items-center gap-1.5 text-[11.5px] font-mono font-semibold cursor-pointer transition-[gap] duration-300 hover:gap-2.5"
              style={{ color: N.gold }}
            >
              {L('다시 보기', 'Revisit')} <span aria-hidden>→</span>
            </button>
            {dueShips.length > 1 && (
              <p className="mt-2 text-[10px] font-mono" style={{ color: `${N.paper}73` }}>
                {L(`그 외 ${dueShips.length - 1}건이 더 기다려요`, `${dueShips.length - 1} more waiting below`)}
              </p>
            )}
          </div>
      )}

      {/* ── drift chip — the amber current's voice, kept to the sky band so it
            never occludes ships. Fires ONLY on the groundSpotlight event;
            silent on flat days. The full ledger lives below (SharedGroundCard).
            Amber is a fact color, never a verdict (거울 조항). ── */}
      {spotlight && (
          <button
            type="button"
            onClick={() => onSelectReceipt?.(spotlight.members[0].receipt_id)}
            className="static sm:absolute sm:left-[2.5%] sm:top-[7%] z-[3] mt-3 sm:mt-0 flex items-center gap-2 rounded-full border py-1.5 pl-2.5 pr-3 cursor-pointer transition-[gap] hover:gap-2.5"
            style={{
              background: `${N.seaDeep}e0`,
              borderColor: 'color-mix(in srgb, var(--warning) 34%, transparent)',
              backdropFilter: 'blur(3px)',
              maxWidth: 'min(94%, 340px)',
            }}
            aria-label={L(`전제 이동 — ${spotlight.text}. 전체 살펴보기`, `Premise moved — ${spotlight.text}. See the full ground`)}
          >
            <span aria-hidden className="vsea-pulse inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--warning)' }} />
            <span className="text-[9.5px] font-mono uppercase tracking-[0.12em] font-semibold shrink-0" style={{ color: 'var(--warning)' }}>
              {L('전제 이동', 'GROUND MOVED')}
            </span>
            <span className="text-[11px] truncate" style={{ color: `${N.paper}d0`, fontFamily: 'var(--font-display)' }}>
              「{spotlight.text.length > 22 ? `${spotlight.text.slice(0, 22)}…` : spotlight.text}」
            </span>
            {spotGauge && (
              <span className="text-[10px] font-mono tabular-nums shrink-0" style={{ color: 'var(--warning)' }}>
                {spotGauge.from != null ? `${spotGauge.from}→${spotGauge.to}` : spotGauge.to}
              </span>
            )}
            <span aria-hidden className="text-[11px] shrink-0" style={{ color: `${N.paper}80` }}>→</span>
          </button>
      )}
      </div>

      {/* ── under the plate: the honest caption + a quiet chart key ── */}
      <div className="mt-2.5 px-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
        <p className="text-[12px] text-[var(--text-secondary)]">{caption}</p>
        <div aria-hidden className="hidden md:flex items-center gap-4 text-[9px] font-mono uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
          {(
            [
              ['sailing', 'project', L('항해 중', 'sailing')],
              ['adrift', 'project', L('표류', 'adrift')],
              ['wrecked', 'project', L('난파', 'wrecked')],
              ['verified', 'project', L('검증됨', 'verified')],
              ['sailing', 'receipt', L('검수 봉인', 'review seal')],
            ] as Array<[VoyageState, 'project' | 'receipt', string]>
          ).map(([st, kind, label]) => (
            <span key={`${st}-${kind}`} className="inline-flex items-center gap-1.5 rounded px-1 py-0.5" style={{ background: N.sea }}>
              <ShipMark state={st} due={false} size={12} kind={kind} plain />
              <span style={{ color: `${N.paper}8c` }}>{label}</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
