import { ScrollTracker } from '@/components/landing/ScrollTracker';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { SirenHero } from '@/components/landing/SirenHero';
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
      <Act1Voyage />
      <Act2DecisionVoyage />
      <Testimonials />
      <Act3OnDeck />
      <Footer />
    </div>
  );
}
