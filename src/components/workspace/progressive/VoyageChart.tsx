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

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Compass, Anchor, X as XIcon, RotateCcw, ChevronRight, Flag, Pencil, GitCompare, Check } from 'lucide-react';
import { useProgressiveStore } from '@/stores/useProgressiveStore';
import { useLocale } from '@/hooks/useLocale';
import type { VoyageStage } from '@/stores/types';
import { getActivePath } from '@/lib/version-tree';
import { branchHeadSummary } from '@/lib/branch-summary';
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
  const renameBranch = useProgressiveStore(s => s.renameBranch);
  const locked = useProgressiveStore(s => s.isBranchingLocked());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [compareId, setCompareId] = useState<string | null>(null);
  // Two-step delete confirm — a course delete is destructive; arm before acting.
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const checkpoints = useMemo(() => session?.checkpoints || [], [session?.checkpoints]);
  const activeId = session?.active_checkpoint_id ?? null;
  const activePath = useMemo(() => getActivePath(checkpoints, activeId), [checkpoints, activeId]);
  const branches = useMemo(() => session?.branches ?? [], [session?.branches]);
  const activeBranch = branches.find(b => b.id === session?.active_branch_id) ?? null;
  const waypoints = useMemo(() => session?.waypoints ?? [], [session?.waypoints]);

  // Disarm a pending delete-confirm if its target is no longer a deletable,
  // non-active course or while branching is locked (mirrors Logbook).
  useEffect(() => {
    if (!deleteConfirmId) return;
    const stillDeletable = branches.some(b => b.id === deleteConfirmId && b.id !== activeBranch?.id);
    if (!stillDeletable || locked) setDeleteConfirmId(null);
  }, [deleteConfirmId, branches, activeBranch?.id, locked]);

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
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] overflow-hidden">
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
        <div className="max-h-[340px] overflow-y-auto">
          <BranchMap
            checkpoints={checkpoints}
            branches={branches}
            waypoints={session?.waypoints || []}
            activeBranchId={activeBranch?.id ?? null}
            activeCheckpointId={activeId}
            onPick={handleNodeClick}
          />
        </div>

        {/* Visual legend — the SVG marks can't explain themselves, so spell
            out the encoding (filled vs hollow node, ring, ⚑, dimmed). */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 px-1 text-[9px] text-[var(--text-tertiary)]">
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--accent)' }} />
            {L('기록된 기점', 'Logged point')}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full border shrink-0" style={{ borderColor: 'var(--accent)', background: 'var(--surface)' }} />
            {L('기점', 'Checkpoint')}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--accent)', outline: '1px solid var(--accent)', outlineOffset: '1.5px' }} />
            {L('현재 위치', 'Current')}
          </span>
          <span className="inline-flex items-center gap-1">
            <Flag size={9} className="text-[var(--accent)] shrink-0" />
            {L('확정 항로', 'Anchored')}
          </span>
          {branches.some(b => b.status === 'abandoned') && (
            <span className="inline-flex items-center gap-1 opacity-50">
              <span className="w-2 h-2 rounded-full border shrink-0" style={{ borderColor: 'var(--text-tertiary)' }} />
              {L('포기한 항로', 'Abandoned')}
            </span>
          )}
        </div>

        {/* Footer hint — adapts to whether the user has any branches yet.
            First-timers get a "try forking" nudge; veterans get a how-to. */}
        <div className="text-[10px] text-[var(--text-tertiary)] mt-2 px-1 leading-tight">
          {branches.length <= 1
            ? L('아직 한 항로예요. 기점을 클릭해 다른 항로를 내볼 수 있어요.', 'Single course so far. Click a waypoint to start a new course.')
            : L('기점이나 항로를 클릭해 그 시점으로 돌아가거나 새 항로를 낼 수 있어요.', 'Click a waypoint or course to revisit or start a new course there.')}
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
                  className={`flex items-center flex-wrap gap-1.5 px-1.5 py-1 rounded-lg ${isActive ? 'bg-[var(--accent)]/8' : ''} ${abandoned ? 'opacity-50' : ''}`}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: b.color }} />
                  {editingId === b.id ? (
                    <input
                      autoFocus
                      value={draftName}
                      maxLength={60}
                      onChange={(e) => setDraftName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { renameBranch(b.id, draftName); setEditingId(null); }
                        else if (e.key === 'Escape') setEditingId(null);
                      }}
                      onBlur={() => { renameBranch(b.id, draftName); setEditingId(null); }}
                      className="text-[11px] flex-1 min-w-0 bg-[var(--bg)] border border-[var(--accent)]/40 rounded px-1 py-0.5 text-[var(--text-primary)] focus:outline-none"
                    />
                  ) : (
                    <>
                      <span className="text-[11px] text-[var(--text-primary)] truncate flex-1 min-w-0" title={b.name}>{b.name}</span>
                      <button
                        onClick={() => { setEditingId(b.id); setDraftName(b.name); }}
                        title={L('이름 변경', 'Rename')}
                        className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--accent)] shrink-0 cursor-pointer"
                      >
                        <Pencil size={10} />
                      </button>
                    </>
                  )}
                  {b.status === 'anchored' && <Flag size={9} className="text-[var(--accent)] shrink-0" />}
                  <span className="text-[9px] text-[var(--text-tertiary)] tabular-nums shrink-0">{count}</span>
                  {isActive ? (
                    <span className="text-[9px] text-[var(--accent)] font-semibold shrink-0 ml-0.5">{L('활성', 'active')}</span>
                  ) : (
                    <button
                      onClick={() => !locked && switchBranch(b.id)}
                      disabled={locked}
                      title={L('이 항로로 전환', 'Switch to this course')}
                      className={`text-[12px] font-medium text-[var(--accent)] hover:underline shrink-0 ml-0.5 px-2 py-1.5 min-h-[36px] inline-flex items-center cursor-pointer ${locked ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      {L('전환', 'Switch')}
                    </button>
                  )}
                  {b.status !== 'anchored' && (
                    <button
                      onClick={() => !locked && anchorBranch(b.id)}
                      disabled={locked}
                      title={L('이 항로로 확정', 'Anchor this course')}
                      className={`min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--accent)] shrink-0 cursor-pointer ${locked ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      <Anchor size={11} />
                    </button>
                  )}
                  {!isActive && activeBranch && (
                    <button
                      onClick={() => setCompareId(prev => (prev === b.id ? null : b.id))}
                      title={L('활성 항로와 비교', 'Compare with active course')}
                      className={`min-w-[44px] min-h-[44px] inline-flex items-center justify-center shrink-0 cursor-pointer ${compareId === b.id ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)] hover:text-[var(--accent)]'}`}
                    >
                      <GitCompare size={11} />
                    </button>
                  )}
                  {!isActive && (
                    deleteConfirmId === b.id ? (
                      <span className="inline-flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => { setDeleteConfirmId(null); if (!locked) deleteBranch(b.id); }}
                          disabled={locked}
                          className={`text-[12px] font-semibold text-[var(--danger)] px-2 py-1.5 min-h-[36px] inline-flex items-center rounded-md bg-[var(--danger)]/8 hover:bg-[var(--danger)]/15 cursor-pointer ${locked ? 'opacity-40 cursor-not-allowed' : ''}`}
                        >
                          {L('삭제', 'Delete')}
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          aria-label={L('취소', 'Cancel')}
                          className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer"
                        >
                          <XIcon size={11} />
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(b.id)}
                        disabled={locked}
                        title={L('항로 삭제', 'Delete course')}
                        className={`min-w-[44px] min-h-[44px] inline-flex items-center justify-center ml-0.5 text-[var(--text-tertiary)] hover:text-[var(--danger)] shrink-0 cursor-pointer ${locked ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        <XIcon size={11} />
                      </button>
                    )
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Course comparison — weigh the active course against another before
            anchoring, so the choice isn't blind. */}
        {compareId && activeBranch && (() => {
          const other = branches.find(b => b.id === compareId);
          if (!other) return null;
          const cols = [
            branchHeadSummary(checkpoints, waypoints, activeBranch),
            branchHeadSummary(checkpoints, waypoints, other),
          ];
          return (
            <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]/40">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--text-tertiary)] flex items-center gap-1">
                  <GitCompare size={10} /> {L('항로 비교', 'Compare courses')}
                </span>
                <button onClick={() => setCompareId(null)} aria-label={L('닫기', 'Close')} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer">
                  <XIcon size={11} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {cols.map((s, i) => (
                  <div key={s.id} className="rounded-lg border border-[var(--border-subtle)] p-2 space-y-1.5 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                      <span className="text-[11px] font-semibold text-[var(--text-primary)] truncate">{s.name}</span>
                      {i === 0 && <span className="text-[8px] text-[var(--accent)] font-bold shrink-0">{L('활성', 'active')}</span>}
                    </div>
                    <div>
                      <div className="text-[8px] uppercase tracking-wide text-[var(--text-tertiary)]">{L('진짜 질문', 'Real question')}</div>
                      <div className="text-[10px] text-[var(--text-primary)] leading-snug">{s.realQuestion || '—'}</div>
                    </div>
                    {s.assumptions.length > 0 && (
                      <div>
                        <div className="text-[8px] uppercase tracking-wide text-[var(--text-tertiary)]">{L('남은 가정', 'Open assumptions')}</div>
                        <ul className="space-y-0.5">
                          {s.assumptions.map((a, k) => (
                            <li key={k} className="text-[9.5px] text-[var(--text-secondary)] leading-snug flex gap-1">
                              <span className="opacity-50 shrink-0">·</span><span className="min-w-0">{a}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-[9px] text-[var(--text-tertiary)] pt-0.5">
                      <span>{L(`변곡점 ${s.turns}`, `${s.turns} turns`)}</span>
                      {s.hasFinal && <span className="inline-flex items-center gap-0.5 text-[var(--accent)]"><Check size={8} />{L('산출물', 'draft')}</span>}
                      {s.status === 'anchored' && <span className="text-[var(--accent)]">⚑</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
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
                className="fixed inset-0 z-[60] bg-black/45"
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
                          `'${target.label}' 시점으로 돌아갑니다. 현재 진행한 작업은 다른 항로로 보존돼요.`,
                          `Rewinds to '${target.label}'. Your current work is preserved as a separate course.`,
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
