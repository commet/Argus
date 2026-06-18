import { Compass } from 'argus';

export const Idle = () => (
  <div style={{ display: 'flex', gap: 32, alignItems: 'center', padding: 8 }}>
    <Compass bearing="idle" size={140} />
    <Compass bearing="idle" size={88} />
  </div>
);

export const BearingSet = () => (
  <div style={{ padding: 8 }}>
    <Compass bearing="set" size={168} />
  </div>
);
