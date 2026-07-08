'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import type { AnalysisSnapshot } from '@/stores/types';
import { EASE } from './constants';
import { diffItems } from './diffItems';
import type { ReactNode } from 'react';

// ─── Inline formatting helpers ───

/** Parse **bold** syntax in text */
function renderText(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} className="font-semibold text-[var(--text-primary)]">{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>,
  );
}

/** Split "prefix — body" for skeleton items */
function splitSkeleton(text: string): { prefix: string | null; body: string } {
  const sep = text.indexOf(' — ');
  if (sep > 0 && sep < 25) {
    return { prefix: text.slice(0, sep), body: text.slice(sep + 3) };
  }
  return { prefix: null, body: text };
}

/** The first sentence of a step body. The summary row must carry CONTENT —
 *  step prefixes are usually bare connectives ("먼저/그다음/마지막으로"), and a
 *  list of connectives with the content amputated is not a summary (창업자
 *  실사용 지적: "'먼저' '그다음'만 보여주는 게 요약이냐"). */
function firstSentence(text: string): string {
  const m = text.match(/^[\s\S]*?[.!?](?=['")\]\s]|$)/);
  return (m ? m[0] : text).trim();
}

interface AnalysisCardProps {
  snapshot: AnalysisSnapshot;
  prevSnapshot: AnalysisSnapshot | null;
  isActive?: boolean;
  showExecutionPlan?: boolean;
  locale?: 'ko' | 'en';
  /** When true, the card renders as a single-line peek with an expand
   *  toggle. Used during the Q&A loop so the user isn't buried in
   *  accumulating analysis cards while still answering. */
  defaultCollapsed?: boolean;
}

export function AnalysisCard({
  snapshot,
  prevSnapshot,
  isActive = true,
  showExecutionPlan = false,
  locale = 'ko',
  defaultCollapsed = false,
}: AnalysisCardProps) {
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const hasChanges = prevSnapshot && snapshot.version > (prevSnapshot.version ?? 0);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  // Expanded card defaults to a SCANNABLE summary — key insight + step
  // headlines only. The full per-step explanations, the assumptions block,
  // and the execution plan live behind "자세히 보기". The old card dumped all
  // of it at once, so the user started reading, the next turn arrived, and
  // they bailed mid-paragraph every time. A summary you can absorb in one
  // glance fixes that; depth is one tap away for anyone who wants it.
  const [detailOpen, setDetailOpen] = useState(false);

  // Compact peek — used during Q&A loop so the card doesn't dominate
  // while the user is still answering. Tap to expand.
  if (collapsed) {
    const stepCount = snapshot.skeleton?.length ?? 0;
    const assumeCount = snapshot.hidden_assumptions?.length ?? 0;
    // Show the DOCUMENT, not the question. real_question == the question the user
    // is answering right below it, so echoing it here read as "질문이 두 개".
    // Lead with the insight (a statement, not a question) + what's accrued so far,
    // so the collapsed course = a peek at the deliverable, distinct from the Q.
    const summaryLine = snapshot.insight || snapshot.skeleton?.[0] || snapshot.real_question;
    return (
      <motion.button
        type="button"
        onClick={() => setCollapsed(false)}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
        // No line, no box — whitespace-grouped. The course is something you READ;
        // it sits a step down the type scale from the question and is set off by
        // spacing alone. Hover dims slightly to signal it opens.
        className="w-full text-left flex items-start gap-3 py-1 cursor-pointer group transition-opacity hover:opacity-70"
      >
        <div className="flex-1 min-w-0">
          {/* 공정 5-3: the label names its ROLE, not just its title — a first-
              timer must know this is a hypothesis their answers keep refining. */}
          <div className={`text-[10px] font-semibold text-[var(--accent)]/85 mb-1.5 ${locale === 'ko' ? 'tracking-[0.02em]' : 'uppercase tracking-[0.14em]'}`}>
            {L('우리가 잡은 항로', 'Course we plotted')}
            <span className="ml-1.5 font-normal text-[var(--text-tertiary)] normal-case tracking-normal">
              {L('· 답할수록 다듬어지는 가설', '· a hypothesis your answers refine')}
            </span>
          </div>
          {/* This is the screen's MAIN line (the course). It was 14-15px — smaller
              than the question below it. Anchor it a step up so it reads as the
              deliverable, and don't clamp a single sentence mid-word. */}
          <p className="text-[16px] md:text-[17px] text-[var(--text-primary)] leading-[1.5] line-clamp-3" style={{ fontFamily: 'var(--font-display)' }}>
            {renderText(summaryLine)}
          </p>
          {(stepCount > 0 || assumeCount > 0) && (
            <div className="mt-2 flex items-center gap-2 text-[11px] text-[var(--text-tertiary)] tabular-nums">
              {stepCount > 0 && <span>{L(`${stepCount}단계 계획`, `${stepCount}-step plan`)}</span>}
              {stepCount > 0 && assumeCount > 0 && <span aria-hidden>·</span>}
              {assumeCount > 0 && <span>{L(`가정 ${assumeCount}개`, `${assumeCount} assumptions`)}</span>}
            </div>
          )}
        </div>
        <div className="shrink-0 flex items-center gap-1 text-[10px] text-[var(--text-tertiary)] mt-0.5 group-hover:text-[var(--accent)] transition-colors">
          <span>{L('펼치기', 'Expand')}</span>
          <ChevronDown size={12} />
        </div>
      </motion.button>
    );
  }

  const skeletonDiff = hasChanges
    ? diffItems(prevSnapshot.skeleton, snapshot.skeleton)
    : snapshot.skeleton.map(s => ({ text: s, status: 'same' as const }));
  const assumptionDiff = hasChanges
    ? diffItems(prevSnapshot.hidden_assumptions, snapshot.hidden_assumptions)
    : snapshot.hidden_assumptions.map(a => ({ text: a, status: 'same' as const }));

  const activeAssumptions = assumptionDiff.filter(d => d.status !== 'removed');
  const removedAssumptions = assumptionDiff.filter(d => d.status === 'removed');
  const activeSkeleton = skeletonDiff.filter(d => d.status !== 'removed');
  const removedSkeleton = skeletonDiff.filter(d => d.status === 'removed');

  return (
    <motion.div
      initial={prevSnapshot ? { opacity: 0.85 } : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prevSnapshot ? 0.3 : 0.6, ease: EASE }}
      className="rounded-2xl">
      <div className={`rounded-2xl p-[1px] ${isActive ? 'bg-gradient-to-b from-[var(--accent)]/20 to-[var(--accent)]/5' : 'bg-[var(--border-subtle)]'}`}>
        <div className="rounded-[calc(1rem-1px)] bg-[var(--surface)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.5)]">
          <div className="p-5 md:p-7">
            {/* Eyebrow + collapse toggle. Eyebrow names the card so the
                user knows what they're looking at; metaphor labels carry
                the new "voyage" framing without overcommitting. */}
            <div className="flex items-start justify-between gap-3 mb-1.5">
              <div className={`text-[10px] font-bold text-[var(--accent)] ${locale === 'ko' ? 'tracking-[0.02em]' : 'uppercase tracking-[0.15em]'}`}>
                {L('우리가 잡은 항로', 'Course we plotted')}
              </div>
              {defaultCollapsed && (
                <button
                  type="button"
                  onClick={() => setCollapsed(true)}
                  className="shrink-0 inline-flex items-center gap-0.5 text-[10px] text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors -mt-0.5"
                  aria-label={L('접기', 'Collapse')}
                >
                  <ChevronUp size={11} />
                  <span>{L('접기', 'Collapse')}</span>
                </button>
              )}
            </div>
            {/* First-snapshot sub-line — explains why the card exists and
                what happens next. Hidden after round 1 since by then the
                user already knows the pattern. */}
            {!prevSnapshot && (
              <p className="text-[11px] text-[var(--text-tertiary)] leading-relaxed mb-3">
                {L('이 방향이 맞나요? 한 번 더 짚어볼게요.', "Does this heading look right? We'll check once more.")}
              </p>
            )}
            {prevSnapshot && <div className="mb-2" />}

            {/* Real question — single source of truth, no line-through
                (previous version lives in UpdateSummaryChip above). */}
            <div className="mb-5">
              <AnimatePresence mode="wait">
                <motion.h2 key={snapshot.real_question} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.5, ease: EASE }}
                  className="text-[18px] md:text-[22px] font-bold text-[var(--text-primary)] leading-[1.35] tracking-tight"
                  style={{ fontFamily: 'var(--font-display)' }}>
                  {snapshot.real_question}
                </motion.h2>
              </AnimatePresence>
            </div>

            {/* Insight — pull-quote style. Left rail alone carries the visual
                cue; no sparkle icon needed. */}
            <AnimatePresence>
              {snapshot.insight && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.4, ease: EASE }} className="overflow-hidden mb-6">
                  <div className="pl-4 py-2 border-l-[2px] border-[var(--accent)]/40">
                    <div className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-[0.15em] mb-1.5">
                      {L('핵심', 'Key Insight')}
                    </div>
                    <p className="text-[15px] md:text-[16px] text-[var(--text-primary)] leading-[1.6] font-medium">
                      {renderText(snapshot.insight)}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ═══ Compact Blindspot Callout + Step Flow ═══ */}

            {/* ─── Blindspots: Single compact callout block ─── */}
            <AnimatePresence>
              {removedAssumptions.map((d, i) => (
                <motion.div key={`removed-a-${i}`} initial={{ opacity: 0.5 }} animate={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.8, ease: EASE }}
                  className="flex items-start gap-2 text-[12px] text-red-300 line-through leading-relaxed overflow-hidden">
                  <span className="text-red-300 text-[9px] font-bold shrink-0 mt-0.5">−</span>
                  <span>{d.text}</span>
                </motion.div>
              ))}
            </AnimatePresence>

            {detailOpen && activeAssumptions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: EASE }}
                className="mb-7 rounded-xl bg-[var(--bg)]/50 overflow-hidden">
                {/* Callout header — neutral tone, no team avatars
                    (team belongs in worker panel, not inside this block) */}
                <div className="flex items-center gap-2 px-4 pt-3.5 pb-2">
                  <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.15em]">
                    {L('알아둘 것', 'Worth knowing')}
                  </span>
                </div>
                {/* Compact numbered items */}
                <div className="px-4 pb-3.5 space-y-0">
                  {activeAssumptions.map((d, i) => (
                    <motion.div key={`${snapshot.version}-a${i}`}
                      initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06, duration: 0.35, ease: EASE }}
                      className={`flex items-baseline gap-3 py-2 transition-colors duration-1000 ${
                        i < activeAssumptions.length - 1 ? 'border-b border-[var(--border-subtle)]/40' : ''
                      } ${d.status === 'new' ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                      <span className="text-[11px] font-semibold tabular-nums shrink-0 text-[var(--text-tertiary)]">
                        {i + 1}
                      </span>
                      <p className="text-[13px] leading-[1.65]">{renderText(d.text)}</p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ─── Skeleton: The main event — step flow ─── */}
            <AnimatePresence>
              {removedSkeleton.map((d, i) => (
                <motion.div key={`removed-s-${i}`} initial={{ opacity: 0.5 }} animate={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.8, ease: EASE }}
                  className="flex items-start gap-2 text-[12px] text-red-300 line-through leading-relaxed overflow-hidden">
                  <span className="text-red-300 font-mono text-[9px] shrink-0 mt-1">−</span>
                  <span>{d.text}</span>
                </motion.div>
              ))}
            </AnimatePresence>

            {activeSkeleton.length > 0 && (
              <div>
                {/* Quiet section label so the numbered list reads as "the plan",
                    matching the card's existing eyebrow system (핵심 / 알아둘 것). */}
                <div className={`text-[10px] font-bold text-[var(--text-tertiary)] mb-2 ${locale === 'ko' ? 'tracking-[0.02em]' : 'uppercase tracking-[0.15em]'}`}>
                  {L('단계', 'Steps')}
                </div>
                {activeSkeleton.map((d, i) => {
                  const { prefix, body } = splitSkeleton(d.text);
                  const isLast = i === activeSkeleton.length - 1;
                  return (
                    <motion.div key={`${snapshot.version}-s${i}`}
                      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.07, duration: 0.4, ease: EASE }}
                      className={`relative ${!isLast ? 'border-b border-[var(--border-subtle)]/50' : ''}`}>
                      <div className={`flex gap-4 ${detailOpen ? 'py-4' : 'py-2.5'} ${i === 0 ? 'pt-1' : ''}`}>
                        {/* Step indicator — minimal number in accent tone,
                            no box fill. Presence through typography alone. */}
                        <div className="shrink-0 pt-[2px] w-5 text-right">
                          <span className={`text-[13px] font-bold tabular-nums ${
                            d.status === 'new' ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]'
                          }`}>
                            {i + 1}
                          </span>
                        </div>
                        {/* Content. Summary mode = prefix + the body's FIRST
                            SENTENCE (a connective alone is not a summary);
                            the full explanation appears under "자세히 보기". */}
                        <div className="flex-1 min-w-0">
                          {prefix ? (
                            <>
                              <h4 className={`text-[14px] md:text-[15px] tracking-tight text-[var(--text-primary)] ${detailOpen ? 'font-bold leading-snug' : 'font-normal leading-[1.6] line-clamp-2'}`}>
                                <span className="font-bold">{prefix}</span>
                                {!detailOpen && (
                                  <span className="text-[var(--text-secondary)]"> — {firstSentence(body)}</span>
                                )}
                              </h4>
                              {detailOpen && (
                                <p className="text-[13px] md:text-[14px] text-[var(--text-secondary)] leading-[1.7] mt-1">
                                  {renderText(body)}
                                </p>
                              )}
                            </>
                          ) : (
                            <p className={`text-[13px] md:text-[14px] text-[var(--text-primary)] leading-[1.7] ${detailOpen ? '' : 'line-clamp-2'}`}>
                              {renderText(body)}
                            </p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Summary ⇄ detail toggle. Default is the scannable summary above;
                this reveals the per-step bodies, the assumptions block, and the
                execution plan. Hint the hidden assumption count so the user
                knows there's more worth a tap. */}
            {(activeSkeleton.length > 0 || activeAssumptions.length > 0) && (
              <button
                type="button"
                onClick={() => setDetailOpen(o => !o)}
                aria-expanded={detailOpen}
                className="mt-4 inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--accent)] hover:opacity-70 transition-opacity cursor-pointer"
              >
                {detailOpen ? (
                  <>{L('요약만 보기', 'Summary only')} <ChevronUp size={13} /></>
                ) : (
                  <>
                    {L('단계별 자세히 보기', 'Read the full detail')}
                    {activeAssumptions.length > 0 && (
                      <span className="text-[var(--text-tertiary)] font-normal">
                        {L(`· 알아둘 것 ${activeAssumptions.length}개`, `· ${activeAssumptions.length} to know`)}
                      </span>
                    )}
                    <ChevronDown size={13} />
                  </>
                )}
              </button>
            )}

            {/* Execution plan footer — workspace only, neutral palette */}
            <AnimatePresence>
              {detailOpen && showExecutionPlan && snapshot.execution_plan && snapshot.execution_plan.steps.length > 0 && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} transition={{ duration: 0.5, ease: EASE }} className="overflow-hidden">
                  <div className="pt-4 mt-4 border-t border-[var(--border-subtle)]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.12em]">{L('실행 계획', 'Execution Plan')}</span>
                      {snapshot.execution_plan.steps.map((step, i) => {
                        const mark = step.who === 'ai' ? 'AI' : step.who === 'human' ? L('외부', 'Ext') : L('도구', 'Tool');
                        return (
                          <span key={i} className="inline-flex items-baseline gap-1 text-[11px] px-2 py-0.5 rounded-full bg-[var(--bg)] border border-[var(--border-subtle)]/60">
                            <span className="text-[var(--text-tertiary)] font-semibold text-[9px] tracking-wider">{mark}</span>
                            <span className="text-[var(--text-secondary)]">{step.task}</span>
                          </span>
                        );
                      })}
                      <span className="text-[10px] text-[var(--text-tertiary)] ml-auto">
                        <span className="hidden lg:inline">{L('우측 패널에서 확인 →', 'See right panel →')}</span>
                        <span className="lg:hidden">{L('↓ 하단 팀 탭에서 진행 중', '↓ In progress below')}</span>
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
