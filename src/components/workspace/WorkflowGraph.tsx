'use client';

import { useState } from 'react';
import type { RecastStep as StepType, RecastAnalysis, ActorRelationship } from '@/stores/types';
import { Bot, Brain, Handshake, ArrowRight, Flag, Clock, Package, Zap, Trash2 } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';

interface WorkflowGraphProps {
  steps: StepType[];
  analysis: RecastAnalysis | null;
  editable?: boolean;
  onUpdateActor?: (index: number, actor: ActorRelationship) => void;
  onToggleCheckpoint?: (index: number) => void;
  onRemoveStep?: (index: number) => void;
  onUpdateField?: (index: number, updates: Partial<StepType>) => void;
}

const ACTORS: Record<string, { labelKo: string; labelEn: string; color: string; bg: string; text: string; Icon: typeof Bot }> = {
  ai: { labelKo: 'AI', labelEn: 'AI', color: '#3b6dcc', bg: '#eaeff8', text: '#2d4a7c', Icon: Bot },
  human: { labelKo: '사람', labelEn: 'Human', color: '#b8860b', bg: '#fef4e4', text: '#8b6914', Icon: Brain },
  both: { labelKo: '협업', labelEn: 'Collab', color: '#2d6b2d', bg: '#eaf5ea', text: '#2d6b2d', Icon: Handshake },
  'human→ai': { labelKo: '사람→AI', labelEn: 'Human→AI', color: '#6b4fa0', bg: '#f3eef9', text: '#5a3d8a', Icon: ArrowRight },
  'ai→human': { labelKo: 'AI→사람', labelEn: 'AI→Human', color: '#2d6b6b', bg: '#eaf5f5', text: '#1e5050', Icon: ArrowRight },
};

function actorLabel(actor: string, locale: 'ko' | 'en'): string {
  const a = ACTORS[actor];
  if (!a) return actor;
  return locale === 'ko' ? a.labelKo : a.labelEn;
}

import { extractOptions } from '@/lib/extract-options';

/* ────────────────────────────────────
   Role Distribution Dashboard
   ──────────────────────────────────── */

function RoleDashboard({
  steps,
  checkpoints,
  totalTime,
  onJumpActor,
  onJumpCheckpoint,
}: {
  steps: StepType[];
  checkpoints?: number;
  totalTime?: string;
  onJumpActor: (actor: ActorRelationship | 'human-involved') => void;
  onJumpCheckpoint: () => void;
}) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const total = steps.length || 1;
  const counts: Record<string, number> = { ai: 0, human: 0, both: 0, 'human→ai': 0, 'ai→human': 0 };
  steps.forEach(s => { counts[s.actor] = (counts[s.actor] || 0) + 1; });
  const collaborativeCnt = counts.both + counts['human→ai'] + counts['ai→human'];
  const humanPct = Math.round(((counts.human + collaborativeCnt) / total) * 100);
  const actorOrder: ActorRelationship[] = ['ai', 'ai→human', 'human→ai', 'both', 'human'];

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 mb-5">
      <div className="flex h-2 overflow-hidden bg-[var(--bg)]" aria-hidden="true">
        {actorOrder.filter((actor) => counts[actor] > 0).map((actor) => (
          <span key={actor} className="transition-[width] duration-500" style={{ width: `${(counts[actor] / total) * 100}%`, backgroundColor: ACTORS[actor].color }} />
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-2">
        {actorOrder.filter((actor) => counts[actor] > 0).map((actor) => {
          const actorInfo = ACTORS[actor];
          return (
            <button
              key={actor}
              type="button"
              onClick={() => onJumpActor(actor)}
              className="inline-flex min-h-[28px] items-center gap-1.5 text-[11px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              aria-label={L(`${actorLabel(actor, locale)} 단계 ${counts[actor]}개 중 첫 단계로 이동`, `Go to the first of ${counts[actor]} ${actorLabel(actor, locale)} steps`)}
            >
              <span className="h-2.5 w-2.5 shrink-0" style={{ backgroundColor: actorInfo.color }} />
              {actorLabel(actor, locale)} <span className="tabular-nums text-[var(--text-tertiary)]">{counts[actor]}</span>
            </button>
          );
        })}
      </div>

      {/* Stats — compact */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--border-subtle)] pt-2 text-[12px]">
        <button type="button" onClick={() => onJumpActor('human-involved')} className="font-semibold text-[var(--text-primary)] hover:text-[var(--accent)]">
          {L(`사람 개입 ${humanPct}%`, `Human ${humanPct}%`)}
        </button>
        {checkpoints !== undefined && checkpoints > 0 && (
          <>
            <span className="text-[var(--text-tertiary)]">|</span>
            <button type="button" onClick={onJumpCheckpoint} className="font-semibold text-[var(--warning)] hover:underline"><Flag size={10} className="inline mr-0.5" />{L(`체크포인트 ${checkpoints}`, `${checkpoints} checkpoint${checkpoints === 1 ? '' : 's'}`)} <span className="font-normal text-[var(--text-secondary)]">{L('(사람 확인 필수)', '(human review required)')}</span></button>
          </>
        )}
        {totalTime && (
          <>
            <span className="text-[var(--text-tertiary)]">|</span>
            <span className="text-[var(--text-secondary)]"><Clock size={10} className="inline mr-0.5" />{L(`총 ${totalTime}`, `Total ${totalTime}`)}</span>
          </>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────
   Actor Toggle — 3-position pill
   ──────────────────────────────────── */

function ActorToggle({
  current,
  onChange,
}: {
  current: ActorRelationship;
  onChange: (actor: ActorRelationship) => void;
}) {
  const locale = useLocale();
  const options: ActorRelationship[] = ['ai', 'ai→human', 'human→ai', 'human'];
  // Legacy 'both' → highlight 'human→ai' as closest match
  const effectiveCurrent = current === 'both' ? 'human→ai' : current;
  return (
    <div className="inline-flex flex-wrap items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)]/80 p-0.5">
      {options.map((actor) => {
        const a = ACTORS[actor];
        const active = effectiveCurrent === actor;
        const AIcon = a.Icon;
        return (
          <button
            key={actor}
            onClick={(e) => { e.stopPropagation(); onChange(actor); }}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold
              transition-all duration-200 cursor-pointer
              ${active
                ? 'shadow-sm'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
              }
            `}
            style={active ? { backgroundColor: a.color, color: '#fff' } : {}}
          >
            <AIcon size={11} />
            {actorLabel(actor, locale)}
          </button>
        );
      })}
    </div>
  );
}

/* ────────────────────────────────────
   Main Component
   ──────────────────────────────────── */

export function WorkflowGraph({
  steps,
  analysis,
  editable = false,
  onUpdateActor,
  onToggleCheckpoint,
  onRemoveStep,
  onUpdateField,
}: WorkflowGraphProps) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const rawCritical = new Set(analysis?.critical_path || []);
  // If more than half the steps are "critical", it's meaningless — suppress
  const criticalSet = rawCritical.size > Math.ceil(steps.length / 2) ? new Set<number>() : rawCritical;
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const toggleStep = (i: number) => setExpandedSteps(prev => {
    const next = new Set(prev);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    return next;
  });
  const jumpToStep = (index: number) => {
    if (index < 0) return;
    setExpandedSteps((previous) => new Set(previous).add(index));
    window.setTimeout(() => {
      const target = document.getElementById(`recast-step-${index}`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target?.focus();
    }, 0);
  };

  return (
    <div>
      {/* ── Dashboard — unified bar ── */}
      <RoleDashboard
        steps={steps}
        checkpoints={steps.filter(s => s.checkpoint).length}
        totalTime={analysis?.total_estimated_time}
        onJumpActor={(actor) => jumpToStep(steps.findIndex((step) => actor === 'human-involved' ? step.actor !== 'ai' : step.actor === actor))}
        onJumpCheckpoint={() => jumpToStep(steps.findIndex((step) => step.checkpoint))}
      />

      {/* ── Lane headers — large, centered in each half ── */}
      <div className="hidden md:grid grid-cols-2 gap-0 mb-4">
        <div className="flex items-center justify-center gap-2 py-2 rounded-l-lg" style={{ backgroundColor: `${ACTORS.ai.color}08` }}>
          <Bot size={16} style={{ color: ACTORS.ai.text }} />
          <span className="text-[15px] font-bold" style={{ color: ACTORS.ai.text }}>{L('AI 실행', 'AI Execution')}</span>
        </div>
        <div className="flex items-center justify-center gap-2 py-2 rounded-r-lg" style={{ backgroundColor: `${ACTORS.human.color}08` }}>
          <Brain size={16} style={{ color: ACTORS.human.text }} />
          <span className="text-[15px] font-bold" style={{ color: ACTORS.human.text }}>{L('사람 판단', 'Human Judgment')}</span>
        </div>
      </div>

      {/* ── Steps in lane layout ── */}
      <div className="relative">
        {/* Center line (desktop only) */}
        <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-[var(--border-subtle)] -translate-x-1/2" />

        <div className="space-y-3">
          {steps.map((step, i) => {
            const a = ACTORS[step.actor] || ACTORS.ai;
            const AIcon = a.Icon;
            const isCritical = criticalSet.has(i + 1) || criticalSet.has(i);
            const options = extractOptions(step.judgment);

            // Lane positioning
            const laneClass = step.actor === 'ai'
              ? 'md:mr-[52%]'                    // left lane
              : step.actor === 'human'
              ? 'md:ml-[52%]'                    // right lane
              : '';                               // full width (collaboration / directional)

            const isExpanded = expandedSteps.has(i);
            const hasInput = !!(step.user_ai_guide?.trim() || step.user_decision?.trim());

            return (
              <div id={`recast-step-${i}`} tabIndex={-1} key={i} className={`relative scroll-mt-24 focus:outline-none ${laneClass}`}>
                <div
                  className={`rounded-xl overflow-hidden transition-all cursor-pointer bg-[var(--surface)] ${
                    isCritical ? 'ring-1 ring-red-200' : ''
                  } ${isExpanded ? 'shadow-md border border-[var(--border)]' : 'border border-[var(--border-subtle)] hover:border-[var(--border)]'}`}
                  style={{ borderLeft: `3px solid ${a.color}` }}
                  onClick={() => toggleStep(i)}
                >
                  {/* Card body — clean white, no pastel tint */}
                  <div className="px-4 py-3 bg-[var(--surface)]">
                    {/* Header: number + actor + task + time */}
                    <div className="flex items-start gap-2.5">
                      <div className="shrink-0 flex flex-col items-center gap-0.5">
                        <span
                          className="text-[18px] font-bold tabular-nums leading-none select-none"
                          style={{ color: `${a.color}30` }}
                        >
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        {step.checkpoint && (
                          <span title={L('이 단계는 반드시 사람이 확인해야 합니다', 'This step requires human review')}><Flag size={10} className="text-[var(--warning)]" /></span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {editable ? (
                            <ActorToggle current={step.actor} onChange={(actor) => onUpdateActor?.(i, actor)} />
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold"
                              style={{ backgroundColor: a.color, color: '#fff' }}
                            >
                              <AIcon size={11} /> {actorLabel(step.actor, locale)}
                            </span>
                          )}
                          {isCritical && (
                            <span className="text-[10px] text-[var(--danger)] font-bold flex items-center gap-0.5">
                              <Zap size={10} /> {L('크리티컬', 'Critical')}
                            </span>
                          )}
                          {step.estimated_time && (
                            <span className="text-[11px] text-[var(--text-secondary)] flex items-center gap-1 ml-auto">
                              <Clock size={10} /> {step.estimated_time}
                            </span>
                          )}
                        </div>

                        <p className="text-[14px] font-semibold text-[var(--text-primary)] leading-snug">
                          {step.task}
                        </p>

                        {step.expected_output && (
                          <p className="text-[12px] text-[var(--text-primary)] mt-1.5 flex items-start gap-1.5">
                            <Package size={11} className="shrink-0 mt-0.5 text-[var(--text-secondary)]" />
                            {step.expected_output}
                          </p>
                        )}

                        {/* AI/Human scope for "both" steps */}
                        {step.actor === 'both' && (step.ai_scope || step.human_scope) && (
                          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {step.ai_scope && (
                              <div className="flex items-start gap-1.5 text-[11px] px-2 py-1.5 rounded-md bg-[#3b6dcc]/5">
                                <span className="font-bold text-[var(--ai-fg)] shrink-0">AI:</span>
                                <span className="text-[var(--text-secondary)]">{step.ai_scope}</span>
                              </div>
                            )}
                            {step.human_scope && (
                              <div className="flex items-start gap-1.5 text-[11px] px-2 py-1.5 rounded-md bg-[var(--human-fg)]/5">
                                <span className="font-bold text-[var(--human-fg)] shrink-0">{L('사람', 'Human')}:</span>
                                <span className="text-[var(--text-secondary)]">{step.human_scope}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Filled input indicators (collapsed view) */}
                        {!isExpanded && hasInput && (
                          <div className="flex gap-2 mt-2">
                            {step.user_ai_guide?.trim() && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--ai)] text-[var(--ai-fg)] font-medium">{L('AI 가이드 입력됨', 'AI guide entered')}</span>
                            )}
                            {step.user_decision?.trim() && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--human)] text-[var(--human-fg)] font-medium">{L('결정 입력됨', 'Decision entered')}</span>
                            )}
                          </div>
                        )}

                        {/* Expand hint */}
                        {!isExpanded && editable && (
                          <p className="text-[11px] text-[var(--text-secondary)] mt-2">
                            {step.actor === 'ai'
                              ? L('AI 방향 설정 ↓', 'Set AI direction ↓')
                              : step.actor === 'human'
                              ? L('판단 입력 ↓', 'Enter judgment ↓')
                              : L('방향 설정 & 판단 ↓', 'Set direction & judgment ↓')}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* ── Expanded: inputs + details ── */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] animate-fade-in space-y-3">
                        {/* Actor reasoning */}
                        {step.actor_reasoning && (
                          <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed italic">
                            {step.actor_reasoning}
                          </p>
                        )}

                        {/* AI + Human inputs — side-by-side for "both" */}
                        {editable && step.actor === 'both' ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* AI column */}
                            <div className="rounded-lg p-3" style={{ backgroundColor: `${ACTORS.ai.color}06` }}>
                              <div className="flex items-center gap-1.5 mb-2.5">
                                <Bot size={12} style={{ color: ACTORS.ai.text }} />
                                <p className="text-[12px] font-semibold text-[var(--ai-fg)]">{L('AI 실행 방향', 'AI direction')}</p>
                              </div>
                              {step.ai_direction_options && step.ai_direction_options.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mb-2">
                                  {step.ai_direction_options.map((opt, j) => (
                                    <button
                                      key={j}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const current = step.user_ai_guide || '';
                                        const isSelected = current.includes(opt);
                                        const next = isSelected
                                          ? current.split(', ').filter(s => s !== opt).join(', ')
                                          : current ? `${current}, ${opt}` : opt;
                                        onUpdateField?.(i, { user_ai_guide: next });
                                      }}
                                      className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border cursor-pointer transition-all ${
                                        (step.user_ai_guide || '').includes(opt)
                                          ? 'border-[#3b6dcc] bg-[#3b6dcc]/10 text-[var(--ai-fg)]'
                                          : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[#3b6dcc]/50'
                                      }`}
                                    >
                                      {opt}
                                    </button>
                                  ))}
                                </div>
                              )}
                              <input
                                type="text"
                                value={step.user_ai_guide || ''}
                                onChange={(e) => onUpdateField?.(i, { user_ai_guide: e.target.value })}
                                placeholder={step.ai_direction_options?.length ? L('또는 직접 입력...', 'Or type your own...') : L('예: 국내 시장 중심으로', 'e.g., focus on the domestic market')}
                                className="w-full text-[12px] px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] placeholder:text-[var(--text-tertiary)] focus:border-[#3b6dcc] focus:outline-none"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                            {/* Human column */}
                            <div className="rounded-lg p-3" style={{ backgroundColor: `${ACTORS.human.color}06` }}>
                              <div className="flex items-center gap-1.5 mb-2.5">
                                <Brain size={12} style={{ color: ACTORS.human.text }} />
                                <p className="text-[12px] font-semibold text-[var(--human-fg)]">{L('사람이 결정할 것', 'What the human decides')}</p>
                              </div>
                              {/* Show judgment only when no pills extracted (otherwise redundant) */}
                              {step.judgment?.trim() && options.length === 0 && (
                                <p className="text-[12px] text-[var(--text-primary)] mb-2 leading-relaxed bg-[var(--bg)] rounded-lg px-3 py-2">
                                  {step.judgment.replace(/[:：]\s*$/, '')}
                                </p>
                              )}
                              {options.length > 0 ? (
                                <div className="space-y-2">
                                  <div className="flex flex-wrap gap-1.5">
                                    {options.map((opt, j) => (
                                      <button
                                        key={j}
                                        onClick={(e) => { e.stopPropagation(); onUpdateField?.(i, { user_decision: opt }); }}
                                        className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border cursor-pointer transition-all ${
                                          step.user_decision === opt
                                            ? 'border-[var(--human-fg)] bg-[var(--human-fg)] text-white'
                                            : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--human-fg)] hover:text-[var(--human-fg)]'
                                        }`}
                                      >
                                        {opt}
                                      </button>
                                    ))}
                                  </div>
                                  <input
                                    type="text"
                                    value={options.includes(step.user_decision || '') ? '' : (step.user_decision || '')}
                                    onChange={(e) => onUpdateField?.(i, { user_decision: e.target.value })}
                                    placeholder={L('또는 직접 입력...', 'Or type your own...')}
                                    className="w-full text-[12px] px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--human-fg)] focus:outline-none"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                              ) : (
                                <textarea
                                  value={step.user_decision || ''}
                                  maxLength={2000}
                                  onChange={(e) => onUpdateField?.(i, { user_decision: e.target.value })}
                                  placeholder={L('이 단계에서의 판단을 입력하세요...', 'Enter your judgment for this step...')}
                                  rows={2}
                                  className="w-full text-[12px] px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--human-fg)] focus:outline-none resize-none"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              )}
                            </div>
                          </div>
                        ) : (
                          <>
                            {/* AI guide input (ai-only steps) */}
                            {editable && step.actor === 'ai' && (
                              <div>
                                <p className="text-[12px] font-semibold text-[var(--ai-fg)] mb-1.5">{L('AI 실행 방향', 'AI direction')}</p>
                                {step.ai_direction_options && step.ai_direction_options.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 mb-2">
                                    {step.ai_direction_options.map((opt, j) => (
                                      <button
                                        key={j}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const current = step.user_ai_guide || '';
                                          const isSelected = current.includes(opt);
                                          const next = isSelected
                                            ? current.split(', ').filter(s => s !== opt).join(', ')
                                            : current ? `${current}, ${opt}` : opt;
                                          onUpdateField?.(i, { user_ai_guide: next });
                                        }}
                                        className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border cursor-pointer transition-all ${
                                          (step.user_ai_guide || '').includes(opt)
                                            ? 'border-[#3b6dcc] bg-[#3b6dcc]/10 text-[var(--ai-fg)]'
                                            : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[#3b6dcc]/50'
                                        }`}
                                      >
                                        {opt}
                                      </button>
                                    ))}
                                  </div>
                                )}
                                <input
                                  type="text"
                                  value={step.user_ai_guide || ''}
                                  onChange={(e) => onUpdateField?.(i, { user_ai_guide: e.target.value })}
                                  placeholder={step.ai_direction_options?.length ? L('또는 직접 입력...', 'Or type your own...') : L('예: 국내 시장 중심으로, 최근 3년 데이터 기준으로', 'e.g., focus on the domestic market, based on the last 3 years of data')}
                                  className="w-full text-[12px] px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] placeholder:text-[var(--text-tertiary)] focus:border-[#3b6dcc] focus:outline-none"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                            )}

                            {/* Human judgment + decision (human-only steps) */}
                            {editable && step.actor === 'human' && (
                              <div>
                                <p className="text-[12px] font-semibold text-[var(--human-fg)] mb-1.5">{L('여기서 결정할 것', 'What to decide here')}</p>
                                {step.judgment?.trim() && options.length === 0 && (
                                  <p className="text-[12px] text-[var(--text-primary)] mb-2 leading-relaxed bg-[var(--bg)] rounded-lg px-3 py-2">
                                    {step.judgment.replace(/[:：]\s*$/, '')}
                                  </p>
                                )}
                                {options.length > 0 ? (
                                  <div className="space-y-2">
                                    <div className="flex flex-wrap gap-1.5">
                                      {options.map((opt, j) => (
                                        <button
                                          key={j}
                                          onClick={(e) => { e.stopPropagation(); onUpdateField?.(i, { user_decision: opt }); }}
                                          className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border cursor-pointer transition-all ${
                                            step.user_decision === opt
                                              ? 'border-[var(--human-fg)] bg-[var(--human-fg)] text-white'
                                              : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--human-fg)] hover:text-[var(--human-fg)]'
                                          }`}
                                        >
                                          {opt}
                                        </button>
                                      ))}
                                    </div>
                                    <input
                                      type="text"
                                      value={options.includes(step.user_decision || '') ? '' : (step.user_decision || '')}
                                      onChange={(e) => onUpdateField?.(i, { user_decision: e.target.value })}
                                      placeholder={L('또는 직접 입력...', 'Or type your own...')}
                                      className="w-full text-[12px] px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--human-fg)] focus:outline-none"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </div>
                                ) : (
                                  <textarea
                                    value={step.user_decision || ''}
                                    maxLength={2000}
                                    onChange={(e) => onUpdateField?.(i, { user_decision: e.target.value })}
                                    placeholder={L('이 단계에서의 판단을 입력하세요...', 'Enter your judgment for this step...')}
                                    rows={2}
                                    className="w-full text-[12px] px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--human-fg)] focus:outline-none resize-none"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                )}
                              </div>
                            )}
                          </>
                        )}

                        {/* Read-only filled values */}
                        {!editable && step.user_ai_guide?.trim() && (
                          <div className="rounded-lg bg-[var(--ai)] px-3 py-2">
                            <p className="text-[11px] font-bold text-[var(--ai-fg)] mb-0.5">{L('AI 가이드', 'AI guide')}</p>
                            <p className="text-[12px] text-[var(--text-primary)]">{step.user_ai_guide}</p>
                          </div>
                        )}
                        {!editable && step.user_decision?.trim() && (
                          <div className="rounded-lg bg-[var(--human)] px-3 py-2">
                            <p className="text-[11px] font-bold text-[var(--human-fg)] mb-0.5">{L('결정', 'Decision')}</p>
                            <p className="text-[12px] text-[var(--text-primary)]">{step.user_decision}</p>
                          </div>
                        )}

                        {/* Actor reasoning — readable */}
                        {/* Checkpoint reason — inline warning */}
                        {step.checkpoint && step.checkpoint_reason && (
                          <div className="flex items-start gap-2 text-[11px] bg-[var(--warning)]/10 border border-[var(--warning)]/30 rounded-lg px-3 py-2">
                            <Flag size={11} className="text-[var(--warning)] shrink-0 mt-0.5" />
                            <p className="text-[var(--warning)]"><span className="font-bold">{L('넘어가기 전 확인:', 'Verify before moving on:')}</span> {step.checkpoint_reason}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Edit controls — only in expanded editable */}
                  {editable && isExpanded && (
                    <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--bg)] border-t border-[var(--border-subtle)]">
                      <button
                        onClick={(e) => { e.stopPropagation(); onToggleCheckpoint?.(i); }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border cursor-pointer transition-colors ${
                          step.checkpoint
                            ? 'border-amber-400 bg-[var(--warning)]/10 text-[var(--warning)]'
                            : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--warning)]/30'
                        }`}
                      >
                        <Flag size={10} className="inline mr-1" /> {step.checkpoint ? L('확인 필수 해제', 'Remove required check') : L('확인 필수로 설정', 'Mark as required check')}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onRemoveStep?.(i); }}
                        className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-red-500 hover:bg-[var(--danger)]/10 cursor-pointer transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
