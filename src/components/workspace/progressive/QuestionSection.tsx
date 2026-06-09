'use client';

/**
 * QuestionSection — the question-asking UI lifted out of ProgressiveFlow:
 * the first-time onboarding note, the team-ready "questions are optional now"
 * note, and the QuestionCard itself. Parent owns questionRef (passed in) and
 * the onAnswer / onDeployWorkers handlers. Behaviour-preserving.
 */

import type { RefObject } from 'react';
import { motion } from 'framer-motion';
import { useLocale } from '@/hooks/useLocale';
import { EASE } from './shared/constants';
import { QuestionCard } from './shared/QuestionCard';
import type { FlowQuestion, FlowAnswer, WorkerTask } from '@/stores/types';

interface QuestionSectionProps {
  curQ: FlowQuestion | null;
  busy: boolean;
  phase: string;
  round: number;
  answers: FlowAnswer[];
  deployPhase: string;
  workers: WorkerTask[];
  onAnswer: (value: string) => void;
  onDeployWorkers: () => void;
  questionRef: RefObject<HTMLDivElement | null>;
}

export function QuestionSection({
  curQ, busy, phase, round, answers, deployPhase, workers, onAnswer,
  onDeployWorkers, questionRef,
}: QuestionSectionProps) {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  return (
          <div ref={questionRef}>
            {/* First-time onboarding — explains *why* we're asking the user
                questions and what happens after. Shown only on the very
                first question of a session; disappears once the user has
                answered anything. */}
            {curQ && !busy && phase === 'conversing' && round === 0 && answers.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: EASE, delay: 0.15 }}
                className="flex items-start gap-2.5 px-4 py-3 mb-4 rounded-xl bg-[var(--accent)]/[0.05] border border-[var(--accent)]/20"
              >
                <span className="text-[15px] shrink-0 leading-none mt-0.5">💬</span>
                <p className="text-[12.5px] text-[var(--text-secondary)] leading-[1.55]">
                  {locale === 'ko'
                    ? <>질문 <strong className="text-[var(--text-primary)]">두세 개</strong>만 답해주시면, 어울리는 <strong className="text-[var(--text-primary)]">팀을 꾸려서</strong> 분석을 시작해요.</>
                    : <>Just <strong className="text-[var(--text-primary)]">a couple of questions</strong> and we&apos;ll <strong className="text-[var(--text-primary)]">assemble the right team</strong> to start.</>}
                </p>
              </motion.div>
            )}
            {/* Once the team is assembled, further questions are OPTIONAL
                refinements — make that explicit so the user doesn't feel
                they must answer before deploying. The 출항 CTA sits above. */}
            {curQ && !busy && phase === 'conversing' && deployPhase === 'ready' && workers.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: EASE }}
                className="flex items-center gap-2 px-3.5 py-2.5 mb-3 rounded-xl bg-[var(--bg)] border border-dashed border-[var(--border)]"
              >
                <span className="text-[13px] shrink-0 leading-none">✓</span>
                <p className="text-[12px] text-[var(--text-secondary)] leading-[1.5]">
                  {locale === 'ko'
                    ? <>팀은 이미 준비됐어요. <strong className="text-[var(--text-primary)]">위에서 바로 시작</strong>해도 되고, 아래 질문으로 더 다듬어도 돼요 <span className="text-[var(--text-tertiary)]">(선택)</span>.</>
                    : <>Your team is ready. <strong className="text-[var(--text-primary)]">Start now from above</strong>, or refine further with the question below <span className="text-[var(--text-tertiary)]">(optional)</span>.</>}
                </p>
              </motion.div>
            )}
            {curQ && !busy && phase === 'conversing' && (() => {
              const teamReady = deployPhase === 'ready' && workers.length > 0;
              const meta = teamReady
                ? L(`${answers.length + 1}번째 질문 · 선택`, `Question ${answers.length + 1} · optional`)
                : L(`${answers.length + 1}번째 질문`, `Question ${answers.length + 1}`);
              return (
                <QuestionCard
                  key={curQ.id}
                  question={curQ}
                  onAnswer={onAnswer}
                  disabled={busy}
                  locale={locale}
                  meta={meta}
                  onSkip={teamReady ? onDeployWorkers : undefined}
                  skipLabel={teamReady ? L('건너뛰고 팀 투입', 'Skip & start') : undefined}
                />
              );
            })()}
          </div>
  );
}
