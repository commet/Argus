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

/* Spine rule 4(a): the pill describes the REVIEW STATE, never a directional
 * call. "진행/Proceed" reads as "go" — a machine verdict stamped above the
 * user's decision — so each label states what the review found and leaves the
 * going to the captain. The "리뷰 기준/review" word doubles as the one-word
 * provenance tag: this is what the AI review saw, not what you decided. */
const STATUS_META: Record<CourseStatus, { ko: string; en: string; caution: boolean }> = {
  proceed: { ko: '이의 없음 · 리뷰 기준', en: 'No open objections · review', caution: false },
  anchor: { ko: '정박', en: 'Anchor', caution: false },
  fork: { ko: '분기', en: 'Fork', caution: false },
  collect_evidence: { ko: '확인 필요 항목 있음 · 리뷰 기준', en: 'Needs evidence · review', caution: true },
  hold: { ko: '미해결 쟁점 있음 · 리뷰 기준', en: 'Open issue · review', caution: true },
  revise: { ko: '수정 제안 있음 · 리뷰 기준', en: 'Revision suggested · review', caution: true },
};

export function CurrentBearingCard({
  bearing,
  label,
  onShowEvidence,
  onSeal,
  canSeal = false,
}: {
  bearing: CurrentBearing | null;
  label?: string | null;
  onShowEvidence?: () => void;
  onSeal?: () => void;
  canSeal?: boolean;
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
          <div className="flex min-w-0 items-center gap-2">
            <Compass size={15} className="text-[var(--text-tertiary)]" />
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
              {L('현재 항로', 'Current Heading')}
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
              aria-label={L('현재 항로 복사', 'Copy current heading')}
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

        <p className="text-[15px] font-semibold leading-snug text-[var(--text-primary)] text-balance md:text-[16px]">
          {current_course.summary}
        </p>
        <p className="mt-1.5 text-[10.5px] leading-[1.5] text-[var(--text-tertiary)] text-pretty">
          {L(
            '이 결정이 지금 향하는 방향입니다. 긴 문서는 아래 근거로 접어두고, 나중에는 여기서 다시 이어갑니다.',
            'This is where the decision is headed now. The long document is evidence below; this is the point you come back to.',
          )}
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
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold text-white transition-[scale,filter] duration-150 hover:brightness-[1.02] active:scale-[0.96]"
                style={{ background: 'var(--gradient-gold)' }}
              >
                <Anchor size={13} />
                {L('결정으로 봉인', 'Seal this call')}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="space-y-4 px-5 py-4 md:px-6">
        {reasons.length > 0 && (
          <Section title={L('왜 이 항로인가', 'Why this course')}>
            <ul className="space-y-1.5">
              {reasons.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                  <span>{r.point}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {fog_or_reef?.issue && (
          <Section
            title={L('안개와 암초', "Fog & reef")}
            icon={<AlertTriangle size={12} style={{ color: 'var(--gold)' }} />}
          >
            <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
              {fog_or_reef.issue}
            </p>
            {fog_or_reef.required_check && (
              <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-tertiary)]">
                <span className="font-medium">{L('확인: ', 'Check: ')}</span>
                {fog_or_reef.required_check}
              </p>
            )}
          </Section>
        )}

        {roads.length > 0 && (
          <Section
            title={L('가지 않은 길', 'Road not taken')}
            icon={<GitFork size={12} className="text-[var(--text-tertiary)]" />}
          >
            {roads.map((r, i) => (
              <div key={i} className="text-[13px] leading-relaxed">
                <span className="text-[var(--text-secondary)] line-through decoration-[var(--text-tertiary)]/50">
                  {r.option}
                </span>
                <span className="text-[var(--text-tertiary)]"> — {r.why_not_now}</span>
              </div>
            ))}
          </Section>
        )}

        {next_helm && (
          <div className="flex items-start gap-2 pt-1">
            <ArrowRight size={14} className="mt-0.5 shrink-0 text-[var(--accent)]" />
            <p className="text-[13px] font-medium leading-relaxed text-[var(--text-primary)]">
              <span className="font-normal text-[var(--text-tertiary)]">{L('다음 조타: ', 'Next step: ')}</span>
              {next_helm}
            </p>
          </div>
        )}
      </div>

      {contract_seed?.predicate && (
        <div className="px-5 py-3 md:px-6" style={{ background: 'color-mix(in srgb, var(--accent) 4%, transparent)' }}>
          <div className="flex items-start gap-2">
            <Anchor size={12} className="mt-0.5 shrink-0 text-[var(--accent)]" />
            <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]">
              <span className="font-semibold text-[var(--text-primary)]">
                {L('나중에 확인할 것: ', 'To check later: ')}
              </span>
              {contract_seed.predicate}
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5">
        {icon}
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
          {title}
        </p>
      </div>
      {children}
    </div>
  );
}
