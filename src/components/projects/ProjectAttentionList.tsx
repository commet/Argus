'use client';

import { useEffect, useState } from 'react';
import { ArrowUpRight, CircleHelp, Clock3, FileSearch, LocateFixed, Radar, UserCheck, Waves } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import { openTraceLocator } from '@/lib/evidence-trace';
import type { ProjectAttentionItem, ProjectAttentionKind } from '@/lib/project-attention';

const ICONS: Record<ProjectAttentionKind, typeof Clock3> = {
  check_in: Clock3,
  premise_recheck: Radar,
  open_question: CircleHelp,
  receipt_check_in: FileSearch,
  ground_shift: Waves,
  stakeholder_check: UserCheck,
};

function decisionIdFor(item: ProjectAttentionItem): string | null {
  if (item.projectId) return item.projectId;
  const reviewTarget = item.affected.find((entry) => entry.scope === 'review');
  return reviewTarget?.id ?? null;
}

export function ProjectAttentionList({
  items,
  focusedDecisionId,
  focusedAttentionId,
  scrollToFocused = false,
  onFocusItem,
}: {
  items: ProjectAttentionItem[];
  focusedDecisionId?: string | null;
  focusedAttentionId?: string | null;
  scrollToFocused?: boolean;
  onFocusItem?: (item: ProjectAttentionItem, decisionId: string | null) => void;
}) {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const [expanded, setExpanded] = useState(false);
  const focusedIndex = focusedAttentionId ? items.findIndex((item) => item.id === focusedAttentionId) : -1;

  useEffect(() => {
    if (!focusedAttentionId || focusedIndex < 0) return;
    if (focusedIndex >= 5) setExpanded(true);
    if (!scrollToFocused) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(`project-attention-${focusedAttentionId}`)?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'nearest',
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusedAttentionId, focusedIndex, scrollToFocused]);

  if (items.length === 0) return null;
  const visible = expanded ? items : items.slice(0, 5);

  const kindLabel = (kind: ProjectAttentionKind) => ({
    check_in: L('결과 확인', 'Check outcome'),
    premise_recheck: L('전제 재확인', 'Recheck premise'),
    open_question: L('미결 다시 보기', 'Revisit open question'),
    receipt_check_in: L('문서 판단 확인', 'Check document judgment'),
    ground_shift: L('공통 전제 이동', 'Shared premise moved'),
    stakeholder_check: L('이해관계자 실제 확인', 'Stakeholder reality check'),
  }[kind]);

  return (
    <section aria-labelledby="project-attention-heading" className="border-y border-[var(--border-subtle)]">
      <header className="flex items-end justify-between gap-3 px-1 py-3">
        <div>
          <h2 id="project-attention-heading" className="text-[14px] font-bold text-[var(--text-primary)]">
            {L('지금 살펴볼 것', 'Needs a look now')}
          </h2>
          <p className="mt-0.5 text-[11.5px] text-[var(--text-secondary)]">
            {L('확인할 이유와 영향을 받는 판단을 함께 묶었습니다.', 'Each signal includes why it matters and which judgments depend on it.')}
          </p>
        </div>
        <span className="shrink-0 text-[11px] tabular-nums text-[var(--text-tertiary)]">{items.length}</span>
      </header>

      <ol className="divide-y divide-[var(--border-subtle)]">
        {visible.map((item) => {
          const Icon = ICONS[item.kind];
          const affected = item.affected;
          const decisionId = decisionIdFor(item);
          const selected = focusedAttentionId === item.id
            || (!!focusedDecisionId && focusedDecisionId === decisionId);
          return (
            <li
              key={item.id}
              id={`project-attention-${item.id}`}
              data-attention-selected={selected ? 'true' : 'false'}
              className={`group flex items-stretch gap-2 px-1 py-1.5 transition-colors ${selected ? 'bg-[var(--accent)]/[0.07]' : ''}`}
            >
              <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center text-amber-700 dark:text-amber-400" aria-hidden="true">
                <Icon size={15} />
              </span>
              <button
                type="button"
                onClick={() => onFocusItem ? onFocusItem(item, decisionId) : openTraceLocator(item.locator)}
                className="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
                aria-pressed={selected}
                aria-label={onFocusItem
                  ? L(`${kindLabel(item.kind)} 결정 지도에서 찾기`, `Locate ${kindLabel(item.kind)} on the decision map`)
                  : L(`${kindLabel(item.kind)} 원문 위치 열기`, `Open source for ${kindLabel(item.kind)}`)}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-amber-700 dark:text-amber-400">{kindLabel(item.kind)}</span>
                    <span className="text-[10.5px] text-[var(--text-tertiary)]">{item.context}</span>
                    {item.ageDays != null && <span className="text-[10.5px] tabular-nums text-[var(--text-tertiary)]">· {L(`${item.ageDays}일째`, `${item.ageDays}d`)}</span>}
                  </span>
                  <span className="mt-0.5 block text-[13px] font-medium leading-[1.5] text-[var(--text-primary)] line-clamp-2">{item.title}</span>
                  <span className="mt-1 flex items-center gap-1 text-[10.5px] text-[var(--text-secondary)]">
                    {L(`영향받는 판단 ${affected.length}건`, `${affected.length} affected judgment${affected.length === 1 ? '' : 's'}`)}
                    {affected.length <= 3 && <span className="truncate text-[var(--text-tertiary)]">· {affected.map((entry) => entry.label).join(' · ')}</span>}
                  </span>
                </span>
                {onFocusItem && <LocateFixed size={15} className={`shrink-0 transition-colors ${selected ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)] group-hover:text-[var(--accent)]'}`} aria-hidden="true" />}
              </button>
              {onFocusItem && (
                <button
                  type="button"
                  onClick={() => openTraceLocator(item.locator)}
                  title={L('정확한 근거 위치 열기', 'Open the exact source')}
                  aria-label={L(`${kindLabel(item.kind)} 정확한 근거 위치 열기`, `Open exact source for ${kindLabel(item.kind)}`)}
                  className="my-auto inline-flex h-10 w-10 shrink-0 items-center justify-center text-[var(--text-tertiary)] transition-colors hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
                >
                  <ArrowUpRight size={16} aria-hidden="true" />
                </button>
              )}
            </li>
          );
        })}
      </ol>
      {items.length > 5 && (
        <div className="flex justify-end border-t border-[var(--border-subtle)] px-1 py-2">
          <button type="button" onClick={() => setExpanded((value) => !value)} className="min-h-9 text-[11.5px] font-semibold text-[var(--accent)] hover:underline">
            {expanded ? L('접기', 'Show less') : L(`${items.length - 5}건 더 보기`, `Show ${items.length - 5} more`)}
          </button>
        </div>
      )}
    </section>
  );
}
