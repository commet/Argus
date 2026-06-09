import { ScrollTracker } from '@/components/landing/ScrollTracker';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { Act1Voyage } from '@/components/landing/voyage/Act1Voyage';
import { Act2DecisionVoyage } from '@/components/landing/voyage/Act2DecisionVoyage';
import { Act3OnDeck } from '@/components/landing/voyage/Act3OnDeck';

export default function HomePage() {
  return (
    <div>
      <ScrollTracker />
      <LandingHeader />
      <Act1Voyage />
      <Act2DecisionVoyage />
      <Act3OnDeck />
    </div>
  );
}
