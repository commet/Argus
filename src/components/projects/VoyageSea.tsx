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
  state: VoyageState;
  /** The one promised return: this ship's check-in date has arrived. */
  due: boolean;
  /** Days past / until check-in (negative = still ahead), when promised. */
  dueDays: number | null;
  /** The user's own sealed bet text, for the beacon quote. Null = none sealed. */
  premise: string | null;
  /** One quiet fact line under the name (state · elapsed), locale-resolved. */
  sub: string;
  idleDays: number;
  createdAt: string;
}

/** Art-directed slots per zone (% of plate). Deterministic, collision-free,
 *  composed — a hash-scatter reads as noise; a hand-set constellation reads
 *  as a chart. Order = assignment order (oldest first within a zone). */
const SLOTS: Record<'sailing' | 'adrift' | 'wrecked' | 'harbor' | 'docked', Array<{ x: number; y: number }>> = {
  sailing: [
    { x: 21, y: 30 }, { x: 38, y: 17 }, { x: 58, y: 27 }, { x: 30, y: 47 },
    { x: 55, y: 48 }, { x: 72, y: 38 }, { x: 12, y: 16 },
  ],
  adrift: [ { x: 8, y: 28 }, { x: 11, y: 48 }, { x: 6, y: 63 } ],
  wrecked: [ { x: 14, y: 77 }, { x: 23, y: 81 }, { x: 7, y: 82 } ],
  harbor: [ { x: 42, y: 86 }, { x: 50, y: 86 }, { x: 58, y: 86 }, { x: 66, y: 86 }, { x: 34, y: 86 } ],
  docked: [ { x: 86, y: 86 }, { x: 92, y: 86 }, { x: 80, y: 86 } ],
};
const BEACON_SLOT = { x: 44, y: 36 };

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
 *  furled + a fleck of gold at the masthead · beacon = gold canvas + halo. */
function ShipMark({ state, due, size }: { state: VoyageState; due: boolean; size: number }) {
  const w = size;
  const h = Math.round(size * 1.12);
  const sail = due ? N.gold : N.paper;
  const heel = state === 'adrift' ? -11 : 0;

  if (state === 'wrecked') {
    // Aground on the shoal: heeled bare hull + stump of mast, sinking into the
    // hatch. Dimmed — never enlarged, never colored as failure.
    return (
      <span aria-hidden className="relative block" style={{ width: w, height: h, opacity: 0.5 }}>
        <span className="absolute block" style={{ left: '8%', right: '8%', bottom: '18%', height: '17%', background: N.paper, borderRadius: '2px 2px 12px 12px / 2px 2px 100% 100%', transform: 'rotate(21deg)' }} />
        <span className="absolute block" style={{ left: '52%', bottom: '30%', width: 1.5, height: '34%', background: N.paper, transform: 'rotate(28deg)' }} />
      </span>
    );
  }

  const furled = state === 'docked' || state === 'arrived' || state === 'verified';
  return (
    <span aria-hidden className="relative block" style={{ width: w, height: h, transform: heel ? `rotate(${heel}deg)` : undefined }}>
      {/* wake — only a ship under way leaves one */}
      {state === 'sailing' && (
        <>
          <span className="absolute block" style={{ left: '-52%', bottom: '9%', width: '48%', height: 1, background: `linear-gradient(to right, transparent, ${N.paper}66)` }} />
          <span className="absolute block" style={{ left: '-34%', bottom: '3%', width: '30%', height: 1, background: `linear-gradient(to right, transparent, ${N.paper}44)` }} />
        </>
      )}
      {/* hull */}
      <span className="absolute block" style={{ left: '6%', right: '6%', bottom: 0, height: '16%', background: N.paper, borderRadius: '2px 2px 12px 12px / 2px 2px 100% 100%' }} />
      {/* mast */}
      <span className="absolute block" style={{ left: '50%', bottom: '14%', width: 1.5, height: '74%', background: N.paper, transform: 'translateX(-50%)' }} />
      {furled ? (
        // canvas struck and lashed to the boom — a ship at her moorings
        <span className="absolute block" style={{ left: '38%', bottom: '52%', width: '26%', height: '7%', background: N.paper, opacity: 0.75, borderRadius: 2 }} />
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
      {/* verified — one fleck of gold at the masthead. The record's only medal. */}
      {state === 'verified' && (
        <span className="absolute block" style={{ left: '50%', top: 0, width: 4, height: 4, background: N.gold, borderRadius: 1 }} />
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
        state,
        due,
        dueDays: cs?.daysUntilCheckIn ?? null,
        premise,
        sub,
        idleDays: idle,
        createdAt: p.created_at || lastActivityAt || '',
      });
    }
    // Stable assignment order inside each zone: oldest voyage first.
    list.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, reframeItems, recastItems, synthesizeItems, feedbackHistory, progressiveSessions, dueProjectIds, locale]);

  // Below two ships there is no sea to chart — the page's list carries it.
  if (ships.length < 2) return null;

  // ── zone assignment. The beacon = the FIRST due ship (most overdue). Other
  //    due ships keep their zone but fly gold canvas. ──
  const dueShips = ships.filter((s) => s.due);
  const beacon = dueShips.length
    ? [...dueShips].sort((a, b) => (a.dueDays ?? 0) - (b.dueDays ?? 0))[0]
    : null;

  type Placed = SeaShip & { x: number; y: number; beacon: boolean };
  const placed: Placed[] = [];
  const overflow: Record<string, number> = {};
  const used: Record<keyof typeof SLOTS, number> = { sailing: 0, adrift: 0, wrecked: 0, harbor: 0, docked: 0 };
  for (const s of ships) {
    if (beacon && s.id === beacon.id) {
      placed.push({ ...s, ...BEACON_SLOT, beacon: true });
      continue;
    }
    const zone: keyof typeof SLOTS =
      s.state === 'adrift' ? 'adrift'
      : s.state === 'wrecked' ? 'wrecked'
      : s.state === 'arrived' || s.state === 'verified' ? 'harbor'
      : s.state === 'docked' ? 'docked'
      : 'sailing';
    const slot = SLOTS[zone][used[zone]];
    if (!slot) {
      overflow[zone] = (overflow[zone] || 0) + 1;
      continue;
    }
    used[zone]++;
    placed.push({ ...s, ...slot, beacon: false });
  }

  const counts = {
    adrift: ships.filter((s) => s.state === 'adrift').length,
    wrecked: ships.filter((s) => s.state === 'wrecked').length,
  };

  // Honest caption — plain facts in the calm register, no manufactured urgency.
  const caption = beacon
    ? L(
        `지금 다시 볼 결정 ${dueShips.length}건 — 등대가 비추고 있어요.`,
        `${dueShips.length} decision${dueShips.length === 1 ? '' : 's'} to revisit — the light is on ${dueShips.length === 1 ? 'it' : 'them'}.`,
      )
    : counts.adrift + counts.wrecked > 0
      ? L(
          `표류 ${counts.adrift} · 난파 ${counts.wrecked} — 열면 다시 뜹니다.`,
          `${counts.adrift} adrift · ${counts.wrecked} wrecked — open one and it refloats.`,
        )
      : L(
          `부를 배가 없어요. ${ships.length}척 모두 제 항로에 있어요.`,
          `Nothing calls you back. All ${ships.length} ships are on course.`,
        );

  const overflowNote = Object.values(overflow).reduce((a, b) => a + b, 0);

  return (
    <section aria-label={L('항해 지도 — 결정들의 현재 위치', 'Voyage chart — where each decision is now')}>
      {/* Component-scoped keyframes. Plain static CSS (no user data). */}
      <style>{`
        @keyframes vsea-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-4px) } }
        @keyframes vsea-in { from { opacity: 0; transform: translateY(7px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes vsea-beam { 0%,100% { transform: translateX(-50%) rotate(-44deg) } 50% { transform: translateX(-50%) rotate(34deg) } }
        @keyframes vsea-halo { 0%,100% { opacity: .35; transform: translate(-50%,-50%) scale(.88) } 50% { opacity: .8; transform: translate(-50%,-50%) scale(1.1) } }
        @keyframes vsea-pulse { 0%,100% { opacity: .45 } 50% { opacity: 1 } }
        .vsea-in { opacity: 0; animation: vsea-in .7s cubic-bezier(.32,.72,0,1) forwards }
        .vsea-bob { animation: vsea-bob 6s ease-in-out infinite }
        .vsea-beam { animation: vsea-beam 26s ease-in-out infinite }
        .vsea-halo { animation: vsea-halo 3.2s ease-in-out infinite }
        .vsea-pulse { animation: vsea-pulse 2.6s ease-in-out infinite }
        @media (prefers-reduced-motion: reduce) {
          .vsea-in { animation: none; opacity: 1 }
          .vsea-bob, .vsea-beam, .vsea-halo, .vsea-pulse { animation: none }
        }
      `}</style>

      {/* ── the night sea plate (committed dark — a framed nocturne) ── */}
      <div
        className="relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] shadow-[var(--shadow-md)] min-h-[400px] sm:min-h-0 sm:aspect-[16/7.2]"
        style={{ background: `linear-gradient(176deg, ${N.seaHi} 0%, ${N.sea} 52%, ${N.seaDeep} 100%)` }}
      >
        {/* swell — engraved hairlines, fading toward the horizon */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background: `repeating-linear-gradient(180deg, transparent 0 34px, ${N.paper}0d 34px 35px)`,
            maskImage: 'linear-gradient(180deg, transparent 0%, black 30%, black 84%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(180deg, transparent 0%, black 30%, black 84%, transparent 100%)',
          }}
        />
        {/* night air — a whisper of starlight, a breath of moon */}
        <div aria-hidden className="absolute inset-0" style={{ background: `radial-gradient(42% 30% at 76% 4%, ${N.paper}0e, transparent 70%)` }} />
        <div
          aria-hidden
          className="absolute top-[7%] left-[12%] w-px h-px rounded-full"
          style={{ background: `${N.paper}55`, boxShadow: `14vw 2vh 0 0 ${N.paper}33, 34vw -1vh 0 0 ${N.paper}44, 52vw 3vh 0 0 ${N.paper}2e, 63vw -2vh 0 0 ${N.paper}40, 26vw 6vh 0 0 ${N.paper}26` }}
        />

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

        {/* the lighthouse — Argus, keeping watch. Its beam is the sheet's one
            bold move; reduced-motion holds it still. */}
        <div aria-hidden className="absolute" style={{ left: '75%', bottom: '11%', width: 3, height: 30, background: `${N.paper}5e`, transform: 'translateX(-50%)' }} />
        <div aria-hidden className="absolute rounded-full" style={{ left: '75%', bottom: 'calc(11% + 29px)', width: 5, height: 5, background: N.gold, transform: 'translateX(-50%)', boxShadow: `0 0 10px 2px ${N.gold}66` }} />
        <div
          aria-hidden
          className="vsea-beam absolute"
          style={{
            left: '75%',
            bottom: 'calc(11% + 30px)',
            width: 'min(58vw, 620px)',
            aspectRatio: '1',
            transformOrigin: '50% 100%',
            transform: 'translateX(-50%) rotate(-8deg)',
            background: `conic-gradient(from -10deg at 50% 100%, transparent 0deg, ${N.gold}12 7deg, ${N.gold}1f 10deg, ${N.gold}12 13deg, transparent 20deg)`,
          }}
        />

        {/* zone inscriptions — the chart register, kept to a whisper */}
        <span className="absolute top-[6%] left-[3%] text-[9px] font-mono uppercase tracking-[0.22em] pointer-events-none" style={{ color: `${N.paper}59` }}>
          {L('먼바다', 'OPEN SEA')}
        </span>
        <span className="absolute bottom-[3%] left-[3%] text-[9px] font-mono uppercase tracking-[0.22em] pointer-events-none" style={{ color: `${N.paper}59` }}>
          {L('항구', 'HARBOR')}
        </span>
        <span className="absolute top-[3.5%] right-[3%] text-[9px] font-mono tracking-[0.14em] tabular-nums pointer-events-none hidden sm:block" style={{ color: `${N.paper}4d` }}>
          {L(`전체 ${ships.length}척`, `${ships.length} SHIPS`)}
        </span>

        {/* ── the ships ── */}
        <div role="list" className="absolute inset-0 z-[2]">
          {placed.map((s, i) => {
            const meta = VOYAGE_STATE_META[s.state];
            const stateLabel = s.beacon ? L('다시 볼 때', 'due back') : L(meta.ko, meta.en);
            const size = s.beacon ? 42 : 24;
            return (
              <button
                key={s.id}
                type="button"
                role="listitem"
                onClick={() => (s.due ? onReview(s.id) : onSelect(s.id))}
                title={`${s.name} — ${stateLabel}`}
                aria-label={`${s.name} — ${stateLabel} · ${s.sub}`}
                className="vsea-in absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 p-2.5 rounded-lg cursor-pointer group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] transition-transform duration-300 hover:-translate-y-[calc(50%+3px)]"
                style={{ left: `${s.x}%`, top: `${s.y}%`, animationDelay: `${Math.min(i, 8) * 70}ms` }}
              >
                {s.beacon && (
                  <span
                    aria-hidden
                    className="vsea-halo absolute left-1/2 top-[34%] -z-[1] rounded-full"
                    style={{ width: 120, height: 120, background: `radial-gradient(circle, ${N.gold}2b 0%, transparent 62%)`, transform: 'translate(-50%,-50%)' }}
                  />
                )}
                <span className={s.state === 'wrecked' || s.state === 'docked' ? '' : 'vsea-bob'} style={{ animationDelay: `${(i % 5) * 1.1}s` }}>
                  <ShipMark state={s.state} due={s.due} size={size} />
                </span>
                <span
                  className={`${s.beacon ? '' : 'hidden sm:block'} max-w-[96px] text-center text-[10.5px] leading-[1.3] break-keep line-clamp-2 font-medium`}
                  style={{ color: s.beacon ? N.paper : `${N.paper}b8`, fontFamily: 'var(--font-display)' }}
                >
                  {s.name}
                </span>
                <span className={`${s.beacon ? '' : 'hidden sm:block'} text-[8px] font-mono uppercase tracking-[0.08em]`} style={{ color: s.beacon ? N.gold : `${N.paper}66` }}>
                  {stateLabel} · {s.sub}
                </span>
              </button>
            );
          })}
          {overflowNote > 0 && (
            <span className="absolute right-[3%] top-[14%] text-[9px] font-mono tabular-nums pointer-events-none" style={{ color: `${N.paper}59` }}>
              {L(`+${overflowNote}척`, `+${overflowNote} more`)}
            </span>
          )}
        </div>

        {/* ── beacon notice — the sheet's single voice, only when a promised
              check-in has actually arrived ── */}
        {beacon && (
          <div className="static sm:absolute sm:right-[2.5%] sm:top-[7%] z-[3] m-3 sm:m-0 sm:max-w-[300px] rounded-xl border p-4" style={{ background: `${N.seaDeep}d9`, borderColor: `${N.paper}24`, backdropFilter: 'blur(3px)' }}>
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
      </div>

      {/* ── under the plate: the honest caption + the chart legend ── */}
      <div className="mt-2.5 px-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
        <p className="text-[12px] text-[var(--text-secondary)]">{caption}</p>
        <div aria-hidden className="hidden md:flex items-center gap-4 text-[9px] font-mono uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
          {(
            [
              ['sailing', L('항해 중', 'sailing')],
              ['adrift', L('표류', 'adrift')],
              ['wrecked', L('난파', 'wrecked')],
              ['verified', L('검증됨', 'verified')],
            ] as Array<[VoyageState, string]>
          ).map(([st, label]) => (
            <span key={st} className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1" style={{ background: N.sea }}>
              <ShipMark state={st} due={false} size={13} />
              <span style={{ color: `${N.paper}99` }}>{label}</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
