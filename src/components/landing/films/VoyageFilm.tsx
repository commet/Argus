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
 * ARGUS actually does — grounded in internal design notes:
 *   묶기  seal/decision_contract — write your own call before you open the AI
 *   듣기  recast/persona/refinement — hear it, but the premises you waved past get noted beside you
 *   닿기  watch — reality is the judge; if a premise shifts, Argus tells you
 *   알아봄 settle — named after the dog Argos; on your day it comes back to ask how it went
 *
 * A persistent chapter rail shows progress; the active chapter's myth+meaning
 * fade in. Bottom scrim keeps it legible; in dark mode the baked-cream film
 * inverts via CSS (.bp-voyage-video). `?cap=N` force-shows a chapter (preview).
 */

import { Fragment, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useLocale } from '@/hooks/useLocale';

// ≤640px = the short 16:9 mobile band (the plate folio collapses to one column).
function useIsNarrow() {
  const [n, setN] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 639.98px)'); // aligns with Tailwind `sm`
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
        transition={{ duration: dur, delay, ease: [0.22, 0.61, 0.36, 1] }}
      >
        {text}
      </motion.span>
      <motion.span
        aria-hidden="true"
        style={{ position: 'absolute', top: '8%', bottom: '8%', width: 1.5, borderRadius: 1, background: nib, boxShadow: `0 0 5px 0.5px color-mix(in srgb, ${nib} 55%, transparent)` }}
        initial={{ left: '-1%', opacity: 0 }}
        animate={{ left: '101%', opacity: [0, 1, 1, 0] }}
        transition={{ duration: dur, delay, ease: [0.22, 0.61, 0.36, 1], opacity: { times: [0, 0.08, 0.92, 1] } }}
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
  lineKo: '“다 알려주겠다”며 뱃사람을 홀리던 세이렌의 노래.\n지금 우리가 AI 앞에서 넋 놓는 모습과 닮았죠.',
  // Break BEFORE the quote so it stays whole on its own line instead of wrapping
  // mid-phrase ("we will tell" | "you all").
  lineEn: '“We’ll tell you all,” sang the Sirens — and sailors were lost to it.\nMuch like the AI we sit before today.',
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
    mythKo: '“나를 돛대에 묶어라.\n풀어달라 빌어도, 더 단단히.”',
    mythEn: '“Bind me to the mast —\nthough I plead, bind me tighter.”',
    attrKo: '세이렌을 앞둔 오디세우스. AI를 열기 직전의 당신이죠.',
    attrEn: 'Odysseus, before the Sirens. You, about to open the AI.',
    lineKo: '묻기 전에 지금 판단을 적어둬요.\n나중에 흔들려도, 돌아올 자리가 생겨요.',
    lineEn: 'write down your own call first —\nso a fluent answer can’t move you off it.',
  },
  {
    num: 'II', ko: '듣기', en: 'Listen', from: 14.2, to: 21, lure: true,
    mythKo: '“우리 노래를 들은 자는,\n모든 것을 알고 떠나리라.”',
    mythEn: '“Whoever hears our song\ndeparts knowing all.”',
    attrKo: '“다 알려주겠다”던 세이렌의 약속. 지금 AI가 그래요.',
    attrEn: 'The Sirens’ promise to tell you all. The AI makes it now.',
    lineKo: '듣되, 삼키진 마요.\n그냥 넘어간 전제를 옆에 적어둬요.',
    lineEn: 'listen, but don’t swallow it —\nwhat you waved past, it notes beside you.',
  },
  {
    num: 'III', ko: '닿기', en: 'Land', from: 23, to: 30,
    mythKo: '“노래가 잦아들고,\n마침내 단단한 땅에 발을 디딘다.”',
    mythEn: '“The song fades; at last\nhe steps onto solid ground.”',
    attrKo: '세이렌의 바다를 건넌 오디세우스. 이제 당신의 땅이죠.',
    attrEn: 'Odysseus, across the Sirens’ sea. The ground is yours now.',
    lineKo: '결정은 결국 현실에서 판가름나요.\n전제가 바뀌면 Argus가 알려주고요.',
    lineEn: 'in the end, reality is the judge.\nif a premise shifts, Argus tells you.',
  },
  {
    num: 'IV', ko: '알아봄', en: 'Recognition', from: 32, to: 39.4, gold: true,
    mythKo: '“스러져 가던 늙은 개만이,\n옛 주인을 알아보았다.”',
    mythEn: '“Only old Argos, failing,\nknew his master still.”',
    attrKo: '이 도구의 이름은 그 개, 아르고스에서 왔어요.',
    attrEn: 'This tool takes its name from that dog — Argos.',
    // Explicit break BEFORE the quote so the whole question drops to its own
    // line instead of wrapping mid-phrase (“그래서,” | “어떻게 됐어요?”).
    lineKo: '정한 날 다시 찾아와 물어요.\n“그래서, 어떻게 됐어요?”',
    lineEn: 'on your day, I come back to ask,\n“so, how did it go?”',
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
  const bodyHalo = '0 0 1px var(--bp-paper), 0 0 3px var(--bp-paper), 0 0 8px var(--bp-paper), 0 0 14px var(--bp-paper)';
  const quoteHalo = lure
    ? '0 0 1px var(--bp-paper), 0 0 3px var(--bp-paper), 0 0 7px var(--bp-paper), 0 0 13px var(--bp-paper)'
    : '0 0 1px var(--bp-paper), 0 0 3px var(--bp-paper), 0 0 9px var(--bp-paper), 0 0 16px var(--bp-paper)';
  const folioColor = gold ? 'var(--bp-gold-deep)' : 'var(--bp-ink)';
  // FILLED watermark numeral (not a hairline outline — that vanished over the
  // busy engraving). A soft paper halo lifts it off the line-work so the
  // chapter mark actually reads, without competing with the quote.
  const folioOpacity = gold ? 0.48 : 0.4;
  const folioHalo = '0 0 2px var(--bp-paper), 0 0 7px var(--bp-paper), 0 0 16px var(--bp-paper)';
  const spineColor = gold ? 'var(--bp-ink)' : 'var(--bp-gold)';
  const eyebrowColor = gold ? 'var(--bp-gold-deep)' : 'var(--bp-ink)';
  const clusterDelay = quoteEnd(L(active.mythKo, active.mythEn), narrow);
  const ease: [number, number, number, number] = [0.22, 0.61, 0.36, 1];
  const bk = locale === 'ko' ? 'break-keep' : '';

  // Hangul reads loose under the mono's wide tracking — settle to a tighter
  // target in Korean (Latin keeps the formal plate-caption tracking).
  const ebFrom = locale === 'ko' ? '0.22em' : '0.34em';
  const ebTo = locale === 'ko' ? '0.14em' : '0.28em';
  const eyebrow = (
    <motion.span
      className="bp-mono"
      initial={rm ? { opacity: 1 } : { opacity: 0, letterSpacing: ebFrom, scale: 1.06 }}
      animate={{ opacity: 1, letterSpacing: ebTo, scale: 1 }}
      transition={{ duration: 0.26, delay: rm ? 0 : 0.18, ease }}
      style={{ display: 'inline-block', fontSize: 'clamp(11px, 1.05vw, 13px)', textTransform: 'uppercase', fontWeight: 700, color: eyebrowColor, textShadow: '0 0 2px var(--bp-paper), 0 0 5px var(--bp-paper), 0 0 10px var(--bp-paper)', transformOrigin: 'left center', whiteSpace: 'nowrap' }}
    >
      {gold ? L('종장', 'Coda') : L(`${active.num} · ${active.ko}`, `${active.num} · ${active.en}`)}
    </motion.span>
  );
  const quote = (
    <div className={bk} style={{ fontFamily: "'Nanum Myeongjo', var(--font-display), serif", fontWeight: 700, fontSize: 'clamp(21px, 2.6vw, 31px)', lineHeight: 1.32, letterSpacing: '0.005em', maxWidth: '52ch', whiteSpace: 'pre-line' }}>
      <InkedQuote text={L(active.mythKo, active.mythEn)} ink={quoteInk} nib={nib} halo={quoteHalo} rm={rm} narrow={narrow} />
    </div>
  );
  // attribution (who said the myth line) — held visually apart from the blue
  // "what Argus does" line below by a short rule, so the two never read as one.
  // Both stay on a single line in the wide layout (the box is now wide enough).
  const tail = (
    <motion.div initial={rm ? { opacity: 1 } : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.36, delay: rm ? 0 : clusterDelay, ease }} style={{ marginTop: 16 }}>
      <p className={bk} style={{ margin: 0, fontStyle: 'italic', fontWeight: 600, fontSize: 'clamp(12.5px, 1.2vw, 14.5px)', color: lure ? 'var(--bp-lure)' : 'var(--bp-ink)', opacity: 0.9, letterSpacing: '0.01em', whiteSpace: narrow ? 'normal' : 'nowrap', textShadow: bodyHalo }}>
        — {L(active.attrKo, active.attrEn)}
      </p>
      <div aria-hidden="true" style={{ height: 1, width: 30, background: 'var(--bp-ink-faint)', margin: '11px 0' }} />
      <p className={bk} style={{ margin: 0, fontWeight: 600, fontSize: 'clamp(15.5px, 1.9vw, 20px)', lineHeight: 1.42, color: 'var(--bp-azure)', letterSpacing: '-0.004em', whiteSpace: narrow ? 'normal' : 'nowrap', textShadow: bodyHalo }}>
        <b style={{ fontWeight: 800, color: 'var(--bp-azure)' }}>Argus:</b>{' '}
        <Lines text={L(active.lineKo, active.lineEn)} />
      </p>
    </motion.div>
  );

  if (narrow) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 9 }}>
          <span aria-hidden="true" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(34px, 12vw, 54px)', lineHeight: 0.78, color: folioColor, opacity: folioOpacity, textShadow: folioHalo, userSelect: 'none' }}>{active.num}</span>
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
        // Fade+rise in — NOT a clipPath reveal. With lineHeight 0.78 the glyph
        // overflows its line box, and an inset() clip cut that overflow off at the
        // bottom (the narrow numeral, which has no clip, stayed whole — that's why
        // the bottom only vanished on wide). Opacity has no such edge.
        initial={rm ? { opacity: folioOpacity } : { opacity: 0, y: 12 }}
        animate={{ opacity: folioOpacity, y: 0 }}
        transition={{ duration: 0.6, delay: rm ? 0 : 0.08, ease: [0.22, 0.61, 0.36, 1] }}
        style={{ flex: 'none', alignSelf: 'flex-start', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(76px, 11vw, 160px)', lineHeight: 0.78, color: folioColor, textShadow: folioHalo, userSelect: 'none' }}
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
        <div style={{ marginTop: 16 }}>{quote}</div>
        {tail}
      </div>
    </div>
  );
}

// The film itself — the moving engraving + its time-synced chaptered captions.
// The hero mounts this ONLY inside the lightbox (on explicit play), so it always
// plays on user action; that's why the former reduced-motion autoplay gate is
// gone — a click-to-play control satisfies WCAG 2.2.2 by design, and the resting
// poster (VoyagePosterCard) is static for everyone. `onEnded` lets the overlay
// auto-close when the film finishes (loop is off in the lightbox).
function VoyageFilmStage({ onEnded }: { onEnded?: () => void }) {
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
    // NOTE: reduced-motion enforcement lives in its own effect below.
    // Re-run on `narrow`: the mobile and desktop layouts render SEPARATE <video>
    // elements (the gutter stacks, the desktop overlays), so when the viewport
    // crosses 640px the element behind `vref` is swapped. Without `narrow` here,
    // the listeners stay bound to the old (now-unmounted) video and the caption
    // freezes — the film keeps playing but the chapter sync stops.
  }, [narrow]);

  // ── MOBILE (<640px): stack the video (16:9) ABOVE a paper caption gutter, so
  // the plate-folio text never covers the engraving. The phone band is too short
  // for the desktop lower-left overlay — its frost box swallowed most of the
  // picture. The desktop cinematic overlay (below) is unchanged. ──
  if (narrow) {
    // Fallback (H1-C1): before playback ever reaches the intro window — slow
    // connection, load failure, or reduced-motion keeping the poster — intro/
    // active/shownIdx are all at their initial values and the fixed 256px
    // gutter rendered as pure blank, which read as a broken page (the top
    // mobile bounce point). Show the intro caption by default instead; the
    // video clock takes over the moment it actually plays.
    const introMode = (intro && !active) || (!active && shownIdx < 0);
    // Persist the most recent chapter through the ~1.5s gaps between windows so
    // the gutter never flashes empty (desktop just shows the engraving in gaps).
    const gChapter = active ?? (shownIdx >= 0 ? CHAPTERS[shownIdx] : null);
    return (
      <figure className="relative w-full" style={{ margin: 0, overflow: 'hidden', background: 'var(--bp-paper)', display: 'flex', flexDirection: 'column' }}>
        {/* video — true 16:9, full width, nothing over it */}
        <div className="relative w-full" style={{ aspectRatio: '16 / 9', flex: 'none', overflow: 'hidden' }}>
          <video
            ref={vref}
            className="bp-voyage-video"
            autoPlay muted playsInline preload="metadata"
            loop={!onEnded} onEnded={onEnded}
            poster="/voyage/voyage-poster.jpg"
            aria-label={L('오디세우스의 항해 — 묶기, 듣기, 닿기, 그리고 알아봄', "Odysseus's voyage — bind, listen, land, and recognition")}
            style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', background: 'var(--bp-paper)' }}
          >
            {/* Mobile band gets the 360p encode (~2MB vs 5.6MB) — this branch
                renders its own <video>, so no <source media> queries needed. */}
            <source src="/voyage/voyage-film-mobile.mp4" type="video/mp4" />
          </video>
        </div>
        {/* caption gutter — paper strip with a FIXED height (sized for the
            tallest chapter, measured ~196px of text) so chapter swaps never shift
            the page below. Caption is vertically centered; progress dots pinned
            bottom-left. */}
        <div style={{ position: 'relative', flex: 'none', height: 256, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '14px 18px 34px' }}>
          <AnimatePresence mode="wait">
            {introMode ? (
              <motion.div key="intro" style={{ textAlign: 'left' }} initial={rm ? { opacity: 1 } : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.4, ease: [0.22, 0.61, 0.36, 1] }}>
                <span className="bp-mono" style={{ display: 'block', marginBottom: 9, fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--bp-ink)' }}>{L(INTRO.eyebrowKo, INTRO.eyebrowEn)}</span>
                <p className={locale === 'ko' ? 'break-keep' : ''} style={{ margin: 0, fontWeight: 600, color: 'var(--bp-ink)', fontSize: 'clamp(15.5px, 4.4vw, 19px)', lineHeight: 1.5, letterSpacing: '-0.006em', textWrap: 'pretty' }}>
                  <Lines text={L(INTRO.lineKo, INTRO.lineEn)} />
                </p>
              </motion.div>
            ) : gChapter ? (
              <motion.div key={gChapter.num} style={{ textAlign: 'left' }} initial={rm ? { opacity: 1 } : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.4, ease: [0.22, 0.61, 0.36, 1] }}>
                <PlateFolioCard active={gChapter} L={L} locale={locale} rm={rm} narrow={true} />
              </motion.div>
            ) : null}
          </AnimatePresence>
          <div className="flex items-center" style={{ position: 'absolute', left: 18, bottom: 14, gap: 9 }} aria-hidden="true">
            {CHAPTERS.map((c, i) => {
              const on = i === shownIdx; const passed = i < shownIdx; const size = on ? 7 : 5;
              return <span key={c.num} style={{ width: size, height: size, borderRadius: '50%', background: on ? (c.gold ? 'var(--bp-gold)' : 'var(--bp-ink)') : passed ? 'var(--bp-ink-soft)' : 'transparent', border: !on && !passed ? '1px solid var(--bp-ink-faint)' : 'none', opacity: on ? 1 : passed ? 0.55 : 0.5, transition: 'width 360ms ease, height 360ms ease, background 360ms ease, opacity 360ms ease' }} />;
            })}
          </div>
        </div>
      </figure>
    );
  }

  return (
    <figure className="relative w-full h-full" style={{ margin: 0, overflow: 'hidden', background: 'var(--bp-paper)' }}>
      <video
        ref={vref}
        className="bp-voyage-video"
        autoPlay muted playsInline preload="metadata"
        loop={!onEnded} onEnded={onEnded}
        poster="/voyage/voyage-poster.jpg"
        aria-label={L('오디세우스의 항해 — 묶기, 듣기, 닿기, 그리고 알아봄', "Odysseus's voyage — bind, listen, land, and recognition")}
        // Full-bleed cover. Where the max-h cap makes the band shorter than 16:9
        // (short/large viewports), bias the crop toward the BOTTOM (water/deck/
        // feet) so the height cap never cuts a face — figures sit upper-center in
        // every scene.
        style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 35%', background: 'var(--bp-paper)' }}
      >
        <source src="/voyage/voyage-film.mp4" type="video/mp4" />
      </video>

      {/* Localized FROSTED reading surface — NOT a full-frame wash (that hid the
          engraving's subjects). It blurs only the caption zone's line-noise and
          lifts it a touch toward paper, so dark ink reads while the picture stays
          visible THROUGH it (figures soften, never disappear). Radial mask =
          feathered corner vignette, no box edge. Chapter card → bottom-left;
          intro → bottom-center. Fades with its caption. */}
      <AnimatePresence>
        {active && !intro && (
          <motion.div
            key="frost-ch"
            aria-hidden="true"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.42, ease: [0.22, 0.61, 0.36, 1] }}
            style={{
              // Shaped to the TEXT block, not a corner vignette: a rectangle SOLID
              // across the full text width, feathered only on the RIGHT (just past
              // the longest line) and TOP — left + bottom are screen edges, so a clip
              // there is invisible. mask-composite intersects a horizontal fade with a
              // vertical one, giving UNIFORM backing behind every line; a radial
              // under-covered the wide two-line block's top-right, so line-ends fell
              // onto bare engraving and lost legibility. Desktop-only — the mobile
              // gutter returns earlier, so this never needs a narrow variant.
              position: 'absolute',
              left: 0, bottom: 0, zIndex: 1, pointerEvents: 'none',
              width: 'min(880px, 72%)', height: 'min(62%, 430px)',
              backdropFilter: 'blur(9px) saturate(1.0) brightness(1.05)',
              WebkitBackdropFilter: 'blur(9px) saturate(1.0) brightness(1.05)',
              background: 'color-mix(in srgb, var(--bp-paper) 60%, transparent)',
              maskImage: 'linear-gradient(to right, #000 70%, transparent 94%), linear-gradient(to top, #000 58%, transparent 95%)',
              WebkitMaskImage: 'linear-gradient(to right, #000 70%, transparent 94%), linear-gradient(to top, #000 58%, transparent 95%)',
              maskComposite: 'intersect',
              WebkitMaskComposite: 'source-in',
            }}
          />
        )}
        {intro && !active && (
          <motion.div
            key="frost-intro"
            aria-hidden="true"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.42, ease: [0.22, 0.61, 0.36, 1] }}
            style={{
              position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 1, pointerEvents: 'none',
              height: 'min(46%, 260px)',
              backdropFilter: 'blur(7px) saturate(1.0) brightness(1.07)',
              WebkitBackdropFilter: 'blur(7px) saturate(1.0) brightness(1.07)',
              background: 'linear-gradient(to top, color-mix(in srgb, var(--bp-paper) 38%, transparent), transparent 80%)',
              maskImage: 'radial-gradient(86% 132% at 50% 100%, #000 44%, transparent 84%)',
              WebkitMaskImage: 'radial-gradient(86% 132% at 50% 100%, #000 44%, transparent 84%)',
            }}
          />
        )}
      </AnimatePresence>

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
          >
            <motion.div className="flex flex-col items-center" initial={rm ? { opacity: 1 } : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 0.61, 0.36, 1] }}>
              <span className="bp-mono" style={{ marginBottom: 11, fontSize: 'clamp(10px, 1.05vw, 11.5px)', letterSpacing: locale === 'ko' ? '0.13em' : '0.26em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--bp-ink)', textShadow: '0 0 2px var(--bp-paper), 0 0 6px var(--bp-paper), 0 0 11px var(--bp-paper)' }}>
                {L(INTRO.eyebrowKo, INTRO.eyebrowEn)}
              </span>
              <p className={`${locale === 'ko' ? 'break-keep' : ''}`} style={{ margin: 0, fontWeight: 600, color: 'var(--bp-ink)', fontSize: 'clamp(16px, 2.15vw, 23px)', lineHeight: 1.5, letterSpacing: '-0.006em', maxWidth: 600, textWrap: 'pretty', textShadow: '0 0 1px var(--bp-paper), 0 0 4px var(--bp-paper), 0 0 10px var(--bp-paper), 0 0 17px var(--bp-paper)' }}>
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
            style={{ position: 'absolute', left: narrow ? 'clamp(16px, 5vw, 24px)' : 'clamp(24px, 6vw, 84px)', bottom: narrow ? 'clamp(28px, 9%, 56px)' : 'clamp(36px, 11%, 84px)', right: 'auto', textAlign: 'left', maxWidth: narrow ? '90vw' : 'min(82ch, 880px)', zIndex: 2 }}
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

// ── Resting state: a fully MATTED PLATE, not the autoplaying film. The comment
// this component long carried ("lifted like a matted plate") was never actually
// built — it stopped at a bordered image with a lone gold bar across the top,
// which read as an unfinished frame. This is the intended plate: a paper mat
// with the SAME corner-registration ticks as the entry field below, the gold
// signature rule across the finished plate, the poster mounted inside with a
// crisp inner frame, and the intro caption tied to the plate as its engraved
// label. One bounded, finished object. The whole poster is the play affordance;
// pressing it lifts the film into the lightbox (VoyageFilm orchestrator). ──
function VoyagePosterCard({ onPlay }: { onPlay: () => void }) {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  // Mat inset — the paper margin that hosts the ticks and separates the mounted
  // poster from the plate edge, so the frame reads as deliberate, not clipped.
  const MAT = 'clamp(9px, 1.4vw, 13px)';
  return (
    <figure
      className="bp-voyage-plate relative w-full"
      style={{
        margin: 0, position: 'relative', background: 'var(--bp-paper)',
        border: '1px solid color-mix(in srgb, var(--bp-ink) 20%, transparent)',
        boxShadow: '0 1px 2px rgba(48,34,14,0.10), 0 16px 34px -20px rgba(48,34,14,0.30)',
        padding: MAT,
      }}
    >
      {/* corner registration ticks — the exact plate signature the entry field
          below carries, so the poster reads as the same finished logbook plate */}
      {([
        { k: 'tl', s: { top: 6, left: 6, borderTopStyle: 'solid', borderTopWidth: 1.5, borderLeftStyle: 'solid', borderLeftWidth: 1.5 } },
        { k: 'tr', s: { top: 6, right: 6, borderTopStyle: 'solid', borderTopWidth: 1.5, borderRightStyle: 'solid', borderRightWidth: 1.5 } },
        { k: 'bl', s: { bottom: 6, left: 6, borderBottomStyle: 'solid', borderBottomWidth: 1.5, borderLeftStyle: 'solid', borderLeftWidth: 1.5 } },
        { k: 'br', s: { bottom: 6, right: 6, borderBottomStyle: 'solid', borderBottomWidth: 1.5, borderRightStyle: 'solid', borderRightWidth: 1.5 } },
      ] as const).map(({ k, s }) => (
        <span
          key={k}
          aria-hidden="true"
          style={{
            position: 'absolute', width: 11, height: 11, zIndex: 4,
            borderColor: 'var(--bp-ink-soft)', opacity: 0.6, ...s,
          }}
        />
      ))}

      {/* poster (16:9) — mounted plate + play affordance */}
      <button
        type="button"
        onClick={onPlay}
        aria-label={L('항해 영상 재생 — 크게 보기', 'Play the voyage film — view larger')}
        className="bp-voyage-play relative block w-full"
        style={{
          aspectRatio: '16 / 9', overflow: 'hidden', background: 'var(--bp-paper)', padding: 0, cursor: 'pointer',
          border: '1px solid color-mix(in srgb, var(--bp-ink) 26%, transparent)',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- decorative still that
            carries the .bp-voyage-video dark-mode invert filter; a plain <img> keeps
            parity with the <video> poster and avoids next/image's wrapper. */}
        <img
          src="/voyage/voyage-poster.jpg"
          alt=""
          aria-hidden="true"
          className="bp-voyage-video"
          style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 35%' }}
        />
        {/* soft center scrim so the control reads over any frame */}
        <span aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(closest-side at 50% 50%, color-mix(in srgb, var(--bp-paper) 42%, transparent), transparent 72%)' }} />
        {/* play control */}
        <span
          aria-hidden="true"
          className="bp-voyage-play-btn"
          style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 'clamp(52px, 9vw, 66px)', height: 'clamp(52px, 9vw, 66px)', borderRadius: '50%',
            border: '1.5px solid var(--bp-ink)',
            background: 'color-mix(in srgb, var(--bp-paper) 82%, transparent)',
            backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)',
            transition: 'background 220ms ease, border-color 220ms ease, transform 220ms cubic-bezier(.22,.61,.36,1)',
          }}
        >
          <svg width="20" height="22" viewBox="0 0 20 22" fill="none" aria-hidden="true" style={{ marginLeft: 3 }}>
            <path d="M2 1.8L18 11L2 20.2V1.8Z" fill="var(--bp-ink)" stroke="var(--bp-ink)" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {/* caption teaser — the intro, static, tied to the plate by a hairline so
          it reads as the plate's engraved label (not loose text below a frame) */}
      <figcaption style={{ paddingTop: MAT }}>
        <div aria-hidden="true" style={{ height: 1, background: 'var(--bp-ink-faint)', marginBottom: 11 }} />
        <span className="bp-mono" style={{ display: 'block', marginBottom: 7, fontSize: 10.5, letterSpacing: locale === 'ko' ? '0.13em' : '0.24em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--bp-ink-soft)' }}>
          {L(INTRO.eyebrowKo, INTRO.eyebrowEn)}
        </span>
        <p className={locale === 'ko' ? 'break-keep' : ''} style={{ margin: 0, fontWeight: 500, color: 'var(--bp-ink-soft)', fontSize: 'clamp(12.5px, 1.4vw, 14px)', lineHeight: 1.62, letterSpacing: '-0.004em', textWrap: 'pretty' }}>
          <Lines text={L(INTRO.lineKo, INTRO.lineEn)} />
        </p>
      </figcaption>
    </figure>
  );
}

// ── The hero film, orchestrated: a small resting card that expands into a
// dimmed lightbox on play, and collapses (unmounting the film → it stops) on
// X / backdrop / Esc / the film ending. The lightbox is portalled to <body>
// because the hero's `bp-fade-up` leaves a sticky `transform`, which would trap
// a nested `position: fixed`. Rendered only while expanded, so close is a clean
// unmount (no lingering AnimatePresence exit inside the portal). ──
export function VoyageFilm() {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const rm = !!useReducedMotion();
  const narrow = useIsNarrow();
  const [expanded, setExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // While open: Esc closes and the page underneath is locked from scrolling.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(false); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [expanded]);

  const close = () => setExpanded(false);

  // Box sizes to the film: a fixed 16:9 frame on desktop (cinematic overlay),
  // content-driven on mobile (the stacked video + caption gutter is taller).
  const boxStyle = narrow
    ? { width: '94vw', maxHeight: '88vh', overflowY: 'auto' as const }
    : { width: 'min(1100px, 92vw, 153vh)', aspectRatio: '16 / 9' as const };

  return (
    <>
      <VoyagePosterCard onPlay={() => setExpanded(true)} />

      {mounted && expanded && createPortal(
        <motion.div
          className="fixed inset-0 flex items-center justify-center"
          style={{ zIndex: 90, background: 'rgba(12,14,16,0.66)', padding: 'clamp(12px, 4vw, 40px)' }}
          onClick={close}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: rm ? 0 : 0.24, ease: [0.22, 0.61, 0.36, 1] }}
          role="dialog"
          aria-modal="true"
          aria-label={L('오디세우스의 항해 영상', "Odysseus's voyage film")}
        >
          <motion.div
            className="relative"
            style={{ ...boxStyle, background: 'var(--bp-paper)', boxShadow: '0 24px 80px -24px rgba(0,0,0,0.6)' }}
            onClick={(e) => e.stopPropagation()}
            initial={rm ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: 10 }}
            animate={rm ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: rm ? 0 : 0.34, ease: [0.22, 0.61, 0.36, 1] }}
          >
            <VoyageFilmStage onEnded={close} />
            <button
              type="button"
              onClick={close}
              aria-label={L('닫기', 'Close')}
              className="bp-voyage-close"
              style={{
                position: 'absolute', top: 10, right: 10, zIndex: 5,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 34, height: 34, borderRadius: '50%',
                border: '1px solid color-mix(in srgb, var(--bp-ink) 55%, transparent)',
                background: 'color-mix(in srgb, var(--bp-paper) 80%, transparent)',
                backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)',
                color: 'var(--bp-ink)', cursor: 'pointer',
                transition: 'background 200ms ease, border-color 200ms ease',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                <path d="M3 3L12 12M12 3L3 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </motion.div>
        </motion.div>,
        document.body,
      )}
    </>
  );
}
