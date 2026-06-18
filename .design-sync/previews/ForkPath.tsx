import { ForkPath } from 'argus';

// ForkPath draws itself in via staggered `bp-stroke-draw` / `bp-fade-up`
// entrance animations (backwards fill keeps strokes hidden during their delays),
// so a static preview capture catches it mid-draw / blank. Force the completed
// end-state for the card — this is exactly how it looks once it has drawn in.
export const Default = () => (
  <div className="forkpath-preview" style={{ maxWidth: 360, padding: 8 }}>
    <style>{`
      .forkpath-preview .bp-stroke-draw { animation: none !important; stroke-dashoffset: 0 !important; }
      .forkpath-preview .bp-fade-up { animation: none !important; }
    `}</style>
    <ForkPath label="여기서 갈립니다" />
  </div>
);
