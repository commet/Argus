'use client';

import { useMemo, useState } from 'react';
import { ChartPlate } from '@/components/ui/ChartPlate';
import { JudgmentFrame } from './JudgmentFrame';
import { contractStatus, summarizeGrades } from '@/lib/decision-contract';
import { firstVoyageInscription } from '@/lib/record-summary';
import type { Project, DecisionContract } from '@/stores/types';
import { ChevronDown } from 'lucide-react';

/**
 * Logbook (S6 항해일지 — 교차-결정 연대기 · B4/B5) — the user's sealed voyages
 * laid out as ONE time-ordered ship's log: seal (봉인), course-change (변침),
 * settle (정산). Below the log a "문장만 보기" toggle (B5) absorbs the quote wall
 * (제안2 형태1) — it hides the event ledger and shows only each decision's
 * JudgmentFrame (봉인 문장 / 돌아온 문장), newest seal first.
 *
 * This composes EXISTING assets only: contract fields already stored in the
 * decision_contract jsonb (created_at / history / graded_at / judgment_receipt),
 * summarizeGrades (the settle-count brain), JudgmentFrame (the single verbatim-
 * quote render path), ChartPlate (the register plate). Nothing new is invented.
 *
 * SPINE:
 *  - Every line is a plain DATE + a fact of what happened — never a score, %,
 *    grade, tier, streak, or comparison. A settle line is a COUNT ("가설 적중 2 ·
 *    운 1"), the same counts the 자차표 shows, never a verdict.
 *  - 변침 (a superseded check-in) is logged as a fact — "변침은 기록이다" — never
 *    framed as slipping or failure.
 *  - Retrospective (practice) contracts are excluded: the accumulation face is the
 *    record of decisions made blind, and retro loops are isolated from the record
 *    everywhere (W1 origin:'retro' invariant). Their practice surfaces stand alone.
 *  - Quote wall reuses JudgmentFrame → verbatim JSX text nodes (React auto-escapes),
 *    the SINGLE quote render path. No second, drifting rendering of the same quote.
 *  - Renders only at 2+ events (and the quote wall only at 2+ frames). Below that
 *    there is no chronicle to keep.
 */

type EventKind = 'seal' | 'amend' | 'settle';

interface LogEvent {
  key: string;
  kind: EventKind;
  /** Sort key — ISO timestamp of the event. */
  at: string;
  /** Formatted M/D date stamp (fact only). */
  stamp: string;
  /** Project name for the seal line's 「…」. */
  projectName: string;
  /** For amend: the new check-in date (fact). */
  amendTo?: string;
  /** For settle: the counts sentence (전부 사실). */
  settleCounts?: string;
}

interface QuoteFrame {
  key: string;
  humanJudgment: string;
  whatHappened?: string;
  sealedOn: string;
  settledOn?: string;
  sortAt: string;
}

function mdStamp(iso: string | undefined, locale: 'ko' | 'en'): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return locale === 'ko' ? `${m}/${day}` : `${m}/${day}`;
}

/** The settle line's counts — the SAME counts the 자차표 shows (summarizeGrades),
 *  rendered as a plain list. Never a total, never a score. Exported so the B8
 *  drift guard can assert the Logbook's digits equal the RecordStrip/telegram
 *  digits without rendering React. */
export function settleCountsLine(c: DecisionContract, locale: 'ko' | 'en'): string {
  const g = summarizeGrades(c);
  const parts: string[] = [];
  const ko = locale === 'ko';
  if (g.betsHeld > 0) parts.push(ko ? `가설 적중 ${g.betsHeld}` : `${g.betsHeld} bet${g.betsHeld === 1 ? '' : 's'} held`);
  if (g.betsBroke > 0) parts.push(ko ? `가설 빗나감 ${g.betsBroke}` : `${g.betsBroke} bet${g.betsBroke === 1 ? '' : 's'} missed`);
  if (g.risksAvoided > 0) parts.push(ko ? `위험 비켜감 ${g.risksAvoided}` : `${g.risksAvoided} risk${g.risksAvoided === 1 ? '' : 's'} steered past`);
  if (g.risksHappened > 0) parts.push(ko ? `위험 실현 ${g.risksHappened}` : `${g.risksHappened} risk${g.risksHappened === 1 ? '' : 's'} hit`);
  if (g.goodOutcomesOnLuck > 0) parts.push(ko ? `그중 운 ${g.goodOutcomesOnLuck}` : `${g.goodOutcomesOnLuck} on luck`);
  if (parts.length === 0) {
    // A settled loop with no counted bucket (e.g. a date-only outcome). Honest fact.
    return ko ? '고리를 닫음' : 'loop closed';
  }
  return parts.join(' · ');
}

export function Logbook({
  projects,
  locale,
}: {
  projects: Project[];
  locale: 'ko' | 'en';
}) {
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const [collapsed, setCollapsed] = useState(true);
  const [quotesOnly, setQuotesOnly] = useState(false);

  // Only SEALED, real (non-retro) contracts belong in the chronicle.
  const contracts = useMemo(
    () =>
      projects
        .filter((p) => p.decision_contract && p.decision_contract.origin !== 'retro')
        .map((p) => ({ name: p.name, c: p.decision_contract as DecisionContract })),
    [projects],
  );

  // B4 — merge seal / amend / settle into one time-ordered ledger.
  const events = useMemo<LogEvent[]>(() => {
    const list: LogEvent[] = [];
    for (const { name, c } of contracts) {
      if (c.created_at) {
        list.push({
          key: `${c.id}-seal`,
          kind: 'seal',
          at: c.created_at,
          stamp: mdStamp(c.created_at, locale),
          projectName: name,
        });
      }
      for (let i = 0; i < (c.history || []).length; i++) {
        const a = (c.history || [])[i];
        if (!a?.amended_at) continue;
        list.push({
          key: `${c.id}-amend-${i}`,
          kind: 'amend',
          at: a.amended_at,
          stamp: mdStamp(a.amended_at, locale),
          projectName: name,
          amendTo: a.check_in_at ? mdStamp(a.check_in_at, locale) : undefined,
        });
      }
      if (c.graded_at && contractStatus(c, 0).allGraded) {
        list.push({
          key: `${c.id}-settle`,
          kind: 'settle',
          at: c.graded_at,
          stamp: mdStamp(c.graded_at, locale),
          projectName: name,
          settleCounts: settleCountsLine(c, locale),
        });
      }
    }
    // The ONE ordering: newest first (a log reads latest-at-top).
    list.sort((a, b) => (b.at || '').localeCompare(a.at || ''));
    return list;
  }, [contracts, locale]);

  // B5 — quote wall: each decision's JudgmentFrame, newest seal first. Only the
  // user-typed seal-time line (JudgmentFrame renders nothing without it).
  const quoteFrames = useMemo<QuoteFrame[]>(() => {
    const list: QuoteFrame[] = [];
    for (const { c } of contracts) {
      const jr = c.judgment_receipt;
      const hj = (jr?.human_judgment || '').trim();
      if (!hj) continue; // no user quote → no frame (JudgmentFrame's own rule)
      list.push({
        key: `${c.id}-quote`,
        humanJudgment: hj,
        whatHappened: jr?.what_happened,
        sealedOn: mdStamp(c.created_at, locale),
        settledOn: jr?.settled_at ? mdStamp(jr.settled_at, locale) : undefined,
        sortAt: c.created_at || '',
      });
    }
    list.sort((a, b) => (b.sortAt || '').localeCompare(a.sortAt || ''));
    return list;
  }, [contracts, locale]);

  // Left inscription — same pure elapsed fact as the fleet chart (shared brain).
  const firstSeal = useMemo(() => {
    let min: string | undefined;
    for (const { c } of contracts) {
      const d = c.created_at;
      if (d && (!min || d < min)) min = d;
    }
    return min ? String(min).slice(0, 10) : undefined;
  }, [contracts]);
  const inscription = firstVoyageInscription(firstSeal, Date.now(), locale);

  // The chronicle renders only when there is a chronicle to keep.
  if (events.length < 2) return null;
  const canShowQuotes = quoteFrames.length >= 2;

  return (
    <ChartPlate
      label={L('결정 이력 · DECISION HISTORY', 'DECISION HISTORY · 결정 이력')}
      coordinate={inscription}
      compact
      className="!rounded-xl !border-[#123c3a]/20 !shadow-none"
    >
      <div className="w-full text-left">
        <div className="flex items-center justify-between gap-3 mb-2 pt-1">
          <div>
            <p className="text-[15px] font-semibold text-[var(--bp-ink)]" style={{ fontFamily: 'var(--font-display)' }}>
              {L('결정 기록', 'Decision log')}
            </p>
            {inscription ? (
            <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-[var(--bp-ink-soft)]/80 tabular-nums">
              {inscription}
            </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            aria-expanded={!collapsed}
            className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.14em] text-[var(--bp-ink-soft)]/70 hover:text-[var(--bp-ink)] transition-colors cursor-pointer"
          >
            {collapsed ? L('펼치기', 'Show') : L('접기', 'Hide')}
            <ChevronDown
              size={12}
              className={`transition-transform ${collapsed ? '-rotate-90' : ''}`}
              aria-hidden
            />
          </button>
        </div>

        {!collapsed && (
          <div className="pt-2 pb-3">
            {/* B5 — the "문장만 보기" toggle (quote wall). Only offered when there
                are 2+ frames to accumulate. */}
            {canShowQuotes && (
              <div className="mb-3">
                <button
                  type="button"
                  onClick={() => setQuotesOnly((v) => !v)}
                  aria-pressed={quotesOnly}
                  className="inline-flex items-center rounded-lg border border-[var(--bp-ink)]/20 px-2.5 py-1 text-[11px] font-medium text-[var(--bp-ink-soft)] hover:bg-[var(--bp-ink)]/[0.05] transition-colors cursor-pointer"
                >
                  {quotesOnly ? L('일지 보기', 'Show the log') : L('문장만 보기', 'Sentences only')}
                </button>
              </div>
            )}

            {quotesOnly && canShowQuotes ? (
              // Quote wall — verbatim JudgmentFrames, newest seal first.
              <div className="space-y-3">
                {quoteFrames.map((q) => (
                  <JudgmentFrame
                    key={q.key}
                    humanJudgment={q.humanJudgment}
                    whatHappened={q.whatHappened}
                    sealedOn={q.sealedOn}
                    settledOn={q.settledOn}
                    ko={locale === 'ko'}
                  />
                ))}
              </div>
            ) : (
              // The event ledger — a single vertical column, newest at top.
              <ol className="relative space-y-2.5">
                {events.map((e) => (
                  <li key={e.key} className="flex items-baseline gap-3 text-[13px]">
                    <span className="shrink-0 w-10 text-right font-mono tabular-nums text-[11px] text-[var(--bp-ink-soft)]/70">
                      {e.stamp}
                    </span>
                    <span className="text-[var(--bp-ink)] leading-snug">
                      {e.kind === 'seal' && (
                        <>
                          <span className="font-semibold">{L('처음 판단 저장', 'Decision saved')}</span>
                          {' — '}
                          <span className="text-[var(--bp-ink-soft)]">
                            {L('「', '“')}
                            {e.projectName}
                            {L('」', '”')}
                          </span>
                        </>
                      )}
                      {e.kind === 'amend' && (
                        <>
                          <span className="font-semibold">{L('확인일 변경', 'Review date changed')}</span>
                          {' — '}
                          <span className="text-[var(--bp-ink-soft)]">
                            {e.amendTo
                              ? L(`확인일 ${e.amendTo}로`, `check-in moved to ${e.amendTo}`)
                              : L('확인일 미룸', 'check-in pushed')}
                          </span>
                        </>
                      )}
                      {e.kind === 'settle' && (
                        <>
                          <span className="font-semibold">{L('결과 확인', 'Outcome reviewed')}</span>
                          {' — '}
                          <span className="text-[var(--bp-ink-soft)]">{e.settleCounts}</span>
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>
    </ChartPlate>
  );
}
