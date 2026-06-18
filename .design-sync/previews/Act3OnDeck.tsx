import { Act3OnDeck } from 'argus';

// "§ III · The Heading" — the captain's-helm act where the 5% gold finally
// lands (the gold-deep headline accent + the primary "Set sail" CTA). No
// scroll-reveal, but the plate label, headline, helm scene and CTA enter via
// `bp-fade-up` (800ms, opacity:0 start); a static capture can catch them
// mid-fade, so neutralize the entrance to keep the act fully painted.
export const Default = () => (
  <div className="act3-ondeck-preview">
    <style>{`.act3-ondeck-preview .bp-fade-up { animation: none !important; opacity: 1 !important; }`}</style>
    <Act3OnDeck />
  </div>
);
