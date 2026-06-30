'use client';

import { useMemo } from 'react';
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
  const resolvedRootLabel = rootLabel ?? L('v0 (초안)', 'v0 (draft)');
  const resolvedRootSummary = rootSummary ?? L('원본', 'Original');
  const tree = useMemo(() => buildTree(nodes), [nodes]);

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
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent)] text-white">
                <Check className="w-2.5 h-2.5" /> {L('현재', 'current')}
              </span>
            )}
            {isReleased && (
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                <Crown className="w-2.5 h-2.5" /> released
              </span>
            )}
            <span className="ml-auto text-[10px] text-[var(--text-tertiary)]">
              {item.created_at ? relativeTime(item.created_at, locale) : ''}
            </span>
          </div>
          <p
            className="text-[12px] text-[var(--text-secondary)] leading-snug line-clamp-2 mb-2 cursor-pointer hover:text-[var(--text-primary)]"
            onClick={() => onPreview(nodeId)}
            title={L('클릭하면 이 버전의 본문을 미리 봅니다', 'Click to preview this version')}
          >
            {summary}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              className="inline-flex items-center gap-1 text-[11px] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
              onClick={() => onPreview(nodeId)}
            >
              <Eye className="w-3 h-3" /> {L('보기', 'View')}
            </button>
            {!isActiveLeaf && (
              <button
                className="inline-flex items-center gap-1 text-[11px] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
                onClick={() => onBranch(nodeId)}
              >
                <GitBranch className="w-3 h-3" /> {L('이 버전에서 수정', 'Revise here')}
              </button>
            )}
            {canPromote && (
              <button
                className="inline-flex items-center gap-1 text-[11px] text-amber-700 hover:text-amber-900 transition-colors ml-auto"
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
      />
      <aside className="absolute right-0 top-0 h-full w-[min(360px,calc(100vw-44px))] bg-[var(--bg)] border-l border-[var(--border)] shadow-[var(--shadow-lg)] pointer-events-auto flex flex-col">
        <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <div>
            <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">{L('버전 히스토리', 'Version History')}</h3>
            <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
              {L('클릭으로 돌아가거나 새 수정본을 시작하세요', 'Click to revisit or start a new revision')}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label={L('닫기', 'Close')}>
            <X className="w-4 h-4" />
          </Button>
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-3 pb-[env(safe-area-inset-bottom)]">
          {tree.length === 0 ? (
            <div className="text-[12px] text-[var(--text-tertiary)] text-center py-8">
              {L('아직 저장된 버전이 없습니다.', 'No saved versions yet.')}
            </div>
          ) : (
            <div>
              <div className="mb-3 pb-2 border-b border-dashed border-[var(--border)]">
                <div className="text-[11px] text-[var(--text-tertiary)] mb-0.5">{resolvedRootLabel}</div>
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
