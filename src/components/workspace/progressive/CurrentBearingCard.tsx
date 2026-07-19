'use client';

/*
 * Current Bearing is Argus's one-screen output: current course, why, fog/reef,
 * road not taken, next helm, and the thing to check later. The long document is
 * evidence below it, not the first thing the user has to re-summarize.
 */

import { useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Anchor,
  ArrowRight,
  Check,
  Compass,
  Copy,
  FileText,
  GitFork,
} from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import { bearingToMarkdown } from '@/lib/current-bearing';
import type { CourseStatus, CurrentBearing } from '@/lib/current-bearing';
import { EASE } from './shared/constants';
import { renderInline } from './shared/renderMd';

/* Spine rule 4(a): the pill describes the REVIEW STATE, never a directional
 * call. "진행/Proceed" reads as "go" — a machine verdict stamped above the
 * user's decision — so each label states what the review found and leaves the
 * going to the captain. The "리뷰 기준/review" word doubles as the one-word
 * provenance tag: this is what the AI review saw, not what you decided. */
const STATUS_META: Record<CourseStatus, { ko: string; en: string; caution: boolean }> = {
  proceed: { ko: '열린 쟁점 없음', en: 'No open issues', caution: false },
  anchor: { ko: '검토 의견 없음', en: 'No review signal', caution: false },
  fork: { ko: '선택지 확인 필요', en: 'Choice to review', caution: false },
  collect_evidence: { ko: '근거 확인 필요', en: 'Evidence needed', caution: true },
  hold: { ko: '열린 쟁점 있음', en: 'Open issue', caution: true },
  revise: { ko: '수정 제안 있음', en: 'Revision suggested', caution: true },
};

export function CurrentBearingCard({
  bearing,
  label,
  onShowEvidence,
  onSeal,
  canSeal = false,
  sealHandlesRisk = false,
}: {
  bearing: CurrentBearing | null;
  label?: string | null;
  onShowEvidence?: () => void;
  onSeal?: () => void;
  canSeal?: boolean;
  /** On the final screen the seal card below carries the same uncertainty as
   *  the honest "what the AI assumed" receipt. Pass true there so this card
   *  drops its "가장 큰 위험" beat and the risk isn't stated twice on one screen.
   *  Off (project record view) keeps the full triad. */
  sealHandlesRisk?: boolean;
}) {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const [copied, setCopied] = useState(false);

  if (!bearing) return null;

  const copyBearing = async () => {
    try {
      await navigator.clipboard.writeText(bearingToMarkdown(bearing, locale === 'ko' ? 'ko' : 'en'));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard may be unavailable on non-secure origins. The card remains usable.
    }
  };

  const {
    current_course,
    why_this_course,
    fog_or_reef,
    road_not_taken,
    next_helm,
    contract_seed,
  } = bearing;

  const reasons = Array.isArray(why_this_course)
    ? why_this_course.filter((r) => r && typeof r.point === 'string' && r.point)
    : [];
  const roads = Array.isArray(road_not_taken)
    ? road_not_taken.filter((r) => r && typeof r.option === 'string' && r.option)
    : [];
  const status = STATUS_META[current_course.status] ?? STATUS_META.proceed;
  // The course state is a neutral wayfinding descriptor, NOT a color-coded
  // verdict on the user's decision — no accent/gold "approve vs caution" split.
  const showActions = !!onShowEvidence || (canSeal && !!onSeal);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EASE }}
      className="mb-4 overflow-hidden rounded-2xl bg-[var(--surface)] shadow-[var(--shadow-md)]"
    >
      <div className="px-5 pb-4 pt-4 md:px-6">
        <div className="mb-2.5 flex items-center justify-between gap-3">
          {/* 역할 부제 + 위계 통일 (F-1-1): '완성된 문서'와 형제로 읽히도록
              헤더를 14px semibold로 맞추고, 이 카드가 "지금 선 자리 요약"임을
              한 줄로 밝힌다 — 문서 카드와의 혼동 제거. */}
          <div className="flex min-w-0 items-center gap-2">
            <Compass size={15} className="text-[var(--accent)]" />
            <span className="text-[14px] font-semibold text-[var(--text-primary)]">
              {L('결정 요약', 'Decision summary')}
            </span>
            {label && (
              <span className="tabular-nums text-[10px] text-[var(--text-tertiary)]">
                {label}
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={copyBearing}
              aria-label={L('결정 요약 복사', 'Copy decision summary')}
              className="inline-flex min-h-8 cursor-pointer items-center gap-1 px-1.5 text-[10.5px] font-medium text-[var(--text-tertiary)] transition-[color,scale] duration-150 hover:text-[var(--accent)] active:scale-[0.96]"
            >
              {copied ? <Check size={11} className="text-[var(--success)]" /> : <Copy size={11} />}
              {copied ? L('복사됨', 'Copied') : L('복사', 'Copy')}
            </button>
            <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">
              {L(status.ko, status.en)}
            </span>
          </div>
        </div>

        {/* Headline — the one-line "read first" (decision_read). summary now
            carries a single crisp sentence (the shared bearing contract), so
            it reads as a conclusion you scan in one glance, not a paragraph to
            re-summarize. renderInline turns the engine's **emphasis** into bold. */}
        <p className="text-[18px] md:text-[20px] font-medium leading-[1.4] text-[var(--text-primary)] text-balance" style={{ fontFamily: 'var(--font-display)' }}>
          {renderInline(current_course.summary)}
        </p>

        {showActions && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {onShowEvidence && (
              <button
                type="button"
                onClick={onShowEvidence}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-[var(--bg)] px-3 text-[12px] font-semibold text-[var(--text-secondary)] transition-[color,scale,box-shadow] duration-150 hover:text-[var(--accent)] active:scale-[0.96]"
              >
                <FileText size={13} />
                {L('근거 보기', 'View evidence')}
              </button>
            )}
            {canSeal && onSeal && (
              <button
                type="button"
                onClick={onSeal}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold text-[var(--accent-fg)] transition-[scale,filter] duration-150 hover:brightness-[1.02] active:scale-[0.96]"
                style={{ background: 'var(--gradient-gold)' }}
              >
                <Anchor size={13} />
                {L('결정으로 봉인', 'Seal this call')}
              </button>
            )}
          </div>
        )}
        {/* First-meeting caption (06 S4): '봉인' reads as "locked / can't change" to a
            careful stranger — say what it actually does before the tap. Half of
            SealModal's honest sentence, transplanted next to the 47/0-funnel button. */}
        {showActions && canSeal && onSeal && (
          <p className="mt-2 text-[12px] leading-relaxed text-[var(--text-secondary)]">
            {L(
              '봉인 = 이 결정을 여기 남겨두고, 정한 날에 “그래서, 어떻게 됐어요?”를 물어드리는 거예요.',
              'Sealing keeps this call here — and on the date you pick, we ask "so, how did it go?"',
            )}
          </p>
        )}
      </div>

      {/* At-a-glance triad — 지금 할 일 / 가장 큰 위험 / 확인일에 볼 것. Each is
          an existing bearing field (next_helm / fog / contract_seed); the fixed
          label column makes the screen scannable in one pass instead of a
          paragraph wall. This is the content redesign, not a fold. */}
      {(next_helm || (fog_or_reef?.issue && !sealHandlesRisk) || contract_seed?.predicate) && (
        <div className="border-t border-[var(--border-subtle)] px-5 md:px-6">
          {next_helm && (
            <Beat
              label={L('지금 할 일', 'Do now')}
              icon={<ArrowRight size={13} />}
              tone="var(--accent)"
            >
              {renderInline(next_helm)}
            </Beat>
          )}
          {fog_or_reef?.issue && !sealHandlesRisk && (
            <Beat
              label={L('가장 큰 위험', 'Biggest risk')}
              icon={<AlertTriangle size={13} />}
              tone="var(--gold)"
            >
              {renderInline(fog_or_reef.issue)}
              {fog_or_reef.required_check && (
                <span className="mt-1 block text-[12px] text-[var(--text-tertiary)]">
                  <span className="font-medium">{L('확인: ', 'Check: ')}</span>
                  {renderInline(fog_or_reef.required_check)}
                </span>
              )}
            </Beat>
          )}
          {contract_seed?.predicate && (
            <Beat
              label={L('확인일에 볼 것', 'Check later')}
              icon={<Anchor size={13} />}
              tone="var(--text-secondary)"
            >
              {renderInline(contract_seed.predicate)}
            </Beat>
          )}
        </div>
      )}

      {/* Rationale — why this direction, and roads set aside. Demoted BELOW the
          triad (secondary to "what to do / watch / check"), but not hidden. */}
      {(reasons.length > 0 || roads.length > 0) && (
        <div className="space-y-3 border-t border-[var(--border-subtle)] bg-[var(--bg)]/40 px-5 py-4 md:px-6">
          {reasons.length > 0 && (
            <div>
              <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
                {L('이 방향을 택한 이유', 'Why this direction')}
              </p>
              <ul className="space-y-1">
                {reasons.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[var(--text-tertiary)]" />
                    <span>{renderInline(r.point)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {roads.length > 0 && (
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
                <GitFork size={11} className="text-[var(--text-tertiary)]" />
                {L('보류한 선택지', 'Options set aside')}
              </p>
              {roads.map((r, i) => (
                <div key={i} className="text-[12.5px] leading-relaxed">
                  <span className="text-[var(--text-secondary)] line-through decoration-[var(--text-tertiary)]/50">{r.option}</span>
                  <span className="text-[var(--text-tertiary)]"> — {r.why_not_now}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

/* One row of the at-a-glance triad: a fixed-width colored label + one phrase.
   The label column is what makes three lines scan as a table, not a paragraph. */
function Beat({ label, icon, tone, children }: { label: string; icon: ReactNode; tone: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 border-b border-[var(--border-subtle)] py-3 last:border-b-0">
      <div
        className="flex w-[92px] shrink-0 items-center gap-1.5 pt-px text-[11.5px] font-semibold"
        style={{ color: tone }}
      >
        {icon}
        <span>{label}</span>
      </div>
      <div className="min-w-0 flex-1 text-[13.5px] leading-[1.55] text-[var(--text-primary)]">
        {children}
      </div>
    </div>
  );
}
