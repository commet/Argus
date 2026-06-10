'use client';

/* ═══ Current Bearing — the compressed orientation above the long document ═══
 *
 * ARGUS-FINAL-DIRECTION §"The Surface Principle": the user should see a Current
 * Bearing first — current course, why, fog/reef, road not taken, next helm,
 * contract seed — not a long report. This card sits ABOVE the FinalCard so the
 * one-screen bearing is the visible center; the full document stays right below.
 *
 * Pure presentation: it renders a CurrentBearing derived by lib/current-bearing.
 * Renders nothing when there's no bearing (no draft to orient from). */

import { motion } from 'framer-motion';
import { Compass, AlertTriangle, GitFork, ArrowRight, Anchor } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import type { CurrentBearing, CourseStatus } from '@/lib/current-bearing';
import { EASE } from './shared/constants';

/** Status chip copy + tone. Go-states ride the accent; caution-states ride gold
 *  (attention, not danger — the webapp never hard-blocks a conscious captain). */
const STATUS_META: Record<CourseStatus, { ko: string; en: string; caution: boolean }> = {
  proceed:          { ko: '진행',      en: 'Proceed',          caution: false },
  anchor:           { ko: '정박',      en: 'Anchor',           caution: false },
  fork:             { ko: '분기',      en: 'Fork',             caution: false },
  collect_evidence: { ko: '근거 먼저', en: 'Collect evidence', caution: true },
  hold:             { ko: '보류',      en: 'Hold',             caution: true },
  revise:           { ko: '수정',      en: 'Revise',           caution: true },
};

export function CurrentBearingCard({
  bearing,
  label,
}: {
  bearing: CurrentBearing | null;
  /** Optional version label (e.g. "v0.1") shown in the header, mirroring the plugin. */
  label?: string | null;
}) {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  if (!bearing) return null;

  const { current_course, why_this_course, fog_or_reef, road_not_taken, next_helm, contract_seed } = bearing;
  const status = STATUS_META[current_course.status] ?? STATUS_META.proceed;
  const tone = status.caution ? 'var(--gold)' : 'var(--accent)';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EASE }}
      className="mb-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] shadow-[var(--shadow-md)] overflow-hidden"
    >
      {/* Header — the compass + the one-line course + a status chip */}
      <div className="px-5 md:px-6 pt-4 pb-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2">
            <Compass size={15} style={{ color: tone }} />
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
              {L('현재 항로', 'Current Bearing')}
            </span>
            {label && <span className="text-[10px] text-[var(--text-tertiary)] tabular-nums">{label}</span>}
          </div>
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ color: tone, background: `color-mix(in srgb, ${tone} 12%, transparent)` }}
          >
            {L(status.ko, status.en)}
          </span>
        </div>
        <p className="text-[15px] md:text-[16px] font-semibold text-[var(--text-primary)] leading-snug">
          {current_course.summary}
        </p>
      </div>

      <div className="px-5 md:px-6 py-4 space-y-4">
        {/* Why this course */}
        {why_this_course.length > 0 && (
          <Section title={L('왜 이 항로인가', 'Why this course')}>
            <ul className="space-y-1.5">
              {why_this_course.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px] text-[var(--text-secondary)] leading-relaxed">
                  <span className="w-1.5 h-1.5 rounded-full mt-[7px] shrink-0" style={{ background: 'var(--accent)' }} />
                  <span>{r.point}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Fog / reef — the named uncertainty */}
        {fog_or_reef && (
          <Section title={L('안개·암초', 'Fog & reef')} icon={<AlertTriangle size={12} style={{ color: 'var(--gold)' }} />}>
            <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">{fog_or_reef.issue}</p>
            {fog_or_reef.required_check && (
              <p className="text-[12px] text-[var(--text-tertiary)] mt-1 leading-relaxed">
                <span className="font-medium">{L('확인할 것: ', 'Check: ')}</span>
                {fog_or_reef.required_check}
              </p>
            )}
          </Section>
        )}

        {/* Road not taken */}
        {road_not_taken.length > 0 && (
          <Section title={L('가지 않은 길', 'Road not taken')} icon={<GitFork size={12} className="text-[var(--text-tertiary)]" />}>
            {road_not_taken.map((r, i) => (
              <div key={i} className="text-[13px] leading-relaxed">
                <span className="text-[var(--text-secondary)] line-through decoration-[var(--text-tertiary)]/50">{r.option}</span>
                <span className="text-[var(--text-tertiary)]"> — {r.why_not_now}</span>
              </div>
            ))}
          </Section>
        )}

        {/* Next helm — the one concrete action */}
        {next_helm && (
          <div className="flex items-start gap-2 pt-1">
            <ArrowRight size={14} className="text-[var(--accent)] mt-0.5 shrink-0" />
            <p className="text-[13px] font-medium text-[var(--text-primary)] leading-relaxed">
              <span className="text-[var(--text-tertiary)] font-normal">{L('다음 키: ', 'Next helm: ')}</span>
              {next_helm}
            </p>
          </div>
        )}
      </div>

      {/* Contract seed — the falsifiable prediction to seal later */}
      {contract_seed && (
        <div className="px-5 md:px-6 py-3 border-t border-[var(--border-subtle)] bg-[var(--accent)]/[0.04]">
          <div className="flex items-start gap-2">
            <Anchor size={12} className="text-[var(--accent)] mt-0.5 shrink-0" />
            <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed">
              <span className="font-semibold text-[var(--text-primary)]">{L('계약 씨앗: ', 'Contract seed: ')}</span>
              {contract_seed.predicate}
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        {icon}
        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">{title}</p>
      </div>
      {children}
    </div>
  );
}
