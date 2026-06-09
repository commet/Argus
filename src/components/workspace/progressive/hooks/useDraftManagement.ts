'use client';

/**
 * useDraftManagement — the post-complete draft-tree domain extracted out of
 * ProgressiveFlow.
 *
 * Owns the version/revision UI that only matters once a session reaches the
 * `complete` phase: the draft tree derivations (active path, branch detection,
 * preview lookup), the drawer/preview/revision modal state, and the three
 * mutation handlers (request a revision, branch to an older draft, promote a
 * draft to v1).
 *
 * Deliberately decoupled from worker runtime and the phase state machine — it
 * reads only the session's drafts, so it can move wholesale without touching
 * any of the analyze→mix→DM→final flow. Behaviour-preserving extraction: every
 * returned value keeps its original name so the consuming JSX is unchanged.
 */

import { useMemo, useState } from 'react';
import { runNavigatorRevision } from '@/lib/progressive-engine';
import { getActivePath, isOnBranch } from '@/lib/version-tree';
import { track } from '@/lib/analytics';
import { useLocale } from '@/hooks/useLocale';
import type { ProgressiveState } from '@/stores/useProgressiveStore';
import type { Draft } from '@/stores/types';

interface UseDraftManagementArgs {
  /** The full progressive store (already subscribed in the parent). */
  store: ProgressiveState;
  /** Parent's error setter — a failed revision surfaces inline in the modal. */
  setError: (err: string | null) => void;
  /** Parent's scroll helper — jump to top after a revision lands. */
  scroll: (mode?: 'top' | 'bottom') => void;
}

export function useDraftManagement({ store, setError, scroll }: UseDraftManagementArgs) {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const session = store.currentSession();

  // ── Post-complete draft tree UI state ──
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [previewDraftId, setPreviewDraftId] = useState<string | null>(null);
  const [iterationOpen, setIterationOpen] = useState(false);
  const [iterationDirective, setIterationDirective] = useState('');
  const [isIterating, setIsIterating] = useState(false);
  const [justReactivatedFromBranch, setJustReactivatedFromBranch] = useState(false);

  // ── Post-complete draft tree derivations ──
  const drafts = useMemo<Draft[]>(() => session?.drafts ?? [], [session?.drafts]);
  const activeDraftId = session?.active_draft_id ?? null;
  const activeDraftPath = useMemo<Draft[]>(() => {
    if (drafts.length === 0) return [];
    const nodes = drafts.map((d) => ({
      id: d.id,
      parent_id: d.parent_draft_id,
      created_at: d.created_at,
      _full: d,
    }));
    return getActivePath(nodes, activeDraftId).map((n) => n._full);
  }, [drafts, activeDraftId]);
  const activeDraft = activeDraftPath.length > 0
    ? activeDraftPath[activeDraftPath.length - 1]
    : undefined;
  const activeDraftPathIds = useMemo(
    () => new Set(activeDraftPath.map((d) => d.id)),
    [activeDraftPath],
  );
  const draftIsOnBranch = useMemo(() => {
    if (drafts.length === 0) return false;
    const simple = drafts.map((d) => ({
      id: d.id,
      parent_id: d.parent_draft_id,
      created_at: d.created_at,
    }));
    return isOnBranch(simple, activeDraftPathIds);
  }, [drafts, activeDraftPathIds]);
  const previewDraft = previewDraftId
    ? drafts.find((d) => d.id === previewDraftId) ?? null
    : null;

  // ─── Post-complete iteration handlers ─────────────────────────────

  /** User submitted a revision directive → call 항해장 → append a new draft. */
  const onRequestRevision = async () => {
    // Hard guard against double-submission (double click, keyboard re-entry,
    // React-18 batched click → state-lag). The `disabled` prop on the button
    // eventually catches this, but adds a belt to the suspenders.
    if (isIterating) return;
    if (!activeDraft || !session) return;
    const directive = iterationDirective.trim();
    if (directive.length === 0) return;

    setIsIterating(true);
    setError(null);
    // Intentionally do NOT flip session.phase — the session stays in 'complete'
    // during revision, and only the local `isIterating` flag drives the
    // in-modal spinner. This keeps PhaseAmbient/progress-dots stable and
    // makes tab-close-mid-revision recover cleanly.

    try {
      const { revised_text, change_summary } = await runNavigatorRevision({
        currentFinalText: activeDraft.final_text,
        directive,
        problemContext: session.problem_text,
        currentVersionLabel: activeDraft.version_label,
        priorDrafts: activeDraftPath.map((d) => ({
          version_label: d.version_label,
          change_summary: d.change_summary,
        })),
      });

      store.addDraft({
        parent_draft_id: activeDraft.id,
        directive,
        change_summary: change_summary || L('수정 반영', 'Revised'),
        final_text: revised_text,
        final_mix: null,
        reviewing_agent_id: 'navigator',
      });

      setIterationDirective('');
      setIterationOpen(false);
      setJustReactivatedFromBranch(false);
      track('progressive_revision_done', { directive_length: directive.length });
      scroll('top');
    } catch (e) {
      setError(e instanceof Error ? e.message : L('수정 요청 실패', 'Revision failed'));
      // Keep the modal open so the user can read the inline error and retry.
    } finally {
      setIsIterating(false);
    }
  };

  /** Switch to an older draft (= branch-in-progress). */
  const handleBranchToDraft = (draftId: string) => {
    if (!session) return;
    store.setActiveDraft(draftId);
    setDrawerOpen(false);
    setPreviewDraftId(null);
    // If we landed on a non-leaf branch, flag it so the modal opens primed.
    const target = drafts.find((d) => d.id === draftId);
    if (target) {
      setJustReactivatedFromBranch(true);
    }
    track('progressive_branch_to_draft', { draft_id: draftId });
  };

  const handlePromoteDraft = (draftId: string) => {
    store.promoteDraftToV1(draftId);
    track('progressive_promote_v1', { draft_id: draftId });
  };

  return {
    // Derivations
    drafts,
    activeDraftId,
    activeDraftPath,
    activeDraft,
    activeDraftPathIds,
    draftIsOnBranch,
    previewDraft,
    // UI state
    drawerOpen,
    setDrawerOpen,
    previewDraftId,
    setPreviewDraftId,
    iterationOpen,
    setIterationOpen,
    iterationDirective,
    setIterationDirective,
    isIterating,
    justReactivatedFromBranch,
    setJustReactivatedFromBranch,
    // Handlers
    onRequestRevision,
    handleBranchToDraft,
    handlePromoteDraft,
  };
}
