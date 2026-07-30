'use client';

import { Anchor, CircleCheck, FileText, Flag, Sailboat, Waves } from 'lucide-react';
import type { VoyageState } from '@/lib/voyage-state';

const MARK = {
  foam: '#f5f0e5',
  ink: '#092827',
  brass: '#d8ad55',
  amber: '#e39a56',
};

function MarkerGlyph({ state, size, color }: { state: VoyageState; size: number; color: string }) {
  const props = { size, color, className: 'relative z-[1]', 'aria-hidden': true as const };
  switch (state) {
    case 'docked': return <Anchor {...props} strokeWidth={1.75} />;
    case 'arrived': return <Flag {...props} strokeWidth={1.75} />;
    case 'verified': return <CircleCheck {...props} strokeWidth={2.1} />;
    case 'adrift':
    case 'wrecked': return <Waves {...props} strokeWidth={1.75} />;
    default: return <Sailboat {...props} strokeWidth={1.75} />;
  }
}

/**
 * A voyage is represented by a chart instrument, not a miniature illustration.
 * The same marker is used on the sea and in the registry so position, state and
 * the project card all refer to one visual object.
 */
export function VoyageMarker({
  state,
  due = false,
  kind = 'project',
  size = 28,
  heading = 0,
  plain = false,
  title,
  className = '',
}: {
  state: VoyageState;
  due?: boolean;
  kind?: 'project' | 'receipt';
  size?: number;
  heading?: number;
  plain?: boolean;
  title?: string;
  className?: string;
}) {
  const drifted = state === 'adrift' || state === 'wrecked';
  const completed = state === 'arrived' || state === 'verified';
  // Gold has one job on the map: "this needs your attention now". Completed
  // decisions are already unambiguous from the check/flag glyph.
  const tone = due ? MARK.brass : drifted ? MARK.amber : MARK.foam;
  const iconSize = Math.max(12, Math.round(size * 0.46));
  const rotation = state === 'wrecked' ? 12 : state === 'adrift' ? -8 : heading;

  return (
    <span
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size, transform: rotation ? `rotate(${rotation}deg)` : undefined }}
    >
      {!plain && state === 'sailing' && (
        <span
          className="absolute right-[72%] top-1/2 h-px w-[82%] -translate-y-1/2"
          style={{ background: `linear-gradient(90deg, transparent, ${MARK.foam}8f)` }}
        />
      )}
      {!plain && due && (
        <span
          className="absolute inset-[-22%] rounded-full"
          style={{ border: `1px solid ${MARK.brass}a8`, boxShadow: `0 0 18px ${MARK.brass}66` }}
        />
      )}
      <span
        className="absolute inset-0 rounded-full"
        style={{
          background: completed
            ? 'radial-gradient(circle at 35% 28%, #174845 0%, #082a29 58%, #051b1b 100%)'
            : 'radial-gradient(circle at 35% 28%, #123c3a 0%, #072625 58%, #041918 100%)',
          border: `1px solid ${tone}`,
          boxShadow: `inset 0 0 0 1px ${MARK.foam}16, 0 2px 7px #00100fb8`,
          opacity: state === 'wrecked' ? 0.72 : 1,
        }}
      />
      <MarkerGlyph state={state} size={iconSize} color={tone} />
      {kind === 'receipt' && (
        <span
          className="absolute -right-[9%] -top-[8%] z-[2] inline-flex items-center justify-center rounded-full"
          style={{
            width: Math.max(10, size * 0.36),
            height: Math.max(10, size * 0.36),
            color: MARK.ink,
            background: MARK.foam,
            border: `1px solid ${MARK.ink}2e`,
          }}
        >
          <FileText size={Math.max(7, size * 0.2)} strokeWidth={2.2} />
        </span>
      )}
    </span>
  );
}
