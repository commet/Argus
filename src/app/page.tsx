import { ScrollTracker } from '@/components/landing/ScrollTracker';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { Act1Voyage } from '@/components/landing/voyage/Act1Voyage';
import { Act2Cutaway } from '@/components/landing/voyage/Act2Cutaway';
import { Act2_5HowItWorks } from '@/components/landing/voyage/Act2_5HowItWorks';
import { Act3OnDeck } from '@/components/landing/voyage/Act3OnDeck';

export default function HomePage() {
  return (
    <div>
      <ScrollTracker />
      <LandingHeader />
      <Act1Voyage />
      <Act2Cutaway />
      <Act2_5HowItWorks />
      <Act3OnDeck />
    </div>
  );
}
