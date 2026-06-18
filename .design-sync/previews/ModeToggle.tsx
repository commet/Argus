import { ModeToggle } from 'argus';

export const Direct = () => (
  <div style={{ maxWidth: 360 }}><ModeToggle mode="direct" onChange={() => {}} /></div>
);

export const Interview = () => (
  <div style={{ maxWidth: 360 }}><ModeToggle mode="interview" onChange={() => {}} /></div>
);
