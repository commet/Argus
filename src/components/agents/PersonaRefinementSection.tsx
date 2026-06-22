'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Sparkles, Check, X, Loader2, Trash2 } from 'lucide-react';
import type { Agent, AgentObservation, ObservationSource } from '@/stores/agent-types';
import { useAgentStore } from '@/stores/useAgentStore';
import { callLLMStream } from '@/lib/llm';
import { getCurrentLanguage } from '@/lib/i18n';
import { useLocale } from '@/hooks/useLocale';

type Category = AgentObservation['category'];

const CATEGORY_META: Record<Category, { label: string; order: number }> = {
  communication_style: { label: '소통 방식', order: 0 },
  work_pattern: { label: '업무 패턴', order: 1 },
  preference: { label: '선호·가치', order: 2 },
  skill_gap: { label: '약점·사각', order: 3 },
};

// English category labels — used only for building the locale-selected refine prompt
const CATEGORY_LABEL_EN: Record<Category, string> = {
  communication_style: 'Communication style',
  work_pattern: 'Work pattern',
  preference: 'Preferences & values',
  skill_gap: 'Weaknesses & blind spots',
};

/* ────────────────────────────────────────────
   Persona-refinement prompt (locale-selected)
   ──────────────────────────────────────────── */

function buildRefineSystemKO(existingObs: string, chatSummary: string, archiveSummary: string): string {
  return `당신은 심리학적 관찰자다. 부하직원이 저장한 '팀장 페르소나'를 실제 상호작용 데이터를 바탕으로 구체화하는 것이 목표다.

현재 이 팀장에 대해 기록된 관찰:
${existingObs || '(없음)'}

최근 대화:
${chatSummary || '(없음)'}

최근 팀장 속마음 기록:
${archiveSummary || '(없음)'}

위 데이터에서 **기존 관찰과 겹치지 않는**, 구체적이고 행동 관찰이 가능한 새 관찰을 2~3개 제안하라.

규칙:
- 카테고리는 반드시 이 중 하나: communication_style, work_pattern, preference, skill_gap
- observation은 한 문장(50자 이내). "이 팀장은 ~하다" 식의 단정적 서술.
- reason은 위 데이터에서 어떤 근거로 이런 관찰을 했는지 한 줄.
- 추상적이거나 성격유형 일반론은 피하고, 이 사용자-팀장 관계에서만 나오는 특유의 패턴에 집중.
- 이미 기록된 관찰과 의미가 겹치면 제외.
- 데이터가 부족하면 빈 배열 반환.

응답 형식: JSON만. 다른 설명 금지.
{
  "proposals": [
    {"category": "...", "observation": "...", "reason": "..."},
    ...
  ]
}`;
}

function buildRefineSystemEN(existingObs: string, chatSummary: string, archiveSummary: string): string {
  return `You are a psychological observer. Your goal is to flesh out the "manager persona" a direct report has saved, based on actual interaction data.

Observations currently recorded about this manager:
${existingObs || '(none)'}

Recent conversation:
${chatSummary || '(none)'}

Recent records of the manager's inner thoughts:
${archiveSummary || '(none)'}

From the data above, propose 2-3 new observations that **do not overlap with existing observations** and are concrete and behaviorally observable.

Rules:
- The category must be one of: communication_style, work_pattern, preference, skill_gap
- observation is one sentence (under 50 characters). An assertive statement in the form "This manager does ~".
- reason is one line on what evidence in the data above led to this observation.
- Avoid the abstract or generic personality-type talk; focus on the distinctive patterns that arise only in this user–manager relationship.
- Exclude anything that overlaps in meaning with an already-recorded observation.
- If the data is insufficient, return an empty array.

Response format: JSON only. No other explanation.
{
  "proposals": [
    {"category": "...", "observation": "...", "reason": "..."},
    ...
  ]
}`;
}

const SOURCE_META: Record<ObservationSource, { label: string; color: string; bg: string }> = {
  auto: { label: '자동', color: 'var(--text-tertiary)', bg: 'rgba(120,120,120,0.1)' },
  calibration: { label: '교정', color: 'rgb(37, 99, 180)', bg: 'rgba(96, 165, 250, 0.14)' },
  refined: { label: '제안·승인', color: 'rgb(109, 40, 217)', bg: 'rgba(139, 92, 246, 0.12)' },
  user: { label: '직접 기입', color: 'rgb(29, 125, 63)', bg: 'rgba(45, 138, 78, 0.12)' },
};

// English source labels (SOURCE_META.label is Korean; used in UI via srcLabel()).
const SOURCE_LABEL_EN: Record<ObservationSource, string> = {
  auto: 'Auto',
  calibration: 'Calibrated',
  refined: 'Suggested',
  user: 'Manual',
};

interface PersonaRefinementSectionProps {
  agent: Agent;
}

interface RefineProposal {
  category: Category;
  observation: string;
  reason: string;
  selected: boolean;
}

export function PersonaRefinementSection({ agent }: PersonaRefinementSectionProps) {
  const addObservation = useAgentStore(s => s.addObservation);
  const updateAgent = useAgentStore(s => s.updateAgent);

  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const catLabel = (cat: Category) => (locale === 'ko' ? CATEGORY_META[cat].label : CATEGORY_LABEL_EN[cat]);
  const srcLabel = (src: ObservationSource) => (locale === 'ko' ? SOURCE_META[src].label : SOURCE_LABEL_EN[src]);

  const [addMode, setAddMode] = useState(false);
  const [newCategory, setNewCategory] = useState<Category>('communication_style');
  const [newText, setNewText] = useState('');

  const [refining, setRefining] = useState(false);
  const [proposals, setProposals] = useState<RefineProposal[] | null>(null);
  const [refineError, setRefineError] = useState<string | null>(null);

  const grouped: Record<Category, AgentObservation[]> = {
    communication_style: [],
    work_pattern: [],
    preference: [],
    skill_gap: [],
  };
  for (const obs of agent.observations) {
    grouped[obs.category].push(obs);
  }
  // 각 그룹 내에서 confidence 내림차순
  (Object.keys(grouped) as Category[]).forEach(k => {
    grouped[k].sort((a, b) => b.confidence - a.confidence);
  });

  const totalObs = agent.observations.length;
  const hasAnyData =
    (agent.chat_history?.length ?? 0) >= 4 ||
    (agent.inner_monologue_archive?.length ?? 0) >= 1;

  const handleAdd = () => {
    const text = newText.trim();
    if (!text) return;
    addObservation(agent.id, {
      category: newCategory,
      observation: text,
      source: 'user',
    });
    setNewText('');
    setAddMode(false);
  };

  const handleDelete = (obsId: string) => {
    const updated = agent.observations.filter(o => o.id !== obsId);
    updateAgent(agent.id, { observations: updated });
  };

  const handleRefine = async () => {
    setRefining(true);
    setRefineError(null);
    setProposals(null);
    try {
      const ko = getCurrentLanguage() === 'ko';
      const chatSummary = (agent.chat_history || [])
        .slice(-20)
        .map(t => `${t.role === 'user' ? (ko ? '부하' : 'Report') : (ko ? '팀장' : 'Manager')}: ${t.content}`)
        .join('\n');
      const archiveSummary = (agent.inner_monologue_archive || [])
        .slice(-3)
        .map(e => `[${e.verdict}] ${e.situation}\n${ko ? '속마음' : 'Inner thoughts'}: ${e.text}`)
        .join('\n\n');
      const existingObs = agent.observations
        .map(o => `- [${ko ? CATEGORY_META[o.category].label : CATEGORY_LABEL_EN[o.category]}] ${o.observation}`)
        .join('\n');

      const system = ko
        ? buildRefineSystemKO(existingObs, chatSummary, archiveSummary)
        : buildRefineSystemEN(existingObs, chatSummary, archiveSummary);

      let accumulated = '';
      await callLLMStream(
        [{ role: 'user', content: ko ? '위 데이터를 분석해서 새 관찰 2~3개를 JSON으로 제안해라.' : 'Analyze the data above and propose 2-3 new observations as JSON.' }],
        { system, maxTokens: 500 },
        {
          onToken: (text) => { accumulated = text; },
          onComplete: () => {
            try {
              const jsonMatch = accumulated.match(/\{[\s\S]*\}/);
              if (!jsonMatch) throw new Error('JSON 형식을 찾을 수 없음');
              const parsed = JSON.parse(jsonMatch[0]);
              const items = Array.isArray(parsed.proposals) ? parsed.proposals : [];
              const validCategories: Category[] = ['communication_style', 'work_pattern', 'preference', 'skill_gap'];
              const cleaned: RefineProposal[] = items
                .filter((p: { category: string }) => validCategories.includes(p.category as Category))
                .map((p: { category: Category; observation: string; reason: string }) => ({
                  category: p.category,
                  observation: String(p.observation || '').slice(0, 120),
                  reason: String(p.reason || '').slice(0, 200),
                  selected: true,
                }))
                .slice(0, 3);
              if (cleaned.length === 0) {
                setRefineError(L('분석할 만한 패턴이 아직 부족해요. 대화를 몇 번 더 해보세요.', 'Not enough of a pattern to analyze yet. Try a few more conversations.'));
              } else {
                setProposals(cleaned);
              }
            } catch {
              setRefineError(L('분석 결과를 읽지 못했어요. 다시 시도해주세요.', "Couldn't read the analysis result. Please try again."));
            }
          },
          onError: () => {
            setRefineError(L('분석 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.', 'Something went wrong during analysis. Please try again shortly.'));
          },
        },
      );
    } finally {
      setRefining(false);
    }
  };

  const handleAcceptProposals = () => {
    if (!proposals) return;
    const accepted = proposals.filter(p => p.selected);
    for (const p of accepted) {
      addObservation(agent.id, {
        category: p.category,
        observation: p.observation,
        source: 'refined',
      });
    }
    setProposals(null);
  };

  const toggleProposal = (idx: number) => {
    if (!proposals) return;
    setProposals(proposals.map((p, i) => i === idx ? { ...p, selected: !p.selected } : p));
  };

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <p
          style={{
            fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)',
            letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0,
          }}
        >
          {L('페르소나 구체화', 'Flesh out persona')} {totalObs > 0 && `(${totalObs})`}
        </p>
        {!addMode && !proposals && (
          <div style={{ display: 'flex', gap: 4 }}>
            {hasAnyData && (
              <button
                type="button"
                onClick={handleRefine}
                disabled={refining}
                className="pr-mini-btn pr-mini-btn-refine"
                title={L('최근 대화와 속마음 기록으로 페르소나 다듬기', 'Refine the persona from recent conversations and inner-thought records')}
              >
                {refining ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                <span>{L('다듬기', 'Refine')}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setAddMode(true)}
              className="pr-mini-btn"
            >
              <Plus size={11} />
              <span>{L('직접 추가', 'Add manually')}</span>
            </button>
          </div>
        )}
      </div>

      {refineError && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8, fontStyle: 'italic' }}
        >
          {refineError}
        </motion.p>
      )}

      {/* 제안 검토 UI */}
      <AnimatePresence>
        {proposals && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="pr-proposals"
          >
            <p className="pr-proposals-title">
              <Sparkles size={11} style={{ marginRight: 4, display: 'inline-block', verticalAlign: '-1px' }} />
              {L('대화에서 발견한 것들 — 마음에 드는 것만 골라주세요', 'What I noticed from your conversations — pick the ones that ring true')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {proposals.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleProposal(i)}
                  className="pr-proposal"
                  data-selected={p.selected}
                >
                  <div className="pr-proposal-check">
                    {p.selected && <Check size={11} strokeWidth={3} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.04em' }}>
                        {catLabel(p.category)}
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>
                      {p.observation}
                    </p>
                    {p.reason && (
                      <p style={{ fontSize: 10, color: 'var(--text-tertiary)', margin: '3px 0 0', lineHeight: 1.4, fontStyle: 'italic' }}>
                        {p.reason}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              <button
                type="button"
                onClick={handleAcceptProposals}
                disabled={proposals.filter(p => p.selected).length === 0}
                className="pr-btn-primary"
              >
                {L('선택한 것 저장', 'Save selected')} ({proposals.filter(p => p.selected).length})
              </button>
              <button
                type="button"
                onClick={() => setProposals(null)}
                className="pr-btn-secondary"
              >
                {L('버리기', 'Discard')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 직접 추가 폼 */}
      <AnimatePresence>
        {addMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="pr-add-form"
          >
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              {(Object.keys(CATEGORY_META) as Category[])
                .sort((a, b) => CATEGORY_META[a].order - CATEGORY_META[b].order)
                .map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setNewCategory(cat)}
                    className="pr-cat-btn"
                    data-active={newCategory === cat}
                  >
                    {catLabel(cat)}
                  </button>
                ))}
            </div>
            <textarea
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder={L('이 팀장에 대해 알게 된 것을 한 문장으로...', 'One sentence on what you learned about this manager...')}
              maxLength={120}
              rows={2}
              className="pr-textarea"
              autoFocus
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                {newText.length}/120
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  onClick={() => { setAddMode(false); setNewText(''); }}
                  className="pr-btn-secondary"
                >
                  {L('취소', 'Cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={!newText.trim()}
                  className="pr-btn-primary"
                >
                  {L('저장', 'Save')}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 관찰 리스트 — 카테고리별 grouping */}
      {totalObs > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(Object.keys(grouped) as Category[])
            .sort((a, b) => CATEGORY_META[a].order - CATEGORY_META[b].order)
            .filter(cat => grouped[cat].length > 0)
            .map(cat => (
              <div key={cat}>
                <p style={{
                  fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)',
                  letterSpacing: '0.05em', margin: '0 0 4px',
                }}>
                  {catLabel(cat)}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {grouped[cat].map(obs => {
                    const source = obs.source || 'auto';
                    const srcMeta = SOURCE_META[source];
                    return (
                      <div key={obs.id} className="pr-obs">
                        <p style={{ fontSize: 12, color: 'var(--text-primary)', margin: 0, flex: 1, lineHeight: 1.5 }}>
                          {obs.observation}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                          <span
                            className="pr-obs-source"
                            style={{ color: srcMeta.color, background: srcMeta.bg }}
                          >
                            {srcLabel(source)}
                          </span>
                          <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
                            {Math.round(obs.confidence * 100)}%
                          </span>
                          {source === 'user' && (
                            <button
                              type="button"
                              onClick={() => handleDelete(obs.id)}
                              className="pr-obs-delete"
                              title={L('삭제', 'Delete')}
                            >
                              <Trash2 size={10} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      ) : (
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.6, margin: 0 }}>
          {L('아직 이 팀장에 대한 관찰이 없어요. 대화를 하면 자동으로 쌓이고, 직접 기입할 수도 있어요.', 'No observations about this manager yet. They build up automatically as you talk, and you can also add them manually.')}
        </p>
      )}
    </section>
  );
}
