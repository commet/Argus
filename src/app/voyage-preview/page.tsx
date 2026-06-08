'use client';

// TEMPORARY visual-QA route for the voyage ships. Delete after review.

import { VoyageShip, Graticule } from '@/components/ui/VoyageElements';
import { VOYAGE_STATE_META, type VoyageState } from '@/lib/voyage-state';

const STATES: VoyageState[] = ['docked', 'sailing', 'adrift', 'wrecked', 'arrived', 'verified'];

export default function VoyagePreview() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: 40 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
        Voyage Ships — visual QA
      </h1>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 28 }}>
        6 states on sea-chart paper. Large row = detail size, grid = card size (84px).
      </p>

      {/* Large detail row */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 36 }}>
        {STATES.map((s) => (
          <div
            key={s}
            style={{
              position: 'relative',
              width: 220,
              height: 200,
              borderRadius: 16,
              overflow: 'hidden',
              border: '1px solid var(--border)',
              background: 'var(--bp-paper)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-end',
              paddingBottom: 14,
            }}
          >
            <Graticule opacity={0.1} spacing={26} />
            <VoyageShip state={s} size={170} title={VOYAGE_STATE_META[s].en} />
            <div style={{ position: 'relative', zIndex: 1, marginTop: 8, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              {VOYAGE_STATE_META[s].ko} · {VOYAGE_STATE_META[s].en}
            </div>
          </div>
        ))}
      </div>

      {/* Card-size grid (as it appears in the project list) */}
      <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>At card size (84px)</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 280px)', gap: 16 }}>
        {STATES.map((s) => (
          <div key={s} style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border-subtle)', background: 'var(--surface)' }}>
            <div style={{ position: 'relative', height: 92, background: 'var(--bp-paper)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
              <Graticule opacity={0.09} spacing={24} />
              <VoyageShip state={s} size={84} title={VOYAGE_STATE_META[s].en} className="relative z-[1]" />
            </div>
            <div style={{ padding: 14, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              {VOYAGE_STATE_META[s].ko}
            </div>
          </div>
        ))}
      </div>

      {/* Dark mode mirror */}
      <div data-theme="dark" style={{ marginTop: 40, borderRadius: 16, padding: 28, background: 'var(--bg)' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>Dark mode</h2>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {STATES.map((s) => (
            <div key={s} style={{ position: 'relative', width: 150, height: 140, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bp-paper)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 10 }}>
              <Graticule opacity={0.1} spacing={24} />
              <VoyageShip state={s} size={120} title={VOYAGE_STATE_META[s].en} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
