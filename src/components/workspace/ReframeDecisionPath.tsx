'use client';

import { ArrowRight, GitFork, MessageSquareText, SearchCheck, Sparkles } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';

type PathTarget = 'source' | 'assumptions' | 'question' | 'direction';

interface ReframeDecisionPathProps {
  assumptionCount: number;
  reviewedCount: number;
  hasQuestion: boolean;
  hasDirection: boolean;
  onJump: (target: PathTarget) => void;
}

export function ReframeDecisionPath({
  assumptionCount,
  reviewedCount,
  hasQuestion,
  hasDirection,
  onJump,
}: ReframeDecisionPathProps) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const nodes = [
    {
      target: 'source' as const,
      label: L('처음 과제', 'Original task'),
      detail: L('사용자가 적은 상황', 'User-provided context'),
      available: true,
      complete: true,
      Icon: MessageSquareText,
      ownership: 'user',
    },
    {
      target: 'assumptions' as const,
      label: L('가정 점검', 'Assumption check'),
      detail: L(`${reviewedCount}/${assumptionCount}개 확인`, `${reviewedCount}/${assumptionCount} reviewed`),
      available: assumptionCount > 0,
      complete: assumptionCount > 0 && reviewedCount >= assumptionCount,
      Icon: SearchCheck,
      ownership: 'user',
    },
    {
      target: 'question' as const,
      label: L('질문 제안', 'Question proposal'),
      detail: L('AI가 재구성', 'Reframed by AI'),
      available: hasQuestion,
      complete: hasQuestion,
      Icon: Sparkles,
      ownership: 'ai',
    },
    {
      target: 'direction' as const,
      label: L('내가 고른 방향', 'My chosen direction'),
      detail: hasDirection ? L('사용자 선택 완료', 'Selected by user') : L('아직 선택 전', 'Not selected yet'),
      available: hasQuestion,
      complete: hasDirection,
      Icon: GitFork,
      ownership: 'user',
    },
  ];

  return (
    <nav className="border-y border-[var(--border-subtle)] py-3" aria-label={L('질문 재정리 판단 경로', 'Question reframing path')}>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-[1fr_20px_1fr_20px_1fr_20px_1fr] md:items-stretch">
        {nodes.map((node, index) => {
          const Icon = node.Icon;
          return (
            <div key={node.target} className="contents">
              <button
                type="button"
                disabled={!node.available}
                onClick={() => onJump(node.target)}
                className={`min-h-[70px] border px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${node.complete ? 'border-[var(--border)] bg-[var(--surface)]' : 'border-dashed border-[var(--border-subtle)] bg-transparent'} ${node.available ? 'hover:bg-[var(--bg-hover)]' : 'cursor-default opacity-45'}`}
              >
                <span className="flex items-center justify-between gap-2">
                  <Icon size={14} className={node.ownership === 'ai' ? 'text-[var(--ai-fg)]' : 'text-[var(--accent)]'} />
                  <span className={`h-1.5 w-1.5 rounded-full ${node.complete ? 'bg-[var(--success)]' : 'border border-[var(--border)]'}`} />
                </span>
                <span className="mt-2 block text-[12.5px] font-bold text-[var(--text-primary)]">{node.label}</span>
                <span className="mt-0.5 block text-[12.5px] text-[var(--text-tertiary)]">{node.detail}</span>
              </button>
              {index < nodes.length - 1 && (
                <span className="hidden items-center justify-center text-[var(--text-tertiary)] md:flex" aria-hidden="true"><ArrowRight size={12} /></span>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
