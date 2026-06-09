'use client';

/**
 * DraftModals — the three draft-domain overlays lifted out of ProgressiveFlow's
 * render: the version-history drawer, the read-only preview modal, and the
 * revision-directive modal.
 *
 * Pure presentation over the useDraftManagement surface — every value is a
 * prop, so the markup is byte-identical to what lived inline. The only inline
 * reference that wasn't already a draft-management value, `session.released_draft_id`,
 * arrives as `releasedDraftId`.
 */

import type { Dispatch, SetStateAction } from 'react';
import { X as XIcon, GitBranch, Wand2, Loader2, AlertTriangle } from 'lucide-react';
import { VersionHistoryDrawer, type VersionTreeItem } from '@/components/workspace/VersionHistoryDrawer';
import { useLocale } from '@/hooks/useLocale';
import type { Draft } from '@/stores/types';

interface DraftModalsProps {
  drafts: Draft[];
  releasedDraftId: string | null | undefined;
  activeDraftId: string | null;
  activeDraftPathIds: Set<string>;
  activeDraft: Draft | undefined;
  previewDraft: Draft | null;
  previewDraftId: string | null;
  setPreviewDraftId: Dispatch<SetStateAction<string | null>>;
  drawerOpen: boolean;
  setDrawerOpen: Dispatch<SetStateAction<boolean>>;
  iterationOpen: boolean;
  setIterationOpen: Dispatch<SetStateAction<boolean>>;
  iterationDirective: string;
  setIterationDirective: Dispatch<SetStateAction<string>>;
  isIterating: boolean;
  onRequestRevision: () => void;
  handleBranchToDraft: (draftId: string) => void;
  handlePromoteDraft: (draftId: string) => void;
  error: string | null;
  setError: Dispatch<SetStateAction<string | null>>;
}

export function DraftModals({
  drafts, releasedDraftId, activeDraftId, activeDraftPathIds, activeDraft,
  previewDraft, previewDraftId, setPreviewDraftId, drawerOpen, setDrawerOpen,
  iterationOpen, setIterationOpen, iterationDirective, setIterationDirective,
  isIterating, onRequestRevision, handleBranchToDraft, handlePromoteDraft,
  error, setError,
}: DraftModalsProps) {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);

  return (
    <>
      {/* ═══ Version History Drawer ═══ */}
      {drawerOpen && drafts.length > 0 && (
        <VersionHistoryDrawer
          nodes={drafts.map<VersionTreeItem>((d) => ({
            id: d.id,
            parent_id: d.parent_draft_id,
            created_at: d.created_at,
            label: d.version_label,
            summary: d.change_summary,
            is_released: releasedDraftId === d.id,
          }))}
          activeLeafId={activeDraftId}
          activePathIds={activeDraftPathIds}
          previewNodeId={previewDraftId}
          rootLabel={L('v0 (초기 분석)', 'v0 (initial analysis)')}
          rootSummary={L('에이전트 팀의 첫 합성', 'First team synthesis')}
          onClose={() => setDrawerOpen(false)}
          onPreview={(id) => setPreviewDraftId(id)}
          onBranch={handleBranchToDraft}
          onPromote={handlePromoteDraft}
        />
      )}

      {/* ═══ Draft Preview Modal ═══ */}
      {previewDraft && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => setPreviewDraftId(null)}
        >
          <div
            role="dialog" aria-modal="true" aria-label={L('버전 미리보기', 'Version preview')}
            className="relative w-full max-w-2xl max-h-[85vh] bg-[var(--bg)] rounded-xl shadow-[var(--shadow-lg)] border border-[var(--border)] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)]">
              <div>
                <p className="text-[11px] text-[var(--text-tertiary)]">{L('미리보기 · 읽기 전용', 'Preview · read-only')}</p>
                <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">{previewDraft.version_label}</h3>
                {previewDraft.change_summary && (
                  <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">{previewDraft.change_summary}</p>
                )}
              </div>
              <button
                className="p-1.5 rounded-lg hover:bg-[var(--surface)]"
                onClick={() => setPreviewDraftId(null)}
                aria-label={L('닫기', 'Close')}
              >
                <XIcon className="w-4 h-4" />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <pre className="text-[12px] text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
                {previewDraft.final_text}
              </pre>
            </div>
            <footer className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border)]">
              <button
                className="px-4 py-2 rounded-lg text-[12px] text-[var(--text-secondary)] border border-[var(--border)] hover:bg-[var(--surface)] transition-colors"
                onClick={() => setPreviewDraftId(null)}
              >
                {L('닫기', 'Close')}
              </button>
              {previewDraft.id !== activeDraftId && (
                <button
                  className="inline-flex items-center gap-1 px-4 py-2 rounded-lg text-[12px] font-semibold text-white bg-[var(--accent)] hover:opacity-90 transition-opacity"
                  onClick={() => handleBranchToDraft(previewDraft.id)}
                >
                  <GitBranch className="w-3 h-3" /> {L('이 버전에서 수정', 'Revise from here')}
                </button>
              )}
            </footer>
          </div>
        </div>
      )}

      {/* ═══ Revision Directive Modal ═══ */}
      {iterationOpen && activeDraft && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => { if (!isIterating) { setIterationOpen(false); setIterationDirective(''); } }}
        >
          <div
            role="dialog" aria-modal="true" aria-label={L('수정 요청', 'Revise request')}
            className="relative w-full max-w-xl bg-[var(--bg)] rounded-xl shadow-[var(--shadow-lg)] border border-[var(--border)] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-[var(--accent)]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
                    {L('항해장에게 수정 요청', 'Ask Navigator to revise')}
                  </h3>
                  <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                    {L('항해장은 팀 결과를 통합한 에이전트예요', 'The navigator integrates the whole team’s work')} · {L('현재 버전', 'Current version')} <span className="font-semibold">{activeDraft.version_label}</span>
                  </p>
                </div>
              </div>
              {!isIterating && (
                <button
                  className="p-1.5 rounded-lg hover:bg-[var(--surface)]"
                  onClick={() => { setIterationOpen(false); setIterationDirective(''); }}
                  aria-label={L('닫기', 'Close')}
                >
                  <XIcon className="w-4 h-4" />
                </button>
              )}
            </header>
            <div className="flex-1 px-5 py-4">
              <p className="text-[12px] text-[var(--text-secondary)] mb-2">
                {L('어떻게 고치면 좋을까? 구체적인 지시일수록 좋아요.', 'How should it change? More specific is better.')}
              </p>
              <textarea
                value={iterationDirective}
                onChange={(e) => setIterationDirective(e.target.value)}
                aria-label={L('수정 지시', 'Revision directive')}
                placeholder={L('예: 재무 섹션의 가정을 더 보수적으로. 낙관/기본/비관 3가지 시나리오 추가.', 'e.g. Make financial assumptions more conservative. Add 3 scenarios.')}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] resize-none leading-relaxed"
                rows={5}
                maxLength={500}
                disabled={isIterating}
                autoFocus
              />
              <div className="text-[10px] text-[var(--text-tertiary)] mt-1 text-right">
                {iterationDirective.length} / 500
              </div>
              {isIterating && (
                <div className="mt-3 flex items-center gap-2 text-[12px] text-[var(--accent)]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{L('항해장이 편집 중입니다...', 'Navigator is editing...')}</span>
                </div>
              )}
              {!isIterating && error && (
                <div className="mt-3 flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-700">
                  <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                  <span className="flex-1">{error}</span>
                  <button
                    className="text-[11px] text-red-600 hover:underline shrink-0"
                    onClick={() => setError(null)}
                    aria-label={L('에러 닫기', 'Dismiss error')}
                  >
                    {L('닫기', 'Dismiss')}
                  </button>
                </div>
              )}
            </div>
            <footer className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border)]">
              <button
                className="px-4 py-2 rounded-lg text-[12px] text-[var(--text-secondary)] border border-[var(--border)] hover:bg-[var(--surface)] transition-colors disabled:opacity-50"
                onClick={() => { setIterationOpen(false); setIterationDirective(''); }}
                disabled={isIterating}
              >
                {L('취소', 'Cancel')}
              </button>
              <button
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold text-white bg-[var(--accent)] hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={onRequestRevision}
                disabled={isIterating || iterationDirective.trim().length === 0}
              >
                {isIterating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                {isIterating ? L('생성 중...', 'Generating...') : L('수정본 생성', 'Generate revision')}
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
