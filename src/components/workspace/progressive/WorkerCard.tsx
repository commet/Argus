'use client';

import { useState, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, RotateCw, Loader2, ExternalLink, X, Repeat } from 'lucide-react';
import { useProgressiveStore } from '@/stores/useProgressiveStore';
import type { WorkerTask } from '@/stores/types';
import { resolveAgentType } from '@/stores/types';
import { WorkerAvatar } from './WorkerAvatar';
import { useAgentStore } from '@/stores/useAgentStore';
import { usePersonaStore } from '@/stores/usePersonaStore';
import { useLocale } from '@/hooks/useLocale';
import { localizePersona } from '@/lib/worker-personas';
import { recordHitReaction } from '@/lib/hit-rate';
import { recordStrategyOutcome } from '@/lib/context-strategy';
import { selectContextStrategy } from '@/lib/context-strategy';
import { extractOptions } from '@/lib/extract-options';
import { extractKeyFinding } from '@/lib/extract-key-finding';
import { renderMd } from './shared/renderMd';
import { EASE } from './shared/constants';

/* ═══ Hit Reaction Bar — 자기개선 데이터 수집 ═══ */

function HitReactionBar({ workerId, agentId, taskType }: { workerId: string; agentId?: string; taskType?: string }) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const [reacted, setReacted] = useState<'hit' | 'miss' | 'irrelevant' | null>(null);

  if (!agentId || reacted) {
    return reacted ? (
      <p className="text-[10px] text-[var(--text-tertiary)] mt-2 pl-0.5">
        {reacted === 'hit' ? L('새로운 관점이었군요', 'That was a fresh perspective') : reacted === 'miss' ? L('다음엔 더 깊이', 'Will go deeper next time') : L('참고했습니다', 'Noted')}
      </p>
    ) : null;
  }

  const react = (reaction: 'hit' | 'miss' | 'irrelevant') => {
    recordHitReaction(agentId, workerId, reaction, undefined, taskType);
    // context 전략 자기개선: 이 반응이 어떤 전략에서 나왔는지 기록
    if (taskType) {
      const strategy = selectContextStrategy(taskType as import('@/lib/task-classifier').TaskType, agentId);
      recordStrategyOutcome(agentId, taskType as import('@/lib/task-classifier').TaskType, strategy.strategy, reaction === 'hit');
    }
    setReacted(reaction);
  };

  return (
    <div className="flex items-center gap-1.5 mt-2.5">
      <span className="text-[10px] text-[var(--text-tertiary)] mr-1">{L('이 분석이', 'This analysis was')}</span>
      <button onClick={() => react('hit')}
        className="px-2.5 py-1 text-[10px] rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 cursor-pointer transition-colors">
        {L('새로웠다', 'New insight')}
      </button>
      <button onClick={() => react('miss')}
        className="px-2.5 py-1 text-[10px] rounded-lg border border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:bg-[var(--bg)] cursor-pointer transition-colors">
        {L('이미 알았다', 'Already knew')}
      </button>
      <button onClick={() => react('irrelevant')}
        className="px-2.5 py-1 text-[10px] rounded-lg border border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:bg-[var(--bg)] cursor-pointer transition-colors">
        {L('중요하지 않다', 'Not important')}
      </button>
    </div>
  );
}

/* ═══ Result Detail Modal — comfortable full-text reading surface ═══ */
function ResultModal({ worker, content, onClose, onApprove, onReject }: {
  worker: WorkerTask;
  /** Body to render (markdown). Defaults to worker.result; SELF tasks pass their AI reference. */
  content?: string;
  onClose: () => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const body = content ?? worker.result ?? '';
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4"
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.3, ease: EASE }}
        className="relative w-full sm:max-w-2xl max-h-[85vh] sm:max-h-[80vh] rounded-t-2xl sm:rounded-2xl bg-[var(--surface)] shadow-[var(--shadow-xl)] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 sm:px-6 py-4 border-b border-[var(--border-subtle)] shrink-0">
          <WorkerAvatar persona={worker.persona} size="lg" />
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold text-[var(--text-primary)] truncate">
              {worker.persona ? localizePersona(worker.persona, locale).name : 'AI'}
            </p>
            <p className="text-[13px] text-[var(--text-secondary)] truncate">
              {worker.persona ? localizePersona(worker.persona, locale).role : ''} · {worker.task}
            </p>
          </div>
          <button onClick={onClose} className="p-2.5 hover:bg-[var(--bg)] rounded-lg cursor-pointer transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label={L('닫기', 'Close')}>
            <X size={18} className="text-[var(--text-tertiary)]" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
          {worker.completion_note && (
            <p className="text-[13px] text-[var(--text-secondary)] mb-4 leading-relaxed line-clamp-3">
              &ldquo;{worker.completion_note.replace(/^[^:]+:\s*/, '')}&rdquo;
            </p>
          )}
          <div className="text-[14px] text-[var(--text-primary)] break-words">
            {renderMd(body)}
          </div>
        </div>

        {/* Footer — approve/reject */}
        {(onApprove || onReject) && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-4 sm:px-6 py-4 border-t border-[var(--border-subtle)] shrink-0">
            <span className="text-[13px] text-[var(--text-secondary)]">
              {worker.approved === true ? L('초안에 반영됩니다', 'Included in draft') : worker.approved === false ? L('초안에서 제외됩니다', 'Excluded from draft') : L('반영 여부를 선택하세요', 'Choose whether to include')}
            </span>
            <div className="flex gap-2.5">
              {onReject && worker.approved !== false && (
                <button onClick={() => onReject(worker.id)}
                  className="flex-1 sm:flex-none px-5 py-3 sm:py-2.5 text-[13px] text-red-600 dark:text-red-400 hover:bg-[var(--bg)] rounded-xl border border-[var(--border-subtle)] cursor-pointer transition-colors min-h-[44px]">
                  {L('제외', 'Exclude')}
                </button>
              )}
              {onApprove && worker.approved !== true && (
                <button onClick={() => onApprove(worker.id)}
                  className="flex-1 sm:flex-none px-5 py-3 sm:py-2.5 text-[13px] text-white font-semibold rounded-xl cursor-pointer shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-shadow min-h-[44px]"
                  style={{ background: 'var(--gradient-gold)' }}>
                  {L('반영', 'Apply')}
                </button>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

/* ═══ Inline Report Block — 대화 흐름 속 보고 ═══ */

export const WorkerReportBlock = memo(function WorkerReportBlock({
  worker,
  onSubmitInput,
  onRetry,
  onApprove,
  onReject,
  onReassign,
  isFirstWaiting,
  onAdvance,
}: {
  worker: WorkerTask;
  onSubmitInput?: (id: string, input: string) => void;
  onRetry?: (id: string) => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  /** Re-assign this task to a different agent (opens the persona pool in
   *  replace mode, then re-runs). Lets a rejected result get a fresh take from
   *  someone else — the real "거부 후 재배정" loop. */
  onReassign?: (id: string) => void;
  isFirstWaiting?: boolean;
  /** Stepper mode — when provided, terminal actions ("반영"/"확인") advance to
   *  the next worker and relabel the primary button "… → 다음". */
  onAdvance?: () => void;
}) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const store = useProgressiveStore();
  const [showModal, setShowModal] = useState(false);
  const aTypeInit = resolveAgentType(worker);
  const [inputVal, setInputVal] = useState(
    // AI task with draft (legacy both or new ai+self_scope): pre-fill with draft
    (worker.who === 'both' || (aTypeInit === 'ai' && worker.self_scope)) && worker.result ? worker.result : ''
  );
  const persona = worker.persona ? localizePersona(worker.persona, locale) : null;

  const statusLabel: string = ({
    pending: L('대기 중', 'Pending'),
    running: L('작업 중...', 'Working...'),
    done: L('완료', 'Done'),
    error: L('오류', 'Error'),
    waiting_input: L('입력 필요', 'Input needed'),
    ai_preparing: L('AI 준비 중...', 'AI preparing...'),
    sent: L('발송됨', 'Sent'),
    waiting_response: L('응답 대기', 'Awaiting response'),
    validation_failed: L('품질 확인 필요', 'Quality check needed'),
  } as Record<string, string>)[worker.status] || worker.status;

  useEffect(() => {
    if (worker.who === 'both' && worker.result && !inputVal) {
      setInputVal(worker.result);
    }
  }, [worker.result]);

  // Running / AI preparing — subtle inline indicator
  if (worker.status === 'running' || worker.status === 'ai_preparing') {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}
        className="flex items-center gap-3 pl-1">
        <div className="w-px h-8 bg-[var(--border-subtle)]" />
        <WorkerAvatar persona={persona} size="sm" pulse />
        <span className="text-[12px] text-[var(--text-secondary)]">
          {persona?.name || (worker.agent_type === 'self' ? L('내 판단', 'My decision') : worker.agent_type === 'human' ? L('외부 확인', 'External') : 'AI')}
          <span className="text-[var(--text-tertiary)]"> · {worker.status === 'ai_preparing' ? L('AI 참고자료 준비 중', 'AI preparing reference') : worker.task}</span>
        </span>
        <Loader2 size={12} className="animate-spin text-[var(--text-tertiary)]" />
      </motion.div>
    );
  }

  // Sent / Waiting response — human agent status
  if (worker.status === 'sent' || worker.status === 'waiting_response') {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}
        className="flex items-center gap-3 pl-1">
        <div className="w-px h-8" style={{ backgroundColor: '#6B7280' }} />
        <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[12px] shrink-0">👤</div>
        <span className="text-[12px] text-[var(--text-secondary)]">
          {worker.contact?.name || L('외부', 'External')}
          <span className="text-[var(--text-tertiary)]"> · {statusLabel}</span>
        </span>
        <span className="text-[10px] text-amber-500">⏳</span>
      </motion.div>
    );
  }

  // Pending state — quiet
  if (worker.status === 'pending') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} className="flex items-center gap-3 pl-1">
        <div className="w-px h-6 bg-[var(--border-subtle)]" />
        <WorkerAvatar persona={persona} size="sm" />
        <span className="text-[12px] text-[var(--text-tertiary)]">
          {persona?.name || 'AI'} · {L('대기 중', 'Pending')}
        </span>
      </motion.div>
    );
  }

  // Error state
  if (worker.status === 'error') {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}
        className="flex items-start gap-3 pl-1">
        <div className="w-px self-stretch bg-red-300" />
        <WorkerAvatar persona={persona} size="sm" />
        <div className="flex-1">
          <span className="text-[13px] text-red-600 font-medium">{persona?.name || 'AI'}: {L('작업 중 문제가 생겼어요', 'Something went wrong')}</span>
          <p className="text-[12px] text-red-600 mt-0.5">{worker.error}</p>
        </div>
        {onRetry && (
          <button onClick={() => onRetry(worker.id)}
            className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700 shrink-0 cursor-pointer">
            <RotateCw size={11} /> {L('재시도', 'Retry')}
          </button>
        )}
      </motion.div>
    );
  }

  // Validation failed state
  if (worker.status === 'validation_failed') {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
        <div className="flex items-start gap-3">
          <div className="w-px self-stretch mt-1" style={{ backgroundColor: persona?.color || 'var(--accent)' }} />
          <WorkerAvatar persona={persona} size="md" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-[var(--text-primary)]">
              {persona?.name || 'AI'}
              <span className="text-[var(--text-tertiary)] font-normal ml-1.5 text-[11px]">{persona?.role}</span>
            </p>
            <div className="mt-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <p className="text-[12px] font-semibold text-amber-900 mb-1">{L('품질 확인이 필요해요', 'Quality check needed')}</p>
              {worker.validation_feedback && <p className="text-[12px] text-amber-800 mb-2.5 leading-relaxed">{worker.validation_feedback}</p>}
              <div className="flex gap-2">
                {onRetry && <button onClick={() => onRetry(worker.id)}
                  className="text-[11px] px-3 py-1.5 min-h-[36px] rounded-lg bg-white border border-amber-200 text-amber-800 cursor-pointer hover:bg-amber-50">{L('다시 생성', 'Regenerate')}</button>}
                <button onClick={() => store.updateWorker(worker.id, { status: 'done', completed_at: new Date().toISOString() })}
                  className="text-[11px] px-3 py-1.5 min-h-[36px] rounded-lg text-amber-700 cursor-pointer hover:text-amber-900">{L('그냥 사용', 'Use anyway')}</button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // Waiting input (self / both / human Phase 1)
  if (worker.status === 'waiting_input' && onSubmitInput) {
    const aType = resolveAgentType(worker);
    const decisionOptions = extractOptions(worker.decision);
    const isHumanAgent = aType === 'human';
    const hasPreliminary = !!worker.ai_preliminary;
    const hasDraft = (worker.who === 'both' || (aType === 'ai' && worker.self_scope)) && !!worker.result;

    return (
      <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
        {isFirstWaiting && (
          <div className="flex items-center gap-1.5 mb-2 ml-4">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
            <span className="text-[11px] font-medium text-[var(--accent)]">{L('여기부터 작성해주세요', 'Start here')}</span>
          </div>
        )}
        <div className="flex items-start gap-3">
          <div className="w-px self-stretch mt-1" style={{ backgroundColor: isHumanAgent ? '#6B7280' : (persona?.color || 'var(--accent)') }} />
          {isHumanAgent
            ? <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-[14px] shrink-0">👤</div>
            : aType === 'self'
            ? <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-[14px] shrink-0">🧠</div>
            : <WorkerAvatar persona={persona} size="md" />
          }
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-[var(--text-primary)]">
              {isHumanAgent ? (worker.contact?.name || worker.question_to_human?.slice(0, 20) || L('외부 확인', 'External'))
                : aType === 'self' ? L('내 판단', 'My decision')
                : (persona?.name || 'AI')}
              <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                isHumanAgent ? 'bg-gray-100 text-gray-600'
                : aType === 'self' ? 'bg-amber-50 text-amber-700'
                : 'bg-blue-50 text-blue-600'
              }`}>
                {isHumanAgent ? 'HUMAN' : aType === 'self' ? 'SELF' : 'AI'}
              </span>
              {!isHumanAgent && aType !== 'self' && (
                <span className="text-[var(--text-tertiary)] font-normal ml-1.5 text-[11px]">{persona?.role}</span>
              )}
            </p>

            {/* Scope display — AI/사람 역할 분담 */}
            {(worker.ai_scope || worker.self_scope) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2">
                {worker.ai_scope && (
                  <div className="text-[11px] px-2.5 py-1.5 rounded-lg bg-blue-50/80">
                    <span className="font-bold text-blue-600">AI:</span>
                    <span className="text-[var(--text-secondary)] ml-1">{worker.ai_scope}</span>
                  </div>
                )}
                {worker.self_scope && (
                  <div className="text-[11px] px-2.5 py-1.5 rounded-lg bg-amber-50/80">
                    <span className="font-bold text-amber-600">{L('나', 'Me')}:</span>
                    <span className="text-[var(--text-secondary)] ml-1">{worker.self_scope}</span>
                  </div>
                )}
              </div>
            )}

            {/* Human agent — 질문 표시 */}
            {isHumanAgent && worker.question_to_human && (
              <div className="mt-2 text-[12px] bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] font-medium text-gray-500 mb-1">Q:</p>
                <p className="text-[var(--text-primary)]">{worker.question_to_human}</p>
              </div>
            )}

            {/* Key finding — surface the AI reference's takeaway up front so the
                user gets the gist without reading the whole thing. Full text is
                one tap away below. */}
            {(() => {
              const source = worker.ai_preliminary || (hasDraft ? worker.result : null);
              const finding = extractKeyFinding(source);
              if (!finding) return null;
              return (
                <div className="mt-2.5 rounded-xl bg-[var(--bg)]/70 border border-[var(--border-subtle)] px-3.5 py-2.5">
                  <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--accent)] mb-1">
                    {L('AI 핵심 정리', 'AI key point')}
                  </p>
                  <p className="text-[13px] text-[var(--text-primary)] leading-[1.55]">{finding}</p>
                </div>
              );
            })()}

            {/* Full reference / draft — collapsed by default, rendered as proper
                markdown in a height-capped scroll box so it never floods the
                step. (Fixes the old line-clamp dead-end.) */}
            {(hasPreliminary || hasDraft) && (
              <div className="mt-2">
                <button onClick={() => setShowModal(true)}
                  className="flex items-center gap-1 text-[11px] text-[var(--accent)] hover:underline cursor-pointer">
                  <ExternalLink size={10} />
                  {hasDraft ? L('전체 초안 보기', 'View full draft') : L('참고 자료 전체 보기', 'View full reference')}
                </button>
              </div>
            )}

            {/* Decision chips */}
            {decisionOptions.length > 0 && (
              <div className="mt-2">
                <p className="text-[10px] text-[var(--text-tertiary)] mb-1.5">{L('하나 고르거나, 아래에 직접 적어도 돼요', 'Pick one, or type your own below')}</p>
              <div className="flex flex-wrap gap-1.5">
                {decisionOptions.map((opt, j) => (
                  <button key={j}
                    onClick={() => setInputVal(opt)}
                    className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border cursor-pointer transition-all ${
                      inputVal === opt
                        ? 'border-amber-500 bg-amber-500 text-white'
                        : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-amber-400 hover:text-amber-700'
                    }`}>
                    {opt}
                  </button>
                ))}
              </div>
              </div>
            )}

            <div className="mt-2">
              <textarea value={inputVal} onChange={(e) => setInputVal(e.target.value)}
                placeholder={
                  isHumanAgent ? L('이 사람의 답변을 입력하세요...', 'Enter their response...')
                  : hasDraft ? L('수정하거나 그대로 확인...', 'Edit or confirm as-is...')
                  : decisionOptions.length > 0 ? L('또는 직접 입력...', 'Or type your own...')
                  : L('내용을 입력해주세요...', 'Enter your input...')
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]/30 resize-none min-h-[70px] max-h-[150px]"
                rows={3} maxLength={5000}
                aria-label={`${persona?.name || 'AI'} ${L('작업 입력', 'task input')}`} />
              <div className="flex justify-end gap-2 mt-2">
                {isHumanAgent && (
                  <button onClick={() => { onSubmitInput(worker.id, '[skip]'); onAdvance?.(); }}
                    className="px-3.5 py-2.5 text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] rounded-xl border border-[var(--border-subtle)] cursor-pointer min-h-[44px]">
                    {L('이 사람 없이 진행', 'Skip this person')}
                  </button>
                )}
                {hasDraft && (
                  <button onClick={() => { onSubmitInput(worker.id, worker.result!); onAdvance?.(); }}
                    className="px-3.5 py-2.5 text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl border border-[var(--border-subtle)] cursor-pointer min-h-[44px]">
                    {L('초안 그대로', 'Keep draft')}
                  </button>
                )}
                <button onClick={() => { if (inputVal.trim()) { onSubmitInput(worker.id, inputVal.trim()); onAdvance?.(); } }}
                  disabled={!inputVal.trim()}
                  className="px-3.5 py-2 text-[12px] text-white font-semibold rounded-xl disabled:opacity-30 cursor-pointer"
                  style={{ background: 'var(--gradient-gold)' }}>
                  {onAdvance ? L('확인 → 다음', 'Confirm → Next') : L('확인', 'Confirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
      {/* Full reference / draft modal for SELF & human tasks */}
      <AnimatePresence>
        {showModal && (
          <ResultModal
            worker={worker}
            content={worker.ai_preliminary || worker.result || ''}
            onClose={() => setShowModal(false)}
          />
        )}
      </AnimatePresence>
      </>
    );
  }

  // Done state — the main report block
  const isRejected = worker.approved === false;
  const isApproved = worker.approved === true;
  const keyFinding = extractKeyFinding(worker.result);
  const hasMore = (worker.result || '').length > 160;
  const agentLevel = worker.agent_id
    ? useAgentStore.getState().getAgent(worker.agent_id)?.level
    : undefined;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className={`group transition-opacity duration-500 ${isRejected ? 'opacity-40' : ''}`}
      >
        <div className="flex items-start gap-3">
          {/* Color line */}
          <div className="w-px self-stretch mt-1 transition-colors duration-500"
            style={{ backgroundColor: isRejected ? 'var(--border-subtle)' : (persona?.color || 'var(--accent)') }} />
          <WorkerAvatar persona={persona} size="md" />
          <div className="flex-1 min-w-0">
            {/* Name + role */}
            <p className="text-[14px] font-medium text-[var(--text-primary)]">
              {persona?.name || 'AI'}
              <span className="text-[var(--text-secondary)] font-normal ml-1.5 text-[12px]">{persona?.role}</span>
              {agentLevel != null && agentLevel >= 2 && (
                <span className="agent-lv ml-1.5" data-level={agentLevel} style={{ fontSize: 10, padding: '1px 6px' }}>
                  Lv.{agentLevel}
                </span>
              )}
              {isApproved && <span className="ml-2 text-[11px] text-[var(--accent)] font-medium">{L('반영', 'Applied')}</span>}
              {isRejected && <span className="ml-2 text-[11px] text-[var(--text-tertiary)] font-medium">{L('제외', 'Excluded')}</span>}
            </p>
            {/* Task name */}
            <p className="text-[11px] text-[var(--accent)] mt-0.5">{worker.task}</p>

            {/* Validation state — descriptive, not "N점" (score numerals are
                verdict language; the internal score still drives the tint). */}
            {worker.validation_score != null && (
              <span className={`inline-block mt-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                worker.validation_score >= 80 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : worker.validation_score >= 60 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                  : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
              }`}>
                {worker.validation_score >= 80 ? L('확인 통과', 'Checked') : worker.validation_score >= 60 ? L('한 번 봐주세요', 'Worth a look') : L('확인 필요', 'Needs review')}
              </span>
            )}

            {/* Completion note — persona's voice */}
            {worker.completion_note && (
              <p className="text-[13px] text-[var(--text-secondary)] mt-1.5 leading-relaxed">
                &ldquo;{worker.completion_note.replace(/^[^:]+:\s*/, '')}&rdquo;
              </p>
            )}

            {/* Key finding first — the one-line takeaway, so the user grasps the
                result without reading the whole report. Full draft is one tap
                away ("전체 초안 보기"). */}
            {keyFinding && (
              <div className={`mt-2.5 rounded-xl px-3.5 py-3 ${
                isRejected
                  ? 'bg-[var(--bg)]/30 text-[var(--text-tertiary)] line-through'
                  : 'bg-[var(--bg)]/70 border border-[var(--border-subtle)] text-[var(--text-primary)]'
              }`}>
                <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--accent)] mb-1">
                  {L('핵심 발견', 'Key finding')}
                </p>
                <p className="text-[13.5px] leading-[1.6]">{keyFinding}</p>
              </div>
            )}

            {/* Full draft — opens the comfortable reading modal (markdown-rendered,
                scrollable) instead of dumping thousands of chars inline. */}
            {hasMore && (
              <button onClick={() => setShowModal(true)}
                className="flex items-center gap-1 mt-2 text-[11px] text-[var(--accent)] hover:underline cursor-pointer">
                <ExternalLink size={10} />
                {L('전체 초안 보기', 'View full draft')}
              </button>
            )}
            {/* No key finding extracted — show the text inline (capped), so the
                card is never empty even when extraction yields nothing. */}
            {!keyFinding && worker.result && (
              <div className={`mt-2.5 text-[13px] leading-[1.75] rounded-xl p-3.5 break-words ${
                isRejected ? 'bg-[var(--bg)]/30 text-[var(--text-tertiary)] line-through' : 'bg-[var(--bg)]/60 text-[var(--text-primary)]'
              }`}>
                <p className="whitespace-pre-wrap">{worker.result.slice(0, 300)}{worker.result.length > 300 ? '…' : ''}</p>
              </div>
            )}

            {/* Simulation vs Reality comparison (human workers with matching persona) */}
            {aTypeInit === 'human' && worker.status === 'done' && worker.result && worker.contact?.name && (() => {
              const personaStore = usePersonaStore.getState();
              const matchedPersona = personaStore.personas.find(p =>
                !p.deleted_at && p.name === worker.contact?.name
              );
              // Find most recent feedback that mentions this persona
              const feedbackHistory = personaStore.feedbackHistory || [];
              const simulation = feedbackHistory.find((fr: { persona_ids?: string[]; results?: Array<{ persona_id: string; overall_reaction: string }> }) =>
                matchedPersona && fr.persona_ids?.includes(matchedPersona.id)
              );
              const simResult = simulation?.results?.find((r: { persona_id: string }) => r.persona_id === matchedPersona?.id) as { overall_reaction?: string } | undefined;
              if (!simResult) return null;
              return (
                <div className="mt-3 rounded-xl border border-purple-200 bg-purple-50/30 p-3">
                  <p className="text-[10px] font-bold text-purple-600 mb-2">{L('시뮬레이션 vs 실제 응답', 'Simulation vs Reality')}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[9px] font-medium text-purple-500 mb-1">{L('AI 시뮬레이션', 'AI Simulation')}</p>
                      <p className="text-[11px] text-[var(--text-secondary)] line-clamp-4">{simResult.overall_reaction}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-medium text-emerald-600 mb-1">{L('실제 응답', 'Actual Response')}</p>
                      <p className="text-[11px] text-[var(--text-primary)] line-clamp-4">{worker.result.slice(0, 200)}</p>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Approve / Reject actions */}
            {(onApprove || onReject) && (
              <div className="mt-3">
                {!isApproved && !isRejected && (
                  <p className="text-[11px] text-[var(--text-tertiary)] mb-2">
                    {L('이 분석을 최종 문서에 포함할지 선택하세요', 'Choose whether to include this in the final document')}
                  </p>
                )}
                <div className="flex items-center gap-2.5">
                  {onReject && !isRejected && (
                    <button onClick={() => { onReject(worker.id); onAdvance?.(); }}
                      className="flex items-center gap-1.5 px-4 py-2 text-[12px] text-red-600 hover:bg-red-50 rounded-xl border border-red-200 hover:border-red-400 cursor-pointer transition-colors">
                      {L('제외', 'Exclude')}
                    </button>
                  )}
                  {onApprove && !isApproved && (
                    <button onClick={() => { onApprove(worker.id); onAdvance?.(); }}
                      className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-semibold text-white rounded-xl cursor-pointer shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-shadow"
                      style={{ background: 'var(--gradient-gold)' }}>
                      <Check size={12} /> {onAdvance ? L('반영 → 다음', 'Apply → Next') : L('반영', 'Apply')}
                    </button>
                  )}
                  {(isApproved || isRejected) && (
                    <>
                      <button onClick={() => isApproved ? onReject?.(worker.id) : onApprove?.(worker.id)}
                        className="text-[11px] text-[var(--text-tertiary)] hover:text-[var(--accent)] cursor-pointer transition-colors">
                        {L('변경', 'Change')}
                      </button>
                      {/* Rejected work isn't a dead-end — let the captain demand a
                          fresh attempt (same agent) or hand it to someone else. */}
                      {isRejected && onRetry && (
                        <button
                          onClick={() => { store.updateWorker(worker.id, { approved: null }); onRetry(worker.id); }}
                          className="inline-flex items-center gap-1 text-[11px] text-[var(--accent)] hover:underline cursor-pointer transition-colors">
                          <RotateCw size={10} /> {L('다시 시도', 'Try again')}
                        </button>
                      )}
                      {isRejected && onReassign && (
                        <button
                          onClick={() => onReassign(worker.id)}
                          className="inline-flex items-center gap-1 text-[11px] text-[var(--accent)] hover:underline cursor-pointer transition-colors">
                          <Repeat size={10} /> {L('다른 에이전트로', 'Different agent')}
                        </button>
                      )}
                      <span className="text-[10px] text-[var(--text-tertiary)]">
                        {isApproved ? L('최종 문서에 포함됩니다', 'Included in final document') : L('최종 문서에서 제외됩니다', 'Excluded from final document')}
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Hit-rate: 이 분석이 도움이 됐는지 (자기개선 데이터 수집) */}
            <HitReactionBar workerId={worker.id} agentId={worker.agent_id} taskType={worker.task_type} />
          </div>
        </div>
      </motion.div>

      {/* Full result modal — read-only reading surface (approve/exclude stays on
          the card so it flows through the stepper). */}
      <AnimatePresence>
        {showModal && (
          <ResultModal
            worker={worker}
            content={worker.status === 'waiting_input' ? (worker.ai_preliminary || worker.result || '') : (worker.result || '')}
            onClose={() => setShowModal(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}, (prev, next) => {
  if (prev.worker.status === 'running' && next.worker.status === 'running') {
    return Math.abs(prev.worker.stream_text.length - next.worker.stream_text.length) < 20
      && prev.worker.id === next.worker.id;
  }
  return prev.worker === next.worker
    && prev.onSubmitInput === next.onSubmitInput
    && prev.onRetry === next.onRetry
    && prev.onApprove === next.onApprove
    && prev.onReject === next.onReject
    && prev.onReassign === next.onReassign
    // Without this, switching to/from the last worker (where onAdvance flips
    // undefined↔defined) keeps a stale value and the "→ 다음" label desyncs.
    && prev.onAdvance === next.onAdvance;
});

/* ═══ Legacy export for WorkerPanel sidebar (compact) ═══ */
export { WorkerReportBlock as WorkerCard };
