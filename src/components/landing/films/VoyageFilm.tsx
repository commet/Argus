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

import { Fragment, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useLocale } from '@/hooks/useLocale';

// ≤640px = the short 16:9 mobile band (the plate folio collapses to one column).
function useIsNarrow() {
  const [n, setN] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 640px)');
    const on = () => setN(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return n;
}

// One clause of the Homer quote, revealed by a FEATHERED ink mask sweeping
// left→right over fully-formed (always-legible) glyphs, with a single hairline
// "nib" of glow riding the wet edge. The mask alpha moves; the letters never do.
function Clause({ text, ink, nib, halo, dur, delay }: { text: string; ink: string; nib: string; halo: string; dur: number; delay: number }) {
  const MASK = 'linear-gradient(90deg, #000 0 62%, transparent 80%)';
  return (
    <span style={{ position: 'relative', display: 'block' }}>
      <motion.span
        style={{
          display: 'block', color: ink, textShadow: halo, willChange: 'mask-position',
          maskImage: MASK, WebkitMaskImage: MASK,
          maskSize: '168% 100%', WebkitMaskSize: '168% 100%',
          maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat',
        }}
        initial={{ maskPosition: '112% 0%' }}
        animate={{ maskPosition: '0% 0%' }}
        transition={{ duration: dur, delay, ease: [0.33, 0, 0.3, 1] }}
      >
        {text}
      </motion.span>
      <motion.span
        aria-hidden="true"
        style={{ position: 'absolute', top: '8%', bottom: '8%', width: 1.5, borderRadius: 1, background: nib, boxShadow: `0 0 5px 0.5px color-mix(in srgb, ${nib} 55%, transparent)` }}
        initial={{ left: '-1%', opacity: 0 }}
        animate={{ left: '101%', opacity: [0, 1, 1, 0] }}
        transition={{ duration: dur, delay, ease: [0.33, 0, 0.3, 1], opacity: { times: [0, 0.08, 0.92, 1] } }}
      />
    </span>
  );
}

// Orchestrates the quote's clauses (split on the authored "\n") so each inks in
// after the previous, with a small pen-lift gap. Reduced-motion = plain text.
function InkedQuote({ text, ink, nib, halo, rm, narrow }: { text: string; ink: string; nib: string; halo: string; rm: boolean; narrow: boolean }) {
  const clauses = text.split('\n');
  if (rm) return <>{clauses.map((c, i) => <span key={i} style={{ display: 'block', color: ink, textShadow: halo }}>{c}</span>)}</>;
  const mult = narrow ? 0.9 : 1;
  const durs = clauses.map((c) => Math.min(0.85, Math.max(0.46, c.length * 0.045)) * mult);
  return (
    <>
      {clauses.map((c, i) => {
        const delay = 0.3 + durs.slice(0, i).reduce((a, d) => a + d + 0.18, 0);
        return <Clause key={i} text={c} ink={ink} nib={nib} halo={halo} dur={durs[i]} delay={delay} />;
      })}
    </>
  );
}

// Captions break at sentence/clause boundaries (a literal "\n" in the copy),
// never wherever the line happens to fill — so a phrase like
// "그 한 걸음을 또렷하게 내딛도록" always lands whole on its own line.
function Lines({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((ln, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {ln}
        </Fragment>
      ))}
    </>
  );
}

type Chapter = {
  num: string; ko: string; en: string;
  from: number; to: number; gold?: boolean; lure?: boolean;
  mythKo: string; mythEn: string;
  // attribution — a compact "who / when said this" tag under the quote. Carries
  // the meaning for someone who's never read the Odyssey (the bound Odysseus,
  // the Sirens' song, the loyal dog Argos) without an explainer paragraph.
  attrKo: string; attrEn: string;
  lineKo: string; lineEn: string;
};

// Intro, over the opening sail — most viewers won't know this is the Odyssey,
// so name the metaphor plainly (AI = the all-knowing-sounding Sirens) before the
// chapters roll.
const INTRO = {
  from: 1.0, to: 5.3,
  eyebrowKo: '호메로스 · 오디세이아', eyebrowEn: 'HOMER · THE ODYSSEY',
  lineKo: '세이렌은 “내가 다 알려줄게” 노래로 뱃사람을 홀렸습니다 — 지금의 AI처럼.\n오디세우스는, 휩쓸리지 않고 지나는 법을 알았죠.',
  lineEn: 'The Sirens lured sailors with a song — “we will tell you all.” Much like today’s AI.\nOdysseus knew how to pass without being swept away.',
};

// Myth lines are quoted in Homer's voice (echoing Pope's 1725 verse — public
// domain): the binding that holds against your own pleading; the Sirens' lure of
// total knowledge ("we know all that comes to pass"), which IS the AI; the
// homecoming to one's own shore; old Argos who alone knew his master. Service
// lines span Argus's spine — not the seal alone: set your own call (Bind) · an
// honest read, you keep the decision (Listen) · pass the AI fast and land in
// your real choice (Land) · it returns to ask, and your record knows you (Recog).
const CHAPTERS: Chapter[] = [
  {
    num: 'I', ko: '묶기', en: 'Bind', from: 6, to: 12.6,
    mythKo: '“나를 돛대에 묶어라. 풀어달라 빌어도, 더 단단히.”',
    mythEn: '“Bind me to the mast — though I plead, bind me tighter.”',
    attrKo: '오디세우스, 세이렌을 앞두고 스스로를 묶으며',
    attrEn: 'Odysseus, binding himself before the Sirens',
    lineKo: '묻기 전에, 지금 내 판단부터 적어 둬요.',
    lineEn: 'Before you ask, write down your own call first.',
  },
  {
    num: 'II', ko: '듣기', en: 'Listen', from: 14.2, to: 21, lure: true,
    mythKo: '“우리 노래를 들은 자는, 모든 것을 알고 떠나리라.”',
    mythEn: '“Whoever hears our song departs knowing all.”',
    attrKo: '세이렌의 노래 — “다 알려주겠다”는 유혹',
    attrEn: 'The Sirens’ song — the lure of “we’ll tell you all”',
    lineKo: 'AI는 칭찬 대신, 당신이 놓친 단 하나를 짚어줘요.',
    lineEn: 'Instead of praise, it names the one thing you missed.',
  },
  {
    num: 'III', ko: '닿기', en: 'Land', from: 23, to: 30,
    mythKo: '“노래가 잦아들고, 마침내 단단한 땅에 발을 디딘다.”',
    mythEn: '“The song fades; at last he steps onto solid ground.”',
    attrKo: '세이렌의 바다를 지나 뭍에 닿은 오디세우스',
    attrEn: 'Odysseus, ashore at last past the Sirens’ sea',
    lineKo: '결정은 결국, 현실의 당신 몫이에요.',
    lineEn: 'In the end, the decision is yours — out in the world.',
  },
  {
    num: 'IV', ko: '알아봄', en: 'Recognition', from: 32, to: 39.4, gold: true,
    mythKo: '“스러져 가던 늙은 개만이, 옛 주인을 알아보았다.”',
    mythEn: '“Only old Argos, failing, knew his master still.”',
    attrKo: '20년을 기다린 늙은 개 아르고스, 주인을 알아보다',
    attrEn: 'Argos, the dog who waited 20 years, knew his master',
    lineKo: '정한 날, Argus가 돌아와 물어요 — “그래서, 어떻게 됐어요?”',
    lineEn: 'On your day, Argus returns — “So, how did it go?”',
  },
];

// When the quote finishes inking — so the attribution+service rise right after.
function quoteEnd(text: string, narrow: boolean) {
  const mult = narrow ? 0.9 : 1;
  const durs = text.split('\n').map((c) => Math.min(0.85, Math.max(0.46, c.length * 0.045)) * mult);
  const lastDelay = 0.3 + durs.slice(0, -1).reduce((a, d) => a + d + 0.18, 0);
  return lastDelay + (durs[durs.length - 1] ?? 0.46);
}

/* The lower-left "plate folio" — a giant ghosted chapter numeral + a margin
   spine rule + the body (eyebrow · inked Homer quote · attribution · service).
   This asymmetric title-card composition is the cure for the boring centered
   subtitle. Folio is decorative watermark (aria-hidden); gold is spent ONCE per
   card (spine, or the folio on the coda — never both). */
function PlateFolioCard({ active, L, locale, rm, narrow }: { active: Chapter; L: (ko: string, en: string) => string; locale: string; rm: boolean; narrow: boolean }) {
  const lure = !!active.lure, gold = !!active.gold;
  const quoteInk = lure ? 'var(--bp-lure)' : 'var(--bp-ink)';
  const nib = lure ? 'var(--bp-lure)' : 'var(--bp-gold)';
  const bodyHalo = '0 0 1px var(--bp-paper), 0 0 8px var(--bp-paper)';
  const quoteHalo = lure ? '0 0 1px var(--bp-paper), 0 0 6px var(--bp-paper), 0 0 12px var(--bp-paper)' : bodyHalo;
  const folioColor = gold ? 'var(--bp-gold-deep)' : 'var(--bp-ink)';
  const folioOpacity = gold ? 0.3 : 0.22;
  const spineColor = gold ? 'var(--bp-ink)' : 'var(--bp-gold)';
  const eyebrowColor = gold ? 'var(--bp-gold-deep)' : 'var(--bp-ink)';
  const clusterDelay = quoteEnd(L(active.mythKo, active.mythEn), narrow);
  const ease: [number, number, number, number] = [0.22, 0.61, 0.36, 1];
  const bk = locale === 'ko' ? 'break-keep' : '';

  const eyebrow = (
    <motion.span
      className="bp-mono"
      initial={rm ? { opacity: 1 } : { opacity: 0, letterSpacing: '0.34em', scale: 1.06 }}
      animate={{ opacity: 1, letterSpacing: '0.28em', scale: 1 }}
      transition={{ duration: 0.26, delay: rm ? 0 : 0.18, ease }}
      style={{ display: 'inline-block', fontSize: 'clamp(11px, 1.05vw, 13px)', textTransform: 'uppercase', fontWeight: 700, color: eyebrowColor, textShadow: '0 0 2px var(--bp-paper), 0 0 6px var(--bp-paper)', transformOrigin: 'left center', whiteSpace: 'nowrap' }}
    >
      {gold ? L('종장', 'Coda') : L(`${active.num} · ${active.ko}`, `${active.num} · ${active.en}`)}
    </motion.span>
  );
  const quote = (
    <div className={bk} style={{ fontFamily: "'Nanum Myeongjo', var(--font-display), serif", fontWeight: 700, fontSize: 'clamp(21px, 2.6vw, 31px)', lineHeight: 1.34, letterSpacing: '0.005em', maxWidth: '42ch', textWrap: 'pretty' }}>
      <InkedQuote text={L(active.mythKo, active.mythEn)} ink={quoteInk} nib={nib} halo={quoteHalo} rm={rm} narrow={narrow} />
    </div>
  );
  const tail = (
    <motion.div initial={rm ? { opacity: 1 } : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.36, delay: rm ? 0 : clusterDelay, ease }} style={{ marginTop: 11 }}>
      <p className={bk} style={{ margin: '0 0 8px', fontStyle: 'italic', fontWeight: 500, fontSize: 'clamp(12px, 1.15vw, 14px)', color: lure ? 'var(--bp-lure)' : 'var(--bp-ink-soft)', letterSpacing: '0.01em', textShadow: bodyHalo }}>
        — {L(active.attrKo, active.attrEn)}
      </p>
      <p className={bk} style={{ margin: 0, fontWeight: 600, fontSize: 'clamp(15.5px, 1.9vw, 20px)', lineHeight: 1.45, color: 'var(--bp-ink)', letterSpacing: '-0.006em', maxWidth: '44ch', textWrap: 'pretty', textShadow: bodyHalo }}>
        <Lines text={L(active.lineKo, active.lineEn)} />
      </p>
    </motion.div>
  );

  if (narrow) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 9 }}>
          <span aria-hidden="true" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(34px, 12vw, 54px)', lineHeight: 0.78, color: 'transparent', WebkitTextStroke: `1px ${folioColor}`, opacity: folioOpacity, userSelect: 'none' }}>{active.num}</span>
          {eyebrow}
        </div>
        {quote}
        {tail}
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(16px, 2vw, 30px)' }}>
      <motion.div
        aria-hidden="true"
        initial={rm ? {} : { clipPath: 'inset(0 0 100% 0)' }}
        animate={{ clipPath: 'inset(0 0 0% 0)' }}
        transition={{ duration: 0.7, delay: rm ? 0 : 0.08, ease: 'easeOut' }}
        style={{ flex: 'none', alignSelf: 'flex-start', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(76px, 11vw, 160px)', lineHeight: 0.78, color: 'transparent', WebkitTextStroke: `1.25px ${folioColor}`, opacity: folioOpacity, userSelect: 'none' }}
      >
        {active.num}
      </motion.div>
      <motion.div
        aria-hidden="true"
        initial={rm ? { scaleY: 1 } : { scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.42, ease }}
        style={{ flex: 'none', width: 1.5, alignSelf: 'stretch', background: spineColor, transformOrigin: 'top', opacity: 0.75 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        {eyebrow}
        <div style={{ marginTop: 10 }}>{quote}</div>
        {tail}
      </div>
    </div>
  );
}

export function VoyageFilm() {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const vref = useRef<HTMLVideoElement | null>(null);
  // active = chapter whose window we're inside (null between scenes / opening).
  // shown = the most recent chapter, so the rail keeps its progress through gaps.
  const [active, setActive] = useState<Chapter | null>(null);
  const [intro, setIntro] = useState(false);
  const [shownIdx, setShownIdx] = useState<number>(-1);
  const rm = !!useReducedMotion();
  const narrow = useIsNarrow();

  useEffect(() => {
    // Preview affordance: /ko?cap=2 pins a chapter, /ko?cap=intro the intro (the
    // video clock can't be screenshotted headless). Harmless in production.
    const forced = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('cap') : null;
    if (forced !== null) {
      if (forced === 'intro') { setIntro(true); setShownIdx(-1); return; }
      const i = Math.max(0, Math.min(CHAPTERS.length - 1, parseInt(forced, 10) || 0));
      setActive(CHAPTERS[i]); setShownIdx(i); return;
    }
    const v = vref.current;
    if (!v) return;
    const onTime = () => {
      const t = v.currentTime;
      const isIntro = t >= INTRO.from && t <= INTRO.to;
      setIntro((prev) => (prev === isIntro ? prev : isIntro));
      const inWin = isIntro ? null : (CHAPTERS.find((c) => t >= c.from && t <= c.to) ?? null);
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
    <figure className="relative w-full h-full" style={{ margin: 0, overflow: 'hidden', background: 'var(--bp-paper)' }}>
      <video
        ref={vref}
        className="bp-voyage-video"
        autoPlay muted loop playsInline preload="metadata"
        poster="/voyage/voyage-poster.jpg"
        aria-label={L('오디세우스의 항해 — 묶기, 듣기, 닿기, 그리고 알아봄', "Odysseus's voyage — bind, listen, land, and recognition")}
        // cover, but the band itself is now 16:9 (SirenHero), so cover fills the
        // width edge-to-edge with no crop and no margins — full-bleed AND whole.
        // (It only crops a sliver on very tall viewports where max-h caps it.)
        style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', background: 'var(--bp-paper)' }}
      >
        <source src="/voyage/voyage-film.mp4" type="video/mp4" />
      </video>

      {/* gold top rule */}
      <div aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--bp-gold)', zIndex: 3 }} />

      {/* LEFT ink-wash reading zone — replaces the symmetric bottom scrim. A quiet
          cream zone hugs the text's left third; the engraving breathes on the right. */}
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', background: 'linear-gradient(100deg, color-mix(in srgb, var(--bp-paper) 92%, transparent) 0%, color-mix(in srgb, var(--bp-paper) 70%, transparent) 42%, transparent 62%, transparent 100%)' }} />
      {/* slim bottom fade so the dot progress stays legible */}
      <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '26%', zIndex: 1, pointerEvents: 'none', background: 'linear-gradient(to top, color-mix(in srgb, var(--bp-paper) 70%, transparent) 0%, transparent 100%)' }} />

      {/* ── caption: the intro is the centered establishing shot; each chapter is a
            lower-left PLATE FOLIO (title card) that inks itself in. ── */}
      <AnimatePresence mode="wait">
        {intro && !active && (
          <motion.div
            key="intro"
            initial={false}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.42, ease: [0.22, 0.61, 0.36, 1] }}
            className="absolute left-0 right-0 flex flex-col items-center text-center"
            style={{ bottom: 'clamp(30px, 9%, 64px)', padding: '0 28px', zIndex: 2 }}
            aria-live="polite"
          >
            <motion.div className="flex flex-col items-center" initial={rm ? { opacity: 1 } : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 0.61, 0.36, 1] }}>
              <span className="bp-mono" style={{ marginBottom: 11, fontSize: 'clamp(10px, 1.05vw, 11.5px)', letterSpacing: '0.26em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--bp-ink)', textShadow: '0 0 2px var(--bp-paper), 0 0 6px var(--bp-paper), 0 0 11px var(--bp-paper)' }}>
                {L(INTRO.eyebrowKo, INTRO.eyebrowEn)}
              </span>
              <p className={`${locale === 'ko' ? 'break-keep' : ''}`} style={{ margin: 0, fontWeight: 600, color: 'var(--bp-ink)', fontSize: 'clamp(14.5px, 1.75vw, 19px)', lineHeight: 1.5, letterSpacing: '-0.006em', maxWidth: 600, textWrap: 'pretty', textShadow: '0 0 1px var(--bp-paper), 0 0 4px var(--bp-paper), 0 0 10px var(--bp-paper), 0 0 17px var(--bp-paper)' }}>
                <Lines text={L(INTRO.lineKo, INTRO.lineEn)} />
              </p>
            </motion.div>
          </motion.div>
        )}
        {active && (
          <motion.div
            key={active.num}
            initial={false}
            exit={rm ? { opacity: 0 } : { opacity: 0, x: -12 }}
            transition={{ duration: 0.42, ease: [0.22, 0.61, 0.36, 1] }}
            style={{ position: 'absolute', left: narrow ? 'clamp(16px, 5vw, 24px)' : 'clamp(24px, 6vw, 84px)', bottom: narrow ? 'clamp(28px, 9%, 56px)' : 'clamp(40px, 12%, 90px)', right: 'auto', textAlign: 'left', maxWidth: narrow ? '90vw' : 'min(58ch, 640px)', zIndex: 2 }}
            aria-live="polite"
          >
            <PlateFolioCard active={active} L={L} locale={locale} rm={rm} narrow={narrow} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── progress: minimal dots, not a word rail (which read as a cheap TOC) ── */}
      <div
        className="absolute left-0 right-0 flex items-center justify-center"
        style={{ bottom: 'clamp(18px, 5%, 30px)', gap: 9, padding: '0 20px', zIndex: 2 }}
        aria-hidden="true"
      >
        {CHAPTERS.map((c, i) => {
          const on = i === shownIdx;
          const passed = i < shownIdx;
          const size = on ? 7 : 5;
          return (
            <span
              key={c.num}
              style={{
                width: size, height: size, borderRadius: '50%',
                background: on ? (c.gold ? 'var(--bp-gold)' : 'var(--bp-ink)') : passed ? 'var(--bp-ink-soft)' : 'transparent',
                border: !on && !passed ? '1px solid var(--bp-ink-faint)' : 'none',
                opacity: on ? 1 : passed ? 0.55 : 0.5,
                transition: 'width 360ms ease, height 360ms ease, background 360ms ease, opacity 360ms ease',
              }}
            />
          );
        })}
      </div>
    </figure>
  );
}
