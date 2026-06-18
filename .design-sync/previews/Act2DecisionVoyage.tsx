import { Act2DecisionVoyage } from 'argus';

// "§ II · The Trail" — one decision navigated as a ship's-log that unrolls
// waypoint-by-waypoint on scroll (IntersectionObserver). The component
// short-circuits to "reveal the whole trail at once" under
// prefers-reduced-motion; a static capture never scrolls, so without this it
// shows only the first beat on blank parchment. Reporting reduced-motion makes
// the complete trail render — the same end-state a real visitor scrolls to —
// and neutralizing the bp-fade-up entrance keeps headers/CTA fully painted.
if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  const orig = window.matchMedia.bind(window);
  window.matchMedia = ((q: string) =>
    /prefers-reduced-motion/.test(q)
      ? ({
          matches: true,
          media: q,
          onchange: null,
          addEventListener() {},
          removeEventListener() {},
          addListener() {},
          removeListener() {},
          dispatchEvent() {
            return false;
          },
        } as MediaQueryList)
      : orig(q)) as typeof window.matchMedia;
}

export const Default = () => (
  <div className="act2-trail-preview">
    <style>{`.act2-trail-preview .bp-fade-up { animation: none !important; opacity: 1 !important; }`}</style>
    <Act2DecisionVoyage />
  </div>
);
