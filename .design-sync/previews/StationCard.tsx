import { StationCard } from 'argus';
import { CREW_DIVISIONS } from '@/data/voyage-crew';

export const Default = () => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: 20, background: 'var(--bp-paper)', borderRadius: 12, maxWidth: 640 }}>
    <StationCard division={CREW_DIVISIONS[0]} locale="en" number={1} />
    <StationCard division={CREW_DIVISIONS[1]} locale="en" number={2} active />
  </div>
);
