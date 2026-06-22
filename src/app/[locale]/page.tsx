import { ScrollTracker } from '@/components/landing/ScrollTracker';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { SirenHero } from '@/components/landing/SirenHero';
import { ArgusHeroDemo } from '@/components/landing/films/ArgusHeroDemo';
import { Act1Voyage } from '@/components/landing/voyage/Act1Voyage';
import { Act2DecisionVoyage } from '@/components/landing/voyage/Act2DecisionVoyage';
import { Act3OnDeck } from '@/components/landing/voyage/Act3OnDeck';
import { Footer } from '@/components/layout/Footer';

export default function HomePage() {
  return (
    <div>
      <ScrollTracker />
      <LandingHeader />
      {/* W1.3 세이렌 1화면 — the single first screen: tagline + input, no
          scroll needed. The original three acts are preserved below. */}
      <SirenHero />
      {/* Product film — one Argus session in 6 beats, auto-playing under the
          hero so a visitor sees the product move before scrolling. */}
      <section
        className="bp-root"
        style={{ background: 'var(--bp-paper)', paddingTop: 'clamp(24px,5vh,56px)', paddingBottom: 'clamp(24px,5vh,56px)' }}
      >
        <div className="max-w-5xl mx-auto px-6 md:px-10">
          <ArgusHeroDemo embedded />
        </div>
      </section>
      <Act1Voyage />
      <Act2DecisionVoyage />
      <Act3OnDeck />
      <Footer />
    </div>
  );
}
