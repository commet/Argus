'use client';

/**
 * useScrollManagement — the targeted-scroll domain extracted out of
 * ProgressiveFlow.
 *
 * Owns the nine section refs the flow scrolls to (status bar, question,
 * worker section, mix preview, DM feedback, final, answered pills, analysis
 * card, team deploy) plus the two scroll helpers. Pure DOM navigation: it
 * reads nothing from the session, the worker runtime, or the phase machine,
 * so it moves wholesale and the consuming JSX/handlers are unchanged — every
 * returned ref and helper keeps its original name.
 */

import { useCallback, useRef } from 'react';

export function useScrollManagement() {
  // Scroll refs for targeted navigation
  const statusBarRef = useRef<HTMLDivElement>(null);
  const questionRef = useRef<HTMLDivElement>(null);
  const workerSectionRef = useRef<HTMLDivElement>(null);
  const mixPreviewRef = useRef<HTMLDivElement>(null);
  const dmFeedbackRef = useRef<HTMLDivElement>(null);
  const finalRef = useRef<HTMLDivElement>(null);
  const answeredPillsRef = useRef<HTMLDivElement>(null);
  const analysisCardRef = useRef<HTMLDivElement>(null);
  const teamDeployRef = useRef<HTMLDivElement>(null);

  // Double rAF: frame 1 lets React commit pending state, frame 2 ensures the
  // new element is laid out before we scroll to it. Previous 200/250ms timers
  // lost races when the user was scrolling themselves.
  const scroll = useCallback((mode: 'bottom' | 'top' = 'bottom') => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      window.scrollTo({ top: mode === 'top' ? 0 : document.body.scrollHeight, behavior: 'smooth' });
    }));
  }, []);
  const scrollToRef = useCallback((ref: React.RefObject<HTMLElement | null>, fallback: 'top' | 'bottom' = 'bottom') => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (ref.current) {
        ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.scrollTo({ top: fallback === 'top' ? 0 : document.body.scrollHeight, behavior: 'smooth' });
      }
    }));
  }, []);

  return {
    statusBarRef, questionRef, workerSectionRef, mixPreviewRef, dmFeedbackRef,
    finalRef, answeredPillsRef, analysisCardRef, teamDeployRef,
    scroll, scrollToRef,
  };
}
