import { ScrollTracker } from '@/components/landing/ScrollTracker';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { SirenHero } from '@/components/landing/SirenHero';
import { Act2DecisionVoyage } from '@/components/landing/voyage/Act2DecisionVoyage';
import { Testimonials } from '@/components/landing/Testimonials';
import { Act3OnDeck } from '@/components/landing/voyage/Act3OnDeck';
import { Footer } from '@/components/layout/Footer';

export default function HomePage() {
  return (
    <div>
      <ScrollTracker />
      <LandingHeader />
      {/* The single first screen: the cinematic Sirens voyage film already
          carries the whole spine (출항 → 묶기 → 듣기 → 닿기 → 알아봄) with its
          chaptered captions, plus the headline + the one input. */}
      <SirenHero />
      {/* The Trail — the one section that shows the REAL product: a single
          decision being navigated, beat by beat, into a Current Bearing. The
          old metaphor-restatement bands (Act 1 voyage + the 3-leg phases) were
          cut: the hero film now tells that story once, cinematically, so the
          page goes straight from the myth to the proof. */}
      <Act2DecisionVoyage />
      {/* Real voices, then the closing helm + CTA. */}
      <Testimonials />
      <Act3OnDeck />
      <Footer />
    </div>
  );
}
