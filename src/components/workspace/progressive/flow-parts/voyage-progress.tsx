'use client';

/**
 * VoyageProgress — the ship crossing while the AI works.
 *
 * What it replaces and why. The status bar used to carry a bare 1px rule with a
 * quarter-width segment sliding across it forever ("decorative activity line").
 * It moved, but it said nothing: the same animation played whether one reviewer
 * of five had finished or four had, so the founder's reading of the screen was
 * "선만 쓱쓱 지나가서 뭐가 진행중인지 감이 안 온다". A progress indicator that
 * cannot be wrong is a progress indicator that carries no information.
 *
 * So this one is honest in two modes:
 *
 *   determinate    — when the caller knows the count (reviewers done / total),
 *                    the ship sits at that fraction of the crossing and the
 *                    water behind it is inked. Position IS the progress; it
 *                    only moves when something actually finished.
 *   indeterminate  — when nothing countable is running, the ship keeps sailing
 *                    on a long eased cycle. It never pretends to a percentage:
 *                    there is no filled track behind it, only wake.
 *
 * The ship is drawn in the same ink-line language as the landing illustration
 * (`landing/voyage/illustrations/SailingShip.tsx`) rather than an icon-font
 * sailboat, because this is the one moment in the product where the voyage
 * metaphor is doing work instead of decorating. Strokes use currentColor so it
 * inherits the accent and stays correct in both themes.
 *
 * Motion is suppressed under prefers-reduced-motion: the ship holds its true
 * position (determinate) or rests mid-crossing (indeterminate). Nothing here is
 * announced to screen readers — the status bar's text already says the same
 * thing in words, and this is its illustration.
 */

import { motion, useReducedMotion } from 'framer-motion';
import { EASE } from '../shared/constants';

/**
 * A three-masted ship at 28×18, bow to the right, drawn with the same
 * 0.9px ink stroke the landing plate uses. Deliberately not an emoji and not a
 * lucide glyph — both read as clip-art next to the rest of the page.
 */
function ShipMark({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 28 18"
      width="28"
      height="18"
      fill="none"
      className={className}
      aria-hidden
    >
      {/* hull — high stern on the left, cutwater on the right */}
      <path
        d="M3.2 13.4 L24 13.4 L21.4 16.4 L6 16.4 Z"
        stroke="currentColor"
        strokeWidth="0.9"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.12"
      />
      {/* sheer line + stern castle */}
      <path d="M3.2 13.4 L2.4 10.9" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" />
      {/* bowsprit into the wind */}
      <path d="M24 13.4 L27.2 11.6" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
      {/* masts */}
      <path d="M9 13.4 L9 2.6" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" />
      <path d="M16.5 13.4 L16.5 4.2" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" />
      {/* mainsail + foresail, billowing leeward (to the right) */}
      <path
        d="M9 4.2 C13.4 5.1 14 8.4 9.9 12.2 L9 12.2 Z"
        stroke="currentColor"
        strokeWidth="0.85"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.16"
      />
      <path
        d="M16.5 5.6 C19.7 6.4 20.1 9.1 17.2 12.2 L16.5 12.2 Z"
        stroke="currentColor"
        strokeWidth="0.85"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.16"
      />
      {/* pennant */}
      <path d="M9 2.6 L11.6 3.4 L9 4.1" stroke="currentColor" strokeWidth="0.7" strokeLinejoin="round" />
    </svg>
  );
}

export function VoyageProgress({
  done,
  total,
  slow = false,
}: {
  /** Reviewers finished. Ignored unless `total` is a positive number. */
  done?: number;
  /** Reviewers dispatched. Absent or 0 → indeterminate crossing. */
  total?: number;
  /** The current call has been running a long time — slow the cycle down. */
  slow?: boolean;
}) {
  const reduced = useReducedMotion();
  const determinate = typeof total === 'number' && total > 0;

  // Keep the ship off both edges: at 0/5 it should look moored at the near
  // shore, not clipped, and at 5/5 it should look arrived rather than gone.
  const fraction = determinate ? Math.min(1, Math.max(0, (done ?? 0) / total)) : 0;
  const left = `calc(6% + ${(fraction * 82).toFixed(2)}%)`;

  return (
    <div className="relative mt-2.5 h-[22px] select-none" aria-hidden>
      {/* horizon — faint ahead of the ship, inked where it has already sailed */}
      <div className="absolute left-0 right-0 bottom-[5px] h-px bg-[var(--border-subtle)]" />
      {determinate && (
        <motion.div
          className="absolute left-0 bottom-[5px] h-px bg-[var(--accent)]/55"
          initial={false}
          animate={{ width: `calc(6% + ${(fraction * 82).toFixed(2)}%)` }}
          transition={{ duration: reduced ? 0 : 0.9, ease: EASE }}
        />
      )}

      {determinate ? (
        <motion.div
          className="absolute bottom-[3px] text-[var(--accent)]"
          initial={false}
          animate={{ left }}
          transition={{ duration: reduced ? 0 : 0.9, ease: EASE }}
          style={{ transform: 'translateX(-50%)' }}
        >
          <Bobbing reduced={reduced}>
            <ShipMark />
          </Bobbing>
        </motion.div>
      ) : (
        <motion.div
          className="absolute bottom-[3px] text-[var(--accent)]"
          initial={{ left: '4%' }}
          animate={reduced ? { left: '48%' } : { left: ['4%', '92%'] }}
          transition={
            reduced
              ? { duration: 0 }
              : { duration: slow ? 11 : 7.5, repeat: Infinity, repeatType: 'reverse', ease: EASE }
          }
          style={{ transform: 'translateX(-50%)' }}
        >
          <Bobbing reduced={reduced}>
            <ShipMark />
          </Bobbing>
        </motion.div>
      )}
    </div>
  );
}

/** A slow rise and fall, so the ship sits on water rather than on a rail. */
function Bobbing({ reduced, children }: { reduced: boolean | null; children: React.ReactNode }) {
  if (reduced) return <>{children}</>;
  return (
    <motion.div
      animate={{ y: [0, -1.4, 0] }}
      transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
    >
      {children}
    </motion.div>
  );
}
