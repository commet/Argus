'use client';

/**
 * ScaleToFit — render fixed-design-width content (the product films) and scale
 * the whole composition down to fit narrow viewports.
 *
 * The films are laid out for desktop widths (the hero film ~660px, the voyage
 * chart ~1000px) with absolutely-positioned internal pieces, so on a phone the
 * `overflow:hidden` stage clips their content. Rather than re-flow every
 * internal piece, we render the film at its design width and apply a single
 * `transform: scale()` so the entire frame shrinks intact — full composition,
 * just smaller. The wrapper height tracks the scaled height so layout stays
 * tight. scale is capped at 1 (never upscales past the design width).
 */

import { useEffect, useRef, useState } from 'react';

export function ScaleToFit({
  designWidth,
  children,
  className,
}: {
  designWidth: number;
  children: React.ReactNode;
  className?: string;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [boxH, setBoxH] = useState<number | undefined>(undefined);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const update = () => {
      const avail = outer.clientWidth;
      const s = Math.min(1, avail / designWidth);
      setScale(s);
      // offsetHeight is the pre-transform layout height at the design width.
      setBoxH(inner.offsetHeight * s);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(outer);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [designWidth]);

  return (
    <div
      ref={outerRef}
      className={className}
      style={{ width: '100%', height: boxH, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', overflow: 'hidden' }}
    >
      <div
        ref={innerRef}
        style={{ width: designWidth, flex: 'none', transform: `scale(${scale})`, transformOrigin: 'top center' }}
      >
        {children}
      </div>
    </div>
  );
}
