import { ScrollTracker } from '@/components/landing/ScrollTracker';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { SirenHero } from '@/components/landing/SirenHero';
import { VoyagePhases } from '@/components/landing/voyage/VoyagePhases';
import { Act1Voyage } from '@/components/landing/voyage/Act1Voyage';
import { Act2DecisionVoyage } from '@/components/landing/voyage/Act2DecisionVoyage';
import { Testimonials } from '@/components/landing/Testimonials';
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
      {/* The three-leg voyage (Bind → Listen → Land) — plants the spine's
          mental model (you tie your rope BEFORE the song) before the detailed
          acts. The missing Bind beat lives here. */}
      <VoyagePhases />
      <Act1Voyage />
      <Act2DecisionVoyage />
      <Testimonials />
      <Act3OnDeck />
      <Footer />
    </div>
  );
}
