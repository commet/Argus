'use client';

import { useId, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import { useProgressiveStore } from '@/stores/useProgressiveStore';
import { voyageLogToMarkdown, copyToClipboard } from '@/lib/export';
import type { MixResult } from '@/stores/types';
import { ShareBar } from '@/components/ui/ShareBar';
import { AttributedSection } from './AttributedSection';
import { renderInline, renderMd } from './shared/renderMd';
import { EASE } from './shared/constants';

/* ═══ Final deliverable — triumphant, widest ═══ */
export function FinalCard({
  content,
  mix,
  releasedContent,
  releasedLabel,
  sessionId,
  defaultCollapsed = false,
}: {
  content: string;
  mix?: MixResult | null;
  /** When set, the Copy button copies this instead of `content`. Used when
   *  the user has promoted a draft to v1.x and is currently viewing a
   *  branch experiment — we want the "shared" text to always be the
   *  released version per Decision #5 (a). */
  releasedContent?: string | null;
  releasedLabel?: string | null;
  /** Drives the agent-growth footer. When provided, FinalCard derives the
   *  per-agent XP/level deltas accrued during this session from the
   *  activities log and renders a small celebration footer. */
  sessionId?: string | null;
  /** Collapse the document BODY behind one tap. On the complete screen the
   *  bearing card right below opens with the SAME executive summary — the
   *  full text in both places was the app's single worst duplicate. Copy and
   *  share work without expanding. */
  defaultCollapsed?: boolean;
}) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const bodyId = useId();
  const cardTitleId = useId();
  const logSession = useProgressiveStore(s => (sessionId ? s.sessions.find(ss => ss.id === sessionId) : null) ?? null);
  const baseTarget = releasedContent && releasedContent.length > 0 ? releasedContent : content;
  // The decision trail ("the process is the deliverable") is available, but
  // OPT-IN: most users expect Copy to give a clean document, not 2–3× the
  // length with the full history. Default to the clean doc; the toggle below
  // lets power users append the ship's log.
  const voyageLog = voyageLogToMarkdown(logSession, locale as 'ko' | 'en');
  const [withLog, setWithLog] = useState(false);
  const copyTarget = withLog && voyageLog ? `${baseTarget}\n\n---\n\n${voyageLog}\n` : baseTarget;
  const copyLabel = releasedContent && releasedContent !== content && releasedLabel
    ? L(`${releasedLabel} 복사`, `Copy ${releasedLabel}`)
    : L('복사', 'Copy');
  // Viewing a branch draft while a release exists: the main Copy intentionally
  // copies the RELEASED text (Decision #5a). Say so plainly, and offer a quiet
  // secondary action that copies what's actually on screen.
  const viewingBranchDraft = !!(releasedContent && releasedContent !== content && releasedLabel);
  const [copiedDraft, setCopiedDraft] = useState(false);
  const [copyDraftFailed, setCopyDraftFailed] = useState(false);
  const copyVisibleDraft = async () => {
    try {
      await copyToClipboard(content);
      setCopyDraftFailed(false);
      setCopiedDraft(true);
      setTimeout(() => setCopiedDraft(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
      setCopyDraftFailed(true);
      setTimeout(() => setCopyDraftFailed(false), 2500);
    }
  };

  // Older restored sessions can predate these arrays. Keep the completed
  // document readable instead of crashing at the exact moment the user returns.
  const structuredSections = mix?.sections || [];
  const structuredNextSteps = mix?.next_steps || [];
  // When we have the structured mix, render it with attribution; fall back to flat markdown otherwise.
  const hasStructured = structuredSections.length > 0;
  const [bodyOpen, setBodyOpen] = useState(!defaultCollapsed);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}>
      <article aria-labelledby={cardTitleId} className="rounded-2xl md:rounded-[2rem] border border-[var(--border-subtle)] bg-[var(--surface)] shadow-[var(--shadow-lg)] overflow-hidden">
        <div className="overflow-hidden">
          {/* The document is the deliverable, so it stays distinguished — but the
              victory affect (gold gradient border + gold check medallion +
              scale-up entrance) was a verdict the *settlement* moment should own,
              not the freshly generated draft. Neutral hairline + a quiet "ready"
              mark instead; celebratory gold is saved for real reality-contact. */}
          <div className="px-5 md:px-7 py-4 flex items-center justify-between border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full flex items-center justify-center bg-[var(--bg)] border border-[var(--border-subtle)]">
                <Check size={13} className="text-[var(--text-secondary)]" />
              </div>
              {/* 역할 부제 (F-1-1): '완성된 문서'와 '결정 요약'(아래 카드)의 차이가
                  안 보인다는 지적 — 이 카드는 "가져가는 결과물"임을 명시. (옛 이름
                  '현재 방위'는 '결정 요약'으로 개명됨.) */}
              <div>
                <span id={cardTitleId} className="text-[14px] font-semibold text-[var(--text-primary)]">{L('완성된 문서', 'Final Document')}</span>
                <span className="block text-[13px] text-[var(--text-tertiary)] mt-0.5 leading-snug">{L('복사해서 바로 쓰는 결과물', 'The artifact you copy and use')}</span>
              </div>
            </div>
            <ShareBar
              getText={() => copyTarget}
              getTitle={() => mix?.title || L('Argus 기획안', 'Argus Document')}
              copyLabel={copyLabel}
            />
          </div>
          {viewingBranchDraft && (
            <div className="px-5 md:px-7 py-2 border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
              <span className="text-[12.5px] text-[var(--text-tertiary)]">
                {L(`복사하면 ${releasedLabel} 출시본이 나가요`, `Copy gives you the released ${releasedLabel}`)}
              </span>
              <button
                type="button"
                onClick={copyVisibleDraft}
                className="text-[12.5px] font-medium text-[var(--text-secondary)] hover:text-[var(--accent)] underline underline-offset-2 transition-colors cursor-pointer"
              >
                {copiedDraft ? L('복사했어요', 'Copied') : copyDraftFailed ? L('복사 실패 — 다시 시도', 'Copy failed — retry') : L('지금 보는 버전 복사', 'Copy the version on screen')}
              </button>
            </div>
          )}
          {voyageLog && (
            <div className="px-5 md:px-7 py-3 border-b border-[var(--border-subtle)] bg-[var(--accent)]/[0.04]">
              <label className="flex items-start gap-2.5 cursor-pointer group">
                <input type="checkbox" checked={withLog} onChange={(e) => setWithLog(e.target.checked)}
                  className="accent-[var(--accent)] cursor-pointer mt-0.5" />
                <span className="flex-1">
                  <span className="block text-[12.5px] font-medium text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
                    {L('결정 과정도 함께 담기', 'Include the decision process')}
                  </span>
                  <span className="block text-[12px] text-[var(--text-tertiary)] mt-0.5 leading-snug">
                    {L('왜 그렇게 결정했는지의 기록', 'The reasoning behind the decision')}
                  </span>
                </span>
              </label>
            </div>
          )}
          {!bodyOpen ? (
            // Collapsed: title + section count + one tap to READ IT HERE. The
            // count + "여기서 전체 읽기" kills the "진짜 문서는 딴 데 있나?" read
            // (F-1-1): the document IS this, just folded — not a pointer elsewhere.
            <div className="px-5 md:px-8 py-5">
              {hasStructured && (
                <>
                  <h2 className="text-[18px] md:text-[20px] font-bold text-[var(--text-primary)] leading-tight tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>{mix!.title}</h2>
                  <p className="mt-1.5 text-[12px] text-[var(--text-tertiary)] tabular-nums">
                    {L(`${structuredSections.length}개 섹션${structuredNextSteps.length ? ` · 다음 단계 ${structuredNextSteps.length}` : ''}`, `${structuredSections.length} sections${structuredNextSteps.length ? ` · ${structuredNextSteps.length} next steps` : ''}`)}
                  </p>
                </>
              )}
              <button
                type="button"
                onClick={() => setBodyOpen(true)}
                aria-expanded="false"
                aria-controls={bodyId}
                className="mt-2.5 inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--accent)] hover:opacity-70 cursor-pointer transition-opacity"
              >
                {L('여기서 전체 읽기', 'Read it in full here')} <ChevronDown size={13} />
              </button>
            </div>
          ) : hasStructured ? (
            <div id={bodyId} role="document" aria-label={L('완성된 문서 본문', 'Final document body')} className="p-5 md:p-8 space-y-5">
              <h2 className="text-[22px] md:text-[26px] font-bold text-[var(--text-primary)] leading-tight tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>{mix!.title}</h2>
              <blockquote className="rounded-lg bg-[var(--accent)]/[0.04] px-4 py-3 text-[14px] text-[var(--text-secondary)] italic leading-relaxed">
                {renderInline(mix!.executive_summary)}
              </blockquote>
              <div className="space-y-5">
                {structuredSections.map((s, i) => (
                  <AttributedSection key={i} section={s} index={i} />
                ))}
              </div>
              {structuredNextSteps.length > 0 && (
                <div className="pt-5 border-t border-[var(--border-subtle)]">
                  <p className="text-[12.5px] font-bold text-[var(--text-tertiary)] uppercase tracking-[0.2em] mb-3">{L('다음 단계', 'Next Steps')}</p>
                  {structuredNextSteps.map((step, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-[13px] text-[var(--text-primary)] mb-2 leading-relaxed">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] mt-2 shrink-0" />
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              )}
              {defaultCollapsed && (
                <button
                  type="button"
                  onClick={() => setBodyOpen(false)}
                  aria-expanded="true"
                  aria-controls={bodyId}
                  className="text-[12px] text-[var(--text-tertiary)] hover:text-[var(--accent)] cursor-pointer transition-colors"
                >
                  {L('문서 접기 ▴', 'Collapse the document ▴')}
                </button>
              )}
            </div>
          ) : (
            <div id={bodyId} role="document" aria-label={L('완성된 문서 본문', 'Final document body')} className="p-5 md:p-8 space-y-1">
              {renderMd(content)}
              {defaultCollapsed && (
                <button
                  type="button"
                  onClick={() => setBodyOpen(false)}
                  aria-expanded="true"
                  aria-controls={bodyId}
                  className="mt-3 text-[12px] text-[var(--text-tertiary)] hover:text-[var(--accent)] cursor-pointer transition-colors"
                >
                  {L('문서 접기 ▴', 'Collapse the document ▴')}
                </button>
              )}
            </div>
          )}
          {/* Agent-growth footer — the team's XP/level changes from this run.
              Deliberately understated: the deliverable is the triumphant
              moment, not the gamification. A muted one-liner carries the
              signal; the XP/Lv detail is tucked behind a tap-to-reveal so it
              never competes with the final document. */}
        </div>
      </article>
    </motion.div>
  );
}
