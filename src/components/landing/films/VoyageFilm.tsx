'use client';

/**
 * VoyageFilm — the hero's moving-engraving overture, with meaning captions.
 *
 * One continuous ~40s film of Odysseus's voyage: setting sail → 묶기 (bound to
 * the mast) → 듣기 (the Sirens' song, the helm held) → 닿기 (landfall) → the
 * faithful dog's recognition. Living 18th-c. line engravings (Veo, from our
 * Flaxman / Siren-vase references), stitched with ink dissolves.
 *
 * Fills its container (object-fit cover) so the parent can present it inline OR
 * full-bleed. Muted + looped autoplay. Meaning captions are HTML overlays synced
 * to the video time (i18n ko/en, restyleable) rather than burned in — so they
 * translate and stay crisp. In dark mode the baked-cream film inverts via CSS
 * (.bp-voyage-video) to read cream-on-charcoal like the rest of the page.
 */

import { useEffect, useRef, useState } from 'react';
import { useLocale } from '@/hooks/useLocale';

type Cap = { from: number; to: number; ko: string; en: string; koLine: string; enLine: string; gold?: boolean };

// Windows sit inside each scene's stable middle (the ~40s film: sail 0–5,
// bind ~4–14, listen ~13–22, land ~21–31, recognition ~30–40).
const CAPTIONS: Cap[] = [
  { from: 6, to: 12.6, ko: '묶기', en: 'Bind', koLine: '노래를 듣기 전에, 당신의 판단을 먼저 묶습니다', enLine: 'Before the song, you bind your own judgment first' },
  { from: 14.2, to: 21, ko: '듣기', en: 'Listen', koLine: 'AI는 마음껏 노래합니다 — 키는 당신이 잡습니다', enLine: 'Let the AI sing all it wants — you keep the helm' },
  { from: 23, to: 30, ko: '닿기', en: 'Land', koLine: '정한 날, 봉인한 판단을 현실에 대고 정산합니다', enLine: 'On your day, you settle the sealed call against reality' },
  { from: 32, to: 39.4, ko: '알아봄', en: 'Recognition', koLine: '그리고 — 진짜를 알아봅니다', enLine: 'And then — you recognize what is real', gold: true },
];

export function VoyageFilm() {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const vref = useRef<HTMLVideoElement | null>(null);
  const [cap, setCap] = useState<Cap | null>(null);

  useEffect(() => {
    const v = vref.current;
    if (!v) return;
    const onTime = () => {
      const t = v.currentTime;
      const next = CAPTIONS.find((c) => t >= c.from && t <= c.to) ?? null;
      setCap((prev) => (prev?.from === next?.from ? prev : next));
    };
    // timeupdate drives it during playback; seeked/loadeddata keep it correct
    // when scrubbed or paused.
    const evs = ['timeupdate', 'seeked', 'loadeddata', 'play'] as const;
    evs.forEach((e) => v.addEventListener(e, onTime));
    return () => evs.forEach((e) => v.removeEventListener(e, onTime));
  }, []);

  return (
    <figure className="relative w-full h-full" style={{ margin: 0, overflow: 'hidden', background: 'var(--bp-paper-deep)' }}>
      <video
        ref={vref}
        className="bp-voyage-video"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster="/voyage/voyage-poster.jpg"
        aria-label={L('오디세우스의 항해 — 묶기, 듣기, 닿기, 그리고 알아봄', "Odysseus's voyage — bind, listen, land, and recognition")}
        style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', background: 'var(--bp-paper-deep)' }}
      >
        <source src="/voyage/voyage-film.mp4" type="video/mp4" />
      </video>

      {/* gold top rule — the plate's accent */}
      <div aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--bp-gold)', zIndex: 2 }} />

      {/* bottom scrim so the caption stays legible over the film */}
      <div
        aria-hidden="true"
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '46%', background: 'linear-gradient(to top, var(--bp-paper) 6%, color-mix(in srgb, var(--bp-paper) 55%, transparent) 48%, transparent 100%)', zIndex: 1 }}
      />

      {/* meaning caption — synced to the scene, fades on change */}
      <div
        className="absolute left-0 right-0 flex flex-col items-center text-center"
        style={{ bottom: 'clamp(16px, 5%, 44px)', padding: '0 24px', zIndex: 2, opacity: cap ? 1 : 0, transform: cap ? 'translateY(0)' : 'translateY(8px)', transition: 'opacity 650ms ease, transform 650ms ease' }}
        aria-live="polite"
      >
        {cap && (
          <>
            <span
              className="bp-mono"
              style={{ fontSize: 11, letterSpacing: '0.26em', textTransform: 'uppercase', fontWeight: 700, color: cap.gold ? 'var(--bp-gold-deep)' : 'var(--bp-ink-soft)', marginBottom: 9 }}
            >
              {L(cap.ko, cap.en)}
            </span>
            <span
              className={locale === 'ko' ? 'break-keep' : ''}
              style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(15px, 2vw, 23px)', fontWeight: 700, color: 'var(--bp-ink)', lineHeight: 1.42, letterSpacing: '-0.01em', maxWidth: 620 }}
            >
              {L(cap.koLine, cap.enLine)}
            </span>
          </>
        )}
      </div>
    </figure>
  );
}
