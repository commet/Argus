'use client';

import { useMemo } from 'react';
import type { JudgmentReceipt } from '@/lib/review';
import { sharedGrounds } from '@/lib/judgment-graph';
import { pickFocusGround, blastRadius } from '@/lib/judgment-graph-layout';
import { VoyageMarker } from './VoyageMarker';

/**
 * Judgment knowledge graph — the drift-triggered blast-radius view (BLUEPRINT
 * §9.9 V2a). One load-bearing ground at the center; the still-open bets resting
 * on it radiate out. When reality has moved the ground since it was sealed the
 * radius runs "hot" (amber) — the one thing the eye should catch first.
 *
 * This is a CHART, not an illustration: the fixed dark plate carries mood, every
 * datum is an exact HTML/SVG layer on top, and position IS data (the rests-on
 * topology). It reuses VoyageMarker so a ground/bet here is the same visual object
 * as a ship on the sea.
 *
 * SPINE (CLAUDE.md §Zero-Judgment, BLUEPRINT §9.8/§9.9):
 *  - Facts + counts only. The settled record renders as a bare "2 ✓ 1 ✗" tally,
 *    explicitly labelled "facts, not a grade" — never a score/tier/verdict.
 *  - Amber = attention (a footing that moved), never a red "you were wrong".
 *  - The premise is quoted verbatim; the graph invents no relationship — edges
 *    exist only where the ledger asserts the same ground (judgment-graph.ts).
 *  - Restraint: renders nothing when no ground both recurs AND still carries a
 *    live bet. A blank surface is honest; a manufactured map is not.
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

function clip(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

export function JudgmentGraph({
  receipts,
  locale = 'ko',
}: {
  receipts: JudgmentReceipt[];
  locale?: 'ko' | 'en';
}) {
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);

  const blast = useMemo(() => {
    const focus = pickFocusGround(sharedGrounds(receipts));
    return focus ? blastRadius(focus) : null;
  }, [receipts]);

  if (!blast) return null;
  const { center, spokes, edges, overflow, hot, ground } = blast;
  const rec = ground.record;
  const drift = ground.drift;
  const driftLine = drift
    ? typeof drift.baseline_numeric === 'number' && typeof drift.current_numeric === 'number'
      ? `${drift.baseline_numeric} → ${drift.current_numeric}`
      : clip(drift.current_text || drift.finding, 48)
    : '';

  return (
    <section aria-labelledby="ground-map-h" className="mt-10">
      <header className="mb-3">
        <h2
          id="ground-map-h"
          className="text-[15px] font-semibold"
          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
        >
          {L('공유 지반 — 무엇이 함께 흔들리나', 'Shared ground — what moves together')}
        </h2>
        <p className="mt-1 text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {L(
            '여러 결정이 같은 전제 위에 서 있어요. 그 전제가 움직이면, 그 위에 선 열린 내기가 함께 흔들립니다.',
            'Several decisions rest on one assumption. When it moves, every open bet standing on it moves with it.',
          )}
        </p>
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

        {/* open bets standing on the ground */}
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

        {/* the load-bearing ground */}
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
            {rec && ` · ${rec.held} ✓ ${rec.broke} ✗${rec.mixed ? ` ${rec.mixed} ~` : ''}`}
          </span>
        </div>

        {/* drift alarm — the one salient signal */}
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

        {/* honest overflow — never silently dropped */}
        {overflow > 0 && (
          <span
            className="absolute bottom-3 right-3 z-[4] rounded-full px-2.5 py-1 text-[11px]"
            style={{ background: '#f5f0e514', color: '#f5f0e5cc', border: '1px solid #f5f0e524' }}
          >
            {L(`+${overflow}건 더`, `+${overflow} more`)}
          </span>
        )}
      </div>

      {rec && (
        <p className="mt-2 text-[11px] leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
          {L(
            '✓ 지켜짐 · ✗ 깨짐 · ~ 혼재 — 이 지반에 선 정산된 결정들의 기록입니다 (평가가 아니라 사실).',
            '✓ held · ✗ broke · ~ mixed — the record of settled decisions resting on this ground (facts, not a grade).',
          )}
        </p>
      )}
    </section>
  );
}
