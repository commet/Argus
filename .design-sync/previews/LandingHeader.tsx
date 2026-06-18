import { LandingHeader } from 'argus';

// The top nav/header bar. It is `position: fixed`, so on its own it escapes the
// captured cell's bounding box and the card collapses to blank. We pin it back
// into flow (`position: relative`) inside a sized, paper-background stage so the
// bar (un-scrolled/transparent state: wordmark + KO/EN toggle + Sign In) paints
// within the card against the DS parchment instead of a white browser default.
export const Default = () => (
  <div
    className="landing-header-preview"
    style={{
      position: 'relative',
      minHeight: 140,
      background: 'var(--bp-paper)',
    }}
  >
    <style>{`.landing-header-preview > header { position: relative !important; }`}</style>
    <LandingHeader />
  </div>
);
