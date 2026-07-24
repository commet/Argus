import { ScrollTracker } from '@/components/landing/ScrollTracker';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { SirenHero } from '@/components/landing/SirenHero';
import { UseCases } from '@/components/landing/UseCases';
import { Act2DecisionVoyage } from '@/components/landing/voyage/Act2DecisionVoyage';
import { Footer } from '@/components/layout/Footer';

export default function HomePage() {
  return (
    <div>
      <ScrollTracker />
      <LandingHeader />
      {/* One thesis + one entry + one proof: raw words → one crux → the user's
          closing judgment → a reality check. */}
      <SirenHero />
      {/* Recognition band — three concrete, first-person decisions so a first-timer
          who isn't sure "is this for my decision?" sees their own here before
          scrolling to the proof. Mechanism is taught by the Trail below, not here. */}
      <UseCases />
      {/* The Trail is the single deeper proof below the concrete use cases. */}
      <Act2DecisionVoyage />
      <Footer />
    </div>
  );
}
