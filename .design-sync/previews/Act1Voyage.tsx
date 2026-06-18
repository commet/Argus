import { Act1Voyage } from 'argus';

// "§ I · The Voyage" — the wide-shot hero act (tall ship in naval-print ink on
// cream). No scroll-reveal, but the plate label, illustration, headline and CTA
// all enter via `bp-fade-up` (800ms, opacity:0 start); a static capture can
// catch them mid-fade, so neutralize the entrance to keep the act fully painted.
export const Default = () => (
  <div className="act1-voyage-preview">
    <style>{`.act1-voyage-preview .bp-fade-up { animation: none !important; opacity: 1 !important; }`}</style>
    <Act1Voyage />
  </div>
);
