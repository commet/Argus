'use client';

/**
 * ProgressiveFlow의 표시 전용 조각들 (E-1 리팩토링, 2026-07-29).
 *
 * 본문은 원본에서 **한 글자도 바꾸지 않고** 옮겼다 — 이 이동의 계약은 "동작이
 * 같다"가 아니라 "코드가 같다"이고, 그래야 4,177줄 파일을 서비스 위험 없이 줄일 수
 * 있다. 상태 기계(ProgressiveFlow 본체 3,017줄)는 건드리지 않았다.
 *
 * 원본 파일은 back-compat re-export를 유지한다 — DMFeedback/VerificationGate/
 * TeamDeployBanner/FinalCard가 이미 쓰던 그 패턴.
 */

import { useState, useEffect, useId } from 'react';
import { motion } from 'framer-motion';
import { Check, ArrowRight, AlertTriangle } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import type { FlowQuestion, FlowAnswer, AnalysisSnapshot } from '@/stores/types';
import { EASE, SPRING } from '../shared/constants';

/** P1-2 과거 답 수정 진입로 (B-7): a pill taps open to the full Q/A; when a
 *  pre-answer checkpoint exists, "이 답부터 다시" forks a NEW branch there —
 *  the current course is preserved (변침도 기록), the question re-presents. */
export function AnsweredPills({ qaPairs, canRevisit, onRevisit, focusIndex, focusNonce }: {
  qaPairs: Array<{ question: FlowQuestion; answer: FlowAnswer | null }>;
  /** Per-ANSWER-index: is there a checkpoint to fork from? */
  canRevisit?: (answerIndex: number) => boolean;
  onRevisit?: (answerIndex: number) => void;
  /** 정거장 레일의 질문 노드 클릭 → 그 답을 정확히 펼치라는 신호.
   *  focusNonce가 바뀔 때마다 focusIndex번째 답을 연다(같은 질문 반복 클릭도 재발화). */
  focusIndex?: number | null;
  focusNonce?: number;
}) {
  const locale = useLocale();
  const disclosureBaseId = useId();
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const answered = qaPairs.filter(qa => qa.answer);
  useEffect(() => {
    if (focusNonce == null || focusIndex == null) return;
    setOpenIdx(focusIndex >= 0 && focusIndex < answered.length ? focusIndex : null);
    // focusNonce가 유일한 트리거 — answered/focusIndex는 그 시점 값으로 충분.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNonce]);
  if (!answered.length) return null;
  const open = openIdx !== null ? answered[openIdx] : null;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {answered.map((qa, i) => (
          <motion.button key={i} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05, ...SPRING }}
            type="button"
            onClick={() => setOpenIdx(openIdx === i ? null : i)}
            aria-expanded={openIdx === i}
            aria-controls={`${disclosureBaseId}-${i}`}
            aria-label={`${qa.question.text}: ${qa.answer!.value}`}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-[var(--surface)] border text-[12px] cursor-pointer transition-colors ${
              openIdx === i ? 'border-[var(--accent)]/50' : 'border-[var(--border-subtle)] hover:border-[var(--accent)]/30'
            }`}>
            <Check size={12} className="text-[var(--accent)]" />
            {/* Wider caps on LARGER screens (the sm: values were inverted). */}
            <span className="text-[var(--text-tertiary)] max-w-[80px] sm:max-w-[120px] truncate">{qa.question.text.split(' ').slice(0, 3).join(' ')}</span>
            <span className="text-[var(--text-primary)] font-medium max-w-[100px] sm:max-w-[160px] truncate">{qa.answer!.value}</span>
          </motion.button>
        ))}
        <motion.span initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
          className="text-[12.5px] font-medium text-[var(--accent)]/80 flex items-center gap-1">
          <ArrowRight size={11} /> {locale === 'ko' ? '팀 분석에 반영' : 'sent to team'}
        </motion.span>
      </div>

      {open && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          id={`${disclosureBaseId}-${openIdx}`}
          role="region"
          aria-label={locale === 'ko' ? `${(openIdx ?? 0) + 1}번째 답변 상세` : `Answer ${(openIdx ?? 0) + 1} details`}
          className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3.5 space-y-2">
          <p className="text-[12px] text-[var(--text-secondary)] leading-[1.55]">{open.question.text}</p>
          <p className="text-[13px] text-[var(--text-primary)] font-medium leading-[1.5]">→ {open.answer!.value}</p>
          {canRevisit?.(openIdx!) && onRevisit ? (
            <div className="flex items-center justify-between gap-3 pt-1">
              <span className="text-[12.5px] text-[var(--text-tertiary)]">
                {locale === 'ko' ? '지금까지 정리한 방향은 다른 갈래로 그대로 남아요' : 'The direction so far stays available as another branch'}
              </span>
              <button
                onClick={() => { onRevisit(openIdx!); setOpenIdx(null); }}
                className="shrink-0 px-3 py-1.5 rounded-lg border border-[var(--accent)]/40 text-[13px] font-medium text-[var(--accent)] hover:bg-[var(--ai)] transition-colors cursor-pointer">
                {locale === 'ko' ? '이 답부터 다시 →' : 'Redo from this answer →'}
              </button>
            </div>
          ) : (
            <p className="text-[12.5px] text-[var(--text-tertiary)] pt-1">
              {locale === 'ko' ? '이 지점은 답 이후 흐름이 많이 진행돼 직접 수정 대신 새 질문으로 반영하는 게 안전해요.' : 'This point is past safe rewind — fold changes in via a new answer instead.'}
            </p>
          )}
        </motion.div>
      )}
    </div>
  );
}

/* QuestionCard → imported from shared/ */

/* AttributedSection + SentenceStream → extracted to ./AttributedSection */

/* MixPreview → extracted to ./MixPreview */

/* DMFeedback → extracted to ./DMFeedback (re-exported below for back-compat) */
/* FinalCard → extracted to ./FinalCard (re-exported below) */

/* ═══ Loading ═══ */

/* ═══ Framing Confirmation (Weakness A fix) ═══ */
export function FramingConfirmation({ snapshot, onConfirm, onReject, busy }: {
  snapshot: AnalysisSnapshot;
  onConfirm: () => void;
  onReject: (reason: string) => void;
  busy: boolean;
}) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const [rejectMode, setRejectMode] = useState(false);
  const [reason, setReason] = useState('');
  const confidence = snapshot.framing_confidence ?? 75;
  const isLowConfidence = confidence < 70;

  if (snapshot.framing_locked) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}
      className={`rounded-xl border p-4 md:p-5 ${isLowConfidence ? 'bg-amber-50/50 border-[var(--warning)]/30' : 'bg-[var(--accent)]/[0.02] border-[var(--accent)]/10'}`}>
      <div className="flex items-start gap-3 mb-3">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${isLowConfidence ? 'bg-[var(--warning)]/15' : 'bg-[var(--accent)]/10'}`}>
          {isLowConfidence ? <AlertTriangle size={11} className="text-[var(--warning)]" /> : <Check size={11} className="text-[var(--accent)]" />}
        </div>
        <div>
          <p className="text-[13px] font-semibold text-[var(--text-primary)] leading-snug">{L('이 방향으로 정리할까요?', 'Should we continue in this direction?')}</p>
          {/* Only the low-confidence case earns a subline — and without the
              "흔들릴 여지가 있어요" clause that undercut the analysis mid-confirm.
              The high-confidence subline just restated the heading + buttons. */}
          {isLowConfidence && (
            <p className="text-[12.5px] text-[var(--text-tertiary)] mt-0.5">
              {L('이 문제는 여러 방향으로 읽힐 수 있어요.', 'This problem reads in more than one way.')}
            </p>
          )}
        </div>
      </div>

      {!rejectMode ? (
        <div className="flex gap-2 pl-9">
          <motion.button onClick={onConfirm} disabled={busy} whileTap={{ scale: 0.98 }}
            className="px-4 py-2 rounded-xl text-[12px] font-semibold text-[var(--accent-fg)] cursor-pointer disabled:opacity-50"
            style={{ background: 'var(--gradient-gold)' }}>{L('맞아요', 'Correct')}</motion.button>
          <motion.button onClick={() => setRejectMode(true)} disabled={busy} whileTap={{ scale: 0.98 }}
            className="px-4 py-2 rounded-xl text-[12px] font-medium text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:border-[var(--accent)]/30 cursor-pointer">
            {L('방향 바꾸기', 'Change direction')}</motion.button>
        </div>
      ) : (
        <div className="pl-9 space-y-2">
          <input value={reason} onChange={e => setReason(e.target.value)} maxLength={500} placeholder={L('어떤 방향이 더 맞나요? (예: 이건 투자용이 아니라 내부 보고용이야)', 'What direction fits better? (e.g., This is for internal reporting, not investors)')}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] text-base md:text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]/30"
            onKeyDown={e => { if (e.key === 'Enter' && reason.trim()) { e.preventDefault(); onReject(reason.trim()); } }} autoFocus />
          <div className="flex gap-2">
            <motion.button onClick={() => reason.trim() && onReject(reason.trim())} disabled={busy || !reason.trim()} whileTap={{ scale: 0.98 }}
              className="px-4 py-2 rounded-xl text-[12px] font-semibold text-[var(--accent-fg)] cursor-pointer disabled:opacity-50"
              style={{ background: 'var(--gradient-gold)' }}>{L('재분석', 'Re-analyze')}</motion.button>
            <button onClick={() => setRejectMode(false)} className="px-3 py-2 text-[12.5px] text-[var(--text-tertiary)] cursor-pointer">{L('취소', 'Cancel')}</button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

/* Convergence Status (명확도 게이지) removed — it surfaced an uncalibrated score
   and leaned on the model's self-confidence as a user-facing verdict. Its two
   real jobs are owned elsewhere now: "when to stop" = the standing 그만 묻고 초안
   CTA, "what the AI assumed" = the MirrorBeat. assessConvergence still runs in
   progressive-engine for internal routing only — never rendered. */

/* ═══ Pipeline Exit Buttons (Weakness D fix) ═══ */
export function PipelineExitOptions({ onReframe, onRehearse }: {
  onReframe: () => void;
  onRehearse: () => void;
}) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  return (
    <div className="flex flex-col gap-2.5 border-t border-dashed border-[var(--border-subtle)] pt-4 mt-2">
      <p className="text-[12px] font-semibold text-[var(--text-secondary)]">{L('다른 방식으로 이어가기', 'Continue another way')}</p>
      <div className="flex gap-2.5">
        <button onClick={onReframe}
          className="flex-1 text-left px-3.5 py-2.5 rounded-xl bg-[var(--bg)]/60 hover:bg-[var(--accent)]/5 border border-[var(--border-subtle)]/60 hover:border-[var(--accent)]/30 cursor-pointer transition-colors duration-300">
          <p className="text-[13px] font-semibold text-[var(--text-primary)]">{L('→ 문제 다시 정리하기', '→ Reframe the problem')}</p>
          <p className="text-[12.5px] text-[var(--text-tertiary)] mt-0.5">{L('더 깊이 들어가기', 'Dig deeper')}</p>
        </button>
        <button onClick={onRehearse}
          className="flex-1 text-left px-3.5 py-2.5 rounded-xl bg-[var(--bg)]/60 hover:bg-[var(--accent)]/5 border border-[var(--border-subtle)]/60 hover:border-[var(--accent)]/30 cursor-pointer transition-colors duration-300">
          <p className="text-[13px] font-semibold text-[var(--text-primary)]">{L('→ 피드백부터 받기', '→ Get feedback first')}</p>
          <p className="text-[12.5px] text-[var(--text-tertiary)] mt-0.5">{L('이해관계자 반응 시뮬레이션', 'Simulate stakeholder reactions')}</p>
        </button>
      </div>
    </div>
  );
}
