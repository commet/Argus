'use client';

import { useEffect, useId, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { GitBranch, Check, Crown, X, Eye } from 'lucide-react';
import { isPreRelease } from '@/lib/version-numbering';
import { buildTree, type TreeHierarchyNode, type VersionNode } from '@/lib/version-tree';
import { useLocale } from '@/hooks/useLocale';

/**
 * Generic tree-view drawer for version histories.
 *
 * Consumers (RefineStep, ProgressiveFlow) adapt their domain types
 * (RefineIteration, Draft, …) into `VersionTreeItem` and hand the drawer
 * a flat array. The drawer is shape-agnostic — it only knows about
 * `{id, parent_id, label, summary, created_at}`. Mutations are delegated
 * to the parent via the four callbacks.
 */
export interface VersionTreeItem extends VersionNode {
  label: string;
  summary: string;
  is_released?: boolean;
}

interface VersionHistoryDrawerProps {
  nodes: VersionTreeItem[];
  activeLeafId: string | null;
  activePathIds: Set<string>;
  previewNodeId: string | null;
  /** Label for the synthetic root entry (e.g. "v0 (초안)"). Defaults to "v0". */
  rootLabel?: string;
  /** Summary text for the synthetic root entry. Defaults to "원본". */
  rootSummary?: string;
  onClose: () => void;
  onPreview: (nodeId: string) => void;
  onBranch: (nodeId: string) => void;
  onPromote: (nodeId: string) => void;
}

function relativeTime(iso: string, locale: 'ko' | 'en'): string {
  try {
    const diffMs = Date.now() - new Date(iso).getTime();
    const s = Math.floor(diffMs / 1000);
    if (s < 60) return locale === 'ko' ? '방금' : 'just now';
    const m = Math.floor(s / 60);
    if (m < 60) return locale === 'ko' ? `${m}분 전` : `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return locale === 'ko' ? `${h}시간 전` : `${h}h ago`;
    const d = Math.floor(h / 24);
    return locale === 'ko' ? `${d}일 전` : `${d}d ago`;
  } catch {
    return '';
  }
}

export function VersionHistoryDrawer({
  nodes,
  activeLeafId,
  activePathIds,
  previewNodeId,
  rootLabel,
  rootSummary,
  onClose,
  onPreview,
  onBranch,
  onPromote,
}: VersionHistoryDrawerProps) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const titleId = useId();
  const drawerRef = useRef<HTMLElement>(null);
  const previewNodeIdRef = useRef(previewNodeId);
  previewNodeIdRef.current = previewNodeId;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const resolvedRootLabel = rootLabel ?? L('v0 (첫 정리)', 'v0 (first write-up)');
  const resolvedRootSummary = rootSummary ?? L('원본', 'Original');
  const tree = useMemo(() => buildTree(nodes), [nodes]);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const onKeyDown = (event: KeyboardEvent) => {
      // A version preview opens above this drawer. Let that topmost dialog
      // consume Escape first so one key never closes two layers at once.
      if (event.key === 'Escape' && !previewNodeIdRef.current) {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !drawerRef.current || previewNodeIdRef.current) return;
      const focusable = Array.from(drawerRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      if (focusable.length === 0) { event.preventDefault(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !drawerRef.current.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const raf = requestAnimationFrame(() => drawerRef.current?.focus());
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      cancelAnimationFrame(raf);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, []);

  const renderNode = (node: TreeHierarchyNode<VersionTreeItem>, depth: number) => {
    const item = node.data;
    const nodeId = item.id;
    const isActivePath = activePathIds.has(nodeId);
    const isActiveLeaf = activeLeafId === nodeId;
    const isPreview = previewNodeId === nodeId;
    const label = item.label;
    const summary = item.summary || '—';
    // Only the currently-active leaf may be promoted — prevents multiple
    // nodes in the same tree from being relabeled "v1.0".
    const canPromote = isPreRelease(label) && isActiveLeaf;
    const isReleased = !!item.is_released || !isPreRelease(label);

    return (
      <div key={nodeId} className="relative">
        <div
          className={[
            'group rounded-lg border px-3 py-2.5 mb-1.5 transition-all',
            isActiveLeaf
              ? 'border-[var(--accent)] bg-[var(--gold-muted)]/40 shadow-[var(--shadow-xs)]'
              : isActivePath
                ? 'border-[var(--accent-light)]/50 bg-[var(--surface)]'
                : 'border-[var(--border)] bg-[var(--surface)]',
            isPreview && 'ring-2 ring-[var(--accent-light)]',
          ]
            .filter(Boolean)
            .join(' ')}
          style={{ marginLeft: `${Math.min(depth, 3) * 12}px` }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[13px] font-semibold text-[var(--text-primary)]">{label}</span>
            {isActiveLeaf && (
              <span className="inline-flex items-center gap-1 text-[12px] px-1.5 py-0.5 rounded bg-[var(--accent)] text-white">
                <Check className="w-2.5 h-2.5" /> {L('현재', 'current')}
              </span>
            )}
            {isReleased && (
              <span className="inline-flex items-center gap-1 text-[12px] px-1.5 py-0.5 rounded bg-[var(--warning)]/15 text-[var(--warning)]">
                <Crown className="w-2.5 h-2.5" /> {L('정식 버전', 'released')}
              </span>
            )}
            <span className="ml-auto text-[12px] text-[var(--text-tertiary)]">
              {item.created_at ? relativeTime(item.created_at, locale) : ''}
            </span>
          </div>
          <button
            type="button"
            className="block w-full text-left text-[12px] text-[var(--text-secondary)] leading-snug mb-2 cursor-pointer hover:text-[var(--text-primary)]"
            onClick={() => onPreview(nodeId)}
            title={L('클릭하면 이 버전의 본문을 미리 봅니다', 'Click to preview this version')}
          >
            <span className="line-clamp-2">{summary}</span>
          </button>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="inline-flex items-center gap-1 text-[12.5px] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
              onClick={() => onPreview(nodeId)}
            >
              <Eye className="w-3 h-3" /> {L('보기', 'View')}
            </button>
            {!isActiveLeaf && (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-[12.5px] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
                onClick={() => onBranch(nodeId)}
              >
                <GitBranch className="w-3 h-3" /> {L('이 버전에서 수정', 'Revise here')}
              </button>
            )}
            {canPromote && (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-[12.5px] text-[var(--warning)] hover:text-amber-900 transition-colors ml-auto"
                onClick={() => onPromote(nodeId)}
                title={L('이 버전을 v1.0으로 승격합니다', 'Promote this version to v1.0')}
              >
                <Crown className="w-3 h-3" /> {L('v1으로 승격', 'Promote to v1')}
              </button>
            )}
          </div>
        </div>
        {node.children.length > 0 && (
          <div>
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-40 pointer-events-none">
      <div
        className="absolute inset-0 bg-black/10 pointer-events-auto"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        ref={drawerRef}
        id="version-history-drawer"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute right-0 top-0 h-full w-[min(380px,calc(100vw-24px))] bg-[var(--bg)] border-l border-[var(--border)] shadow-[var(--shadow-lg)] pointer-events-auto flex flex-col focus:outline-none"
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <div>
            <h3 id={titleId} className="text-[14px] font-semibold text-[var(--text-primary)]">{L('버전 히스토리', 'Version History')}</h3>
            <p className="text-[12.5px] text-[var(--text-tertiary)] mt-0.5">
              {L(`${nodes.length}개 저장됨 · 읽어본 뒤 원하는 지점에서 수정할 수 있어요`, `${nodes.length} saved · preview one, then revise from that point`)}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label={L('닫기', 'Close')}>
            <X className="w-4 h-4" />
          </Button>
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-3 pb-[env(safe-area-inset-bottom)]">
          <div className="mb-3 rounded-lg bg-[var(--surface)] px-3 py-2 text-[12.5px] leading-relaxed text-[var(--text-tertiary)]">
            <span className="font-semibold text-[var(--accent)]">{L('현재', 'Current')}</span>
            {L('는 지금 편집 기준 · ', ' is your working version · ')}
            <span className="font-semibold text-[var(--warning)]">{L('정식 버전', 'Released')}</span>
            {L('은 복사·공유 기준이에요.', ' is the copy/share version.')}
          </div>
          {tree.length === 0 ? (
            <div className="text-[12px] text-[var(--text-tertiary)] text-center py-8">
              {L('아직 저장된 버전이 없습니다.', 'No saved versions yet.')}
            </div>
          ) : (
            <div>
              <div className="mb-3 pb-2 border-b border-dashed border-[var(--border)]">
                <div className="text-[12.5px] text-[var(--text-tertiary)] mb-0.5">{resolvedRootLabel}</div>
                <div className="text-[12px] text-[var(--text-secondary)] italic">{resolvedRootSummary}</div>
              </div>
              {tree.map((node) => renderNode(node, 0))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
