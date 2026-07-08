'use client';

import { useRef } from 'react';
import { motion } from 'framer-motion';
import { Loader2, ChevronRight } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import type { DMConcern, DMFeedbackResult } from '@/stores/types';
import { EASE, SPRING } from './shared/constants';

/* ═══ DM Feedback ═══ */
export function DMFeedback({ fb, onToggle, onFinalize, onDeepen, busy }: { fb: DMFeedbackResult; onToggle: (i: number) => void; onFinalize: () => void; onDeepen?: () => void; busy: boolean }) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const initial = (fb.persona_name || '?').charAt(0).toUpperCase();
  // Snapshot the initial applied[] once on mount — parent remounts this
  // component via `key` when a new review arrives, so we don't need to
  // watch fb identity here. toggleFix rebuilds dm_feedback on every toggle,
  // so watching object identity would reset on each click.
  const baselineRef = useRef<boolean[] | null>(null);
  if (baselineRef.current === null) {
    baselineRef.current = fb.concerns.map(c => c.applied);
  }
  const changedCount = fb.concerns.reduce(
    (n, c, i) => n + (c.applied !== (baselineRef.current![i] ?? c.applied) ? 1 : 0),
    0,
  );
  const hasChanges = changedCount > 0;
  return (
    <div className="space-y-5">
    {/* 공정 5-10 위계 수술: 정체성은 카드 안에서 한 번만 (divider 행 제거),
        칭찬은 접고, 화면의 주인공은 인용 → 고칠 것 → CTA 한 줄기다. */}
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE }}>
      <div className="rounded-2xl p-[1px] bg-[var(--border-subtle)]">
        <div className="rounded-[calc(1rem-1px)] bg-[var(--surface)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.5)]">
          <div className="p-5 md:p-6 space-y-5">
            {/* Reviewer — one compact identity row (avatar + name·role inline) */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[var(--accent)]/8 flex items-center justify-center text-[15px] font-bold text-[var(--accent)]">{initial}</div>
              <p className="text-[14px] text-[var(--text-primary)]">
                <span className="font-bold">{fb.persona_name}</span>
                <span className="mx-1.5 text-[var(--text-tertiary)]">·</span>
                <span className="text-[13px] text-[var(--text-tertiary)]">{fb.persona_role}</span>
              </p>
            </div>

            {/* First reaction — impactful blockquote */}
            <blockquote className="text-[17px] md:text-[18px] text-[var(--text-primary)] leading-[1.6] italic">
              &ldquo;{fb.first_reaction}&rdquo;
            </blockquote>

            {/* Good parts — praise is context, not action: folded to one line so
                the fix list below owns the screen. */}
            {fb.good_parts.length > 0 && (
              <details className="group/g rounded-xl bg-[var(--bg)]/50 px-4 py-3">
                <summary className="list-none cursor-pointer flex items-center gap-2 text-[12px] text-[var(--text-secondary)]">
                  <span className="text-[var(--accent)] text-[12px]">&#10003;</span>
                  <span className="font-semibold">{L(`잘한 점 ${fb.good_parts.length}가지`, `${fb.good_parts.length} strengths`)}</span>
                  <span className="text-[var(--text-tertiary)] truncate flex-1 min-w-0">{fb.good_parts[0]}</span>
                  <ChevronRight size={12} className="shrink-0 text-[var(--text-tertiary)] transition-transform group-open/g:rotate-90" />
                </summary>
                <div className="mt-2.5 space-y-2">
                  {fb.good_parts.map((g, i) => <p key={i} className="text-[13px] text-[var(--text-primary)] flex items-start gap-2.5 leading-relaxed"><span className="text-[var(--accent)] shrink-0 mt-0.5 text-[12px]">&#10003;</span>{g}</p>)}
                </div>
              </details>
            )}

            {/* Concerns — "이것만 고치면" */}
            {fb.concerns.length > 0 && <div>
              <div className="flex items-center justify-between gap-3 mb-3">
                <p className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-[0.2em]">{L('이것만 고치면', 'Fix These')}</p>
                {fb.concerns.length > 1 && (
                  <div className="flex items-center gap-2.5 shrink-0">
                    <button
                      onClick={() => { if (!busy) fb.concerns.forEach((c, i) => { if (!c.applied) onToggle(i); }); }}
                      disabled={busy || fb.concerns.every(c => c.applied)}
                      className="text-[11px] font-medium text-[var(--accent)] hover:underline cursor-pointer disabled:opacity-30 disabled:cursor-default disabled:no-underline">
                      {L('모두 반영', 'Apply all')}
                    </button>
                    <span className="text-[var(--border)]">·</span>
                    <button
                      onClick={() => { if (!busy) fb.concerns.forEach((c, i) => { if (c.applied) onToggle(i); }); }}
                      disabled={busy || fb.concerns.every(c => !c.applied)}
                      className="text-[11px] font-medium text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer disabled:opacity-30 disabled:cursor-default">
                      {L('모두 해제', 'Clear all')}
                    </button>
                  </div>
                )}
              </div>
              <div className="space-y-3">
                {fb.concerns.map((c: DMConcern, i: number) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.08, duration: 0.4, ease: EASE }}
                    className={`rounded-2xl border p-4 transition-all duration-500 ${c.applied ? 'border-[var(--accent)]/20 bg-[var(--accent)]/[0.02]' : 'border-[var(--border-subtle)] bg-[var(--bg)]'}`}
                    style={{ transitionTimingFunction: 'cubic-bezier(0.32,0.72,0,1)' }}>
                    <div className="flex items-start gap-2 mb-2">
                      <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${c.severity === 'critical' ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400' : c.severity === 'important' ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                        {c.severity === 'critical' ? L('필수', 'Required') : c.severity === 'important' ? L('권장', 'Recommended') : L('참고', 'Note')}</span>
                      <p className="text-[13px] text-[var(--text-primary)] leading-relaxed">{c.text}</p>
                    </div>
                    <p className="text-[12px] text-[var(--accent)] leading-relaxed mb-3 pl-1">→ {c.fix_suggestion}</p>
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-[10px] text-[var(--text-tertiary)]">{c.applied ? L('반영', 'Applied') : L('제외', 'Skipped')}</span>
                      <button onClick={() => onToggle(i)} className={`relative w-11 h-6 rounded-full cursor-pointer ${c.applied ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`}
                        style={{ transitionProperty: 'background', transitionDuration: '400ms', transitionTimingFunction: 'cubic-bezier(0.32,0.72,0,1)' }}>
                        <motion.div className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm" animate={{ left: c.applied ? 24 : 4 }} transition={SPRING} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>}

            {/* Approval condition — one compact line riding right above the CTA
                (it IS the CTA's justification, not a separate chapter). */}
            <div className="flex items-baseline gap-2.5 rounded-lg bg-[var(--accent)]/[0.04] px-3.5 py-2.5">
              <span className="text-[9px] font-bold text-[var(--accent)] uppercase tracking-[0.18em] shrink-0">{L('통과 조건', 'To pass')}</span>
              <p className="text-[13.5px] text-[var(--text-primary)] font-semibold leading-snug">{fb.approval_condition}</p>
            </div>

            {/* Deep mode extras — would_ask (shown after deep review) */}
            {fb.would_ask.length > 0 && (
              <div className="pt-2">
                <p className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-[0.2em] mb-2.5">{L('이것도 물어볼 거다', 'They Would Also Ask')}</p>
                {fb.would_ask.map((q, i) => <p key={i} className="text-[13px] text-[var(--text-secondary)] flex items-start gap-2 mb-1.5 leading-relaxed"><span className="text-[var(--accent)] shrink-0">?</span>{q}</p>)}
              </div>
            )}

            {/* Actions — primary + secondary path */}
            <div className="space-y-3">
              {hasChanges && !busy && (
                <motion.p
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className="text-center text-[12px] text-[var(--accent)] font-medium"
                >
                  {locale === 'ko'
                    ? `변경 ${changedCount}건 — 아래 버튼을 눌러 최종본에 반영하세요`
                    : `${changedCount} pending change${changedCount === 1 ? '' : 's'} — press below to apply to the final doc`}
                </motion.p>
              )}
              <motion.button
                onClick={onFinalize}
                disabled={busy}
                whileTap={{ scale: 0.98 }}
                animate={hasChanges && !busy ? { boxShadow: ['0 0 0px rgba(180,160,100,0)', '0 0 18px rgba(180,160,100,0.45)', '0 0 0px rgba(180,160,100,0)'] } : { boxShadow: '0 0 0px rgba(180,160,100,0)' }}
                transition={hasChanges && !busy ? { duration: 2.2, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.4 }}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 text-white rounded-2xl text-[14px] font-semibold shadow-[var(--shadow-sm)] cursor-pointer disabled:opacity-50"
                style={{ background: 'var(--gradient-gold)' }}
              >
                {busy ? <><Loader2 size={16} className="animate-spin" /> {L('최종본 작성 중...', 'Finalizing...')}</> : <>{L('반영하고 완성', 'Apply and Finalize')} <ChevronRight size={14} /></>}
              </motion.button>
              {fb.would_ask.length === 0 && onDeepen && (
                <p className="text-center text-[12px] text-[var(--text-tertiary)]">
                  {L('다른 관점이 필요하면 ', 'Need another perspective? ')}
                  <button onClick={onDeepen} disabled={busy}
                    className="text-[var(--accent)] hover:underline cursor-pointer font-medium disabled:opacity-50"
                    style={{ transitionProperty: 'color', transitionDuration: '200ms' }}>
                    {busy ? L('검토 중...', 'Reviewing...') : L('더 깊이 검토 →', 'Go deeper →')}
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
    </div>
  );
}
