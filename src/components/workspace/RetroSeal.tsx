'use client';

/**
 * RetroSeal — 회고 봉인 온보딩 (베팅③ 1-A, W2).
 *
 * A first-session taste of the seal→settle loop, run on an ALREADY-KNOWN past
 * decision so the user doesn't wait 2–3 weeks to experience the moat. Three steps,
 * rendered INSIDE HeroFlow (never a new route):
 *
 *   1. lean    — the past decision + the user's own call, one line. Sealed via
 *                buildEarlyContract's `lean` path (authored:'user' — real self,
 *                never a borrowed rope), with check_in_at=TODAY so the settle is
 *                immediately due, and origin:'retro' so it is fully isolated from
 *                the 자차표 (summarizeRecord skips origin==='retro' — C1/P0).
 *   2. outcome — a paragraph of what actually happened. Reused settle-align
 *                (alignOutcome) reads it against the sealed lean and proposes a
 *                NON-BINDING draft verdict, PRE-HIGHLIGHTED only (verdict_via:
 *                'ai_draft' in spirit — the user still taps to commit in step 3).
 *   3. settle  — the real <SettlementModal>. The user self-grades (발생/회피/부분)
 *                and sees the 판단 액자 (그때 생각 ↔ 실제). The draft is a dashed
 *                pre-highlight, never a selected verdict.
 *
 * Spine (CLAUDE.md zero-judgment):
 *  - The lean is the user's OWN words (authored:'user'), never prefilled (rule 1).
 *  - The AI draft is a reading aid, pre-highlighted only; reality's judge is the
 *    user's own tap (C5, rule 2 — no AI verdict shown as the conclusion).
 *  - The whole entry is a demo-equal option, never a forced gate (rule 4).
 *
 * All user/LLM text renders through JSX → React auto-escapes (XSS appendix).
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Anchor, ArrowRight, Check, History } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import { useProjectStore } from '@/stores/useProjectStore';
import { buildEarlyContract } from '@/lib/decision-contract';
import { deriveReceiptFields } from '@/components/projects/JudgmentReceipt';
import { alignOutcome, type DraftVerdict } from '@/lib/settle-align';
import { SettlementModal } from '@/components/projects/SettlementModal';
import { track } from '@/lib/analytics';
import type { Project } from '@/stores/types';
import { EASE } from './progressive/shared/constants';

const MAX_LEAN = 140;
const MAX_OUTCOME = 1200;

type Step = 'lean' | 'outcome' | 'settle';

export function RetroSeal({ onExit, onRealSeal }: {
  /** Return to the idle workspace (skip / done / close). */
  onExit: () => void;
  /** [C3] 실전 온램프 — 회고 정산이 닫히면 완료 화면이 이 링크 하나를 제공한다:
   *  "이제 진짜 …". 눈먼(결과 모르는) 새 결정을 시작한다(setCurrentProjectId(null)
   *  + 메인 입력으로). 미전달 시 온램프는 onExit로 폴백(연습만 닫고 워크스페이스). */
  onRealSeal?: () => void;
}) {
  const locale = useLocale();
  const ko = locale === 'ko';
  const L = (k: string, e: string) => (ko ? k : e);

  const createProject = useProjectStore((s) => s.createProject);
  const updateProject = useProjectStore((s) => s.updateProject);
  // Read the live project back from the store so the SettlementModal sees the
  // freshly-sealed contract (it grades against project.decision_contract).
  const projects = useProjectStore((s) => s.projects);

  const [step, setStep] = useState<Step>('lean');
  const [lean, setLean] = useState('');
  const [outcome, setOutcome] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [aligning, setAligning] = useState(false);
  const [draftVerdicts, setDraftVerdicts] = useState<Record<string, DraftVerdict>>({});

  const project: Project | null = projectId ? projects.find((p) => p.id === projectId) ?? null : null;

  const leanTrimmed = lean.trim();
  const outcomeTrimmed = outcome.trim();

  // ── Step 1 → seal the retro contract (lean, check-in TODAY, origin:'retro'). ──
  function sealRetro() {
    if (!leanTrimmed) return;
    const name = leanTrimmed.slice(0, 40);
    const pid = createProject(name);
    const now = Date.now();
    // check_in_at = TODAY → contractStatus.checkInDue is immediately true (local
    // date granularity), so step 3's SettlementModal opens right away.
    const early = buildEarlyContract(
      pid,
      { lean: leanTrimmed, check_in_at: new Date(now).toISOString() },
      now,
    );
    if (!early) return;
    // Attach a receipt so the 판단 액자 has the user's seal-time line (그때 생각).
    const rf = deriveReceiptFields(early.predicates, name);
    updateProject(pid, {
      decision_contract: {
        ...early,
        origin: 'retro',
        judgment_receipt: {
          ...rf,
          human_judgment: leanTrimmed,
        },
      },
    });
    setProjectId(pid);
    track('retro_seal_started', {});
    setStep('outcome');
  }

  // ── Step 2 → read the outcome against the sealed lean, propose a draft. ──
  async function readOutcome() {
    if (!project?.decision_contract || !outcomeTrimmed) return;
    const preds = Array.isArray(project.decision_contract.predicates)
      ? project.decision_contract.predicates
      : [];
    // Persist the outcome narrative into the receipt (돌아와서, for the 판단 액자).
    updateProject(project.id, {
      decision_contract: {
        ...project.decision_contract,
        judgment_receipt: {
          ...(project.decision_contract.judgment_receipt ?? {
            real_question: '',
            unverified_assumption: '',
            human_only: '',
            human_judgment: leanTrimmed,
          }),
          what_happened: outcomeTrimmed,
          settled_at: new Date().toISOString(),
        },
      },
    });
    setAligning(true);
    try {
      const drafts = await alignOutcome(preds, outcomeTrimmed, ko ? 'ko' : 'en');
      const map: Record<string, DraftVerdict> = {};
      for (const [id, d] of Object.entries(drafts)) map[id] = d.verdict;
      setDraftVerdicts(map);
    } catch {
      // A reading-aid failure is silent — the manual taps in step 3 still work.
      setDraftVerdicts({});
    } finally {
      setAligning(false);
      setStep('settle');
    }
  }

  // ═══ STEP 3: the real SettlementModal (user self-grades) ═══
  if (step === 'settle' && project) {
    return (
      <SettlementModal
        project={project}
        draftVerdicts={draftVerdicts}
        onClose={onExit}
        onRealSeal={() => {
          // [C4/활성화] retro loop → real seal handoff. Fire the transition
          // event first (item 10), then hand off to the real-decision entry.
          track('retro_to_real_onramp_clicked', {});
          (onRealSeal ?? onExit)();
        }}
      />
    );
  }

  return (
    <div className="relative max-w-xl mx-auto px-5 md:px-6 pt-8 md:pt-16 pb-16">
      {/* Practice framing — this is a rehearsal on a KNOWN outcome, said plainly. */}
      <div className="flex items-center gap-3 mb-8 text-[var(--text-tertiary)]/60">
        <div className="h-px flex-1 bg-[var(--border-subtle)]" />
        <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium tracking-wide uppercase">
          <History size={12} />
          {L('연습 · 지난 결정으로', 'Practice · on a past decision')}
        </span>
        <div className="h-px flex-1 bg-[var(--border-subtle)]" />
      </div>

      <AnimatePresence mode="wait">
        {step === 'lean' && (
          <motion.div
            key="lean"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-6 py-7 shadow-sm">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-[var(--ai)] text-[var(--accent)] mb-4">
                <Anchor size={20} />
              </div>
              <h2 className="text-[19px] font-bold leading-snug text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-display)' }}>
                {L('이미 끝난 지난 결정 하나, 그때 어떻게 판단했어요?', 'A past decision that already played out — what was your call at the time?')}
              </h2>
              <p className="text-[12.5px] text-[var(--text-tertiary)] mt-2 leading-snug">
                {L('가짜 데모가 아니라, 당신이 실제로 했던 지난 결정이에요. 이미 결과를 아는 결정으로 “기록→결과 확인” 흐름을 한 번 연습해 봅니다.',
                   "Not a demo — your own real past decision, just one whose outcome you already know. Let's run the seal→settle loop once, now.")}
              </p>

              <textarea
                autoFocus
                value={lean}
                maxLength={MAX_LEAN}
                onChange={(e) => setLean(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sealRetro(); }
                }}
                rows={2}
                placeholder={L('예: 그 제안 거절했다 — 조건이 안 맞아 보여서', "e.g. I turned down that offer — the terms didn't look right")}
                className="mt-5 w-full resize-none rounded-xl border border-[var(--border-subtle)] bg-[var(--bg)] px-3.5 py-3 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--primary)] focus:outline-none"
              />

              <div className="mt-6 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={onExit}
                  className="text-[13px] font-medium text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] cursor-pointer"
                >
                  {L('그만두기', 'Skip')}
                </button>
                <button
                  type="button"
                  onClick={sealRetro}
                  disabled={!leanTrimmed}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13.5px] font-semibold transition-opacity ${
                    leanTrimmed
                      ? 'bg-[var(--primary)] text-[var(--bg)]'
                      : 'cursor-default bg-[var(--bg)] text-[var(--text-tertiary)] opacity-50'
                  }`}
                >
                  {L('기록하고 계속', 'Record and continue')}
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {step === 'outcome' && (
          <motion.div
            key="outcome"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-6 py-7 shadow-sm">
              {/* Echo the sealed lean so the user sees what they're settling against. */}
              {leanTrimmed && (
                <p className="text-[12px] text-[var(--text-secondary)] line-clamp-2 rounded-lg bg-[var(--accent)]/[0.04] px-3 py-2 mb-4">
                  {leanTrimmed}
                </p>
              )}
              <h2 className="text-[19px] font-bold leading-snug text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-display)' }}>
                {L('그래서, 어떻게 됐어요?', 'So, how did it go?')}
              </h2>
              <p className="text-[12.5px] text-[var(--text-tertiary)] mt-2 leading-snug">
                {L('실제로 어떻게 흘러갔는지 편하게 한 문단 적어주세요. 이걸 읽고 미리 짚어드릴게요 — 최종 확인은 다음 화면에서 직접 하세요.',
                   "Write a paragraph on how it actually went. We'll read it and pre-mark our read — you make the final call on the next screen.")}
              </p>

              <textarea
                autoFocus
                value={outcome}
                maxLength={MAX_OUTCOME}
                onChange={(e) => setOutcome(e.target.value)}
                rows={4}
                placeholder={L('무엇이 어떻게 되었나요?', 'What happened?')}
                className="mt-5 w-full resize-none rounded-xl border border-[var(--border-subtle)] bg-[var(--bg)] px-3.5 py-3 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--primary)] focus:outline-none"
              />

              <div className="mt-6 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={onExit}
                  className="text-[13px] font-medium text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] cursor-pointer"
                >
                  {L('그만두기', 'Skip')}
                </button>
                <button
                  type="button"
                  onClick={readOutcome}
                  disabled={!outcomeTrimmed || aligning}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13.5px] font-semibold transition-opacity ${
                    outcomeTrimmed && !aligning
                      ? 'bg-[var(--primary)] text-[var(--bg)]'
                      : 'cursor-default bg-[var(--bg)] text-[var(--text-tertiary)] opacity-50'
                  }`}
                >
                  {aligning
                    ? L('읽는 중…', 'Reading…')
                    : <>{L('현실과 맞춰보기', 'Check against reality')}<Check size={15} /></>}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
