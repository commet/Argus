'use client';

/**
 * VoyageFilm — the hero's moving-engraving overture.
 *
 * One continuous ~36s film of Odysseus's voyage past the Sirens, told as living
 * 18th-c. line engravings: 묶기 (bound to the mast) → 듣기 (the Sirens' song,
 * the helm held) → 닿기 (landfall) → the faithful dog's recognition. Generated
 * with Veo from our Flaxman/engraving references, stitched with ink dissolves.
 *
 * Plays muted + looped (hero autoplay), framed as a mounted chart plate (gold
 * top rule, ink border, drop edge) so it sits in the logbook language. The
 * caption strip is intentionally minimal — meaning-text can be layered on later.
 */

import { useLocale } from '@/hooks/useLocale';

export function VoyageFilm() {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  return (
    <figure
      className="relative w-full"
      style={{
        margin: 0,
        background: 'var(--bp-paper-deep)',
        border: '1px solid var(--bp-ink-faint)',
        boxShadow: '3px 3px 0 0 var(--bp-ink-faint)',
      }}
    >
      {/* gold top rule — the plate's accent */}
      <div aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--bp-gold)', zIndex: 1 }} />
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster="/voyage/voyage-poster.jpg"
        aria-label={L('오디세우스의 항해 — 묶기, 듣기, 닿기', "Odysseus's voyage — bind, listen, land")}
        style={{ display: 'block', width: '100%', height: 'auto', aspectRatio: '16 / 9', objectFit: 'cover', background: 'var(--bp-paper-deep)' }}
      >
        <source src="/voyage/voyage-film.mp4" type="video/mp4" />
      </video>
      {/* caption strip — a quiet legend; meaning-text can grow here later */}
      <figcaption
        className="bp-mono flex items-center justify-center gap-2"
        style={{
          padding: '9px 12px',
          borderTop: '1px solid var(--bp-ink-faint)',
          color: 'var(--bp-ink-soft)',
          fontSize: 10.5,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
        }}
      >
        <span>{L('한 번의 항해', 'One voyage')}</span>
        <span aria-hidden="true" style={{ color: 'var(--bp-ink-faint)' }}>·</span>
        <span>{L('묶기', 'Bind')}</span>
        <span aria-hidden="true" style={{ color: 'var(--bp-ink-faint)' }}>→</span>
        <span>{L('듣기', 'Listen')}</span>
        <span aria-hidden="true" style={{ color: 'var(--bp-ink-faint)' }}>→</span>
        <span style={{ color: 'var(--bp-gold-deep)' }}>{L('닿기', 'Land')}</span>
      </figcaption>
    </figure>
  );
}
