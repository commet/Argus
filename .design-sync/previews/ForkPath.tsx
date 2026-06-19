import { ForkPath } from 'argus';

// The Bearing Fan draws itself in via one-shot `.bf-*` entrance animations
// (stroke-dashoffset on the plan/reader lines, opacity on the labels/return,
// a scale-in on the gold node), gated on an IntersectionObserver. A static
// capture lands mid-draw, so freeze every animated class to its completed
// end-state — this is exactly how the diagram looks once it has drawn in.
export const Default = () => (
  <div className="forkpath-preview" style={{ maxWidth: 760, padding: 12 }}>
    <style>{`
      .forkpath-preview .bf-draw { animation: none !important; stroke-dashoffset: 0 !important; }
      .forkpath-preview .bf-soft,
      .forkpath-preview .bf-glow { animation: none !important; opacity: 1 !important; transform: none !important; }
    `}</style>
    <ForkPath label="흩어진 운영 증상이 한 데이터로 모이고, 정한 날에 돌아옵니다" />
  </div>
);
