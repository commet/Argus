'use client';

import { useEffect, useRef, useState } from 'react';
import { useSynthesizeStore } from '@/stores/useSynthesizeStore';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Field } from '@/components/ui/Field';
import { ShareBar } from '@/components/ui/ShareBar';
import { synthesizeToMarkdown } from '@/lib/export';
import { callLLMJson } from '@/lib/llm';
import { toDisplayError, isAuthError } from '@/lib/error-display';
import type { SynthesizeAnalysis, SynthesizeSource } from '@/stores/types';
import { InterviewInput, buildInterviewPrompt } from '@/components/ui/InterviewInput';
import type { InterviewStep } from '@/components/ui/InterviewInput';
import { ModeToggle } from '@/components/ui/ModeToggle';
import type { InputMode } from '@/components/ui/ModeToggle';
import { LoadingSteps } from '@/components/ui/LoadingSteps';
import { useHandoffStore } from '@/stores/useHandoffStore';
import { useJudgmentStore } from '@/stores/useJudgmentStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { SealMoment } from '@/components/workspace/progressive/SealMoment';
import { extractPredicatesFromSynthesis } from '@/lib/decision-contract';
import { buildEnhancedSystemPrompt } from '@/lib/context-builder';
import { NextStepGuide } from '@/components/ui/NextStepGuide';
import { NavigatorInline } from '@/components/workspace/NavigatorInline';
import { Sparkles, Loader2, FileText, Trash2, Check, PlusCircle, X, AlertTriangle, ArrowRight, RotateCcw, Bot, Scale, Send } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import { getCurrentLanguage } from '@/lib/i18n';

const LOADING_MESSAGES_KO = [
  '소스를 분리하고 있습니다...',
  '핵심 주장을 추출하고 있습니다...',
  '합의점과 쟁점을 분석하고 있습니다...',
];
const LOADING_MESSAGES_EN = [
  'Separating sources...',
  'Extracting core claims...',
  'Analyzing agreements and conflicts...',
];

const SYSTEM_PROMPT_KO = `당신은 전략기획 전문가입니다. 사용자가 제출한 여러 AI 결과물 또는 의견들을 분석하여 아래 JSON 구조로 응답하세요.

1. sources_summary: 각 소스(또는 의견)의 핵심 주장을 정리. 각 소스에 대해:
   - name: 소스 이름 또는 번호 (사용자가 라벨을 붙였으면 그대로, 아니면 "소스 1", "소스 2" 등)
   - core_claim: 핵심 주장 한 문장
2. agreements: 소스들이 동의하는 합의점 리스트 (문자열 배열, 1~3개)
3. conflicts: 소스 간 충돌하는 쟁점 리스트. 각 쟁점에 대해:
   - id: 고유 식별자 (conflict_1, conflict_2 등)
   - topic: 쟁점 주제 한 문장
   - side_a: { source: 소스 이름, position: 이 소스의 입장 }
   - side_b: { source: 소스 이름, position: 이 소스의 입장 }
   - analysis: 왜 이 두 입장이 다른지 분석 한 문장
4. questions_for_user: 사용자가 결정해야 할 핵심 질문 1~2개

반드시 JSON만 응답하세요.`;

const SYSTEM_PROMPT_EN = `You are a strategy expert. Analyze the multiple AI outputs or opinions the user submitted and respond in the JSON structure below.

1. sources_summary: Summarize each source's (or opinion's) core claim. For each source:
   - name: Source name or number (use the user's label if given, otherwise "Source 1", "Source 2", etc.)
   - core_claim: The core claim in one sentence
2. agreements: A list of points the sources agree on (array of strings, 1-3 items)
3. conflicts: A list of issues where the sources clash. For each issue:
   - id: A unique identifier (conflict_1, conflict_2, etc.)
   - topic: The issue topic in one sentence
   - side_a: { source: source name, position: this source's position }
   - side_b: { source: source name, position: this source's position }
   - analysis: One sentence analyzing why these two positions differ
4. questions_for_user: The 1-2 key questions the user needs to decide

Respond with JSON only.`;

function getSystemPrompt(): string {
  return getCurrentLanguage() === 'ko' ? SYSTEM_PROMPT_KO : SYSTEM_PROMPT_EN;
}

const buildSynthesizeInterview = (L: (ko: string, en: string) => string): InterviewStep[] => [
  {
    key: 'sourceType',
    question: L('어떤 것들을 비교하고 싶으세요?', 'What do you want to compare?'),
    label: L('소스 유형', 'Source type'),
    type: 'chips',
    options: [
      { value: 'ai_tools', label: L('AI 도구별 답변', 'AI tool responses'), emoji: '🤖' },
      { value: 'team', label: L('팀원/부서 의견', 'Team/department opinions'), emoji: '👥' },
      { value: 'research', label: L('리서치 자료', 'Research materials'), emoji: '📑' },
      { value: 'external', label: L('외부 보고서', 'External reports'), emoji: '🌐' },
      { value: 'options', label: L('선택지/대안 비교', 'Options/alternatives'), emoji: '⚖️' },
    ],
  },
  {
    key: 'purpose',
    question: L('비교해서 뭘 하려는 건가요?', 'What are you comparing them for?'),
    label: L('비교 목적', 'Purpose'),
    type: 'chips',
    options: [
      { value: 'decision', label: L('의사결정', 'Decision') },
      { value: 'report', label: L('보고서 작성', 'Report writing') },
      { value: 'strategy', label: L('전략 수립', 'Strategy') },
      { value: 'comparison', label: L('단순 비교', 'Plain comparison') },
      { value: 'consensus', label: L('합의점 도출', 'Find consensus') },
    ],
  },
  {
    key: 'importance',
    question: L('이 결정이 얼마나 중요한가요?', 'How important is this decision?'),
    label: L('중요도', 'Importance'),
    hint: L('중요도에 따라 분석 깊이가 달라집니다.', 'Analysis depth varies with importance.'),
    type: 'chips',
    options: [
      { value: 'critical', label: L('매우 중요 (되돌리기 어려움)', 'Very important (hard to reverse)'), emoji: '🔴' },
      { value: 'moderate', label: L('중간', 'Moderate') },
      { value: 'low', label: L('가볍게 참고', 'Light reference'), emoji: '🟢' },
    ],
  },
  {
    key: 'content',
    question: L('비교할 내용을 붙여넣어주세요', 'Paste the content to compare'),
    label: L('비교 내용', 'Comparison content'),
    hint: L('각 소스를 구분해서 붙여넣으면 더 정확하게 분석합니다.', 'Separating sources makes the analysis more accurate.'),
    type: 'textarea',
    placeholder: L('ChatGPT 답변:\n시장 규모는 약 500억 원으로...\n\nClaude 답변:\n해당 시장은 300~700억 원 사이로...', 'ChatGPT response:\nThe market size is about $50M...\n\nClaude response:\nThe market is between $30M–70M...'),
    required: true,
    rows: 8,
  },
];

interface SynthesizeStepProps {
  onNavigate: (step: string) => void;
}

export function SynthesizeStep({ onNavigate }: SynthesizeStepProps) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const SYNTHESIZE_INTERVIEW = buildSynthesizeInterview(L);
  const LOADING_MESSAGES = locale === 'ko' ? LOADING_MESSAGES_KO : LOADING_MESSAGES_EN;
  const { items, currentId, loadItems, createItem, updateItem, deleteItem, setCurrentId, getCurrentItem } = useSynthesizeStore();
  const { addJudgment, loadJudgments } = useJudgmentStore();
  const { setHandoff } = useHandoffStore();
  const [inputMode, setInputMode] = useState<'bulk' | 'individual'>('bulk');
  const [bulkInput, setBulkInput] = useState('');
  const [individualSources, setIndividualSources] = useState<SynthesizeSource[]>([
    { name: '', content: '' },
    { name: '', content: '' },
  ]);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<InputMode>('interview');
  // Carry the interview's importance answer to SealMoment so the mirror-clause
  // restraint gate can fire: a "low" call should get a quiet single-check, not
  // the full seal ceremony. Default 'important' (full ceremony) is the safe
  // fallback when the answer is absent (e.g. paste mode, or after reload).
  const [sealStakes, setSealStakes] = useState<'routine' | 'important' | 'critical'>('important');
  // Project carried in from the tools chain (same pattern as RecastStep) —
  // applied to the item at creation so the seal terminus has a home.
  const [pendingProjectId, setPendingProjectId] = useState<string | undefined>();

  useEffect(() => {
    loadItems();
    loadJudgments();
  }, [loadItems, loadJudgments]);

  // Inbound handoff: 앞 단계 결과를 bulk input에 pre-fill.
  // Accept any tools-chain sender (rehearse hands off here today; 'refine' was
  // a receiver with no producer) and carry projectId through — without it the
  // synthesize terminus can never reach SealMoment (F2: seal→settle was
  // structurally unreachable for tool-path decisions).
  useEffect(() => {
    const handoff = useHandoffStore.getState().handoff;
    if ((handoff?.from === 'refine' || handoff?.from === 'rehearse' || handoff?.from === 'recast') && handoff.content) {
      setBulkInput(handoff.content);
      setMode('direct');
      setInputMode('bulk');
      if (handoff.projectId) setPendingProjectId(handoff.projectId);
      useHandoffStore.getState().clearHandoff();
    }
  }, []);

  const current = getCurrentItem();

  // North-Star C: arm the seal→settle loop at the synthesize terminus. The
  // project (subscribed so a seal re-renders) lets us hand the user's committed
  // judgments to a SealMoment that writes project.decision_contract — so a
  // tools-chain decision enters dueProjects/SettlementModal like the voyage,
  // instead of evaporating into a Share button.
  const sealProject = useProjectStore((s) =>
    current?.project_id ? s.projects.find((p) => p.id === current.project_id) : undefined,
  );

  useEffect(() => {
    if (current?.status !== 'analyzing') return;
    const interval = setInterval(() => {
      setLoadingMsgIdx((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [current?.status]);

  const handleAnalyze = async (prompt?: string) => {
    setError('');
    let userContent = '';
    const sources: SynthesizeSource[] = [];

    if (prompt) {
      userContent = prompt;
    } else if (inputMode === 'bulk') {
      if (!bulkInput.trim()) return;
      userContent = bulkInput;
    } else {
      const validSources = individualSources.filter((s) => s.content.trim());
      if (validSources.length < 2) { setError(L('최소 2개 소스를 입력해주세요.', 'Please enter at least 2 sources.')); return; }
      sources.push(...validSources);
      userContent = validSources.map((s, i) => `### ${s.name || L(`소스 ${i + 1}`, `Source ${i + 1}`)}\n${s.content}`).join('\n\n');
    }

    const id = createItem();
    // Attach the decision's project at creation: handoff first, else the
    // workspace's current project, else a fresh one named after the input —
    // exactly the ReframeStep pattern. Without a project_id the SealMoment
    // below can never render and the decision exits the seal→settle loop.
    const projectStore = useProjectStore.getState();
    const projectId =
      pendingProjectId ||
      projectStore.currentProjectId ||
      projectStore.getOrCreateProject(userContent.replace(/\s+/g, ' ').trim().slice(0, 30));
    updateItem(id, { raw_input: userContent, sources, status: 'analyzing', project_id: projectId });
    if (pendingProjectId) setPendingProjectId(undefined);

    try {
      const analysis = await callLLMJson<SynthesizeAnalysis>(
        [{ role: 'user', content: userContent }],
        { system: buildEnhancedSystemPrompt(getSystemPrompt()), maxTokens: 2500, shape: { sources_summary: 'array', agreements: 'array', conflicts: 'array', questions_for_user: 'array' } }
      );
      updateItem(id, { analysis, status: 'review' });
    } catch (err) {
      const de = toDisplayError(err);
      if (isAuthError(err)) {
        setError('LOGIN_REQUIRED');
      } else {
        setError(de.message || L('분석에 실패했어요. 다시 시도해 주세요.', 'Analysis failed — please try again.'));
      }
      updateItem(id, { status: 'input' });
    }
  };

  // Debounce timers per conflict — the persisted judgment record must NOT be
  // written on every keystroke (it floods the judgment store that patterns /
  // vitality read from, distorting the frequency stats the spine relies on).
  // ReframeStep already debounces the same way. The UI updates immediately;
  // only the RECORD waits ~1s after typing stops.
  const judgmentTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  useEffect(() => {
    const timers = judgmentTimerRef.current;
    return () => { Object.values(timers).forEach(clearTimeout); };
  }, []);

  const handleJudgment = (conflictId: string, judgment: string) => {
    if (!current || !currentId || !current.analysis) return;
    const conflict = current.analysis.conflicts.find(c => c.id === conflictId);
    const conflicts = current.analysis.conflicts.map((c) =>
      c.id === conflictId ? { ...c, user_judgment: judgment } : c
    );
    updateItem(currentId, { analysis: { ...current.analysis, conflicts } });

    if (judgmentTimerRef.current[conflictId]) clearTimeout(judgmentTimerRef.current[conflictId]);
    if (conflict && judgment.trim()) {
      judgmentTimerRef.current[conflictId] = setTimeout(() => {
        addJudgment({
          type: 'conflict_resolution',
          context: conflict.topic,
          decision: judgment,
          original_ai_suggestion: `${conflict.side_a.source}: ${conflict.side_a.position}`,
          user_changed: true,
          project_id: current.project_id,
          tool: 'synthesize',
        });
        delete judgmentTimerRef.current[conflictId];
      }, 1000);
    }
  };

  const handleJudgmentReasoning = (conflictId: string, reasoning: string) => {
    if (!current || !currentId || !current.analysis) return;
    const conflicts = current.analysis.conflicts.map((c) =>
      c.id === conflictId ? { ...c, user_reasoning: reasoning } : c
    );
    updateItem(currentId, { analysis: { ...current.analysis, conflicts } });
  };

  const handleConfirm = () => {
    if (!current || !currentId || !current.analysis) return;
    const synthesis = current.analysis.conflicts
      .filter((c) => c.user_judgment)
      .map((c) => `${c.topic}: ${c.user_judgment}${c.user_reasoning ? ` (${L('근거', 'reasoning')}: ${c.user_reasoning})` : ''}`)
      .join('\n');
    updateItem(currentId, { status: 'done', final_synthesis: synthesis });
  };

  const addIndividualSource = () => {
    if (individualSources.length >= 5) return;
    setIndividualSources([...individualSources, { name: '', content: '' }]);
  };

  const removeIndividualSource = (index: number) => {
    if (individualSources.length <= 2) return;
    setIndividualSources(individualSources.filter((_, i) => i !== index));
  };

  const updateIndividualSource = (index: number, field: 'name' | 'content', value: string) => {
    const updated = [...individualSources];
    updated[index] = { ...updated[index], [field]: value };
    setIndividualSources(updated);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-[var(--text-primary)]">{L('조율', 'Synthesize')}</h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-1">
            {mode === 'direct'
              ? L('결과물을 붙여넣으면 쟁점이 도출되고, 당신은 판단만 합니다.', 'Paste the outputs, we surface the conflicts — you only judge.')
              : L('질문에 답하고 붙여넣으면 더 정확해요.', 'Answer first, then paste — sharper read.')}
          </p>
        </div>
        <ModeToggle mode={mode} onChange={setMode} />
      </div>

      <NavigatorInline step="synthesize" />

      {/* History */}
      {items.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentId(item.id)}
              className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] border transition-colors cursor-pointer ${
                currentId === item.id
                  ? 'border-[var(--accent)] bg-[var(--ai)] text-[var(--text-primary)]'
                  : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]'
              }`}
            >
              <FileText size={14} />
              {(item.analysis?.sources_summary[0]?.name || L('조율', 'Synthesis')).slice(0, 20)}
              <span onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }} className="ml-1 p-0.5 hover:text-red-500 cursor-pointer">
                <Trash2 size={12} />
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ─── STEP 1: Input ─── */}
      {(!current || current.status === 'input') && !currentId && (
        <div className="space-y-4">
          {mode === 'direct' ? (
            <Card className="space-y-3">
              <div>
                <h2 className="text-[16px] font-bold text-[var(--text-primary)] mb-1">{L('비교할 결과물을 붙여넣으세요', 'Paste the outputs you want to compare')}</h2>
                <p className="text-[12px] text-[var(--text-secondary)]">{L('여러 AI 답변이나 의견을 한꺼번에 붙여넣으면 공통점과 차이를 정리해드려요.', 'Paste several AI answers or opinions — we lay out what they agree on and where they differ.')}</p>
              </div>
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => setInputMode('bulk')}
                  className={`px-3 py-1.5 rounded-lg text-[13px] font-medium border transition-colors cursor-pointer ${
                    inputMode === 'bulk' ? 'border-[var(--accent)] bg-[var(--ai)]' : 'border-[var(--border)] text-[var(--text-secondary)]'
                  }`}
                >
                  {L('한 번에 붙여넣기', 'Paste at once')}
                </button>
                <button
                  onClick={() => setInputMode('individual')}
                  className={`px-3 py-1.5 rounded-lg text-[13px] font-medium border transition-colors cursor-pointer ${
                    inputMode === 'individual' ? 'border-[var(--accent)] bg-[var(--ai)]' : 'border-[var(--border)] text-[var(--text-secondary)]'
                  }`}
                >
                  {L('소스별 입력', 'By source')}
                </button>
              </div>
              {inputMode === 'bulk' ? (
                <>
                  <textarea
                    value={bulkInput}
                    maxLength={20000}
                    onChange={(e) => setBulkInput(e.target.value)}
                    placeholder={L("ChatGPT 답변:\n시장 규모는 약 500억 원으로...\n\nClaude 답변:\n해당 시장은 300~700억 원 사이로...", "ChatGPT response:\nThe market size is about $50M...\n\nClaude response:\nThe market is between $30M–70M...")}
                    className="w-full bg-[var(--bg)] border-[1.5px] border-[var(--border)] rounded-[10px] px-4 py-3 text-[15px] leading-[1.7] placeholder:text-[var(--text-secondary)] placeholder:text-[14px] focus:outline-none focus:border-[var(--accent)] resize-none"
                    rows={8}
                  />
                  <div className="flex justify-end">
                    <Button onClick={() => handleAnalyze()} disabled={!bulkInput.trim()}>
                      <Sparkles size={14} /> {L('AI 분석 시작', 'Start AI analysis')}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-3">
                    {individualSources.map((source, i) => (
                      <div key={i} className="space-y-2 p-3 rounded-lg border border-[var(--border)] animate-fade-in">
                        <div className="flex items-center justify-between">
                          <input
                            type="text"
                            value={source.name}
                            onChange={(e) => updateIndividualSource(i, 'name', e.target.value)}
                            placeholder={L(`소스 ${i + 1} (예: ChatGPT, Claude, 리서치팀)`, `Source ${i + 1} (e.g., ChatGPT, Claude, Research team)`)}
                            className="flex-1 bg-transparent text-[14px] font-semibold placeholder:text-[var(--text-secondary)] rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50"
                          />
                          {individualSources.length > 2 && (
                            <button onClick={() => removeIndividualSource(i)} className="p-1 hover:text-red-500 cursor-pointer">
                              <X size={14} />
                            </button>
                          )}
                        </div>
                        <textarea
                          value={source.content}
                          maxLength={10000}
                          onChange={(e) => updateIndividualSource(i, 'content', e.target.value)}
                          placeholder={L("이 소스의 결과물이나 의견을 붙여넣으세요", "Paste this source's output or opinion")}
                          className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-[14px] leading-[1.6] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] resize-none"
                          rows={4}
                        />
                      </div>
                    ))}
                    {individualSources.length < 5 && (
                      <Button variant="ghost" size="sm" onClick={addIndividualSource}>
                        <PlusCircle size={14} /> {L('소스 추가', 'Add source')}
                      </Button>
                    )}
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={() => handleAnalyze()} disabled={individualSources.filter((s) => s.content.trim()).length < 2}>
                      <Sparkles size={14} /> {L('AI 분석 시작', 'Start AI analysis')}
                    </Button>
                  </div>
                </>
              )}
              {error && (
                <div className="flex items-center gap-2 text-[var(--danger)] text-[13px] bg-[var(--danger)]/10 rounded-lg px-3 py-2">
                  <AlertTriangle size={14} /> {error}
                </div>
              )}
            </Card>
          ) : (
            <Card>
              <InterviewInput
                steps={SYNTHESIZE_INTERVIEW}
                submitLabel={L('AI 분석 시작', 'Start AI analysis')}
                onSubmit={(answers) => {
                  // Map the importance chip to the seal gate's stakes so a light
                  // decision gets a quiet single-check instead of full ceremony.
                  const imp = answers.importance;
                  setSealStakes(imp === 'low' ? 'routine' : imp === 'critical' ? 'critical' : 'important');
                  handleAnalyze(buildInterviewPrompt(SYNTHESIZE_INTERVIEW, answers));
                }}
              />
              {error && (
                <div className="flex items-center gap-2 text-[var(--danger)] text-[13px] bg-[var(--danger)]/10 rounded-lg px-3 py-2 mt-3">
                  <AlertTriangle size={14} /> {error}
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {/* ─── Loading ─── */}
      {current?.status === 'analyzing' && (
        <Card>
          <LoadingSteps steps={[
            L('소스를 분리하고 있습니다', 'Separating sources'),
            L('핵심 주장을 추출하고 있습니다', 'Extracting core claims'),
            L('합의점과 쟁점을 분석하고 있습니다', 'Analyzing agreements and conflicts'),
          ]} />
        </Card>
      )}

      {/* ─── STEP 2: Review ─── */}
      {current?.status === 'review' && current.analysis && (
        <div className="space-y-6 animate-fade-in">
          {/* Sources summary */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Bot size={14} className="text-[var(--ai-fg)]" />
              <h3 className="text-[16px] font-bold text-[var(--text-primary)]">{L('소스별 핵심 주장', 'Core claims by source')}</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {current.analysis.sources_summary.map((s, i) => (
                <Card key={i} className="!bg-[var(--ai)] !p-3">
                  <p className="text-[12px] font-bold text-[var(--ai-fg)] mb-1">{s.name}</p>
                  <p className="text-[13px] text-[var(--text-primary)]">{s.core_claim}</p>
                </Card>
              ))}
            </div>
          </div>

          {/* Agreements */}
          {current.analysis.agreements.length > 0 && (
            <Card className="!bg-[var(--collab)]">
              <h3 className="text-[14px] font-bold text-[var(--both-fg)] mb-2">{L('합의점', 'Agreements')}</h3>
              <ul className="space-y-1">
                {current.analysis.agreements.map((a, i) => (
                  <li key={i} className="text-[13px] text-[var(--both-fg)]">✓ {a}</li>
                ))}
              </ul>
            </Card>
          )}

          {/* Conflicts - JUDGMENT POINTS */}
          {current.analysis.conflicts.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="checkpoint">{L('⚡ 판단 필요', '⚡ Judgment needed')}</Badge>
                <h3 className="text-[16px] font-bold text-[var(--text-primary)]">{L('쟁점', 'Conflicts')}</h3>
              </div>
              <p className="text-[13px] text-[var(--text-secondary)]">
                {L('쟁점마다 당신의 판단을 적어주세요. AI가 아니라 당신 상황에서 결정하는 거예요.', 'Make your call on each point — you decide from your situation, not the AI’s.')}
              </p>
              {current.analysis.conflicts.map((conflict) => (
                <Card key={conflict.id} className={`space-y-3 ${conflict.user_judgment ? '!border-[var(--success)]' : '!border-[var(--warning)]/30'}`}>
                  <div className="flex items-center gap-2">
                    <Scale size={14} className="text-[var(--warning)]" />
                    <h4 className="text-[14px] font-bold text-[var(--text-primary)]">{conflict.topic}</h4>
                    {conflict.user_judgment && <Check size={14} className="text-[var(--success)]" />}
                  </div>
                  {/* Two sides */}
                  {/* Two external sources the user judges between — kept visually
                      EQUAL (no color implying which side Argus prefers) and on
                      semantic tokens so they don't turn into near-white boxes in
                      dark mode. Distinguished by the source label, not by hue. */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="bg-[var(--bg)] border border-[var(--border-subtle)] rounded-lg p-3">
                      <p className="text-[11px] font-bold text-[var(--text-secondary)] mb-1">{conflict.side_a.source}</p>
                      <p className="text-[13px] text-[var(--text-primary)]">{conflict.side_a.position}</p>
                    </div>
                    <div className="bg-[var(--bg)] border border-[var(--border-subtle)] rounded-lg p-3">
                      <p className="text-[11px] font-bold text-[var(--text-secondary)] mb-1">{conflict.side_b.source}</p>
                      <p className="text-[13px] text-[var(--text-primary)]">{conflict.side_b.position}</p>
                    </div>
                  </div>
                  <p className="text-[12px] text-[var(--text-secondary)]">{conflict.analysis}</p>
                  {/* User judgment */}
                  <div className="border-t border-[var(--border)] pt-3 space-y-2">
                    <label className="text-[12px] font-bold text-[var(--warning)]">{L('나의 판단', 'My judgment')}</label>
                    <textarea
                      value={conflict.user_judgment || ''}
                      maxLength={2000}
                      onChange={(e) => handleJudgment(conflict.id, e.target.value)}
                      placeholder={L("이 쟁점에 대한 당신의 판단을 입력하세요...", "Enter your judgment on this conflict...")}
                      className="w-full bg-[var(--checkpoint)] border border-[var(--warning)]/30 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-amber-400 resize-none"
                      rows={2}
                    />
                    <input
                      type="text"
                      value={conflict.user_reasoning || ''}
                      onChange={(e) => handleJudgmentReasoning(conflict.id, e.target.value)}
                      placeholder={L("판단 근거 (선택사항)", "Reasoning (optional)")}
                      className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Questions for user */}
          {current.analysis.questions_for_user.length > 0 && (
            <Card className="!bg-[var(--checkpoint)]">
              <h4 className="text-[13px] font-bold text-[var(--warning)] mb-2">{L('당신이 결정해야 할 질문', 'Questions for you to decide')}</h4>
              <ul className="space-y-1">
                {current.analysis.questions_for_user.map((q, i) => (
                  <li key={i} className="text-[13px] text-[var(--warning)]">• {q}</li>
                ))}
              </ul>
            </Card>
          )}

          {error && (
            <div className="flex items-center gap-2 text-[var(--danger)] text-[13px] bg-[var(--danger)]/10 rounded-lg px-3 py-2">
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <Button variant="secondary" size="sm" onClick={() => { setCurrentId(null); setBulkInput(''); }}>
              <RotateCcw size={14} /> {L('새로 시작', 'Start over')}
            </Button>
            <div className="flex gap-2">
              <ShareBar getText={() => synthesizeToMarkdown(current)} getTitle={() => L('조율 결과', 'Synthesis result')} />
              <Button onClick={handleConfirm}>
                <Check size={14} /> {L('확정', 'Confirm')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Done ─── */}
      {current?.status === 'done' && current.analysis && (
        <div className="space-y-4 animate-fade-in">
          <Card className="!border-[var(--success)] !border-2">
            <div className="flex items-center gap-2 text-[var(--success)] text-[13px] font-bold mb-3">
              <Check size={14} /> {L('조율 완료', 'Synthesis complete')}
            </div>
            <div className="space-y-3 text-[14px]">
              <div>
                <h4 className="font-bold mb-1">{L('합의점', 'Agreements')}</h4>
                {current.analysis.agreements.map((a, i) => <p key={i} className="text-[var(--text-secondary)]">✓ {a}</p>)}
              </div>
              <div>
                <h4 className="font-bold mb-1">{L('쟁점별 판단', 'Judgment per conflict')}</h4>
                {current.analysis.conflicts.filter((c) => c.user_judgment).map((c) => (
                  <div key={c.id} className="mb-2">
                    <p className="font-medium">{c.topic}</p>
                    <p className="text-[var(--text-secondary)]">{c.user_judgment}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* North-Star C: the loop's terminus — seal the committed judgments so
              this decision returns at settlement. Renders only when a project
              exists to carry the contract; SealMoment self-silences (null) when
              there's nothing falsifiable to predict. */}
          {sealProject && (
            <SealMoment
              project={sealProject}
              predicates={extractPredicatesFromSynthesis(current.analysis.conflicts)}
              gate={{ stakes: sealStakes, reversibility: sealStakes === 'routine' ? 'reversible' : 'partial' }}
            />
          )}

          <div className="flex items-center justify-between">
            <Button variant="secondary" size="sm" onClick={() => { setCurrentId(null); setBulkInput(''); }}>
              <ArrowRight size={14} /> {L('새 조율', 'New synthesis')}
            </Button>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const content = synthesizeToMarkdown(current!);
                  setHandoff({
                    from: 'synthesize',
                    fromItemId: current!.id,
                    content,
                    projectId: current!.project_id,
                  });
                  onNavigate('rehearse');
                }}
              >
                <Send size={14} /> {L('리허설 받기', 'Run rehearsal')}
              </Button>
              <ShareBar getText={() => synthesizeToMarkdown(current)} getTitle={() => L('조율 결과', 'Synthesis result')} />
            </div>
          </div>
{/* NextStepGuide removed — synthesize is a standalone utility, not part of the core flow */}
        </div>
      )}
    </div>
  );
}
