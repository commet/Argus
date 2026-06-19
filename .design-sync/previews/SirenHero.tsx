import { SirenHero } from 'argus';

// "§ 0 · The Siren" — the single first screen (the money screen). No
// scroll-reveal here, but every block carries the `bp-fade-up` 800ms entrance
// animation; a static capture can land mid-animation on opacity:0, so we
// neutralize the entrance to keep the whole hero painted.
export const Default = () => (
  <div className="siren-hero-preview">
    <style>{`
      .siren-hero-preview .bp-fade-up { animation: none !important; opacity: 1 !important; }
      .siren-hero-preview .bf-draw { animation: none !important; stroke-dashoffset: 0 !important; }
      .siren-hero-preview .bf-soft,
      .siren-hero-preview .bf-glow { animation: none !important; opacity: 1 !important; transform: none !important; }
    `}</style>
    <SirenHero />
  </div>
);
