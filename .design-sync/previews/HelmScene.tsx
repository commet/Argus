import { HelmScene } from 'argus';
import { STAGES } from '@/data/voyage-crew';

export const Default = () => (
  <div style={{ maxWidth: 760, padding: 8 }}>
    <HelmScene stages={STAGES} locale="en" />
  </div>
);
