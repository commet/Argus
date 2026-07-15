'use client';

import { useEffect, useId, useRef } from 'react';
import { motion } from 'framer-motion';
import { UserCheck, X as XIcon, ChevronRight, RotateCw } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import { extractKeyFinding } from '@/lib/extract-key-finding';
import type { WorkerTask } from '@/stores/types';
import { WorkerAvatar } from './WorkerAvatar';
import { personaName } from './shared/persona-format';
import { EASE } from './shared/constants';

/* ═══ Verification Gate — 출항 전 검증 ═══ */
/**
 * The captain-stays-in-the-loop junction. Surfaces every worker that finished
 * but hasn't been accepted/excluded, so unverified analysis can't slip into the
 * final draft unnoticed. Deliberately a *soft* gate: an explicit "확인 없이
 * 출항" override always exists — we make verification conscious, not coerced.
 */
export function VerificationGate({ workers, anyRunning, onApprove, onReject, onRetry, onSail, onOverride, onClose }: {
  workers: WorkerTask[];
  /** True while any worker is mid-run (e.g. a "Redo" in flight). Sailing must
   *  wait for it — otherwise a re-running worker (no longer 'done', so absent
   *  from the unreviewed list) could let the mix proceed without its result. */
  anyRunning?: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onRetry?: (id: string) => void;
  onSail: () => void;
  onOverride: () => void;
  onClose: () => void;
}) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const remaining = workers.length;
  const allClear = remaining === 0 && !anyRunning;
  // ESC closes (matches PersonaPoolModal). Body-scroll lock keeps the page
  // from scrolling behind the sheet.
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      if (focusable.length === 0) { e.preventDefault(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && (document.activeElement === first || !panelRef.current.contains(document.activeElement))) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const raf = requestAnimationFrame(() => panelRef.current?.focus());
    return () => {
      document.removeEventListener('keydown', onKey);
      cancelAnimationFrame(raf);
      document.body.style.overflow = prev;
      previousFocus?.focus?.();
    };
  }, []);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <motion.div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.3, ease: EASE }}
        className="relative w-full sm:max-w-lg max-h-[85dvh] rounded-t-2xl sm:rounded-2xl bg-[var(--surface)] shadow-[var(--shadow-xl)] overflow-hidden flex flex-col focus:outline-none">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border-subtle)] shrink-0">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center shrink-0">
              <UserCheck size={18} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p id={titleId} className="text-[15px] font-semibold text-[var(--text-primary)]">
                {allClear ? L('모두 확인했어요', 'All reviewed') : L('확인하지 않은 분석이 있어요', 'Some analyses are unreviewed')}
              </p>
              <p className="text-[12px] text-[var(--text-secondary)] mt-0.5 leading-snug">
                {allClear
                  ? L('이제 초안을 만들 수 있어요.', 'Ready to create the draft.')
                  : L(`팀원 ${remaining}명의 결과를 아직 안 봤어요. 반영할지 빼고 갈지 한 번씩만 정해주세요 — 그대로 다 반영하고 가도 돼요.`, `You haven't looked at ${remaining} result${remaining > 1 ? 's' : ''} yet. Mark each as keep or skip — or just include them all and go.`)}
              </p>
            </div>
            <button type="button" onClick={onClose} className="shrink-0 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg hover:bg-[var(--bg)] cursor-pointer" aria-label={L('닫기', 'Close')}>
              <XIcon size={16} className="text-[var(--text-tertiary)]" />
            </button>
          </div>
        </div>

        {/* Unreviewed list */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
          {workers.map(w => {
            const finding = extractKeyFinding(w.result) || (w.result || '').slice(0, 120);
            return (
              <div key={w.id} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg)]/50 p-3">
                <div className="flex items-center gap-2">
                  <WorkerAvatar persona={w.persona} size="sm" />
                  <span className="text-[13px] font-medium text-[var(--text-primary)] truncate">{personaName(w.persona, locale) || 'AI'}</span>
                  <span className="text-[11px] text-[var(--text-tertiary)] truncate">· {w.task}</span>
                </div>
                {finding && <p className="text-[12px] text-[var(--text-secondary)] mt-1.5 leading-[1.55] line-clamp-3">{finding}</p>}
                {/* Apply and Exclude are symmetric neutral affordances: the
                    machine must not weight "trust my output" (gold) over a normal
                    editorial "skip" (red-as-danger). Both are plain outlines;
                    gold is reserved for the user's actual commit (Create draft,
                    below). Apply carries slightly more weight only via text
                    primary + medium, never a color verdict. */}
                <div className="flex items-center gap-2 mt-2.5">
                  <button type="button" onClick={() => onApprove(w.id)}
                    className="inline-flex items-center justify-center min-h-[44px] px-3 py-2.5 text-[12px] font-medium text-[var(--text-primary)] rounded-lg border border-[var(--border)] hover:bg-[var(--bg-hover)] cursor-pointer transition-colors">
                    {L('반영', 'Apply')}
                  </button>
                  <button type="button" onClick={() => onReject(w.id)}
                    className="inline-flex items-center justify-center min-h-[44px] px-3 py-2.5 text-[12px] text-[var(--text-secondary)] rounded-lg border border-[var(--border)] hover:bg-[var(--bg-hover)] cursor-pointer transition-colors">
                    {L('제외', 'Exclude')}
                  </button>
                  {onRetry && (
                    <button type="button" onClick={() => onRetry(w.id)}
                      className="ml-auto inline-flex items-center justify-center gap-1 min-h-[44px] px-2.5 py-2.5 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--accent)] rounded-lg cursor-pointer transition-colors"
                      title={L('이 분석을 다시 실행', 'Re-run this analysis')}>
                      <RotateCw size={11} /> {L('다시', 'Redo')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[var(--border-subtle)] shrink-0 flex flex-col gap-2">
          <button type="button" onClick={onSail} disabled={!allClear}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 text-[var(--accent-fg)] rounded-xl text-[14px] font-semibold cursor-pointer shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-shadow disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'var(--gradient-gold)' }}>
            {allClear
              ? L('초안 만들기', 'Create draft')
              : remaining > 0
                ? L(`${remaining}개 남음`, `${remaining} left`)
                : L('실행 중…', 'Running…')} <ChevronRight size={14} />
          </button>
          {/* Override only when there's genuinely unreviewed work to accept —
              not while a re-run is still in flight (nothing to override yet). */}
          {remaining > 0 && (
            <button type="button" onClick={onOverride}
              className="w-full text-center text-[12px] text-[var(--text-tertiary)] hover:text-[var(--accent)] py-1 cursor-pointer transition-colors">
              {L('확인 없이 모두 반영하고 초안 만들기', 'Accept all unchecked & create draft')}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
