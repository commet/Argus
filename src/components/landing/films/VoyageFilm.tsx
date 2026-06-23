'use client';

/**
 * VoyageFilm — the hero's moving-engraving overture, with chaptered captions.
 *
 * One continuous ~40s film of Odysseus's voyage: setting sail → 묶기 → 듣기 →
 * 닿기 → the faithful dog's recognition. Living 18th-c. line engravings (Veo,
 * from our Flaxman / Siren-vase references), stitched with ink dissolves.
 *
 * Captions are HTML overlays synced to the video time (i18n, restyleable, not
 * burned in). Each chapter pairs the MYTH (what the scene means) with what
 * ARGUS actually does — grounded in docs/MYTH-SIRENS-design-grounding:
 *   묶기  seal/decision_contract — seal your own call before the agents run
 *   듣기  recast/persona/refinement — agents generate freely, never overwrite it
 *   닿기  settle/watch — on your date, it's checked against reality
 *   알아봄 own n=1 record — your evidence turns the AI's certainty into your reality
 *
 * A persistent chapter rail shows progress; the active chapter's myth+meaning
 * fade in. Bottom scrim keeps it legible; in dark mode the baked-cream film
 * inverts via CSS (.bp-voyage-video). `?cap=N` force-shows a chapter (preview).
 */

import { useEffect, useRef, useState } from 'react';
import { useLocale } from '@/hooks/useLocale';

type Chapter = {
  num: string; ko: string; en: string;
  from: number; to: number; gold?: boolean;
  mythKo: string; mythEn: string;
  lineKo: string; lineEn: string;
};

const CHAPTERS: Chapter[] = [
  {
    num: 'I', ko: '묶기', en: 'Bind', from: 6, to: 12.6,
    mythKo: '노래를 듣기 전에, 돛대에 자신을 묶는다.',
    mythEn: 'Before the song, he binds himself to the mast.',
    lineKo: 'AI에게 묻기 전에 — 당신의 판단과 확인할 날을 먼저 봉인합니다.',
    lineEn: 'Before you ask the AI — you seal your own call, and the day to check it.',
  },
  {
    num: 'II', ko: '듣기', en: 'Listen', from: 14.2, to: 21,
    mythKo: '노래는 다 듣되, 키는 내주지 않는다.',
    mythEn: 'He hears all of it, but never yields the helm.',
    lineKo: 'AI는 마음껏 분석하지만, 봉인한 결론은 건드리지 못합니다.',
    lineEn: 'The AI analyzes all it wants — but can’t touch the call you sealed.',
  },
  {
    num: 'III', ko: '닿기', en: 'Land', from: 23, to: 30,
    mythKo: '노래가 지나가면, 배는 뭍에 닿는다.',
    mythEn: 'The song passes; the ship reaches shore.',
    lineKo: '정한 날, Argus가 돌아와 물어요 — “그래서, 어떻게 됐어요?”',
    lineEn: 'On your day, Argus comes back to ask — “So, how did it go?”',
  },
  {
    num: 'IV', ko: '알아봄', en: 'Recognition', from: 32, to: 39.4, gold: true,
    mythKo: '충견만이, 진짜 주인을 알아본다.',
    mythEn: 'Only the faithful dog knows its true master.',
    lineKo: '쌓인 당신의 기록이, AI의 장담을 당신의 실제로 바꿉니다.',
    lineEn: 'Your own record turns the AI’s certainty into your reality.',
  },
];

export function VoyageFilm() {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const vref = useRef<HTMLVideoElement | null>(null);
  // active = chapter whose window we're inside (null between scenes / opening).
  // shown = the most recent chapter, so the rail keeps its progress through gaps.
  const [active, setActive] = useState<Chapter | null>(null);
  const [shownIdx, setShownIdx] = useState<number>(-1);

  useEffect(() => {
    // Preview affordance: /ko?cap=2 pins a chapter (the video clock can't be
    // screenshotted headless). Harmless in production.
    const forced = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('cap') : null;
    if (forced !== null) {
      const i = Math.max(0, Math.min(CHAPTERS.length - 1, parseInt(forced, 10) || 0));
      setActive(CHAPTERS[i]); setShownIdx(i); return;
    }
    const v = vref.current;
    if (!v) return;
    const onTime = () => {
      const t = v.currentTime;
      const inWin = CHAPTERS.find((c) => t >= c.from && t <= c.to) ?? null;
      setActive((prev) => (prev?.num === inWin?.num ? prev : inWin));
      let idx = -1;
      for (let i = 0; i < CHAPTERS.length; i++) if (t >= CHAPTERS[i].from - 1.4) idx = i;
      setShownIdx((p) => (p === idx ? p : idx));
    };
    const evs = ['timeupdate', 'seeked', 'loadeddata', 'play'] as const;
    evs.forEach((e) => v.addEventListener(e, onTime));
    return () => evs.forEach((e) => v.removeEventListener(e, onTime));
  }, []);

  return (
    <figure className="relative w-full h-full" style={{ margin: 0, overflow: 'hidden', background: 'var(--bp-paper-deep)' }}>
      <video
        ref={vref}
        className="bp-voyage-video"
        autoPlay muted loop playsInline preload="metadata"
        poster="/voyage/voyage-poster.jpg"
        aria-label={L('오디세우스의 항해 — 묶기, 듣기, 닿기, 그리고 알아봄', "Odysseus's voyage — bind, listen, land, and recognition")}
        style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', background: 'var(--bp-paper-deep)' }}
      >
        <source src="/voyage/voyage-film.mp4" type="video/mp4" />
      </video>

      {/* gold top rule */}
      <div aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--bp-gold)', zIndex: 3 }} />

      {/* bottom scrim — a smooth cream wash so type stays legible (no hard box) */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, height: '62%', zIndex: 1,
          background: 'linear-gradient(to top, var(--bp-paper) 4%, color-mix(in srgb, var(--bp-paper) 78%, transparent) 26%, color-mix(in srgb, var(--bp-paper) 30%, transparent) 60%, transparent 100%)',
        }}
      />

      {/* ── caption block: the scene (myth) over what Argus does ── */}
      <div
        className="absolute left-0 right-0 flex flex-col items-center text-center"
        style={{ bottom: 'clamp(54px, 13%, 96px)', padding: '0 28px', zIndex: 2, opacity: active ? 1 : 0, transition: 'opacity 520ms ease' }}
        aria-live="polite"
      >
        {active && (
          <div key={active.num} className="bp-fade-up flex flex-col items-center">
            <p
              className={`${locale === 'ko' ? 'break-keep' : ''}`}
              style={{ margin: 0, marginBottom: 12, fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 500, color: 'var(--bp-ink-soft)', fontSize: 'clamp(12.5px, 1.5vw, 15.5px)', lineHeight: 1.4, opacity: 0.92, letterSpacing: '0.01em' }}
            >
              {L(active.mythKo, active.mythEn)}
            </p>
            <p
              className={`${locale === 'ko' ? 'break-keep' : ''}`}
              style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--bp-ink)', fontSize: 'clamp(16px, 2.3vw, 25px)', lineHeight: 1.34, letterSpacing: '-0.012em', maxWidth: 660 }}
            >
              {L(active.lineKo, active.lineEn)}
            </p>
          </div>
        )}
      </div>

      {/* ── chapter rail: persistent progress through the four legs ── */}
      <div
        className="absolute left-0 right-0 flex items-center justify-center"
        style={{ bottom: 'clamp(18px, 5%, 30px)', gap: 'clamp(8px, 1.4vw, 18px)', padding: '0 20px', zIndex: 2 }}
        aria-hidden="true"
      >
        {CHAPTERS.map((c, i) => {
          const on = i === shownIdx;
          const passed = i < shownIdx;
          return (
            <span
              key={c.num}
              className="bp-mono inline-flex items-baseline"
              style={{
                gap: 5,
                fontSize: 'clamp(8.5px, 1vw, 10.5px)',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                fontWeight: on ? 700 : 500,
                color: on ? (c.gold ? 'var(--bp-gold-deep)' : 'var(--bp-ink)') : passed ? 'var(--bp-ink-soft)' : 'var(--bp-ink-faint)',
                borderBottom: on ? `1.5px solid ${c.gold ? 'var(--bp-gold)' : 'var(--bp-ink)'}` : '1.5px solid transparent',
                paddingBottom: 3,
                transition: 'color 400ms ease, border-color 400ms ease, font-weight 400ms ease',
              }}
            >
              <span style={{ opacity: 0.7 }}>{c.num}</span>
              <span>{L(c.ko, c.en)}</span>
            </span>
          );
        })}
      </div>
    </figure>
  );
}
