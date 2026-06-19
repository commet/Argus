import { StepIntro } from 'argus';

// StepIntro — the dismissible "이 단계는" explainer that heads each pipeline step
// (reframe / recast / rehearse / synthesize). Accent-tinted card: step emoji +
// icon, title, a one-line purpose, and a bordered "예:" example. Dismissal is
// remembered per-step in sessionStorage; a fresh session shows it. Korean locale.

if (typeof window !== 'undefined') {
  try {
    window.localStorage.setItem('sot_settings', JSON.stringify({ language: 'ko' }));
    // Each preview render is fresh; make sure no prior dismissal hides the card.
    window.sessionStorage.removeItem('argus:step-intro-dismissed');
  } catch {}
}

export const Reframe = () => <StepIntro stepKey="reframe" />;
export const Recast = () => <StepIntro stepKey="recast" />;
export const Rehearse = () => <StepIntro stepKey="rehearse" />;
export const Synthesize = () => <StepIntro stepKey="synthesize" />;
