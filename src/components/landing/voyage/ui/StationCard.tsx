'use client';

/**
 * StationCard — one of the five division stations in Act 2's cutaway.
 *
 * Visible at-a-glance: division name (display serif), member count
 * (mono badge), one-line role. Hover state lifts via Cartouche's gold
 * shadow so the system reveal is interactive without being noisy.
 */

import { Cartouche } from './Cartouche';
import type { CrewDivision } from '@/data/voyage-crew';

type Locale = 'ko' | 'en';

export function StationCard({
  division,
  locale,
  number,           // 01..05 in cutaway order
  active = false,   // controlled by parent (lifted state for cutaway sync)
}: {
  division: CrewDivision;
  locale: Locale;
  number: number;
  active?: boolean;
}) {
  return (
    <div style={{ width: '100%' }}>
      <Cartouche padding={14} active={active}>
        {/* Top row: index + count badge */}
        <div
          className="bp-mono"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            color: 'var(--bp-ink-soft)',
            fontSize: 10.5,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          <span>No. {String(number).padStart(2, '0')}</span>
          <span
            style={{
              border: '1px solid var(--bp-ink-faint)',
              padding: '1px 7px',
              fontSize: 10,
              letterSpacing: '0.12em',
              color: 'var(--bp-ink)',
            }}
          >
            ×{String(division.members.length).padStart(2, '0')}
          </span>
        </div>

        {/* Division name */}
        <div
          style={{
            fontFamily: 'var(--font-display)',
            color: 'var(--bp-ink)',
            fontSize: 22,
            fontWeight: 700,
            lineHeight: 1.1,
            marginBottom: 4,
            letterSpacing: '-0.005em',
          }}
        >
          {division.label[locale]}
        </div>

        {/* English/Korean parallel — quiet secondary label */}
        <div
          className="bp-mono"
          style={{
            color: 'var(--bp-ink-soft)',
            fontSize: 10.5,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            marginBottom: 12,
          }}
        >
          {locale === 'ko' ? division.label.en : division.label.ko}
        </div>

        {/* Role — punchy one-liner */}
        <p
          style={{
            color: 'var(--bp-ink)',
            fontSize: 13.5,
            lineHeight: 1.5,
            margin: 0,
            wordBreak: 'keep-all',
          }}
        >
          {division.role[locale]}
        </p>

        {/* Station label — italic mono, like a plate annotation */}
        <p
          className="bp-mono"
          style={{
            color: 'var(--bp-ink-soft)',
            fontSize: 10.5,
            letterSpacing: '0.08em',
            marginTop: 12,
            marginBottom: 0,
            fontStyle: 'italic',
          }}
        >
          ⌐ {division.stationLabel[locale]}
        </p>
      </Cartouche>
    </div>
  );
}
