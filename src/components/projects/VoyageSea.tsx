'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getVoyageState,
  daysUntilWreck,
  wreckPin,
  VOYAGE_STATE_META,
  DRIFT_DAYS,
  WRECK_DAYS,
  type VoyageLeg,
  type VoyageState,
} from '@/lib/voyage-state';
import { contractStatus } from '@/lib/decision-contract';
import { sharedGrounds, groundSpotlight } from '@/lib/judgment-graph';
import { normalizePremiseText } from '@/lib/premises-core';
import { VoyageMarker } from './VoyageMarker';
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
 * CRAFT: the functional scatter is laid over the canonical Argus sea-chart
 * image. The image carries atmosphere; HTML carries every datum, label, current,
 * and action so the chart stays accessible and testable. One shared instrument
 * marker is reused in the chart and the harbor register below: position means
 * state, while the marker's brass/ivory finish provides identity without turning
 * a decision record into an illustrated game.
 */

// ── canonical sea-chart palette (theme-stable) ──
const N = {
  paper: '#f5f0e5', // bone-white chart ink over the living sea
  ink: '#16211f', // copy on parchment notices
  gold: '#d8ad55', // antique brass — due / closed
  goldInk: '#80601f', // accessible brass text on parchment
  goldGlow: '#f0c86e',
  amber: '#e39a56', // DRIFT attention, never a verdict
  amberInk: '#974a1d', // accessible attention text on parchment
  //                    verdict; distinct from the olive `gold` of completion)
  card: '#f8f2e4', // near-white parchment — floating notices, pops off the sea
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

/**
 * A short KEYWORD for a project — sentence-length names can't label a chart, so
 * the map shows a 1–2 word hint and the full name comes on hover / in the list
 * below (창업자 07-13: "이름 그대로 말고 키워드 중심"). Deterministic, no LLM:
 * drop filler/verb words + trailing Korean particles, keep the first two
 * content words. Imperfect on abstract sentences — but it's a glance hint with
 * the full name one hover away, never the source of truth.
 */
const KW_STOP = new Set([
  '위한', '위해', '어떻게', '방법', '방안', '고민', '고민이', '고민이에요', '고민이야',
  '고민중이야', '고민이돼', '고민이돼.', '할까', '할지', '될까', '맞을까', '좋을까', '하는', '하고',
  '있어', '있는', '싶은데', '그리고', '너무', '정말', '지금', '현재', '앞으로', '대해서', '대해',
  '대한', '관한', '통해', '통한', '이런', '저런', '우리', '내가', '나는', '제가', '별로', '것',
  '등', '및', '전면', '계속', '다시', '해야', '하지', '되는', '살아남기', '생존하고', '성장하는',
  '성공하는', '만들지', '어떻게해야', 'AI', '시대에',
]);
const KW_PARTICLES = ['인데', '라고', '라는', '이라', '한테', '으로', '로', '에서', '에게', '에', '의', '을', '를', '은', '는', '이', '가', '도', '만', '과', '와', '까지', '부터', '처럼', '보다'];

function keyword(name: string): string {
  const clean = (name || '').replace(/[?.!,"'“”「」·]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const words = clean.split(' ').filter(Boolean);
  const picked: string[] = [];
  for (const w of words) {
    if (picked.length >= 2) break;
    let word = w;
    for (const p of KW_PARTICLES) {
      if (word.length > p.length + 1 && word.endsWith(p)) { word = word.slice(0, -p.length); break; }
    }
    if (KW_STOP.has(w) || KW_STOP.has(word) || word.length < 1) continue;
    picked.push(word);
  }
  let out = picked.join(' ');
  if (!out) out = words.slice(0, 2).join(' '); // fallback: first two words
  return out.length > 12 ? `${out.slice(0, 11)}…` : out;
}

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

/** Compatibility wrapper around the shared chart instrument. Keeping the name
 * local avoids perturbing the chart's data/layout logic while the visual object
 * itself remains canonical across the sea and harbor register. */
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
  return (
    <VoyageMarker state={state} due={due} size={size} kind={kind} heading={heading} plain={plain} />
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
  attentionProjectIds = [],
  locale,
  onSelect,
  onReview,
  receipts,
  onSelectReceipt,
  focusedDecisionId,
  onFocusDecision,
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
  /** Projects with a due premise/open question. A small signal on the existing
   *  ship preserves the sea as protagonist; the action list below owns detail. */
  attentionProjectIds?: string[];
  locale: 'ko' | 'en';
  onSelect: (projectId: string) => void;
  /** Beacon CTA — routes to the settle surface (re-arms the settle question). */
  onReview: (projectId: string) => void;
  /** Sealed review/MCP receipts join the same sea (one harbor, P0-6 ①). */
  receipts?: JudgmentReceipt[];
  onSelectReceipt?: (receiptId: string) => void;
  /** Shared selection with the attention list below. The chart remains the
   *  visual locator; the list remains the exact-action surface. */
  focusedDecisionId?: string | null;
  onFocusDecision?: (decisionId: string, kind: SeaShip['kind']) => void;
}) {
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const attentionSet = new Set(attentionProjectIds);
  // B (07-13): the chart is an operable control surface — a state filter that
  // isolates a slice of the fleet (null = whole fleet).
  const [filter, setFilter] = useState<string | null>(null);
  // The map reads position AND colour as data, but that system is invisible to a
  // first-timer (창업자 07-13: 직관적 사용). An on-demand key — progressive
  // disclosure, so the chart stays quiet until you ask "how do I read this?".
  const [showKey, setShowKey] = useState(false);
  // Act-in-place (창업자 07-13: "판 위에서 바로 처리"): tapping a ship opens a
  // small action card AT the ship — open / (due) 정산·다시 보기 — so the board
  // is worked, not just read (and mobile stops tapping blind into a nav jump).
  const [actionShip, setActionShip] = useState<string | null>(null);
  const actionCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!actionShip) return;

    const focusFrame = window.requestAnimationFrame(() => {
      actionCardRef.current?.querySelector<HTMLElement>('[data-autofocus="true"]')?.focus();
    });
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      const shipId = actionShip;
      setActionShip(null);
      window.requestAnimationFrame(() => document.getElementById(`voyage-ship-${shipId}`)?.focus());
    };
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [actionShip]);

  useEffect(() => {
    if (!showKey) return;
    const closeLegendOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowKey(false);
    };
    document.addEventListener('keydown', closeLegendOnEscape);
    return () => document.removeEventListener('keydown', closeLegendOnEscape);
  }, [showKey]);

  // A selection arriving from the action list must stay visible even when a
  // previous chart filter would have hidden it.
  useEffect(() => {
    if (focusedDecisionId) setFilter(null);
  }, [focusedDecisionId]);

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
        sub = L('시작 전', 'not started');
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
            : `${L('검수 기록', 'review record')} · ${relativeDays(r.updated_at || createdAt, now, locale)}`,
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
    // keep ships from hiding under the one remaining floating notice — the
    // drift chip (top-left sky band). The beacon notice is no longer over the
    // water (it's a banner above the plate), so the top-right is free again.
    // The beacon ship is exempt; it sits at its true coordinate.
    if (!isBeacon) {
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

  // ── SHARED-GROUND LEVERAGE (판단 그래프, fleet-wide). Group EVERY charted
  //    vessel — project or receipt — by the normalized text of its sealed
  //    premise. Two decisions on the same key literally stand on the same
  //    assumption: if it moves, they move together. Exact-match only (§4-1:
  //    a broken wire yields NO link, never an invented one). Tapping a ship
  //    lights its ground-siblings so "하나 흔들리면 같이" is a fact you can see,
  //    not a verdict. This is the board's own intelligence, not a menu.
  const siblingsOf = new Map<string, Placed[]>();
  {
    const byKey = new Map<string, Placed[]>();
    for (const p of placed) {
      const key = p.premise ? normalizePremiseText(p.premise) : '';
      if (!key) continue;
      (byKey.get(key) ?? byKey.set(key, []).get(key)!).push(p);
    }
    for (const group of byKey.values()) {
      if (group.length < 2) continue; // no ground shared → no link (restraint)
      for (const p of group) siblingsOf.set(p.id, group.filter((g) => g.id !== p.id));
    }
  }

  const counts = {
    adrift: ships.filter((s) => s.state === 'adrift').length,
    wrecked: ships.filter((s) => s.state === 'wrecked').length,
  };
  const untended = counts.adrift + counts.wrecked;
  // Zone tallies for the board's diagnostic quadrants (below).
  const sailingN = ships.filter((s) => s.state === 'sailing' && !s.due).length;

  // ── the operable filters (B) — each isolates a real slice of the fleet.
  //    Clicking one dims everything else and reveals the matches' keywords, so
  //    the axes/states become something you ACT on, not just read. ──
  const FILTERS: Array<{ key: string; ko: string; en: string; test: (s: SeaShip) => boolean; gold?: boolean; amber?: boolean }> = [
    { key: 'due', ko: '다시 볼 것', en: 'due', test: (s) => s.due, gold: true },
    { key: 'signal', ko: '확인 신호', en: 'signals', test: (s) => s.kind === 'project' && attentionSet.has(s.id) && !s.due, amber: true },
    { key: 'idle', ko: '오래 방치', en: 'untended', test: (s) => s.state === 'adrift' || s.state === 'wrecked', amber: true },
    { key: 'sailing', ko: '진행 중', en: 'in progress', test: (s) => s.state === 'sailing' && !s.due },
    { key: 'home', ko: '완료', en: 'complete', test: (s) => s.state === 'arrived' || s.state === 'verified' },
    { key: 'docked', ko: '시작 전', en: 'not started', test: (s) => s.state === 'docked' && !s.due },
  ];
  const filterList = FILTERS.map((f) => ({ ...f, n: ships.filter(f.test).length })).filter((f) => f.n > 0);
  const activeFilter = FILTERS.find((f) => f.key === filter) || null;
  const matchOf = (s: SeaShip) => !activeFilter || activeFilter.test(s);

  // ── honest thresholds on the recency axis: the REAL 14d-adrift / 30d-wreck
  //    lines from voyage-state, placed by the same log scale. Turns "vaguely
  //    left = old" into "left of this labeled line = adrift/wrecked water" —
  //    real structure, not fake precision (kills critique #4). ──
  const thresholds = [
    { d: DRIFT_DAYS, label: L(`${DRIFT_DAYS}일 · 표류`, `${DRIFT_DAYS}d · adrift`) },
    { d: WRECK_DAYS, label: L(`${WRECK_DAYS}일 · 난파`, `${WRECK_DAYS}d · wrecked`) },
  ]
    .map((t) => ({ ...t, x: logMax > 0 ? 88 - (Math.log1p(t.d) / logMax) * 76 : -1 }))
    .filter((t) => t.x > 9 && t.x < 85);

  // ── undersea currents — shared ground between charted vessels (the judgment
  //    graph made spatial). Relationship = normalizePremiseText EXACT equality
  //    only (§4-1: a broken wire yields a missing chord, never an invented
  //    one). Steady ground = ink-quiet; ground whose last re-check DRIFTED =
  //    var(--warning), a fact color, not a verdict (§4-3). Chords chain
  //    adjacent members sorted by x, computed as pure math from the plate's
  //    fixed aspect — no layout measurement, no SVG.
  const currents: SeaCurrent[] = [];
  // Premise keys whose ground has DRIFTED (last re-check moved). A decision
  // standing on a moved premise is exposed — this is what turns leverage from a
  // fact ("N stand together") into a warning ("N stand on ground that shifted").
  const driftedKeys = new Set<string>();
  if (receipts?.length) {
    const pos = new Map(placed.map((s) => [s.id, s]));
    for (const g of sharedGrounds(receipts)) {
      if (g.drift) driftedKeys.add(g.key);
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

  // The focused ship's ground-siblings (leverage), and the lines to them.
  const leverageFocus = actionShip && siblingsOf.has(actionShip)
    ? placed.find((p) => p.id === actionShip) ?? null
    : null;
  const leverageSibs = leverageFocus ? siblingsOf.get(leverageFocus.id)! : [];
  const leverageSet = leverageFocus
    ? new Set<string>([leverageFocus.id, ...leverageSibs.map((s) => s.id)])
    : null;
  const leverageLinks = leverageFocus
    ? leverageSibs.map((sib) => ({ x1: leverageFocus.x, y1: leverageFocus.y, x2: sib.x, y2: sib.y }))
    : [];
  // Is the focused group standing on ground that DRIFTED? Then leverage is a
  // warning (amber), not a neutral fact (gold).
  const leverageShaky = !!leverageFocus?.premise && driftedKeys.has(normalizePremiseText(leverageFocus.premise));
  const leverageHue = leverageShaky ? N.amber : N.gold;
  // Blast radius of the spotlit drift: how many charted decisions stand on the
  // premise that just moved (the drift chip's "그 위 N척").
  const driftKey = spotlight ? normalizePremiseText(spotlight.text) : '';
  const driftExposed = driftKey
    ? placed.filter((p) => p.premise && normalizePremiseText(p.premise) === driftKey).length
    : 0;

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
    <section id="decision-sea" className="scroll-mt-5" aria-label={L('결정 해도 — 각 결정의 현재 상태', 'Decision chart — current status of each decision')}>
      {/* Component-scoped keyframes. Plain static CSS (no user data). */}
      <style>{`
        @keyframes vsea-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-4px) } }
        @keyframes vsea-in { from { opacity: 0; transform: translateY(7px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes vsea-halo { 0%,100% { opacity: .4; transform: translate(-50%,-50%) scale(.9) } 50% { opacity: .85; transform: translate(-50%,-50%) scale(1.08) } }
        @keyframes vsea-pulse { 0%,100% { opacity: .45 } 50% { opacity: 1 } }
        @keyframes vsea-flow { to { background-position: 13px 0 } }
        .vsea-flow { animation: vsea-flow 1.6s linear infinite }
        .vsea-in { opacity: 0; animation: vsea-in .7s cubic-bezier(.32,.72,0,1) forwards }
        .vsea-bob { animation: vsea-bob 6s ease-in-out infinite }
        .vsea-halo { animation: vsea-halo 3.2s ease-in-out infinite }
        .vsea-pulse { animation: vsea-pulse 2.6s ease-in-out infinite }
        @media (prefers-reduced-motion: reduce) {
          .vsea-in { animation: none; opacity: 1 }
          .vsea-bob, .vsea-halo, .vsea-pulse, .vsea-flow { animation: none }
        }
      `}</style>

      {/* ── beacon banner — the due decision's prompt, ABOVE the map as a
            banner (07-13: floating it over the water always collided with
            ships). "① 지금 할 것 → ② 지도" hierarchy; zero overlap. Horizontal:
            kicker + name + sealed bet on the left, the CTA on the right. ── */}
      {beacon && (
        <div className="mb-2.5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 rounded-xl px-4 py-3" style={{ background: `linear-gradient(105deg, ${N.gold}14 0%, ${N.card} 34%)`, border: `1px solid ${N.gold}30`, boxShadow: `0 1px 2px ${N.paper}0d` }}>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.16em] font-semibold" style={{ color: N.goldInk }}>
              <span aria-hidden className="vsea-pulse inline-block w-1.5 h-1.5 rounded-full" style={{ background: N.gold }} />
              {L('그래서, 어떻게 됐어요?', 'So, how did it go?')}
              {dueShips.length > 1 && (
                <span className="font-normal opacity-70">· {L(`${dueShips.length}건`, `${dueShips.length} due`)}</span>
              )}
            </p>
            <p className="mt-1 text-[15px] font-bold leading-snug break-keep" style={{ color: N.ink, fontFamily: 'var(--font-display)' }}>
              {beacon.name}
            </p>
            {beacon.premise ? (
              <p className="mt-0.5 text-[12px] leading-relaxed break-keep" style={{ color: `${N.ink}a8` }}>
                {L('봉인한 내기 — ', 'Sealed bet — ')}
                <em style={{ color: `${N.ink}d0` }}>「{beacon.premise.length > 52 ? `${beacon.premise.slice(0, 52)}…` : beacon.premise}」</em>
              </p>
            ) : (
              <p className="mt-0.5 text-[12px] leading-relaxed break-keep" style={{ color: `${N.ink}a1` }}>
                {L('약속한 확인일이 왔어요. 봉인할 때의 눈으로 지금을 재볼 시간.', 'The check-in you promised has arrived — reread it with the eyes you sealed it with.')}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onReview(beacon.id)}
            className="shrink-0 self-start sm:self-center inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-mono font-semibold cursor-pointer transition-[gap] duration-300 hover:gap-2.5"
            style={{ background: N.gold, color: N.ink }}
          >
            {L('다시 보기', 'Revisit')} <span aria-hidden>→</span>
          </button>
        </div>
      )}

      {/* One instrument strip, attached to the chart. These are the chart's
          existing real filters promoted into the primary reading order: first
          see the fleet's shape, then isolate the slice that needs work. */}
      <div
        className="mb-2 flex items-center gap-1 overflow-x-auto border-y px-1 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="group"
        aria-label={L('결정 해도 상태 필터', 'Decision chart status filter')}
        style={{ borderColor: `${N.ink}1c` }}
      >
        <button
          type="button"
          onClick={() => setFilter(null)}
          aria-pressed={!activeFilter}
          className="inline-flex min-h-9 shrink-0 items-center gap-1.5 px-2.5 text-[12px] font-semibold transition-colors"
          style={!activeFilter ? { color: N.goldInk, boxShadow: `inset 0 -2px ${N.gold}` } : { color: 'var(--text-secondary)' }}
        >
          {L('전체', 'All')} <span className="font-mono text-[10.5px] tabular-nums opacity-70">{ships.length}</span>
        </button>
        {filterList.map((f) => {
          const on = activeFilter?.key === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(on ? null : f.key)}
              aria-pressed={on}
              className="inline-flex min-h-9 shrink-0 items-center gap-1.5 px-2.5 text-[12px] font-semibold transition-colors"
              style={{
                color: on ? (f.amber ? N.amberInk : N.goldInk) : f.gold ? N.goldInk : f.amber ? N.amberInk : 'var(--text-secondary)',
                boxShadow: on ? `inset 0 -2px ${f.amber ? N.amber : f.gold ? N.gold : N.ink}` : undefined,
              }}
            >
              {(f.gold || f.amber) && <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: f.amber ? N.amber : N.gold }} />}
              {L(f.ko, f.en)} <span className="font-mono text-[10.5px] tabular-nums opacity-70">{f.n}</span>
            </button>
          );
        })}
      </div>

      {/* Phones cannot afford six sentence labels on 326px of water. A native
          finder makes every vessel directly reachable without blind taps; the
          chart then spends its scarce label space on the selected vessel. */}
      <label className="mb-2 flex min-h-11 items-center gap-2 border-b px-1 pb-2 sm:hidden" style={{ borderColor: `${N.ink}1c` }}>
        <span className="shrink-0 text-[11px] font-semibold text-[var(--text-tertiary)]">{L('결정 찾기', 'Find decision')}</span>
        <select
          value={focusedDecisionId ?? ''}
          onChange={(event) => {
            const next = ships.find((ship) => ship.id === event.target.value);
            if (!next) return;
            onFocusDecision?.(next.id, next.kind);
            setActionShip(next.id);
          }}
          aria-label={L('해도에서 결정 찾기', 'Find a decision on the chart')}
          className="min-w-0 flex-1 bg-transparent py-1.5 text-[13px] font-medium text-[var(--text-primary)] outline-none"
        >
          <option value="">{L('이름으로 배 선택', 'Choose by name')}</option>
          {ships.map((ship) => (
            <option key={ship.id} value={ship.id}>{ship.name}</option>
          ))}
        </select>
      </label>

      {/* The living sea is a real image; the chart furniture and decisions stay
          separate, exact UI layers. That keeps the scene rich without letting
          generated art invent or move a single user fact. */}
      <div className="relative">
      <div
        className="relative overflow-hidden rounded-2xl min-h-[380px] sm:min-h-0 sm:aspect-[16/7.2]"
        style={{
          background: '#082625',
          boxShadow: 'inset 0 0 0 1px rgba(245,240,229,.22), 0 18px 46px -22px rgba(2,24,23,.78)',
        }}
      >
        <Image
          src="/images/voyage/argus-sea-chart-v1.jpg"
          alt=""
          fill
          sizes="(max-width: 640px) 100vw, 1120px"
          quality={90}
          priority
          className="object-cover object-[58%_center] sm:object-center"
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(180deg, rgba(1,21,21,.12) 0%, rgba(1,21,21,.04) 44%, rgba(1,17,17,.26) 100%)',
            boxShadow: 'inset 0 0 54px rgba(0,12,12,.42)',
          }}
        />
        {/* corner registration ticks — the plate signature */}
        {(['top-2 left-2 border-t border-l', 'top-2 right-2 border-t border-r', 'bottom-2 left-2 border-b border-l', 'bottom-2 right-2 border-b border-r'] as const).map((pos) => (
          <span key={pos} aria-hidden className={`absolute w-2.5 h-2.5 z-[2] pointer-events-none ${pos}`} style={{ borderColor: `${N.paper}30` }} />
        ))}
        {/* ── the axes, drawn as chart furniture so position reads as data ──
              Y = resolution (먼바다 위 → 항구 아래), X = activity recency
              (오래 방치 왼쪽 → 최근 오른쪽). A faint graticule + edge captions
              turn the sea into a scatter you can actually read. */}
        {/* ── the HOME LINE — the board's primary divider: above it a decision
              is still out (미해소), below it it's home (항구·완료). Placed at the
              resolution boundary between sailing and docked. */}
        <div aria-hidden className="absolute left-0 right-0 pointer-events-none" style={{ top: '62%', height: 1, background: `linear-gradient(90deg, transparent, ${N.paper}22 8%, ${N.paper}22 92%, transparent)` }} />
        <span aria-hidden className="absolute right-[2%] rounded-sm px-1.5 py-0.5 text-[10px] sm:text-[11px] font-mono pointer-events-none" style={{ top: 'calc(62% + 4px)', color: `${N.paper}d0`, background: 'rgba(2,28,27,.58)' }}>
          {L('↑ 아직 열려 있음 · 아래 결론에 가까움', '↑ still open · closer to conclusion below')}
        </span>
        {/* danger-zone tint — the upper-LEFT quadrant (unresolved + slipping).
            A fact of attention, never a verdict (거울 조항); shown only when
            ships actually sit there. */}
        {untended > 0 && (
          <div aria-hidden className="absolute pointer-events-none" style={{ left: 0, top: 0, width: '48%', height: '62%', background: 'radial-gradient(85% 92% at 0% 0%, color-mix(in srgb, var(--warning) 11%, transparent), transparent 72%)' }} />
        )}
        {/* honest recency thresholds — the real 14d / 30d lines, labeled. Only
            meaningful in the unresolved (upper) band, so they fade before the
            harbour. Real structure on the X axis (critique #4). */}
        {thresholds.map((t) => (
          <div key={t.d} aria-hidden className="absolute top-[12%] pointer-events-none" style={{ left: `${t.x}%`, bottom: '30%' }}>
            <div className="absolute inset-y-0" style={{ width: 1, background: `repeating-linear-gradient(180deg, ${N.paper}2e 0 4px, transparent 4px 8px)` }} />
            <span className="absolute -top-1 left-1 whitespace-nowrap rounded-sm px-1 py-0.5 text-[9.5px] sm:text-[10px] font-mono" style={{ color: `${N.paper}c4`, background: 'rgba(2,28,27,.52)' }}>{t.label}</span>
          </div>
        ))}

        {/* X-axis captions — the horizontal meaning (the home line + zone tags
            carry the vertical). Kept quiet; the "읽는 법" key does the teaching. */}
        <span className="absolute bottom-2.5 left-[2%] z-[3] rounded-sm px-1.5 py-0.5 text-[10px] sm:text-[11px] font-mono pointer-events-none" style={{ color: `${N.paper}d0`, background: 'rgba(2,28,27,.58)' }}>
          ← {L('오래 살피지 않음', 'long untended')}
        </span>
        <span className="absolute bottom-2.5 right-[2%] z-[3] rounded-sm px-1.5 py-0.5 text-[10px] sm:text-[11px] font-mono text-right pointer-events-none" style={{ color: `${N.paper}d0`, background: 'rgba(2,28,27,.58)' }}>
          {L('최근 확인', 'recently checked')} →
        </span>

        {/* ── ZONE TAGS — the board's control surface. Each names a diagnostic
              quadrant of the still-out band, shows its live count, and CLICKS to
              work that slice (same filter engine as the chips below). This is
              what makes the map a 판 you operate, not scenery you read. The
              danger zone (놓치는 중) leads in amber — a fact, not a verdict. ── */}
        {untended > 0 && (
          <button
            type="button"
            onClick={() => setFilter(filter === 'idle' ? null : 'idle')}
            aria-pressed={filter === 'idle'}
            className="absolute top-[5.5%] left-[2.5%] z-[4] items-center gap-1.5 rounded-full pl-2.5 pr-3 py-1.5 cursor-pointer transition-colors hidden sm:inline-flex"
            style={filter === 'idle'
              ? { background: N.amber, color: N.card }
              : { background: `${N.card}e0`, color: N.amber, boxShadow: `inset 0 0 0 1px ${N.amber}59` }}
          >
            <span aria-hidden className="w-1.5 h-1.5 rounded-full" style={{ background: filter === 'idle' ? N.card : N.amber }} />
            <span className="text-[11.5px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>{L('놓치는 중', 'slipping')}</span>
            <span className="text-[11px] font-mono tabular-nums font-bold">{untended}</span>
          </button>
        )}
        {sailingN > 0 && (
          <button
            type="button"
            onClick={() => setFilter(filter === 'sailing' ? null : 'sailing')}
            aria-pressed={filter === 'sailing'}
            className="absolute top-[5.5%] right-[2.5%] z-[4] items-center gap-1.5 rounded-full pl-3 pr-3 py-1.5 cursor-pointer transition-colors hidden sm:inline-flex"
            style={filter === 'sailing'
              ? { background: N.paper, color: N.ink }
              : { background: `${N.card}e0`, color: `${N.ink}b0`, boxShadow: `inset 0 0 0 1px ${N.ink}2e` }}
          >
            <span className="text-[11.5px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>{L('진행 중', 'in progress')}</span>
            <span className="text-[11px] font-mono tabular-nums font-bold">{sailingN}</span>
          </button>
        )}

        {/* ── "읽는 법" — the on-demand key. The whole map encodes position and
              colour as data; without this, a first-timer reads scenery, not a
              chart. Progressive disclosure keeps the plate quiet until asked. ── */}
        <button
          type="button"
          onClick={() => setShowKey((v) => !v)}
          aria-expanded={showKey}
          className="absolute bottom-11 right-2 z-[6] inline-flex min-h-9 items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-mono cursor-pointer transition-colors"
          style={{ background: `${N.card}ed`, color: `${N.ink}c8`, boxShadow: `inset 0 0 0 1px ${N.ink}22` }}
        >
          <span aria-hidden className="inline-flex items-center justify-center rounded-full text-[9px] font-bold" style={{ width: 13, height: 13, background: `${N.ink}1a` }}>?</span>
          {showKey ? L('닫기', 'Close') : L('읽는 법', 'Legend')}
        </button>
        {showKey && (
          <>
            <div aria-hidden className="absolute inset-0 z-[6]" style={{ background: `${N.paper}0a` }} onClick={() => setShowKey(false)} />
            <div
              role="group"
              aria-label={L('지도 읽는 법', 'How to read the chart')}
              className="absolute bottom-20 right-2 z-[7] w-[280px] max-w-[calc(100%_-_1rem)] rounded-lg p-3.5 text-left"
              style={{ background: N.card, boxShadow: `0 8px 28px ${N.ink}42, inset 0 0 0 1px ${N.ink}1f` }}
            >
              {/* Lead with the payoff — what to LOOK for — then the mechanism.
                  Plain decision-language, not the nautical metaphor. */}
              <p className="text-[11.5px] font-semibold leading-snug mb-1" style={{ color: N.ink, fontFamily: 'var(--font-display)' }}>
                {L('배 하나 = 결정 하나.', 'Each ship is one decision.')}
              </p>
              <p className="text-[10.5px] leading-relaxed mb-2.5" style={{ color: `${N.ink}b0` }}>
                {L('왼쪽 위로 갈수록 오래 방치됐고 아직 안 끝난 — 놓치기 쉬운 결정이에요.', 'The higher-left a ship sits, the more it is both long-untended and unfinished — the easy-to-miss ones.')}
              </p>
              {/* the two axes — named by what each MEASURES, then its two ends */}
              <div className="space-y-1.5 mb-2.5">
                <p className="text-[10.5px] leading-tight" style={{ color: `${N.ink}c8` }}>
                  <span className="font-semibold">{L('세로 ', 'Up/down ')}</span>
                  <span style={{ color: `${N.ink}90` }}>{L('얼마나 끝났나', 'how finished')}</span>
                  {L(' — 위 진행 중 · 아래 끝나서 항구', ' — top: in progress · bottom: arrived')}
                </p>
                <p className="text-[10.5px] leading-tight" style={{ color: `${N.ink}c8` }}>
                  <span className="font-semibold">{L('가로 ', 'Left/right ')}</span>
                  <span style={{ color: `${N.ink}90` }}>{L('언제 마지막에 봤나', 'last touched')}</span>
                  {L(' — 왼쪽 오래 전 · 오른쪽 최근', ' — left: long ago · right: recent')}
                </p>
              </div>
              {/* state marks — the very same ShipMarks drawn on the water, named
                  in plain terms (색으로도 구분: 금 끝남 · 주황 방치) */}
              <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 mb-2.5 pt-2.5" style={{ borderTop: `1px solid ${N.ink}12` }}>
                {([
                  { st: 'sailing', ko: '진행 중', en: 'in progress' },
                  { st: 'adrift', ko: '표류 — 방치됨', en: 'adrift' },
                  { st: 'verified', ko: '확인까지 끝', en: 'reckoned' },
                  { st: 'docked', ko: '아직 시작 전', en: 'not started' },
                ] as const).map((r) => (
                  <span key={r.st} className="flex items-center gap-1.5 text-[10px]" style={{ color: `${N.ink}c8` }}>
                    <span className="inline-flex items-end justify-center shrink-0" style={{ width: 20, height: 20 }}>
                      <ShipMark state={r.st} due={false} size={17} plain />
                    </span>
                    {L(r.ko, r.en)}
                  </span>
                ))}
              </div>
              <p className="text-[10px] pt-2 flex items-center gap-1.5" style={{ color: `${N.ink}9a`, borderTop: `1px solid ${N.ink}12` }}>
                <span aria-hidden style={{ color: N.gold }}>◆</span>
                {L('배를 누르면 바로 처리해요 — 열기·정산.', 'Tap a ship to act — open or settle, right here.')}
              </p>
            </div>
          </>
        )}

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

        {/* ── shared-ground links: when a ship with premise-siblings is focused,
              draw a line to each sibling (the leverage made visible). Above the
              water, below the ships. Only real, exact-match ground — never
              invented. ── */}
        {leverageSet && (
          <svg aria-hidden className="absolute inset-0 z-[1] pointer-events-none w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
            {leverageLinks.map((ln, i) => (
              <line
                key={i}
                x1={ln.x1} y1={ln.y1} x2={ln.x2} y2={ln.y2}
                stroke={leverageHue}
                strokeWidth={0.35}
                strokeDasharray="1.4 1.2"
                strokeOpacity={0.85}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
        )}

        {/* ── the ships ── */}
        <ul className="absolute inset-0 z-[2] list-none m-0 p-0">
          {placed.map((s, i) => {
            const meta = VOYAGE_STATE_META[s.state];
            const stateLabel = s.beacon ? L('다시 볼 때', 'due back') : L(meta.ko, meta.en);
            const attention = s.state === 'adrift' || s.state === 'wrecked';
            const hasAttentionSignal = s.kind === 'project' && attentionSet.has(s.id) && !s.due;
            const size = s.beacon ? 40 : dense ? (attention || hasAttentionSignal ? 17 : 15) : 24;
            // Persistent labels are KEYWORDS (short), never full sentences.
            // Sparse fleet → keyword on everyone. Dense fleet → keyword only on
            // the DUE decisions ("중요 과제 중심"; they scatter, so few collide).
            // The untended are carried by the amber corner + its "오래 손 놓음 N"
            // summary (창업자 praised that grouping) with names on hover — so
            // the neglect corner doesn't re-crowd with labels. Full name is
            // always one hover away and listed below the map.
            const kw = keyword(s.name);
            const matches = matchOf(s);
            const hasGround = siblingsOf.has(s.id); // stands on shared premise
            const shaky = hasGround && !!s.premise && driftedKeys.has(normalizePremiseText(s.premise));
            const selected = focusedDecisionId === s.id;
            // Filter dims non-matches; a leverage focus dims everything off the
            // shared-ground group so the standing-together reads instantly.
            const filterDimmed = !!activeFilter && !matches && !selected;
            const leverageDimmed = !!leverageSet && !leverageSet.has(s.id);
            const focusDimmed = !!focusedDecisionId && !selected;
            const dimmed = filterDimmed || leverageDimmed;
            const isLeverage = !!leverageSet && leverageSet.has(s.id);
            const groundHue = shaky ? N.amber : N.gold;
            // A filter turns the map into a work slice: matches light up AND
            // reveal their keyword (few remain, so they fit); the rest recede.
            const showKeyword = (activeFilter ? matches : !dense || s.due);
            // Mobile has no hover and (in dense mode) no labels — anonymous dots
            // you tap blind. So on mobile, still name the ships that are CALLING
            // (due + drifted): the few that need action get a keyword, the rest
            // stay gestalt + the list below. (창업자 07-13: 직관적 사용)
            const showKeywordMobile = selected || (!!activeFilter && matches && filterList.find((entry) => entry.key === activeFilter.key)?.n === 1);
            return (
              <li
                key={s.id}
                className="absolute"
                style={{ left: `${s.x}%`, top: `${s.y}%` }}
              >
                <button
                  type="button"
                  id={`voyage-ship-${s.id}`}
                  aria-haspopup="dialog"
                  aria-expanded={actionShip === s.id}
                  aria-pressed={selected}
                  aria-controls={actionShip === s.id ? `voyage-action-${s.id}` : undefined}
                  disabled={dimmed}
                  onClick={(e) => {
                    e.stopPropagation();
                    onFocusDecision?.(s.id, s.kind);
                    setActionShip((prev) => (prev === s.id ? null : s.id));
                  }}
                  title={`${s.name} — ${stateLabel} · ${s.sub}`}
                  aria-label={`${s.name} — ${stateLabel} · ${s.sub}`}
                  className={`vsea-in relative -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 p-1.5 sm:p-2 rounded-lg cursor-pointer group focus-visible:z-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] transition-[transform,opacity] duration-300 ${dimmed ? 'pointer-events-none' : 'hover:z-40 hover:-translate-y-[calc(50%+3px)]'}`}
                  data-voyage-selected={selected ? 'true' : 'false'}
                  style={{ animationDelay: `${Math.min(i, 8) * 70}ms`, opacity: dimmed ? 0.1 : focusDimmed ? 0.38 : 1 }}
                >
                {selected && (
                  <span
                    data-testid="voyage-selection-ring"
                    aria-hidden
                    className="absolute left-1/2 top-[36%] -z-[1] rounded-full"
                    style={{
                      width: size + 22,
                      height: size + 22,
                      transform: 'translate(-50%,-50%)',
                      boxShadow: `0 0 0 2px ${N.paper}, 0 0 0 4px ${N.gold}, 0 0 22px 4px ${N.gold}66`,
                    }}
                  />
                )}
                {s.beacon && (
                  <>
                    <span
                      aria-hidden
                      className="vsea-halo absolute left-1/2 top-[36%] -z-[1] rounded-full"
                      style={{ width: 110, height: 110, background: `radial-gradient(circle, color-mix(in srgb, ${N.goldGlow} 46%, transparent) 0%, transparent 64%)`, transform: 'translate(-50%,-50%)' }}
                    />
                    {/* a crisp gold ring — the due ship's calm marker (no beam) */}
                    <span
                      aria-hidden
                      className="absolute left-1/2 top-[36%] -z-[1] rounded-full"
                      style={{ width: 34, height: 34, border: `1.5px solid ${N.goldGlow}`, transform: 'translate(-50%,-50%)', opacity: 0.7 }}
                    />
                  </>
                )}
                {hasAttentionSignal && (
                  <span
                    data-testid="project-attention-signal"
                    aria-hidden="true"
                    className="vsea-pulse absolute left-1/2 top-[31%] -z-[1] rounded-full"
                    style={{ width: size + 12, height: size + 12, border: `1.5px dashed ${N.amber}`, transform: 'translate(-50%,-50%)', opacity: 0.8 }}
                  />
                )}
                {/* leverage highlight — a gold ring on the focused ground-group
                    so the standing-together reads at a glance. */}
                {isLeverage && (
                  <span aria-hidden className="absolute left-1/2 top-[38%] -z-[1] rounded-full" style={{ width: size + 16, height: size + 16, transform: 'translate(-50%,-50%)', boxShadow: `0 0 0 1.5px ${groundHue}, 0 0 12px 2px ${groundHue}55` }} />
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
                {/* passive leverage tell — a faint gold tie-dot marks a decision
                    that shares its sealed premise with another. Tap to see who. */}
                {hasGround && !s.beacon && !isLeverage && (
                  <span aria-hidden className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ top: '-2px', width: 4, height: 4, background: groundHue, opacity: shaky ? 0.9 : 0.7, boxShadow: `0 0 0 1.5px ${N.card}` }} />
                )}
                {/* persistent KEYWORD chip (short) for sparse fleets + the
                    ships that matter in a dense one. Not for the beacon — its
                    card carries the name. */}
                {(showKeyword || showKeywordMobile) && !s.beacon && (
                  <span
                    className={`${showKeywordMobile || selected ? 'block' : 'hidden'} ${showKeyword || selected ? 'sm:block' : 'sm:hidden'} mt-1 max-w-[128px] text-center text-[11px] sm:text-[11.5px] leading-[1.25] break-keep line-clamp-1 font-semibold rounded-full px-2 py-0.5`}
                    style={{
                      color: s.due ? N.goldInk : attention || hasAttentionSignal ? N.amberInk : `${N.ink}d8`,
                      fontFamily: 'var(--font-display)',
                      background: `${N.card}cc`,
                      boxShadow: s.due
                        ? `inset 0 0 0 1px ${N.gold}4d`
                        : `inset 0 0 0 1px ${N.ink}18`,
                    }}
                  >
                    {kw}
                  </span>
                )}
                {/* full name + state on hover/focus — the source of truth,
                    raised above neighbours (only one shows at a time). Not for
                    the beacon (card already shows it). */}
                {!s.beacon && actionShip !== s.id && (
                  <span
                    className="hidden sm:flex flex-col items-center gap-0.5 absolute top-[calc(100%+3px)] left-1/2 -translate-x-1/2 w-max max-w-[200px] px-2.5 py-1.5 rounded-md opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity pointer-events-none z-40 shadow-[var(--shadow-md)]"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}
                  >
                    <span className="text-center text-[12.5px] leading-[1.35] break-keep line-clamp-3 font-medium" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                      {s.name}
                    </span>
                    <span className="text-[10px] font-mono whitespace-nowrap" style={{ color: s.due ? N.goldInk : 'var(--text-tertiary)' }}>
                      {stateLabel} · {s.sub}
                    </span>
                  </span>
                )}
                </button>
              </li>
            );
          })}
        </ul>

      </div>

      {/* ── act-in-place: the ship's action card. Rendered OUTSIDE the clipped
            plate (child of the wrapper) so it can overhang the edge, anchored at
            the tapped ship. The board's payload — you work the decision here. ── */}
      {actionShip && (() => {
        const s = placed.find((p) => p.id === actionShip);
        if (!s) return null;
        const meta = VOYAGE_STATE_META[s.state];
        const stateLabel = s.due ? L('다시 볼 때', 'due back') : L(meta.ko, meta.en);
        const open = () => { if (s.kind === 'receipt') onSelectReceipt?.(s.id); else onSelect(s.id); setActionShip(null); };
        const review = () => { onReview(s.id); setActionShip(null); };
        // Clamp by the card's real half-width, not a percentage. A 15% clamp
        // still put 220px cards offscreen on a 390px phone when a ship hugged
        // the western shoal.
        const clampedLeft = `clamp(116px, ${s.x}%, calc(100% - 116px))`;
        const below = s.y < 52;
        return (
          <>
            <div className="absolute inset-0 z-[44]" onClick={() => setActionShip(null)} aria-hidden />
            <div
              ref={actionCardRef}
              id={`voyage-action-${s.id}`}
              role="dialog"
              data-edge-clamp="116"
              aria-label={s.name}
              className="absolute z-[45] w-[220px] rounded-xl p-3"
              style={{
                left: clampedLeft,
                [below ? 'top' : 'bottom']: below ? `calc(${s.y}% + 22px)` : `calc(${100 - s.y}% + 22px)`,
                transform: 'translateX(-50%)',
                background: N.card,
                boxShadow: `0 10px 30px ${N.ink}4a, inset 0 0 0 1px ${N.ink}1f`,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setActionShip(null);
                  window.requestAnimationFrame(() => document.getElementById(`voyage-ship-${s.id}`)?.focus());
                }}
                aria-label={L('행동 카드 닫기', 'Close action card')}
                className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-md text-[16px] cursor-pointer transition-colors hover:bg-white/10"
                style={{ color: `${N.ink}9a` }}
              >
                <span aria-hidden>×</span>
              </button>
              <p className="pr-7 text-[13px] font-semibold leading-snug break-keep line-clamp-2" style={{ color: N.ink, fontFamily: 'var(--font-display)' }}>
                {s.name}
              </p>
              <p className="mt-0.5 text-[10.5px] font-mono uppercase tracking-[0.06em] flex items-center gap-1.5" style={{ color: s.due ? N.gold : (s.state === 'adrift' || s.state === 'wrecked') ? N.amber : `${N.ink}88` }}>
                <span className="inline-flex items-end" style={{ width: 15, height: 15 }}><ShipMark state={s.state} due={s.due} size={13} plain /></span>
                {stateLabel} · {s.sub}
              </p>
              {/* the sealed bet this decision rests on — its own words. */}
              {s.premise && (
                <p className="mt-2 text-[11px] leading-relaxed break-keep" style={{ color: `${N.ink}b0` }}>
                  <span className="font-mono text-[9px] uppercase tracking-[0.1em]" style={{ color: `${N.ink}70` }}>{L('봉인한 전제', 'sealed premise')}</span><br />
                  <em style={{ color: `${N.ink}d8` }}>「{s.premise.length > 60 ? `${s.premise.slice(0, 60)}…` : s.premise}」</em>
                </p>
              )}
              {s.kind === 'project' && attentionSet.has(s.id) && !s.due && (
                <p className="mt-2 text-[10.5px] leading-relaxed" style={{ color: N.amber }}>
                  {L('다시 확인할 전제나 미결 질문이 있어요. 아래 목록에서 정확한 항목을 열 수 있습니다.', 'A premise or open question is due for review. Open the exact item from the list below.')}
                </p>
              )}
              {/* LEVERAGE — the decisions standing on the very same premise. A
                  fact (exact-match ground), not a verdict: if it moves, they move
                  together. This is the board's intelligence, not a menu. */}
              {leverageSibs.length > 0 && (
                <div className="mt-2 rounded-lg px-2.5 py-2" style={{ background: `${leverageHue}14` }}>
                  <p className="text-[10.5px] font-semibold flex items-center gap-1.5" style={{ color: leverageHue }}>
                    <span aria-hidden>⚭</span>
                    {L(`같은 전제 위 ${leverageSibs.length + 1}척 — 하나 흔들리면 같이`, `${leverageSibs.length + 1} on this same premise — one moves, all move`)}
                  </p>
                  {leverageShaky && (
                    <p className="mt-1 text-[10.5px] leading-snug flex items-start gap-1.5" style={{ color: N.amber }}>
                      <span aria-hidden>⚠</span>
                      {L('이 전제가 최근 흔들렸어요 — 위 결정들 다시 봐야.', 'This premise just moved — the decisions on it need a fresh look.')}
                    </p>
                  )}
                  <div className="mt-1 flex flex-col gap-0.5">
                    {leverageSibs.slice(0, 4).map((sib) => (
                      <button
                        key={sib.id}
                        type="button"
                        onClick={() => {
                          onFocusDecision?.(sib.id, sib.kind);
                          setActionShip(sib.id);
                        }}
                        className="text-left text-[11px] leading-snug break-keep line-clamp-1 hover:underline cursor-pointer"
                        style={{ color: `${N.ink}c0`, fontFamily: 'var(--font-display)' }}
                      >
                        · {sib.name}
                      </button>
                    ))}
                    {leverageSibs.length > 4 && (
                      <span className="text-[10px]" style={{ color: `${N.ink}80` }}>{L(`외 ${leverageSibs.length - 4}척`, `+${leverageSibs.length - 4} more`)}</span>
                    )}
                  </div>
                </div>
              )}
              <div className="mt-2.5 flex gap-1.5">
                {s.due && s.kind !== 'receipt' && (
                  <button
                    type="button"
                    data-testid="ship-action-review"
                    data-autofocus="true"
                    onClick={review}
                    className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg px-2.5 py-2 text-[12px] font-semibold cursor-pointer transition-opacity hover:opacity-90"
                    style={{ background: N.gold, color: N.ink }}
                  >
                    {L('정산·다시 보기', 'Settle')}
                  </button>
                )}
                <button
                  type="button"
                  data-testid="ship-action-open"
                  data-autofocus={s.due && s.kind !== 'receipt' ? undefined : 'true'}
                  onClick={open}
                  className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg px-2.5 py-2 text-[12px] font-semibold cursor-pointer transition-colors"
                  style={{ background: `${N.ink}0d`, color: N.ink, boxShadow: `inset 0 0 0 1px ${N.ink}22` }}
                >
                  {L('열기', 'Open')}
                </button>
              </div>
            </div>
          </>
        );
      })()}

      {/* ── drift chip — the amber current's voice, kept to the sky band so it
            never occludes ships. Fires ONLY on the groundSpotlight event;
            silent on flat days. The full ledger lives below (SharedGroundCard).
            Amber is a fact color, never a verdict (거울 조항). ── */}
      {spotlight && (
          <button
            type="button"
            onClick={() => onSelectReceipt?.(spotlight.members[0].receipt_id)}
            className="static sm:absolute sm:left-[2.5%] sm:top-[15%] z-[3] mt-3 sm:mt-0 flex items-center gap-2 rounded-full border py-1.5 pl-2.5 pr-3 cursor-pointer transition-[gap] hover:gap-2.5"
            style={{
              background: N.card,
              border: '1px solid color-mix(in srgb, var(--warning) 40%, transparent)',
              boxShadow: 'var(--shadow-sm)',
              maxWidth: 'min(94%, 340px)',
            }}
            aria-label={L(`전제 이동 — ${spotlight.text}. 전체 살펴보기`, `Premise moved — ${spotlight.text}. See the full ground`)}
          >
            <span aria-hidden className="vsea-pulse inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--warning)' }} />
            <span className="text-[9.5px] font-mono uppercase tracking-[0.12em] font-semibold shrink-0" style={{ color: 'var(--warning)' }}>
              {L('전제 이동', 'GROUND MOVED')}
            </span>
            <span className="text-[11px] truncate" style={{ color: `${N.ink}d0`, fontFamily: 'var(--font-display)' }}>
              「{spotlight.text.length > 22 ? `${spotlight.text.slice(0, 22)}…` : spotlight.text}」
            </span>
            {spotGauge && (
              <span className="text-[10px] font-mono tabular-nums shrink-0" style={{ color: 'var(--warning)' }}>
                {spotGauge.from != null ? `${spotGauge.from}→${spotGauge.to}` : spotGauge.to}
              </span>
            )}
            {/* blast radius — how many charted decisions stand on this moved
                premise. Turns a drift notice into "N of your calls are exposed." */}
            {driftExposed >= 2 && (
              <span className="text-[10px] font-semibold shrink-0" style={{ color: N.amber }}>
                · {L(`그 위 ${driftExposed}척`, `${driftExposed} on it`)}
              </span>
            )}
            <span aria-hidden className="text-[11px] shrink-0" style={{ color: `${N.ink}80` }}>→</span>
          </button>
      )}
      </div>

      {/* The chart speaks one live sentence after every filter or selection. */}
      <div className="mt-3 px-1">
        <p className="text-[12px] text-[var(--text-secondary)]" role="status" aria-live="polite" aria-atomic="true">
          {activeFilter
            ? L(
                `${L(activeFilter.ko, activeFilter.en)} ${filterList.find((f) => f.key === activeFilter.key)?.n ?? 0}건만 보는 중 — 나머지는 잠시 물러났어요.`,
                `Showing ${filterList.find((f) => f.key === activeFilter.key)?.n ?? 0} · ${activeFilter.en} — the rest stepped back.`,
              )
            : caption}
        </p>
      </div>
    </section>
  );
}
