'use client';

/**
 * VoyageChart — 해도 (nautical chart) showing the user's decision voyage
 * as a real branching graph.
 *
 * v2 polish (Tier 1+2+3 from objective review):
 *   - Lucide icons replace OS-specific emoji glyphs (consistent)
 *   - Invisible hit circles around every node so 9px branches are still
 *     comfortably tappable (radius bumped to 14px hit-area on top of the
 *     8px visual)
 *   - Up to 2 sibling branches rendered laterally; "+N" badge for the
 *     overflow with a popover that lists them all
 *   - Wider label column (BRANCH_X bumped to 180), labels wrap to 2 lines
 *     instead of truncating
 *   - Tighter ROW_H so the chart fits inside the agent sidebar without
 *     fighting it for vertical space
 *   - Footer copy adapts to whether the user has any alt branches yet —
 *     so first-timers get a hint that nudges them to try forking
 *   - Header coordinate hint replaced with plain "M / N waypoints"
 *   - Branch nodes get a small inline label (no more hover-only tooltip)
 *   - Destination's anchor icon no longer overlaps a stage glyph below it
 *   - Graticule opacity nudged up so the chart vibe reads even in light
 *     mode
 *
 * Backend wiring: reads `session.checkpoints` + `session.active_checkpoint_id`
 * from useProgressiveStore and calls `navigateToCheckpoint(id)` on a node pick —
 * which resolves to switching to the branch that owns the checkpoint, or forking
 * a new course from it (keeping the chart consistent with the branch model).
 */

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Compass, Anchor, X as XIcon, RotateCcw, ChevronRight, Flag } from 'lucide-react';
import { useProgressiveStore } from '@/stores/useProgressiveStore';
import { useLocale } from '@/hooks/useLocale';
import type { VoyageStage } from '@/stores/types';
import { getActivePath } from '@/lib/version-tree';
import { BranchMap } from './BranchMap';
import { EASE } from './shared/constants';

// Stage order — denominator for the header's "reached / total" waypoint count.
const STAGE_ORDER: VoyageStage[] = [
  'origin', 'briefing', 'crew_set', 'crew_done', 'mix', 'review', 'anchor',
];

export function VoyageChart() {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const session = useProgressiveStore(s => s.sessions.find(ss => ss.id === s.currentSessionId));
  const navigateToCheckpoint = useProgressiveStore(s => s.navigateToCheckpoint);
  const switchBranch = useProgressiveStore(s => s.switchBranch);
  const anchorBranch = useProgressiveStore(s => s.anchorBranch);
  const deleteBranch = useProgressiveStore(s => s.deleteBranch);
  const locked = useProgressiveStore(s => s.isBranchingLocked());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const checkpoints = useMemo(() => session?.checkpoints || [], [session?.checkpoints]);
  const activeId = session?.active_checkpoint_id ?? null;
  const activePath = useMemo(() => getActivePath(checkpoints, activeId), [checkpoints, activeId]);
  const branches = session?.branches ?? [];
  const activeBranch = branches.find(b => b.id === session?.active_branch_id) ?? null;

  if (!session || checkpoints.length === 0) return null;

  const handleNodeClick = (id: string) => {
    setSelectedId(prev => prev === id ? null : id);
  };
  const handleRestoreRequest = (id: string) => {
    setConfirmId(id);
    setSelectedId(null);
  };
  const handleConfirm = () => {
    if (confirmId) navigateToCheckpoint(confirmId);
    setConfirmId(null);
  };

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)]/85 backdrop-blur-sm overflow-hidden">
      {/* Header — chart title + clearer waypoint count */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border-subtle)]/60">
        <Compass size={12} className="text-[var(--accent)]" />
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
          {L('해도', 'Chart')}
        </span>
        <span className="ml-auto text-[10px] text-[var(--text-tertiary)]">
          {L(
            `${activePath.length} / ${STAGE_ORDER.length} 기점`,
            `${activePath.length} / ${STAGE_ORDER.length} waypoints`,
          )}
        </span>
      </div>

      {/* Active course summary — shown once the voyage has more than one course */}
      {branches.length > 1 && activeBranch && (
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-[var(--border-subtle)]/40 text-[10px]">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: activeBranch.color }} />
          <span className="font-semibold text-[var(--text-primary)] truncate max-w-[130px]">{activeBranch.name}</span>
          {activeBranch.status === 'anchored' && <Flag size={9} className="text-[var(--accent)] shrink-0" />}
          <span className="ml-auto text-[var(--text-tertiary)]">{L(`항로 ${branches.length}개`, `${branches.length} courses`)}</span>
        </div>
      )}

      {/* Chart body */}
      <div className="relative px-2 py-3">
        <BranchMap
          checkpoints={checkpoints}
          branches={branches}
          waypoints={session?.waypoints || []}
          activeBranchId={activeBranch?.id ?? null}
          activeCheckpointId={activeId}
          onPick={handleNodeClick}
        />

        {/* Footer hint — adapts to whether the user has any branches yet.
            First-timers get a "try forking" nudge; veterans get a how-to. */}
        <div className="text-[10px] text-[var(--text-tertiary)] mt-2 px-1 leading-tight">
          {branches.length <= 1
            ? L('아직 한 항로예요. 기점을 클릭해서 다른 길로 분기해 볼 수 있어요.', 'Single course so far. Click a waypoint to fork a new one.')
            : L('기점이나 항로를 클릭해서 그 시점으로 돌아가거나 분기할 수 있어요.', 'Click a waypoint or course to rewind or fork there.')}
        </div>

        {/* Course legend — every branch (incl. freshly-forked ones with no
            divergent checkpoint yet, which the SVG tree can't show). Full
            management: switch / anchor / delete. */}
        {branches.length > 1 && (
          <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]/40 space-y-0.5">
            <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--text-tertiary)] mb-1">
              {L('항로 목록', 'Courses')}
            </div>
            {branches.map(b => {
              const isActive = b.id === activeBranch?.id;
              const count = getActivePath(checkpoints, b.head_checkpoint_id).length;
              const abandoned = b.status === 'abandoned';
              return (
                <div
                  key={b.id}
                  className={`flex items-center gap-1.5 px-1.5 py-1 rounded-lg ${isActive ? 'bg-[var(--accent)]/8' : ''} ${abandoned ? 'opacity-50' : ''}`}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: b.color }} />
                  <span className="text-[11px] text-[var(--text-primary)] truncate flex-1 min-w-0" title={b.name}>{b.name}</span>
                  {b.status === 'anchored' && <Flag size={9} className="text-[var(--accent)] shrink-0" />}
                  <span className="text-[9px] text-[var(--text-tertiary)] tabular-nums shrink-0">{count}</span>
                  {isActive ? (
                    <span className="text-[9px] text-[var(--accent)] font-semibold shrink-0 ml-0.5">{L('활성', 'active')}</span>
                  ) : (
                    <button
                      onClick={() => !locked && switchBranch(b.id)}
                      disabled={locked}
                      title={L('이 항로로 전환', 'Switch to this course')}
                      className={`text-[9px] font-medium text-[var(--accent)] hover:underline shrink-0 ml-0.5 cursor-pointer ${locked ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      {L('전환', 'Switch')}
                    </button>
                  )}
                  {b.status !== 'anchored' && (
                    <button
                      onClick={() => !locked && anchorBranch(b.id)}
                      disabled={locked}
                      title={L('이 항로로 확정', 'Anchor this course')}
                      className={`p-0.5 text-[var(--text-tertiary)] hover:text-[var(--accent)] shrink-0 cursor-pointer ${locked ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      <Anchor size={11} />
                    </button>
                  )}
                  {!isActive && (
                    <button
                      onClick={() => !locked && deleteBranch(b.id)}
                      disabled={locked}
                      title={L('분기 삭제', 'Delete branch')}
                      className={`p-0.5 text-[var(--text-tertiary)] hover:text-[var(--danger)] shrink-0 cursor-pointer ${locked ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      <XIcon size={11} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Selection popover (slides in below the chart for the picked
          waypoint). Active-waypoint clicks just close — no empty popover. */}
      <AnimatePresence>
        {selectedId && (() => {
          const cp = checkpoints.find(c => c.id === selectedId);
          if (!cp || cp.id === activeId) return null;
          return (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22, ease: EASE }}
              className="overflow-hidden border-t border-[var(--accent)]/20 bg-[var(--accent)]/[0.04]"
            >
              <div className="px-4 py-3">
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <span className="text-[11.5px] font-semibold text-[var(--text-primary)]">{cp.label}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer min-w-[20px] min-h-[20px] flex items-center justify-center"
                    aria-label={L('닫기', 'Close')}
                  >
                    <XIcon size={11} />
                  </button>
                </div>
                <div className="text-[10px] text-[var(--text-tertiary)] mb-2.5">
                  {new Date(cp.created_at).toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US', {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => handleRestoreRequest(cp.id)}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded text-[11px] font-semibold text-[var(--accent)] border border-[var(--accent)]/35 hover:bg-[var(--accent)]/10 transition-colors cursor-pointer min-h-[36px]"
                >
                  <RotateCcw size={11} />
                  {L('이 지점에서 항해', 'Sail from here')}
                  <ChevronRight size={10} />
                </button>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>


      {/* Confirm modal */}
      <AnimatePresence>
        {confirmId && (() => {
          const target = checkpoints.find(c => c.id === confirmId);
          if (!target) return null;
          return (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setConfirmId(null)}
                className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 4 }}
                transition={{ duration: 0.22, ease: EASE }}
                className="fixed inset-0 z-[61] flex items-center justify-center p-4 pointer-events-none"
              >
                <div className="pointer-events-auto w-full max-w-sm rounded-2xl bg-[var(--surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-xl)] p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-9 h-9 rounded-full bg-[var(--accent)]/10 flex items-center justify-center shrink-0">
                      <RotateCcw size={15} className="text-[var(--accent)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[14px] font-semibold text-[var(--text-primary)] mb-1">
                        {L('여기서 새 항로 잡을까요?', 'Set a new course from here?')}
                      </h3>
                      <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed">
                        {L(
                          `'${target.label}' 시점으로 돌아갑니다. 현재 진행한 작업은 다른 분기로 보존돼요.`,
                          `Rewinds to '${target.label}'. Your current course is preserved as a sibling branch.`,
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => setConfirmId(null)}
                      className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-tertiary)] hover:bg-[var(--bg)] transition-colors cursor-pointer"
                      aria-label={L('닫기', 'Close')}
                    >
                      <XIcon size={14} />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmId(null)}
                      className="flex-1 px-3 py-2.5 rounded-lg text-[12.5px] font-medium text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:border-[var(--accent)]/30 transition-colors cursor-pointer"
                    >
                      {L('취소', 'Cancel')}
                    </button>
                    <button
                      onClick={handleConfirm}
                      className="flex-1 px-3 py-2.5 rounded-lg text-[12.5px] font-semibold text-white shadow-[var(--shadow-sm)] cursor-pointer"
                      style={{ background: 'var(--gradient-gold)' }}
                    >
                      {L('이 항로로', 'Set course')}
                    </button>
                  </div>
                </div>
              </motion.div>
            </>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
