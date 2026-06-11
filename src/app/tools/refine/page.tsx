'use client';

/**
 * Refine no longer exists as a standalone step — feedback convergence happens
 * inside Rehearse, and the final integration lives in Synthesize. This stub
 * keeps old links (NextStepGuide history, bookmarks, project next-step cards)
 * from landing on a 404.
 *
 * Client-side replace (not a server redirect): the soft auth wall in
 * LayoutShell only mounts children for permitted visitors, so we redirect the
 * same way the other /tools pages navigate — once actually rendered.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RefinePage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/tools/synthesize');
  }, [router]);
  return null;
}
