'use client';

import { useEffect, useState } from 'react';
import { track, trackError } from '@/lib/analytics';
import { usePersonaStore } from '@/stores/usePersonaStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PersonaCard } from '@/components/tools/PersonaCard';
import { PersonaForm } from '@/components/tools/PersonaForm';
import { FeedbackRequest } from '@/components/tools/FeedbackRequest';
import { FeedbackResult } from '@/components/tools/FeedbackResult';
import { callLLMJson } from '@/lib/llm';
import { toDisplayError, isAuthError } from '@/lib/error-display';
import { buildReviewPrompt } from '@/lib/review-prompt';
import { getCurrentLanguage } from '@/lib/i18n';
import { useAgentStore } from '@/stores/useAgentStore';
import { useProgressiveStore } from '@/stores/useProgressiveStore';
import type { Persona, FeedbackRecord, RehearsalResult, HiddenAssumption, DiscussionMessage } from '@/stores/types';
import { useHandoffStore } from '@/stores/useHandoffStore';
import { useAccuracyStore } from '@/stores/useAccuracyStore';
import { NextStepGuide } from '@/components/ui/NextStepGuide';
import { LocaleLink } from '@/components/ui/LocaleLink';
import { Plus, Pencil, Trash2, Loader2, Users, RotateCcw, Check, AlertTriangle, MessageCircleMore } from 'lucide-react';
import { useReframeStore } from '@/stores/useReframeStore';
import { useRecastStore } from '@/stores/useRecastStore';
import { LoadingSteps } from '@/components/ui/LoadingSteps';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { playSuccessTone, resumeAudioContext } from '@/lib/audio';
import { ContextChainBlock } from './ContextChainBlock';
import { NavigatorInline } from '@/components/workspace/NavigatorInline';
import { buildReframeContext, buildRecastContext } from '@/lib/context-chain';
// Dynamic imports for heavy modules (loaded on-demand, not at initial render)
const lazyEvalEngine = () => import('@/lib/eval-engine');
const lazyVitality = () => import('@/lib/judgment-vitality');
import { recommendBlindSpotPersona } from '@/lib/auto-persona';
import type { BlindSpotRecommendation } from '@/lib/auto-persona';
import { useLocale } from '@/hooks/useLocale';
import { generateId } from '@/lib/uuid';
import {
  buildSyntheticPerspectiveSet,
  summarizeSyntheticPerspectiveSet,
  syntheticPerspectiveSystem,
} from '@/lib/synthetic-perspective';

/* ────────────────────────────────────────────
   Synthesis & discussion prompts (locale-selected)
   ──────────────────────────────────────────── */

const DISCUSSION_SYSTEM_KO = `이해관계자들이 자료를 검토한 후 회의실에서 토론합니다.
각 이해관계자의 개별 피드백을 보고, 서로의 의견에 반응하는 대화를 시뮬레이션하세요.

규칙:
- 첫 발화는 영향력이 가장 높은 이해관계자가 시작
- 각 발화는 다른 이해관계자의 구체적 발언에 반응해야 함
- 단순 동의("맞습니다")보다 이유나 관점 차이를 드러내기
- 영향력이 높은 이해관계자의 발언이 대화를 주도
- 6~10개 메시지로 핵심 쟁점만 다루기
- 각 이해관계자의 말투와 관심사를 유지
- 모든 이해관계자가 최소 2번씩 발언

응답 형식 (JSON만 출력):
{
  "messages": [
    {
      "persona_id": "해당 페르소나 ID",
      "message": "이 사람의 말투로 된 발언. 구체적이고 자연스럽게.",
      "reacting_to": "반응 대상 persona_id 또는 null (첫 발언)",
      "type": "agreement 또는 disagreement 또는 elaboration 또는 question"
    }
  ],
  "key_takeaway": "토론의 핵심 결론 1문장"
}

한국어로 작성하세요. 반드시 JSON만 응답하세요.`;

const DISCUSSION_SYSTEM_EN = `The stakeholders review the material and then discuss it in a meeting room.
Look at each stakeholder's individual feedback and simulate a conversation where they react to one another's opinions.

Rules:
- The first to speak is the highest-influence stakeholder
- Each utterance must react to a specific remark by another stakeholder
- Reveal reasons or differences in perspective rather than plain agreement ("I agree")
- High-influence stakeholders' remarks drive the conversation
- Cover only the key issues in 6-10 messages
- Keep each stakeholder's tone and interests consistent
- Every stakeholder speaks at least twice

Response format (output JSON only):
{
  "messages": [
    {
      "persona_id": "the persona's ID",
      "message": "an utterance in this person's voice. Concrete and natural.",
      "reacting_to": "the persona_id being reacted to, or null (first utterance)",
      "type": "agreement or disagreement or elaboration or question"
    }
  ],
  "key_takeaway": "the discussion's core conclusion in one sentence"
}

Write in English. Respond with JSON only.`;

function getDiscussionSystem(): string {
  return getCurrentLanguage() === 'ko' ? DISCUSSION_SYSTEM_KO : DISCUSSION_SYSTEM_EN;
}

/// Unified review prompt (shared with web app)
function buildPersonaReview(persona: Persona, documentText: string, contextText: string, perspective?: string, intensity?: string): { system: string; user: string } {
  const agent = useAgentStore.getState().getAgent(persona.id) || undefined;
  return buildReviewPrompt(
    { name: persona.name, role: persona.role, personality: persona.communication_style },
    documentText,
    contextText,
    { mode: 'quick', locale: getCurrentLanguage(), agent, perspective, intensity },
  );
}

/// Map ReviewFeedback → RehearsalResult for backward compat
function reviewToRehearsal(review: Record<string, unknown>, personaId: string): RehearsalResult {
  const concerns = (review.concerns as Array<Record<string, string>> || []);
  return {
    persona_id: personaId,
    overall_reaction: (review.first_reaction as string) || '',
    praise: (review.good_parts as string[]) || [],
    concerns: concerns.map(c =>
      typeof c === 'string' ? c : `${c.text || ''}${c.fix_suggestion ? ` → ${c.fix_suggestion}` : ''}`
    ),
    first_questions: (review.would_ask as string[]) || [],
    classified_risks: concerns
      .filter(c => typeof c === 'object' && c.severity === 'critical')
      .map(c => ({ text: (c.text as string) || '', category: 'critical' as const })),
    failure_scenario: (review.failure_scenario as string) || '',
    untested_assumptions: (review.untested_assumptions as string[]) || [],
    wants_more: [],
    approval_conditions: review.approval_condition ? [review.approval_condition as string] : [],
  };
}

/* ────────────────────────────────────────────
   Phase-based flow (matches Reframe/Recast pattern)
   setup → running → results
   ──────────────────────────────────────────── */

type RehearsalPhase = 'setup' | 'running' | 'results';

interface RehearseStepProps {
  onNavigate: (step: string) => void;
}

export function RehearseStep({ onNavigate }: RehearseStepProps) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const { personas, feedbackHistory, loadData, createPersona, updatePersona, deletePersona, addFeedbackRecord, updateFeedbackRecord, getPersona, seedDefaultPersonas } = usePersonaStore();
  const { loadSettings } = useSettingsStore();
  const { loadRatings } = useAccuracyStore();
  const { handoff, clearHandoff } = useHandoffStore();
  const { items: reframeItems, loadItems: loadReframe } = useReframeStore();
  const { items: recastItems, loadItems: loadRecast } = useRecastStore();

  const [phase, setPhase] = useState<RehearsalPhase>('setup');
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [discussionLoading, setDiscussionLoading] = useState(false);
  const [discussionError, setDiscussionError] = useState('');
  const [latestFeedback, setLatestFeedback] = useState<FeedbackRecord | null>(null);
  const [handoffContent, setHandoffContent] = useState<string>('');
  const [handoffTitle, setHandoffTitle] = useState<string>('');
  const [pendingProjectId, setPendingProjectId] = useState<string | undefined>();
  const [autoPersonaIds, setAutoPersonaIds] = useState<string[]>([]);
  const [showPersonaForm, setShowPersonaForm] = useState(false);
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
  const [managingPersonas, setManagingPersonas] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');
  const [lastFeedbackData, setLastFeedbackData] = useState<{ documentTitle: string; documentText: string; personaIds: string[]; perspective: string; intensity: string } | null>(null);
  const [blindSpotRec, setBlindSpotRec] = useState<BlindSpotRecommendation | null>(null);
  const [blindSpotDismissed, setBlindSpotDismissed] = useState(false);
  const [requestedRecordId, setRequestedRecordId] = useState<string | null>(null);
  const [requestedRealityCheckId, setRequestedRealityCheckId] = useState<string | null>(null);
  const [pendingPersonaDelete, setPendingPersonaDelete] = useState<Persona | null>(null);

  // Compute blind spot recommendation
  useEffect(() => {
    const existingRoles = personas.map(p => p.role);
    const rec = recommendBlindSpotPersona(existingRoles);
    setBlindSpotRec(rec);
  }, [personas]);

  useEffect(() => {
    loadData();
    loadSettings();
    loadRatings();
    loadReframe();
    loadRecast();
  }, [loadData, loadSettings, loadRatings, loadReframe, loadRecast]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRequestedRecordId(params.get('record'));
    setRequestedRealityCheckId(params.get('check'));
  }, []);

  // Local records are available synchronously, while signed-in records can
  // arrive after the Supabase merge. Keep the request armed until the exact
  // rehearsal appears instead of falling back to the newest history item.
  useEffect(() => {
    if (!requestedRecordId) return;
    const record = feedbackHistory.find((item) => item.id === requestedRecordId);
    if (!record) return;
    setLatestFeedback(record);
    setPhase('results');
    setRequestedRecordId(null);
  }, [feedbackHistory, requestedRecordId]);

  // Seed default example personas on first use
  useEffect(() => {
    seedDefaultPersonas();
  }, [seedDefaultPersonas]);

  // Boss에서 넘어온 경우 reviewer 자동 추가 (session에서 읽기)
  useEffect(() => {
    const session = useProgressiveStore.getState().currentSession();
    const reviewerId = session?.reviewer_agent_id;
    if (reviewerId && !autoPersonaIds.includes(reviewerId)) {
      setAutoPersonaIds(prev => [...prev, reviewerId]);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle handoff from previous step
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (handoff) {
      setHandoffContent(handoff.content || '');
      setHandoffTitle(`${handoff.from === 'reframe' ? L('문제 재정의', 'Reframe') : handoff.from === 'recast' ? L('실행 설계', 'Recast') : L('리허설', 'Rehearse')} ${L('결과물', 'result')}`);
      setPendingProjectId(handoff.projectId);
      if (handoff.autoPersonaIds && handoff.autoPersonaIds.length > 0) {
        setAutoPersonaIds(handoff.autoPersonaIds);
      }
      setPhase('setup');
      clearHandoff();
    }
  }, []);

  // ── Persona management ──
  const handleSavePersona = (data: Partial<Persona>) => {
    if (editingPersona) {
      updatePersona(editingPersona.id, data);
    } else {
      createPersona(data);
    }
    setShowPersonaForm(false);
    setEditingPersona(null);
  };

  // ── Feedback submit (setup → running → results) ──
  const handleFeedbackSubmit = async (data: {
    documentTitle: string;
    documentText: string;
    personaIds: string[];
    perspective: string;
    intensity: string;
  }) => {
    setPhase('running');
    setFeedbackLoading(true);
    setFeedbackError('');
    setLastFeedbackData(data);
    try {
      // ── Parallel persona feedback (unified review-prompt) ──
      const validPersonas: Array<{ persona: Persona; system: string; user: string }> = [];
      for (const personaId of data.personaIds) {
        const persona = getPersona(personaId);
        if (!persona) continue;

        // Build context from project chain
        let contextText = data.documentText.slice(0, 300);
        const projectId = pendingProjectId;
        if (projectId) {
          const relReframe = reframeItems
            .filter(d => d.project_id === projectId && d.status === 'done' && d.analysis)
            .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))[0];
          const relRecast = recastItems
            .filter(o => o.project_id === projectId && o.analysis && o.status === 'done')
            .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))[0];
          if (relRecast) {
            const rc = buildRecastContext(relRecast);
            contextText = JSON.stringify(rc);
            if (relReframe) contextText += '\n' + JSON.stringify(buildReframeContext(relReframe));
          }
        }

        const { system, user } = buildPersonaReview(persona, data.documentText, contextText);
        validPersonas.push({ persona, system, user });
      }

      // Fire all persona calls concurrently
      const settled = await Promise.allSettled(
        validPersonas.map(async ({ persona, system, user }) => {
          const raw = await callLLMJson<Record<string, unknown>>(
            [{ role: 'user', content: user }],
            { system, maxTokens: 2000, shape: { first_reaction: 'string', good_parts: 'array', concerns: 'array', approval_condition: 'string' } }
          );
          return reviewToRehearsal(raw, persona.id);
        })
      );

      const results: RehearsalResult[] = [];
      for (const outcome of settled) {
        if (outcome.status === 'fulfilled') {
          results.push(outcome.value);
        } else if (process.env.NODE_ENV === 'development') {
          console.warn('[rehearse] 페르소나 피드백 실패:', outcome.reason);
        }
      }

      if (results.length === 0) {
        throw new Error(L('모든 페르소나 피드백이 실패했습니다. 다시 시도해주세요.', 'All persona feedback failed. Please try again.'));
      }

      let synthesisOutput: Record<string, unknown> | undefined;
      if (results.length > 1) {
        const feedbackSummary = results.map((r) => {
          const p = getPersona(r.persona_id);
          return `### ${p?.name} (perspective_id: perspective:${r.persona_id})\n${L('질문', 'Questions')}: ${(r.first_questions || []).join('; ')}\n${L('칭찬', 'Praise')}: ${(r.praise || []).join('; ')}\n${L('우려', 'Concerns')}: ${(r.concerns || []).join('; ')}${r.classified_risks ? `\n${L('리스크', 'Risks')}: ${r.classified_risks.map(cr => `[${cr.category}] ${cr.text}`).join('; ')}` : ''}`;
        }).join('\n\n');

        try {
          synthesisOutput = await callLLMJson<Record<string, unknown>>(
            [{ role: 'user', content: feedbackSummary }],
            {
              system: syntheticPerspectiveSystem(getCurrentLanguage()),
              maxTokens: 1800,
              shape: {
                convergent_simulated_concerns: 'array',
                team_contradictions: 'array',
                strongest_dissent: 'object',
                unknowns_that_block_judgment: 'array',
                reality_check_questions: 'array',
              },
            }
          );
        } catch {
          // A failed synthesis must leave explicit unknowns, never a plausible
          // free-text shared conclusion. The typed builder supplies that set.
        }
      }
      const structured_synthesis = buildSyntheticPerspectiveSet({
        setId: `perspective-set:${generateId()}`,
        sourceCaseId: `rehearse-case:${generateId()}`,
        results,
        personas: results.flatMap((result) => {
          const persona = getPersona(result.persona_id);
          return persona ? [persona] : [];
        }),
        synthesisOutput,
      });
      const synthesis = summarizeSyntheticPerspectiveSet(
        structured_synthesis,
        getCurrentLanguage(),
      );

      const recordId = addFeedbackRecord({
        document_title: data.documentTitle || L('제목 없음', 'Untitled'),
        document_text: data.documentText,
        persona_ids: data.personaIds,
        feedback_perspective: data.perspective,
        feedback_intensity: data.intensity,
        results,
        synthesis,
        structured_synthesis,
        project_id: pendingProjectId,
      });

      const record = usePersonaStore.getState().feedbackHistory.find((r) => r.id === recordId);
      if (record) setLatestFeedback(record);
      // Register the rehearsal on the project (recast already does this at
      // creation) — without the ref, /project never lists this leg and the
      // chain's work stays invisible to the seal→settle loop (H1-B2).
      if (pendingProjectId) {
        const { useProjectStore } = await import('@/stores/useProjectStore');
        useProjectStore.getState().addRef(pendingProjectId, {
          tool: 'rehearse',
          itemId: recordId,
          label: data.documentTitle || L('리허설', 'Rehearsal'),
        });
      }
      setPhase('results');
      const criticalCount = results.flatMap(r => (r.classified_risks || []).filter(cr => cr.category === 'critical')).length;
      const unspokenCount = results.flatMap(r => (r.classified_risks || []).filter(cr => cr.category === 'unspoken')).length;
      track('feedback_complete', {
        personas_count: results.length,
        has_synthesis: !!synthesis,
        perspective: data.perspective,
        intensity: data.intensity,
        critical_risks: criticalCount,
        unspoken_risks: unspokenCount,
        total_concerns: results.flatMap(r => r.concerns || []).length,
        total_approval_conditions: results.flatMap(r => r.approval_conditions || []).length,
      });
      // Phase 0: Record rehearsal eval (dynamic import — heavy module)
      if (record) { lazyEvalEngine().then(m => m.recordRehearsalEval(record, usePersonaStore.getState().personas, useAccuracyStore.getState().ratings)); }
      // Vitality: translate approval conditions to plan-level references
      if (record) {
        try {
          const relRecast = recastItems.find(r => r.project_id === pendingProjectId);
          const steps = relRecast?.analysis?.steps || [];
          if (steps.length > 0) {
            const { translateApprovalsToPlan } = await lazyVitality();
            const translated = translateApprovalsToPlan(record, steps, usePersonaStore.getState().personas);
            if (translated.length > 0) {
              const updatedResults = record.results.map(r => ({
                ...r,
                translated_approvals: translated.filter(ta => ta.persona_id === r.persona_id),
              }));
              updateFeedbackRecord(record.id, { results: updatedResults });
              setLatestFeedback((current) => current?.id === record.id ? { ...current, results: updatedResults } : current);
            }
          }
        } catch { /* non-critical */ }
      }
      const { settings } = useSettingsStore.getState();
      if (settings.audio_enabled) {
        resumeAudioContext();
        playSuccessTone(settings.audio_volume);
      }
    } catch (err) {
      trackError('feedback_generate', err);
      const de = toDisplayError(err);
      if (isAuthError(err)) {
        setFeedbackError('LOGIN_REQUIRED');
      } else {
        setFeedbackError(de.message);
      }
      setPhase('setup');
    } finally {
      setFeedbackLoading(false);
    }
  };

  // ── Discussion simulation ──
  const handleStartDiscussion = async () => {
    if (!latestFeedback || latestFeedback.results.length < 2) return;
    setDiscussionError('');
    setDiscussionLoading(true);
    try {
      const personaProfiles = latestFeedback.results.map(r => {
        const p = getPersona(r.persona_id);
        return `## ${p?.name} (ID: ${r.persona_id}, ${p?.role}, ${L('영향력', 'influence')}: ${p?.influence || 'medium'})
${L('성향', 'Traits')}: ${p?.extracted_traits?.join(', ') || ''}
${L('전반적 반응', 'Overall reaction')}: ${r.overall_reaction}
${L('주요 우려', 'Main concerns')}: ${(r.concerns || []).join('; ')}
${L('질문', 'Questions')}: ${(r.first_questions || []).join('; ')}
${L('리스크', 'Risks')}: ${(r.classified_risks || []).map(cr => `[${cr.category}] ${cr.text}`).join('; ')}`;
      }).join('\n\n');

      const discussionResult = await callLLMJson<{ messages: DiscussionMessage[]; key_takeaway: string }>(
        [{ role: 'user', content: personaProfiles }],
        {
          system: getDiscussionSystem(),
          maxTokens: 2500,
          shape: { messages: 'array', key_takeaway: 'string' },
        }
      );

      const updatedRecord: FeedbackRecord = {
        ...latestFeedback,
        discussion: discussionResult.messages,
        discussion_takeaway: discussionResult.key_takeaway,
      };
      setLatestFeedback(updatedRecord);
      updateFeedbackRecord(latestFeedback.id, {
        discussion: discussionResult.messages,
        discussion_takeaway: discussionResult.key_takeaway,
      });
      track('discussion_complete', { message_count: discussionResult.messages.length });
    } catch (err) {
      // CLAUDE.md forbids OS dialogs — surface as an inline banner with retry.
      const de = toDisplayError(err);
      setDiscussionError(L('토론을 생성할 수 없었습니다. ', 'Could not generate discussion. ') + de.message);
    } finally {
      setDiscussionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-bold text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-display)' }}>{L('리허설', 'Rehearse')} <span className="text-[16px] font-normal text-[var(--text-secondary)]" style={{ fontFamily: 'var(--font-display)' }}>| {L('사전 검증', 'Pre-validation')}</span></h1>
        <p className="text-[13px] text-[var(--text-secondary)] mt-1">
          {L('보내기 전에, 받는 사람 입장에서 미리 들어봐요.', 'Before you send it, hear it from the receiver\'s side first.')}
        </p>
        <LocaleLink href="/boss" className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)]">
          <MessageCircleMore size={13} />
          {L('문서 검토가 아니라 팀장과의 1:1 대화를 연습하려면', 'Rehearse a 1:1 manager conversation instead of a document review')}
        </LocaleLink>
        <div className="mt-2">
          <NavigatorInline step="rehearse" />
        </div>
      </div>

      {/* ── History pills (visible in all phases) ── */}
      {feedbackHistory.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {phase !== 'setup' && (
            <button
              onClick={() => { setPhase('setup'); setLatestFeedback(null); }}
              className="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-medium border border-dashed border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] cursor-pointer transition-colors flex items-center gap-1.5"
            >
              <RotateCcw size={11} /> {L('새 리허설', 'New Rehearsal')}
            </button>
          )}
          {[...feedbackHistory].reverse().slice(0, 5).map((record) => (
            <button
              key={record.id}
              onClick={() => { setLatestFeedback(record); setPhase('results'); }}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-medium border cursor-pointer transition-colors ${
                latestFeedback?.id === record.id && phase === 'results'
                  ? 'border-[var(--accent)] bg-[var(--ai)] text-[var(--accent)]'
                  : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border)]'
              }`}
            >
              {record.document_title || L('제목 없음', 'Untitled')}
              <span className="text-[var(--text-tertiary)] ml-1.5">{record.results.length}{L('명', '')}</span>
            </button>
          ))}
        </div>
      )}

      {/* ══════════════ SETUP PHASE ══════════════ */}
      {phase === 'setup' && (
        <div className="space-y-6 animate-fade-in">
          {/* Handoff context confirmation */}
          {handoffContent && (
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--accent)]">
              <Check size={12} /> {handoffTitle || L('이전 단계', 'Previous step')} {L('맥락이 연결되어 있습니다', 'context is connected')}
            </div>
          )}

          {/* Persona management bar — hide when auto-personas are pre-selected */}
          {autoPersonaIds.length === 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={14} className="text-[var(--text-secondary)]" />
                <span className="text-[13px] font-semibold text-[var(--text-primary)]">{L(`${personas.length}명의 이해관계자`, `${personas.length} stakeholder${personas.length === 1 ? '' : 's'}`)}</span>
                {personas.some(p => p.is_example) && (
                  <span className="text-[10px] text-[var(--text-tertiary)]">{L('예시 포함', 'Examples included')}</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setManagingPersonas(!managingPersonas)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-medium border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border)] cursor-pointer transition-colors"
                >
                  <Pencil size={10} className="inline mr-1" />
                  {managingPersonas ? L('접기', 'Collapse') : L('편집', 'Edit')}
                </button>
                <button
                  onClick={() => { setEditingPersona(null); setShowPersonaForm(true); setManagingPersonas(true); }}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-medium border border-[var(--accent)]/30 text-[var(--accent)] hover:bg-[var(--ai)] cursor-pointer transition-colors"
                >
                  <Plus size={10} className="inline mr-1" /> {L('새 페르소나', 'New Persona')}
                </button>
              </div>
            </div>
          )}
          {autoPersonaIds.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--ai)]">
              <Check size={14} className="text-[var(--accent)]" />
              <span className="text-[12px] font-medium text-[var(--ai-fg)]">{L(`실행 설계에서 찾은 이해관계자 ${autoPersonaIds.length}명이 선택되었습니다`, `${autoPersonaIds.length} stakeholder${autoPersonaIds.length === 1 ? '' : 's'} from Recast selected`)}</span>
            </div>
          )}

          {/* Blind spot persona recommendation (Phase 3: Active Adaptation) */}
          {blindSpotRec && !blindSpotDismissed && phase === 'setup' && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={13} className="text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[12px] font-medium text-[var(--text-primary)]">
                      {L(`${blindSpotRec.axis_label} 관점이 아직 탐색되지 않았습니다`, `${blindSpotRec.axis_label} perspective has not been explored yet`)}
                    </p>
                    <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                      {blindSpotRec.why}
                    </p>
                    <button
                      onClick={() => {
                        createPersona({
                          name: blindSpotRec.name,
                          role: blindSpotRec.role,
                          influence: 'high',
                          known_concerns: blindSpotRec.why,
                        });
                        setBlindSpotDismissed(true);
                      }}
                      className="mt-2 px-3 py-1 rounded-lg text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 cursor-pointer transition-colors"
                    >
                      + {L(`${blindSpotRec.name} (${blindSpotRec.role}) 추가`, `Add ${blindSpotRec.name} (${blindSpotRec.role})`)}
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => setBlindSpotDismissed(true)}
                  className="p-0.5 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] cursor-pointer"
                >
                  <Plus size={12} className="rotate-45" />
                </button>
              </div>
            </div>
          )}

          {/* Inline persona form */}
          {showPersonaForm && managingPersonas && (
            <Card>
              <PersonaForm
                persona={editingPersona || undefined}
                onSave={handleSavePersona}
                onCancel={() => { setShowPersonaForm(false); setEditingPersona(null); }}
              />
            </Card>
          )}

          {/* Persona management grid (edit/delete) */}
          {managingPersonas && !showPersonaForm && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {personas.map((p) => (
                <div key={p.id} className="relative group">
                  <PersonaCard persona={p} onClick={() => { setEditingPersona(p); setShowPersonaForm(true); }} />
                  {p.is_example && (
                    <span className="absolute top-2 left-3 px-1.5 py-0.5 rounded text-[9px] font-bold bg-[var(--ai)] text-[var(--accent)]">{L('예시', 'Example')}</span>
                  )}
                  <div className="absolute top-3 right-3 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-10">
                    <button onClick={() => { setEditingPersona(p); setShowPersonaForm(true); }}
                      aria-label={L(`${p.name} 역할 편집`, `Edit ${p.name} role`)}
                      className="flex min-h-11 min-w-11 items-center justify-center bg-[var(--surface)] rounded-lg shadow-sm border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--accent)] cursor-pointer transition-colors">
                      <Pencil size={11} />
                    </button>
                    <button type="button" onClick={() => setPendingPersonaDelete(p)}
                      aria-label={L(`${p.name} 역할 삭제`, `Delete ${p.name} role`)}
                      className="flex min-h-11 min-w-11 items-center justify-center bg-[var(--surface)] rounded-lg shadow-sm border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-red-500 cursor-pointer transition-colors">
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ─── Error ─── */}
          {feedbackError && (
            <div className="flex items-center justify-between gap-2 text-[var(--danger)] text-[13px] bg-[var(--danger)]/10 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} /> <span>{feedbackError}</span>
              </div>
              <button onClick={() => { if (feedbackLoading) return; setFeedbackError(''); if (lastFeedbackData) handleFeedbackSubmit(lastFeedbackData); }} className="shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-medium border border-[var(--danger)]/25 text-[var(--danger)] hover:bg-[var(--danger)]/15 cursor-pointer transition-colors">
                {L('다시 시도', 'Retry')}
              </button>
            </div>
          )}

          {/* FeedbackRequest: document + persona selection + settings + submit */}
          <FeedbackRequest
            personas={personas}
            onSubmit={handleFeedbackSubmit}
            loading={feedbackLoading}
            initialContent={handoffContent}
            initialTitle={handoffTitle}
            initialPersonaIds={autoPersonaIds}
          />
        </div>
      )}

      {/* ══════════════ RUNNING PHASE ══════════════ */}
      {phase === 'running' && (
        <Card>
          <LoadingSteps steps={[
            L('이해관계자가 문서를 읽는 중이에요...', 'Stakeholders are reading the document...'),
            L('잘한 점과 고칠 점을 정리하는 중이에요...', 'Organizing strengths and areas to improve...'),
            L('반영 기준을 확인하는 중이에요...', 'Checking revision criteria...'),
          ]} />
        </Card>
      )}

      {/* ══════════════ RESULTS PHASE ══════════════ */}
      {phase === 'results' && latestFeedback && (
        <div className="space-y-4 animate-fade-in">
          {/* Context chain */}
          {(() => {
            const projectId = latestFeedback.project_id;
            if (!projectId) return null;
            const reframe = reframeItems.find(d => d.project_id === projectId && d.analysis);
            const recast = recastItems.find(o => o.project_id === projectId && o.analysis);
            if (!reframe?.analysis && !recast?.analysis) return null;
            const items = [];
            if (reframe?.analysis?.hidden_assumptions && reframe.analysis.hidden_assumptions.length > 0) {
              items.push({
                label: L('검증되지 않은 가정', 'Unverified assumptions'),
                count: reframe.analysis.hidden_assumptions.length,
                details: reframe.analysis.hidden_assumptions.map((a: HiddenAssumption | string) =>
                  typeof a === 'string' ? a : a.assumption + (a.risk_if_false ? ` → ${a.risk_if_false}` : '')
                ),
                color: 'text-[var(--warning)]',
              });
            }
            if (recast?.analysis?.key_assumptions && recast.analysis.key_assumptions.length > 0) {
              items.push({
                label: L('실행 설계의 핵심 가정', 'Key assumptions from Recast'),
                count: recast.analysis.key_assumptions.length,
                details: recast.analysis.key_assumptions.map(ka => ka.assumption),
              });
            }
            const summary = reframe?.analysis
              ? L(`문제 재정의에서 찾은 핵심 질문: ${reframe.selected_question || reframe.analysis.surface_task}`, `Key question found in Reframe: ${reframe.selected_question || reframe.analysis.surface_task}`)
              : L(`실행 설계의 핵심 가정 ${recast?.analysis?.key_assumptions?.length || 0}건을 이 리허설에서 검증합니다.`, `Validating ${recast?.analysis?.key_assumptions?.length || 0} key assumption${(recast?.analysis?.key_assumptions?.length || 0) === 1 ? '' : 's'} from Recast in this rehearsal.`);
            return <ContextChainBlock summary={summary} items={items} />;
          })()}

          {/* ── Reward: 리허설 발견 요약 ── */}
          {(() => {
            const results = latestFeedback.results || [];
            const allRisks = results.flatMap(r => r.classified_risks || []);
            const critical = allRisks.filter(r => r.category === 'critical').length;
            const manageable = allRisks.filter(r => r.category === 'manageable').length;
            const unspoken = allRisks.filter(r => r.category === 'unspoken').length;
            const approvalCount = results.reduce((s, r) => s + (r.approval_conditions?.length || 0), 0);
            const personaCount = results.length;
            if (personaCount === 0) return null;

            const praiseCount = results.reduce((s, r) => s + (r.praise || []).length, 0);

            return (
              <div className="rounded-xl border border-[var(--accent)]/20 bg-[var(--ai)] p-4 reward-entrance">
                <p className="text-[12px] font-bold text-[var(--text-primary)] mb-3">{L(`${personaCount}명의 이해관계자가 검토했습니다`, `${personaCount} stakeholder${personaCount === 1 ? '' : 's'} reviewed`)}</p>

                <div className="flex flex-wrap gap-2 mb-2">
                  {praiseCount > 0 && <span className="text-[11px] px-2.5 py-1 rounded-full bg-[var(--success)]/10 border border-[var(--success)]/25 text-[var(--success)] font-medium">{L(`긍정 평가 ${praiseCount}건`, `${praiseCount} positive${praiseCount === 1 ? '' : 's'}`)}</span>}
                  {critical > 0 && <span className="text-[11px] px-2.5 py-1 rounded-full bg-[var(--danger)]/10 border border-[var(--danger)]/25 text-[var(--danger)] font-semibold">{L(`핵심 리스크 ${critical}건`, `${critical} critical risk${critical === 1 ? '' : 's'}`)}</span>}
                  {manageable > 0 && <span className="text-[11px] px-2.5 py-1 rounded-full bg-[var(--warning)]/10 border border-[var(--warning)]/30 text-[var(--warning)] font-medium">{L(`관리 가능 ${manageable}건`, `${manageable} manageable`)}</span>}
                  {unspoken > 0 && <span className="text-[11px] px-2.5 py-1 rounded-full bg-[var(--risk-unspoken)]/12 border border-[var(--risk-unspoken)]/30 text-[var(--risk-unspoken)] font-semibold">{L(`침묵의 리스크 ${unspoken}건`, `${unspoken} unspoken risk${unspoken === 1 ? '' : 's'}`)}</span>}
                  {approvalCount > 0 && <span className="text-[11px] px-2.5 py-1 rounded-full bg-[var(--ai)] border border-[var(--ai-fg)]/20 text-[var(--ai-fg)] font-medium">{L(`승인 조건 ${approvalCount}건`, `${approvalCount} approval condition${approvalCount === 1 ? '' : 's'}`)}</span>}
                </div>
                {(critical > 0 || unspoken > 0) && (
                  <p className="text-[11px] text-[var(--text-secondary)] mt-1">
                    {L('아래에서 각 이해관계자의 의견을 확인하고, 반영할 부분을 골라보세요.', 'Review each stakeholder\'s feedback below and choose what to incorporate.')}
                  </p>
                )}
                {critical === 0 && unspoken === 0 && (
                  <p className="text-[11px] text-[var(--success)] font-medium">{L('큰 위협 없이 통과했습니다. 실행 준비가 되었습니다.', 'Passed without major threats. Ready to execute.')}</p>
                )}
              </div>
            );
          })()}

          <FeedbackResult
            record={latestFeedback}
            personas={personas}
            focusRealityCheckId={requestedRealityCheckId ?? undefined}
            onUpdateRecord={(patch) => {
              setLatestFeedback((current) => current ? { ...current, ...patch } : current);
              updateFeedbackRecord(latestFeedback.id, patch);
            }}
            onStartDiscussion={handleStartDiscussion}
            discussionLoading={discussionLoading}
          />

          {discussionError && (
            <div role="alert" className="flex items-center justify-between gap-2 text-[var(--danger)] text-[13px] bg-[var(--danger)]/10 rounded-lg px-3 py-2">
              <span className="min-w-0">{discussionError}</span>
              <button onClick={() => { setDiscussionError(''); handleStartDiscussion(); }} className="shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-medium border border-[var(--danger)]/25 text-[var(--danger)] hover:bg-[var(--danger)]/15 cursor-pointer transition-colors">
                {L('다시 시도', 'Retry')}
              </button>
            </div>
          )}

          {latestFeedback?.project_id && (
            <NextStepGuide
              currentTool="rehearse"
              projectId={latestFeedback.project_id}
              onSendTo={(href) => onNavigate(href.replace('/tools/', ''))}
            />
          )}
        </div>
      )}
      <ConfirmDialog
        open={pendingPersonaDelete !== null}
        title={L('검토 역할을 삭제할까요?', 'Delete reviewer role?')}
        description={pendingPersonaDelete
          ? L(`‘${pendingPersonaDelete.name}’ 역할이 이후 검토에서 제거됩니다. 기존 검토 결과는 그대로 남아요.`, `“${pendingPersonaDelete.name}” will be removed from future reviews. Existing review results will remain.`)
          : ''}
        confirmLabel={L('역할 삭제', 'Delete role')}
        cancelLabel={L('취소', 'Cancel')}
        onCancel={() => setPendingPersonaDelete(null)}
        onConfirm={() => {
          if (pendingPersonaDelete) deletePersona(pendingPersonaDelete.id);
          setPendingPersonaDelete(null);
        }}
        dangerous
      />
    </div>
  );
}
