import { notFound } from 'next/navigation';
import { PatternsSurface } from '@/components/patterns/PatternsSurface';
import { productionE3BReleaseDecision } from '@/lib/epistemic/e3b-release-gate';

export const dynamic = 'force-dynamic';

export default function PatternsPage() {
  if (!productionE3BReleaseDecision().open) notFound();
  return <PatternsSurface />;
}
