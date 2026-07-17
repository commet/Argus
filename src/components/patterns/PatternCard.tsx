'use client';

import { Circle, CircleCheck, Waves } from 'lucide-react';
import type { PublicPatternProjection } from '@/lib/epistemic/patterns-projection';
import type { E3BReviewActionInput } from '@/lib/epistemic/server-review';
import { InfluenceGrantPanel } from './InfluenceGrantPanel';

const DIMENSION_COPY = {
  outcome_frequency: ['결과·빈도', 'Outcome · frequency'],
  authorship_trajectory: ['시간·저자 궤적', 'Time · authorship'],
  causal_structure: ['인과·전제 구조', 'Causal · premise structure'],
  cross_decision_scope: ['교차 결정 범위', 'Cross-decision scope'],
  transfer_question: ['전이 질문', 'Transfer question'],
} as const;

export function PatternCard({
  pattern,
  locale,
  busy,
  onAction,
}: {
  pattern: PublicPatternProjection;
  locale: 'ko' | 'en';
  busy: boolean;
  onAction: (action: E3BReviewActionInput) => void;
}) {
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  return (
    <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-xs)] sm:p-6">
      <div className="flex items-start gap-3">
        <div className="mt-1 rounded-xl bg-[var(--primary)]/10 p-2 text-[var(--primary)]"><Waves size={18} /></div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold tracking-[0.14em] text-[var(--text-tertiary)] uppercase">{L('내가 채택한 표현', 'Wording I endorsed')}</p>
          <h2 className="mt-2 text-[17px] font-semibold leading-7 text-[var(--text-primary)]">{pattern.claim.statement}</h2>
          <p className="mt-1 text-[12px] text-[var(--text-secondary)]">{L(`적용 범위: ${pattern.claim.scope.domains.join(', ')}`, `Scope: ${pattern.claim.scope.domains.join(', ')}`)}</p>
        </div>
      </div>

      <div className="mt-5 border-l border-[var(--border)] pl-5" aria-label={L('다섯 판단 차원', 'Five judgment dimensions')}>
        {pattern.dimensions.map((dimension, index) => {
          const labels = DIMENSION_COPY[dimension.dimension];
          return (
            <div key={dimension.dimension} className="relative pb-5 last:pb-0">
              <span className="absolute -left-[29px] top-0 bg-[var(--surface)] text-[var(--text-tertiary)]">
                {dimension.available ? <CircleCheck size={17} className="text-[var(--primary)]" /> : <Circle size={17} />}
              </span>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[10px] text-[var(--text-tertiary)]">{String(index + 1).padStart(2, '0')}</span>
                <h3 className="text-[12px] font-bold text-[var(--text-primary)]">{labels[locale === 'ko' ? 0 : 1]}</h3>
                {!dimension.available && <span className="text-[10px] text-[var(--text-tertiary)]">{L('미확인', 'not established')}</span>}
              </div>
              <p className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">{locale === 'ko' ? dimension.summary : dimension.summary_en}</p>
            </div>
          );
        })}
      </div>

      <InfluenceGrantPanel claim={pattern.claim} locale={locale} busy={busy} onAction={onAction} />
    </article>
  );
}
