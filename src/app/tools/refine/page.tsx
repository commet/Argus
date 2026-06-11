import { redirect } from 'next/navigation';

/**
 * Refine no longer exists as a standalone step — feedback convergence happens
 * inside Rehearse, and the final integration lives in Synthesize. This stub
 * keeps old links (NextStepGuide history, bookmarks, project next-step cards)
 * from landing on a 404.
 */
export default function RefinePage() {
  redirect('/tools/synthesize');
}
