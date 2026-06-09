'use client';

/**
 * CompletionView — the final/complete phase view lifted out of ProgressiveFlow.
 * Renders the version chip, branch-in-progress banner, completion moment,
 * FinalCard, the collapsible team-dissent block, and the start-new / revise /
 * re-review actions. Pure presentation: the parent keeps the finalRef wrapper
 * and the  guard; every value arrives as a prop. Markup is byte-identical.
 */

import type { Dispatch, SetStateAction } from 'react';
import { motion } from 'framer-motion';
import { History, GitBranch, Check, ArrowRight, Wand2 } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import { useProgressiveStore } from '@/stores/useProgressiveStore';
import type { ProgressiveState } from '@/stores/useProgressiveStore';
import { FinalCard } from './FinalCard';
import { EASE } from './shared/constants';
import type { Draft, DMConcern, MixResult, DMFeedbackResult, ProgressiveSession } from '@/stores/types';
import type { DebateResult } from '@/lib/progressive-engine';

interface CompletionViewProps {
  final_: string;
  finalMix: MixResult | null;
  mix: MixResult | null;
  dmFb: DMFeedbackResult | null;
  debateResult: DebateResult | null;
  session: ProgressiveSession;
  store: ProgressiveState;
  activeDraft: Draft | undefined;
  activeDraftId: string | null;
  drafts: Draft[];
  draftIsOnBranch: boolean;
  justReactivatedFromBranch: boolean;
  setJustReactivatedFromBranch: Dispatch<SetStateAction<boolean>>;
  setDrawerOpen: Dispatch<SetStateAction<boolean>>;
  setIterationOpen: Dispatch<SetStateAction<boolean>>;
  setIterationDirective: Dispatch<SetStateAction<string>>;
  setShowMix: Dispatch<SetStateAction<boolean>>;
}

export function CompletionView({
  final_, finalMix, mix, dmFb, debateResult, session, store, activeDraft,
  activeDraftId, drafts, draftIsOnBranch, justReactivatedFromBranch,
  setJustReactivatedFromBranch, setDrawerOpen, setIterationOpen,
  setIterationDirective, setShowMix,
}: CompletionViewProps) {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  return (
    <>
            {/* Version chip + history toggle — subtle header */}
            {activeDraft && (
              <div className="flex items-center justify-end gap-2 pb-2">
                <button
                  onClick={() => setDrawerOpen(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[11px] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                  title={L('버전 히스토리 열기', 'Open version history')}
                >
                  <History className="w-3 h-3" />
                  <span className="font-semibold">{activeDraft.version_label}</span>
                  <span className="text-[var(--text-tertiary)]">· {drafts.length}{L('개', '')}</span>
                </button>
              </div>
            )}

            {/* Branch-in-progress banner */}
            {draftIsOnBranch && activeDraft && (
              <div className="flex items-start justify-between gap-2 px-3 py-2 mb-2 rounded-lg bg-[var(--gold-muted)]/30 border border-[var(--accent-light)]/30">
                <div className="flex items-start gap-2 text-[12px] text-[var(--text-primary)]">
                  <GitBranch className="w-3.5 h-3.5 text-[var(--accent)] mt-0.5" />
                  <div>
                    <div>
                      {L('현재', 'Currently on')}{' '}
                      <span className="font-semibold">{activeDraft.version_label}</span>
                      {L('에서 수정 중', ' (revision)')}
                    </div>
                    {justReactivatedFromBranch && (
                      <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                        {L('이전 결과는 버전 히스토리에 그대로 남아있습니다.', 'Previous results remain in version history.')}
                      </div>
                    )}
                  </div>
                </div>
                {drafts.length > 0 && (() => {
                  // "Latest main line" = draft whose version_label has the fewest dots
                  // (shallowest branch level), then latest created among those.
                  const mainLineCandidates = [...drafts].sort((a, b) => {
                    const aDots = (a.version_label.match(/\./g) || []).length;
                    const bDots = (b.version_label.match(/\./g) || []).length;
                    if (aDots !== bDots) return aDots - bDots;
                    return (b.created_at || '').localeCompare(a.created_at || '');
                  });
                  const latestMain = mainLineCandidates[0];
                  if (!latestMain || latestMain.id === activeDraft.id) return null;
                  return (
                    <button
                      onClick={() => {
                        store.setActiveDraft(latestMain.id);
                        setJustReactivatedFromBranch(false);
                      }}
                      className="text-[11px] text-[var(--accent)] hover:underline shrink-0"
                    >
                      {L('최신으로 돌아가기', 'Back to latest')}
                    </button>
                  );
                })()}
              </div>
            )}

            {/* Completion moment */}
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease: EASE }}
              className="flex flex-col items-center justify-center gap-2 py-6">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--gradient-gold)' }}>
                <Check size={16} className="text-white" />
              </div>
              <p className="text-[16px] font-semibold text-[var(--text-primary)]">
                {dmFb && dmFb.concerns.filter((c: DMConcern) => c.applied).length > 0
                  ? locale === 'ko' ? `피드백 ${dmFb.concerns.filter((c: DMConcern) => c.applied).length}건이 반영된 최종 문서입니다` : `Final document with ${dmFb.concerns.filter((c: DMConcern) => c.applied).length} feedback item(s) applied`
                  : L('최종 문서가 완성되었습니다', 'Your document is complete')}
              </p>
              <p className="text-[13px] text-[var(--text-tertiary)]">
                {L('아래에서 복사하거나, 새 프로젝트를 시작할 수 있어요', 'Copy below or start a new project')}
              </p>
            </motion.div>
            <FinalCard
              content={final_}
              mix={finalMix}
              sessionId={session?.id ?? null}
              releasedContent={(() => {
                const rid = session?.released_draft_id;
                if (!rid) return null;
                const r = drafts.find((d) => d.id === rid);
                if (!r || r.id === activeDraftId) return null;
                return r.final_text;
              })()}
              releasedLabel={(() => {
                const rid = session?.released_draft_id;
                if (!rid) return null;
                const r = drafts.find((d) => d.id === rid);
                if (!r || r.id === activeDraftId) return null;
                return r.version_label;
              })()}
            />

            {/* Debate result — persisted, collapsible */}
            {debateResult && (
              <motion.details initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] group">
                <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer text-[12px] font-semibold text-[var(--text-secondary)] select-none">
                  <span className="text-[14px]">{'⚔️'}</span>
                  {L('팀 내 반론', 'Team Dissent')}
                  <span className={`ml-auto text-[9px] px-2 py-0.5 rounded-full font-medium ${
                    debateResult.severity === 'critical' ? 'bg-red-100 text-red-600' : debateResult.severity === 'important' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
                  }`}>{debateResult.severity}</span>
                </summary>
                <div className="px-4 pb-4 space-y-2 text-[13px] text-[var(--text-primary)] leading-relaxed">
                  <p>{debateResult.challenge}</p>
                  {debateResult.weakestClaim && <p className="text-[var(--text-secondary)]"><strong>{debateResult.targetAgent}</strong>{L('의 약점: ', "'s weakness: ")}{debateResult.weakestClaim}</p>}
                  {debateResult.alternativeView && <p className="text-[var(--text-secondary)] italic">{debateResult.alternativeView}</p>}
                </div>
              </motion.details>
            )}

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="pt-8 pb-16">
              <p className="text-[13px] text-[var(--text-tertiary)] text-center mb-1.5">{L('복사해서 바로 사용하세요.', 'Copy and use it right away.')}</p>
              <p className="text-[11px] text-[var(--text-tertiary)]/80 text-center mb-6">{L('새 프로젝트를 시작해도 이 결과는 저장돼요 — 언제든 다시 열 수 있어요.', 'Starting a new project keeps this one saved — you can reopen it anytime.')}</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center flex-wrap">
                <button onClick={() => { useProgressiveStore.setState({ currentSessionId: null }); window.location.reload(); }}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-white text-[13px] font-semibold cursor-pointer"
                  style={{ background: 'var(--gradient-gold)' }}>{L('새 프로젝트 시작', 'Start New Project')} <ArrowRight size={12} /></button>
                <button onClick={() => { setIterationOpen(true); setIterationDirective(''); }}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-[13px] font-semibold text-[var(--text-primary)] border border-[var(--accent)]/30 bg-[var(--gold-muted)]/30 hover:bg-[var(--gold-muted)]/50 cursor-pointer transition-colors">
                  <Wand2 size={13} className="text-[var(--accent)]" /> {L('항해장에게 수정 요청', 'Ask Navigator to revise')}
                </button>
                <button onClick={() => { if (mix) { store.setFinalDeliverable(null as unknown as string); store.setDMFeedback(null as unknown as import('@/stores/types').DMFeedbackResult); store.setMix(null as unknown as MixResult); setShowMix(true); } }}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-[13px] font-medium text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:border-[var(--accent)]/30 cursor-pointer transition-colors">
                  {L('이해관계자 검증 다시 하기', 'Re-run stakeholder review')}
                </button>
              </div>
            </motion.div>
    </>
  );
}
