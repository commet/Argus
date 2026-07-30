'use client';

import { useEffect, useState } from 'react';
import { ArrowUpRight, CircleHelp, Clock3, FileSearch, Radar, UserCheck, Waves } from 'lucide-react';
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
    if (focusedIndex >= 3) setExpanded(true);
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
  const visible = expanded ? items : items.slice(0, 3);

  const kindLabel = (kind: ProjectAttentionKind) => ({
    check_in: L('결과 적기', 'Record outcome'),
    premise_recheck: L('전제 확인', 'Check premise'),
    open_question: L('질문 다시 보기', 'Revisit question'),
    receipt_check_in: L('문서 결과 확인', 'Review document outcome'),
    ground_shift: L('바뀐 전제 확인', 'Review changed premise'),
    stakeholder_check: L('당사자 확인', 'Check with stakeholder'),
  }[kind]);

  const reasonFor = (item: ProjectAttentionItem) => ({
    check_in: L('정해 둔 확인일이 왔어요.', 'Its review date has arrived.'),
    premise_recheck: item.ageDays != null
      ? L(`${item.ageDays}일 동안 다시 확인하지 않은 전제예요.`, `This premise has not been checked for ${item.ageDays} days.`)
      : L('다시 확인할 때가 된 전제예요.', 'This premise is due for a fresh check.'),
    open_question: L('답을 미뤄 둔 질문이에요.', 'This question was left open.'),
    receipt_check_in: L('문서 판단의 확인일이 왔어요.', 'This document judgment is due for review.'),
    ground_shift: L(`${item.affected.length}개 판단이 기대는 전제가 바뀌었어요.`, `A premise behind ${item.affected.length} judgments has changed.`),
    stakeholder_check: L('실제 당사자에게 확인할 내용이 남아 있어요.', 'A stakeholder check is still open.'),
  }[item.kind]);

  return (
    <section aria-labelledby="project-attention-heading" className="mt-5">
      <header className="flex items-end justify-between gap-3 px-1 pb-3">
        <div>
          <h2 id="project-attention-heading" className="text-[17px] font-bold text-[var(--text-primary)]">
            {L('지금 할 일', 'What to do now')}
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-secondary)]">
            {L('확인일이 왔거나, 판단의 바탕이 달라진 것만 모았어요.', 'Only due reviews and changes that could affect a judgment appear here.')}
          </p>
        </div>
        <span className="shrink-0 text-[12.5px] tabular-nums text-[var(--text-tertiary)]">{items.length}</span>
      </header>

      <ol className="space-y-2">
        {visible.map((item) => {
          const Icon = ICONS[item.kind];
          const decisionId = decisionIdFor(item);
          const selected = focusedAttentionId === item.id
            || (!!focusedDecisionId && focusedDecisionId === decisionId);
          return (
            <li
              key={item.id}
              id={`project-attention-${item.id}`}
              data-attention-selected={selected ? 'true' : 'false'}
              className={`group flex items-stretch gap-2 rounded-xl border px-3 py-2.5 transition-colors ${selected ? 'border-[var(--accent)]/45 bg-[var(--accent)]/[0.07]' : 'border-[var(--border-subtle)] bg-[var(--surface)]/65 hover:border-[var(--border)]'}`}
            >
              <button
                type="button"
                onClick={() => onFocusItem ? onFocusItem(item, decisionId) : openTraceLocator(item.locator)}
                className="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
                aria-pressed={selected}
                aria-label={L(`${kindLabel(item.kind)} 결정 지도에서 찾기`, `Find ${kindLabel(item.kind)} on the decision map`)}
              >
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400" aria-hidden="true">
                  <Icon size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-[12px] font-bold text-amber-700 dark:text-amber-400">{kindLabel(item.kind)}</span>
                    <span className="truncate text-[12px] text-[var(--text-tertiary)]">{item.context}</span>
                  </span>
                  <span className="mt-1 block text-[14px] font-semibold leading-[1.5] text-[var(--text-primary)] line-clamp-2">{item.title}</span>
                  <span className="mt-1 block text-[12.5px] leading-relaxed text-[var(--text-secondary)]">{reasonFor(item)}</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => openTraceLocator(item.locator)}
                className="inline-flex min-h-11 shrink-0 items-center gap-1 self-center rounded-lg px-1.5 text-[12px] font-semibold text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
                aria-label={L(`${kindLabel(item.kind)} 정확한 근거 위치 열기`, `Open exact source for ${kindLabel(item.kind)}`)}
              >
                <span className="inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-[var(--accent)]">
                  {L('열기', 'Open')} <ArrowUpRight size={14} aria-hidden="true" />
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {items.length > 3 && (
        <div className="flex justify-end px-1 pt-2">
          <button type="button" onClick={() => setExpanded((value) => !value)} className="min-h-9 text-[13px] font-semibold text-[var(--accent)] hover:underline">
            {expanded ? L('접기', 'Show less') : L(`${items.length - 3}건 더 보기`, `Show ${items.length - 3} more`)}
          </button>
        </div>
      )}
    </section>
  );
}
