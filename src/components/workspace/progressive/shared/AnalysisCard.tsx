'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import type { AnalysisSnapshot, PremiseRecord } from '@/stores/types';
import { kindLabel, policyFor, premiseListHeading } from '@/lib/decisive-premises';
import { EASE } from './constants';
import { diffItems, diffPremiseRows, type PremiseDiffItem } from './diffItems';
import { analysisDelta } from './analysisDelta';
import type { ReactNode } from 'react';

/**
 * What the card shows, typed. Snapshots written before 2026-08-01 carry only
 * `hidden_assumptions`, and back then that list genuinely was all assumptions —
 * so reading them as 'premise' is the truthful legacy default, not a guess.
 */
function premiseRowsOf(snapshot: AnalysisSnapshot): PremiseRecord[] {
  if (snapshot.premise_records?.length) return snapshot.premise_records;
  return (snapshot.hidden_assumptions || []).map((text) => ({
    text,
    anchor_quote: '',
    if_false_changes: '',
    support_kind: 'explicit_reason' as const,
    kind: 'premise' as const,
  }));
}

/**
 * The kind, said out loud on the row.
 *
 * A number ("1 2 3") was carrying no information — these are not ordered steps —
 * while the one thing the row genuinely needed to say was what KIND of thing it
 * is, since that decides whether the user is being asked to go check it. Only
 * the kinds that need checking take the accent; context stays quiet. That is
 * the whole hierarchy, and it is about the item, never about the person.
 */
function KindChip({ kind, locale }: { kind: string | undefined; locale: 'ko' | 'en' }) {
  const needsChecking = policyFor(kind).competes;
  return (
    <span
      // Fixed width so the sentences start on one line. Seen on screen, chips
      // of 가정 / 내 기준 / 사실 sized to their own text left the rows ragged and
      // the list stopped being scannable — the labels are a column, and a
      // column that does not line up is decoration.
      className={`shrink-0 inline-flex justify-center min-w-[3.5rem] rounded-[5px] px-1.5 py-[3px] text-[10.5px] font-bold leading-none tracking-[0.02em] ${
        needsChecking
          ? 'bg-[var(--accent)]/[0.11] text-[var(--accent)]'
          : 'bg-[var(--text-tertiary)]/[0.10] text-[var(--text-tertiary)]'
      }`}
    >
      {kindLabel(kind, locale)}
    </span>
  );
}

function DeltaLine({ delta, locale }: {
  delta: ReturnType<typeof analysisDelta>;
  locale: 'ko' | 'en';
}) {
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const parts = [
    delta.questionChanged ? L('핵심 질문 조정', 'question adjusted') : '',
    delta.decisionChanged ? L('판단문 조정', 'judgment adjusted') : '',
    delta.planChanged ? L('계획 조정', 'plan adjusted') : '',
    delta.premisesAdded > 0 ? L(`전제 +${delta.premisesAdded}`, `premises +${delta.premisesAdded}`) : '',
    delta.premisesRemoved > 0 ? L(`전제 −${delta.premisesRemoved}`, `premises −${delta.premisesRemoved}`) : '',
  ].filter(Boolean);
  return (
    <p className="text-[11.5px] leading-5 text-[var(--text-tertiary)]" aria-live="polite">
      {parts.length > 0
        ? parts.join(' · ')
        : L('핵심 질문·전제·계획 유지', 'Question, premises, and plan held')}
    </p>
  );
}

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

/**
 * Turn an insight into an editorial headline + supporting line.
 *
 * Older snapshots sometimes begin with model commentary such as
 * "'막혀 있다'는 표현이 핵심이에요 — …". That describes the writing instead
 * of helping the user read the decision, so strip that preamble at render time.
 * New prompts already ask for two clean sentences, but this keeps saved sessions
 * readable too.
 */
function splitCourseSummary(text: string): { thesis: string; support: string | null } {
  const metaLead = /(?:표현|말|단어).{0,18}(?:핵심|중요)|(?:phrase|word).{0,20}(?:key|important)/i;
  const dashParts = text.trim().split(/\s+[—–]\s+/).filter(Boolean);
  const cleaned = dashParts.length > 1 && metaLead.test(dashParts[0])
    ? dashParts.slice(1).join(' — ')
    : text.trim();

  const sentences = cleaned.match(/^([\s\S]*?[.!?])(?:\s+)([\s\S]+)$/);
  if (sentences && sentences[2].trim()) {
    return { thesis: sentences[1].trim(), support: sentences[2].trim() };
  }

  const semanticParts = cleaned.split(/\s+[—–]\s+/).filter(Boolean);
  if (semanticParts.length > 1) {
    return {
      thesis: semanticParts[0].trim(),
      support: semanticParts.slice(1).join(' — ').trim(),
    };
  }

  return { thesis: cleaned, support: null };
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
  /** Number of user answers already reflected in this snapshot. */
  answerCount?: number;
}

export function AnalysisCard({
  snapshot,
  prevSnapshot,
  isActive = true,
  showExecutionPlan = false,
  locale = 'ko',
  defaultCollapsed = false,
  answerCount = 0,
}: AnalysisCardProps) {
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const hasChanges = !!prevSnapshot && snapshot.version > (prevSnapshot.version ?? 0);
  const delta = analysisDelta(prevSnapshot, snapshot);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  // Expanded card defaults to a SCANNABLE summary — key insight + step
  // headlines only. The full per-step explanations, the assumptions block,
  // and the execution plan live behind "자세히 보기". The old card dumped all
  // of it at once, so the user started reading, the next turn arrived, and
  // they bailed mid-paragraph every time. A summary you can absorb in one
  // glance fixes that; depth is one tap away for anyone who wants it.
  const [detailOpen, setDetailOpen] = useState(false);
  const integrityPending = snapshot.version === 0 && (
    snapshot.lean_flags === undefined || snapshot.honesty_flags === undefined
  );
  const terminalRoute = !!snapshot.request_type && snapshot.request_type !== 'open';
  const initialOpenInsight = snapshot.version === 0
    && !(snapshot.request_type && snapshot.request_type !== 'open')
    ? snapshot.real_question
    : snapshot.insight;
  const safeInsight = integrityPending
    ? undefined
    : initialOpenInsight;
  const visibleSkeleton = snapshot.version === 0 ? [] : snapshot.skeleton;
  // Render from the TYPED records. `hidden_assumptions` deliberately carries
  // claims only — every legacy surface prints it under the words "확인할 가정" —
  // so reading it here would silently drop every fact and standard the contract
  // admitted, and the user would never see the material their decision rests on.
  const premiseRecords = snapshot.version === 0 ? [] : premiseRowsOf(snapshot);
  const visibleAssumptions = premiseRecords.map((r) => r.text);
  // The count in the eyebrow says "확인할 가정", so it counts only assumptions.
  const claimCount = premiseRecords.filter((r) => policyFor(r.kind).competes).length;
  const revealsExecutionPlan = !!(showExecutionPlan && snapshot.execution_plan?.steps?.length);
  const hasSupportingDetail = visibleSkeleton.length > 0
    || visibleAssumptions.length > 0
    || revealsExecutionPlan;
  const summaryLine = safeInsight || snapshot.real_question;
  const courseSummary = splitCourseSummary(summaryLine);
  // An answer is not "reflected" until the snapshot version that incorporated
  // it has arrived. `answers.length` increments immediately on submit; using it
  // alone made the old snapshot falsely claim the new answer was already used.
  const reflectedAnswerCount = Math.min(answerCount, Math.max(0, snapshot.version));
  const refinementStatus = reflectedAnswerCount > 0
    ? isActive
      ? L(`${reflectedAnswerCount}개 답변 반영 · 계속 조정 중`, `${reflectedAnswerCount} answers reflected · still refining`)
      : L(`${reflectedAnswerCount}개 답변 반영 · 방향 정리됨`, `${reflectedAnswerCount} answers reflected · direction clarified`)
    : hasChanges
      ? isActive
        ? L('방금 답변 반영 · 계속 조정 중', 'Latest answer reflected · still refining')
        : L('답변 반영 · 방향 정리됨', 'Answer reflected · direction clarified')
      : L('현재까지의 내용으로 잡은 방향', 'Direction based on what we know so far');

  // Compact peek — used during Q&A loop so the card doesn't dominate
  // while the user is still answering. Tap to expand.
  if (collapsed) {
    const stepCount = visibleSkeleton.length;
    // Counts what the label says it counts. When nothing needs verifying but
    // material was collected, say THAT instead of inflating the assumption
    // count with facts — a number the user can check is worth more than a
    // bigger one they cannot.
    const assumeCount = claimCount;
    const notedCount = visibleAssumptions.length - claimCount;
    return (
      <motion.button
        type="button"
        onClick={() => { if (hasSupportingDetail) setCollapsed(false); }}
        disabled={!hasSupportingDetail}
        aria-label={hasSupportingDetail
          ? L('지금 살펴볼 것: 근거 보기', 'What we are examining: view the rationale')
          : L('지금 살펴볼 것', 'What we are examining')}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
        className={`w-full text-left grid gap-2 sm:grid-cols-[132px_minmax(0,1fr)] sm:gap-7 border-y border-[var(--border)] py-4 md:py-5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/35 focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--bg)] ${hasSupportingDetail ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <div className="min-w-0 sm:pt-0.5">
          <div className="flex items-center gap-2 mb-1.5" aria-hidden>
            <span className="h-px w-7 bg-[var(--accent)]/60 transition-[width] duration-300 group-hover:w-9" />
            <span className="size-1 rounded-full bg-[var(--accent)]/75" />
          </div>
          <div className={`text-[12px] font-bold text-[var(--accent)] ${locale === 'ko' ? 'tracking-[0.02em]' : 'uppercase tracking-[0.14em]'}`}>
            {terminalRoute
              ? L('지금 들은 내용', 'What I heard')
              : L('지금 살펴볼 것', 'What we are examining')}
          </div>
          <p className="mt-1 hidden text-[12.5px] text-[var(--text-tertiary)] leading-[1.5] tabular-nums sm:block">
            {refinementStatus}
          </p>
        </div>

        <div className="min-w-0">
          <p className="text-[16px] md:text-[18px] font-semibold text-[var(--text-primary)] leading-[1.45] md:leading-[1.48] tracking-[-0.012em] line-clamp-3" style={{ fontFamily: 'var(--font-display)' }}>
            {renderText(courseSummary.thesis)}
          </p>
          {courseSummary.support && (
            <p className="mt-1.5 max-w-[65ch] text-[12.5px] md:text-[13px] text-[var(--text-secondary)] leading-[1.65] line-clamp-3">
              {renderText(courseSummary.support)}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px] tabular-nums">
            {(stepCount > 0 || assumeCount > 0 || notedCount > 0) && (
              <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
                {stepCount > 0 && <span>{L(`계획 ${stepCount}단계`, `${stepCount}-step plan`)}</span>}
                {stepCount > 0 && (assumeCount > 0 || notedCount > 0) && <span aria-hidden>·</span>}
                {assumeCount > 0 && <span>{L(`확인할 가정 ${assumeCount}개`, `${assumeCount} assumptions to verify`)}</span>}
                {assumeCount > 0 && notedCount > 0 && <span aria-hidden>·</span>}
                {notedCount > 0 && <span>{L(`짚어둔 것 ${notedCount}개`, `${notedCount} noted`)}</span>}
              </div>
            )}
            {hasSupportingDetail && (
              <span className="inline-flex items-center gap-1 font-semibold text-[var(--text-secondary)] transition-colors group-hover:text-[var(--accent)]">
                {L('근거 보기', 'View the rationale')}
                <ChevronDown size={12} aria-hidden />
              </span>
            )}
          </div>
          {hasChanges && <div className="mt-1.5"><DeltaLine delta={delta} locale={locale} /></div>}
        </div>
      </motion.button>
    );
  }

  const skeletonDiff = hasChanges
    ? diffItems(prevSnapshot!.skeleton, visibleSkeleton)
    : visibleSkeleton.map(s => ({ text: s, status: 'same' as const }));
  // Diff against the previous RECORDS for the same reason the render reads
  // them: comparing against hidden_assumptions would show every fact as newly
  // "removed" the moment the list narrowed to claims. Records, not texts —
  // they carry the lineage that tells a rewrite apart from a replacement.
  const assumptionDiff: PremiseDiffItem[] = hasChanges
    ? diffPremiseRows(premiseRowsOf(prevSnapshot!), premiseRecords)
    : visibleAssumptions.map(a => ({ text: a, status: 'same' as const }));

  const activeAssumptions = assumptionDiff.filter(d => d.status !== 'removed');
  const removedAssumptions = assumptionDiff.filter(d => d.status === 'removed');
  const activeSkeleton = skeletonDiff.filter(d => d.status !== 'removed');
  const removedSkeleton = skeletonDiff.filter(d => d.status === 'removed');

  return (
    <motion.div
      initial={prevSnapshot ? { opacity: 0.85 } : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prevSnapshot ? 0.3 : 0.6, ease: EASE }}
      className="border-y border-[var(--border)]">
      <div>
        <div>
          <div className="p-5 md:p-7">
            {/* Eyebrow + collapse toggle. Eyebrow names the card so the
                user knows what they're looking at; metaphor labels carry
                the new "voyage" framing without overcommitting. */}
            <div className="flex items-start justify-between gap-3 mb-1.5">
              <div>
                <div className={`text-[12px] font-bold text-[var(--accent)] ${locale === 'ko' ? 'tracking-[0.02em]' : 'uppercase tracking-[0.15em]'}`}>
                  {terminalRoute
                    ? L('지금 들은 내용', 'What I heard')
                    : L('지금 살펴볼 것', 'What we are examining')}
                </div>
                <p className="mt-1 text-[12.5px] text-[var(--text-tertiary)] tabular-nums">
                  {refinementStatus}
                </p>
                {hasChanges && <div className="mt-0.5"><DeltaLine delta={delta} locale={locale} /></div>}
              </div>
              {defaultCollapsed && (
                <button
                  type="button"
                  onClick={() => setCollapsed(true)}
                  className="shrink-0 inline-flex items-center gap-0.5 text-[12px] text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors -mt-0.5"
                  aria-label={L('방향 요약으로 접기', 'Collapse to direction summary')}
                >
                  <ChevronUp size={11} />
                  <span>{L('방향 요약으로', 'Direction summary')}</span>
                </button>
              )}
            </div>
            {/* (The first-snapshot sub-line was removed: it restated the eyebrow
                and the status line's "…정리한 방향" verbatim —
                three near-identical lines within ~40px. The eyebrow + status carry it.) */}
            <div className="mb-2" />

            {/* Real question — single source of truth, no line-through. */}
            {!terminalRoute && (
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
            )}

            {/* Insight — editorial thesis + support. A quiet tint separates the
                thought without introducing another ornamental card. */}
            <AnimatePresence>
              {safeInsight && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.4, ease: EASE }} className="overflow-hidden mb-6">
                  <div className="border-t border-[var(--border-subtle)] pt-4">
                    <div className="text-[12px] font-bold text-[var(--accent)] uppercase tracking-[0.15em] mb-1.5">
                      {hasChanges
                        ? delta.materialChange
                          ? L('방금 달라진 것', 'What just changed')
                          : L('답을 반영해도 유지된 것', 'What held after your answer')
                        : L('지금 보이는 것', 'What is visible now')}
                    </div>
                    <p className="text-[15px] md:text-[16px] text-[var(--text-primary)] leading-[1.6] font-semibold">
                      {renderText(courseSummary.thesis)}
                    </p>
                    {courseSummary.support && (
                      <p className="mt-1.5 text-[13px] md:text-[14px] text-[var(--text-secondary)] leading-[1.65]">
                        {renderText(courseSummary.support)}
                      </p>
                    )}
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
                  <span className="text-red-300 text-[12.5px] font-bold shrink-0 mt-0.5">−</span>
                  <span>{d.text}</span>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* WHAT it rests on is always visible; WHY each item is here waits
                behind 자세히 보기. The summary used to hide the whole block, so
                the card said "확인할 가정 2개" and showed neither — a count the
                reader had no way to check, guarding the one thing this product
                exists to surface. The supporting lines are what made the block
                too heavy to leave open, and they are what stayed behind. */}
            {activeAssumptions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: EASE }}
                className="mb-7 border-y border-[var(--border-subtle)] overflow-hidden">
                {/* Callout header — neutral tone, no team avatars
                    (team belongs in worker panel, not inside this block) */}
                <div className="flex items-center gap-2 px-4 pt-3.5 pb-2">
                  <span className={`text-[12px] font-bold text-[var(--text-secondary)] ${locale === 'ko' ? 'tracking-[0.02em]' : 'uppercase tracking-[0.15em]'}`}>
                    {/* Narrows to "확인할 가정" only when the list really is all
                        assumptions. Calling a list that contains the user's own
                        facts by that name is the lie this block exists to end. */}
                    {premiseListHeading(premiseRecords, locale)}
                  </span>
                </div>
                {/* Each premise shows its work: the user's own sentence it
                    stands on, and what changes if it turns out wrong. Both were
                    already validated on the way in and used to be discarded —
                    without them a premise is just an assertion about someone. */}
                <div className="px-4 pb-3.5 space-y-0">
                  {activeAssumptions.map((d, i) => {
                    const record = premiseRecords
                      .find(r => r.text.trim() === d.text.trim());
                    return (
                      <motion.div key={`${snapshot.version}-a${i}`}
                        initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.06, duration: 0.35, ease: EASE }}
                        className={`flex items-baseline gap-2.5 py-2.5 transition-colors duration-1000 ${
                          i < activeAssumptions.length - 1 ? 'border-b border-[var(--border-subtle)]/40' : ''
                        } ${d.status === 'same' ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'}`}>
                        <KindChip kind={record?.kind} locale={locale} />
                        {/* "Visible stability is valid" is what the update
                            contract promises the model, and until now the
                            screen did not keep it: a row carried forward
                            unchanged looked identical to one written this
                            turn, so an answer that legitimately changed
                            nothing read as an answer that landed nowhere.
                            Marking only what MOVED makes the rest legible as
                            stable by contrast, without tagging every row. */}
                        {hasChanges && d.status !== 'same' && (
                          <span className="shrink-0 text-[10px] font-semibold leading-none text-[var(--accent)]/80 self-center">
                            {d.status === 'revised' ? L('고쳐 씀', 'revised') : L('새로', 'new')}
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="text-[13px] leading-[1.65]">{renderText(d.text)}</p>
                          {/* The sentence this replaced, shown next to the one
                              that replaced it. Not behind 자세히 보기 and not in
                              the red strike-through row above: a rewrite the
                              user's own answer caused is the clearest evidence
                              they get that talking to this thing did anything,
                              and it was being rendered as a deletion. */}
                          {d.status === 'revised' && d.previousText && (
                            <p className="mt-1 text-[12px] leading-[1.6] text-[var(--text-tertiary)]">
                              {L('고치기 전', 'before')}
                              <span className="mx-1.5 opacity-50">·</span>
                              <span className="italic">“{d.previousText}”</span>
                            </p>
                          )}
                          {detailOpen && record?.anchor_quote && (
                            <p className="mt-1 text-[12px] leading-[1.6] text-[var(--text-tertiary)]">
                              {L('내가 쓴 말', 'your words')}
                              <span className="mx-1.5 opacity-50">·</span>
                              <span className="italic">“{record.anchor_quote}”</span>
                            </p>
                          )}
                          {/* "이게 아니라면" and "무엇을 보면 아나" are the two
                              halves of a checkable claim, so they appear only on
                              kinds reality can settle. Printing them on a
                              standard would ask someone to falsify their own
                              values; printing them on a fact would ask them to
                              go verify a sentence they had just written. */}
                          {detailOpen && policyFor(record?.kind).verifiable && record?.if_false_changes && (
                            <p className="mt-0.5 text-[12px] leading-[1.6] text-[var(--text-secondary)]">
                              {L('이게 아니라면', 'if this is wrong')}
                              <span className="mx-1.5 opacity-50">→</span>
                              {renderText(record.if_false_changes)}
                            </p>
                          )}
                          {detailOpen && policyFor(record?.kind).verifiable && record?.observable && (
                            <p className="mt-0.5 text-[12px] leading-[1.6] text-[var(--text-tertiary)]">
                              {L('무엇을 보면 아나', 'how you would know')}
                              <span className="mx-1.5 opacity-50">→</span>
                              {renderText(record.observable)}
                            </p>
                          )}
                          {detailOpen && record?.kind === 'standard' && (
                            <p className="mt-0.5 text-[12px] leading-[1.6] text-[var(--text-tertiary)]">
                              {L('내 기준 · 확인 대상 아님', 'your own standard — not something to check')}
                            </p>
                          )}
                          {detailOpen && record?.kind === 'fact' && (
                            <p className="mt-0.5 text-[12px] leading-[1.6] text-[var(--text-tertiary)]">
                              {L('이미 확정된 것 · 확인 대상 아님', 'already settled — not something to check')}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* ─── Skeleton: The main event — step flow ─── */}
            <AnimatePresence>
              {removedSkeleton.map((d, i) => (
                <motion.div key={`removed-s-${i}`} initial={{ opacity: 0.5 }} animate={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.8, ease: EASE }}
                  className="flex items-start gap-2 text-[12px] text-red-300 line-through leading-relaxed overflow-hidden">
                  <span className="text-red-300 font-mono text-[12.5px] shrink-0 mt-1">−</span>
                  <span>{d.text}</span>
                </motion.div>
              ))}
            </AnimatePresence>

            {activeSkeleton.length > 0 && (
              <div>
                {/* Quiet section label so the numbered list reads as "the plan",
                    matching the card's existing eyebrow system (핵심 / 확인할 가정). */}
                <div className={`text-[12px] font-bold text-[var(--text-tertiary)] mb-2 ${locale === 'ko' ? 'tracking-[0.02em]' : 'uppercase tracking-[0.15em]'}`}>
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
            {/* The toggle appears ONLY when opening it actually reveals
                something. It used to key off skeleton/assumptions alone, so
                with no premises the execution plan became unreachable (the
                button never rendered) — and with premises but nothing behind
                them it opened onto an empty block. One honest predicate now
                covers every branch the expanded body renders. */}
            {(activeSkeleton.length > 0 || activeAssumptions.length > 0 || revealsExecutionPlan) && (
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
                    {L('근거 보기', 'View the rationale')}
                    {activeAssumptions.length > 0 && (
                      <span className="text-[var(--text-tertiary)] font-normal">
                        {claimCount > 0
                          ? L(`· 확인할 가정 ${claimCount}개`, `· ${claimCount} assumptions to verify`)
                          : L(`· 짚어둔 것 ${activeAssumptions.length}개`, `· ${activeAssumptions.length} noted`)}
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
                      <span className="text-[12px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.12em]">{L('실행 계획', 'Execution Plan')}</span>
                      {snapshot.execution_plan.steps.map((step, i) => {
                        const mark = step.who === 'ai' ? 'AI' : step.who === 'human' ? L('외부', 'Ext') : L('도구', 'Tool');
                        return (
                          <span key={i} className="inline-flex items-baseline gap-1 text-[12.5px] px-2 py-0.5 rounded-full bg-[var(--bg)] border border-[var(--border-subtle)]/60">
                            <span className="text-[var(--text-tertiary)] font-semibold text-[12.5px] tracking-wider">{mark}</span>
                            <span className="text-[var(--text-secondary)]">{step.task}</span>
                          </span>
                        );
                      })}
                      <span className="text-[12px] text-[var(--text-tertiary)] ml-auto">
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
