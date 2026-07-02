'use client';

import { motion } from 'framer-motion';
import { useLocale } from '@/hooks/useLocale';
import { useAgentAttentionStore } from '@/stores/useAgentAttentionStore';
import type { MixResult } from '@/stores/types';
import { useWorkers } from './WorkerPanel';
import { renderInline } from './shared/renderMd';
import { personaName } from './shared/persona-format';
import { EASE } from './shared/constants';

/* ═══ Attributed Section — draft paragraph with bidirectional hover + sentence-level attribution ═══ */
export function AttributedSection({ section, index }: {
  section: MixResult['sections'][number];
  index: number;
}) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const workers = useWorkers();
  const hovered = useAgentAttentionStore(s => s.hovered);
  const setHovered = useAgentAttentionStore(s => s.setHovered);
  const clearHovered = useAgentAttentionStore(s => s.clearHovered);

  const contributorIds = section.contributor_worker_ids || [];
  const contributors = contributorIds
    .map(id => workers.find(w => w.id === id))
    .filter((w): w is NonNullable<typeof w> => !!w && !!w.persona);

  // Honest provenance (spine rule 1): focus mode lets crew work flow into the
  // draft without a captain click, so approved stays null there. Disclose it —
  // neutrally, this is provenance, not a warning — instead of letting the
  // section read as captain-reviewed.
  const hasUnreviewed = contributors.some(w => w.approved == null);

  const hasSentences = Array.isArray(section.sentences) && section.sentences.length > 0;

  // Section-level highlight/dim — matches any hover kind that touches this section.
  const isHighlighted =
    (hovered?.kind === 'section' && hovered.sectionIndex === index) ||
    (hovered?.kind === 'sentence' && hovered.sectionIndex === index) ||
    (hovered?.kind === 'agent' && contributorIds.includes(hovered.workerId));
  const isDimmed = hovered != null && !isHighlighted;

  // Section-level hover handlers only fire in fallback mode (no sentences).
  // In sentence mode, each sentence publishes its own hover state.
  const onSectionHoverStart = hasSentences
    ? undefined
    : () => { if (contributorIds.length > 0) setHovered({ kind: 'section', sectionIndex: index, contributorIds }); };
  const onSectionHoverEnd = hasSentences
    ? undefined
    : () => setHovered(null);

  // Click to lock/toggle (touch-friendly; Round 2B).
  const onSectionTap = hasSentences
    ? undefined
    : () => {
        if (contributorIds.length === 0) return;
        if (hovered?.kind === 'section' && hovered.sectionIndex === index) {
          clearHovered();
        } else {
          setHovered({ kind: 'section', sectionIndex: index, contributorIds }, true);
        }
      };

  return (
    <motion.div
      data-attribution-source="section"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: isDimmed ? 0.35 : 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.08, duration: 0.5, ease: EASE }}
      onHoverStart={onSectionHoverStart}
      onHoverEnd={onSectionHoverEnd}
      onTap={onSectionTap}
      className={`relative rounded-lg transition-all duration-300 ${
        isHighlighted && contributorIds.length > 0
          ? '-mx-3 px-3 py-2 bg-[var(--accent)]/[0.05] ring-1 ring-[var(--accent)]/25'
          : ''
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        {/* Section heading was only 1px above body — no skim anchor in a long brief.
            Lift it a clear step (16px) so headings scan as headings. */}
        <h3 className="text-[16px] md:text-[17px] font-bold text-[var(--text-primary)] leading-[1.35] flex-1 tracking-tight">{section.heading}</h3>
        {hasUnreviewed && (
          <span
            title={L('이 부분에 기여한 선원 보고를 아직 직접 확인하지 않았어요. 위 "열어보기"에서 반영/제외할 수 있어요.', "You haven't reviewed the crew reports behind this section yet — open the reports above to apply/exclude them.")}
            className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)] border border-[var(--border)] rounded-full px-1.5 py-0.5"
          >
            {L('검토 전', 'unreviewed')}
          </span>
        )}
        {contributors.length > 0 && (
          <div className="flex -space-x-1.5 shrink-0">
            {contributors.map(w => (
              <div
                key={w.id}
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] border-2 border-[var(--surface)]"
                style={{ backgroundColor: (w.persona?.color || 'var(--accent)') + '25', color: w.persona?.color }}
                title={personaName(w.persona, locale)}
              >
                {w.persona?.emoji}
              </div>
            ))}
          </div>
        )}
      </div>

      {hasSentences ? (
        <SentenceStream section={section} sectionIndex={index} workers={workers} />
      ) : (
        <p className="text-[14px] text-[var(--text-primary)] leading-[1.75]">{renderInline(section.content)}</p>
      )}

      {contributors.length > 0 && (
        <p className="mt-2 text-[10px] text-[var(--text-tertiary)] flex items-center gap-1.5">
          <span className="opacity-60">{L('기여', 'By')}</span>
          <span className="truncate">
            {contributors.map(w => personaName(w.persona, locale)).filter(Boolean).join(' · ')}
          </span>
        </p>
      )}
    </motion.div>
  );
}

/* ═══ SentenceStream — renders section sentences inline with per-sentence hover + trailing contributor dots ═══ */
function SentenceStream({ section, sectionIndex, workers }: {
  section: MixResult['sections'][number];
  sectionIndex: number;
  workers: ReturnType<typeof useWorkers>;
}) {
  const locale = useLocale();
  const hovered = useAgentAttentionStore(s => s.hovered);
  const setHovered = useAgentAttentionStore(s => s.setHovered);
  const clearHovered = useAgentAttentionStore(s => s.clearHovered);
  const sentences = section.sentences || [];

  return (
    <p className="text-[14px] text-[var(--text-primary)] leading-[1.8]">
      {sentences.map((sent, sIdx) => {
        const ids = sent.contributor_worker_ids || [];
        const dots = ids
          .map(id => workers.find(w => w.id === id))
          .filter((w): w is NonNullable<typeof w> => !!w && !!w.persona);
        const isThisHovered = hovered?.kind === 'sentence'
          && hovered.sectionIndex === sectionIndex
          && hovered.sentenceIndex === sIdx;

        return (
          <motion.span
            key={sIdx}
            data-attribution-source="sentence"
            onHoverStart={() => ids.length > 0 && setHovered({ kind: 'sentence', sectionIndex, sentenceIndex: sIdx, contributorIds: ids })}
            onHoverEnd={() => setHovered(null)}
            onTap={() => {
              if (ids.length === 0) return;
              if (isThisHovered) {
                clearHovered();
              } else {
                setHovered({ kind: 'sentence', sectionIndex, sentenceIndex: sIdx, contributorIds: ids }, true);
              }
            }}
            className={`inline transition-all duration-200 ${
              isThisHovered ? 'bg-[var(--accent)]/[0.08] rounded px-0.5' : ''
            }`}
            style={{ cursor: ids.length > 0 ? 'pointer' : 'default' }}
          >
            {renderInline(sent.text)}
            {dots.length > 0 && (
              <span className="inline-flex items-center gap-[2px] ml-1 align-middle">
                {dots.map(d => (
                  <motion.span
                    key={d.id}
                    animate={{
                      scale: isThisHovered ? 1.4 : 1,
                      opacity: isThisHovered ? 1 : 0.55,
                    }}
                    transition={{ duration: 0.2, ease: EASE }}
                    className="inline-block w-[4px] h-[4px] rounded-full"
                    style={{ backgroundColor: d.persona?.color || 'var(--accent)' }}
                    title={personaName(d.persona, locale)}
                  />
                ))}
              </span>
            )}
            {' '}
          </motion.span>
        );
      })}
    </p>
  );
}
