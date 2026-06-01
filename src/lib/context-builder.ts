import { getStorage, STORAGE_KEYS } from '@/lib/storage';
import { getSignalsByType } from '@/lib/signal-recorder';
import { getEvalSummary, getStageEvalSummary } from '@/lib/eval-engine';
import type { JudgmentRecord, ReframeItem, RecastItem, SynthesizeItem, PersonaAccuracyRating, Project, OutcomeRecord } from '@/stores/types';
import { getActionableInsights } from '@/lib/retrospective';
import { getCurrentLanguage } from '@/lib/i18n';

/**
 * Returns the LLM response-language directive.
 * Appended to every enhanced system prompt so the model outputs in the user's locale
 * regardless of the prompt body's language.
 */
function getLocaleDirective(): string {
  return getCurrentLanguage() === 'ko'
    ? '\n\n---\n\n## Response Language\n한국어로만 응답하세요. 제목, 필드 이름(JSON key 제외), 설명, 예시 — 모두 한국어.'
    : '\n\n---\n\n## Response Language\nRespond in English only. Headings, field values (not JSON keys), explanations, examples — all English. Do not mix languages.';
}

/**
 * Builds an enhanced system prompt by injecting user patterns and project context.
 * This is the core "learning" mechanism — past judgments influence future AI suggestions.
 */
export function buildEnhancedSystemPrompt(
  basePrompt: string,
  projectId?: string,
): string {
  const ko = getCurrentLanguage() === 'ko';
  const judgments = getStorage<JudgmentRecord[]>(STORAGE_KEYS.JUDGMENTS, []);
  if (judgments.length === 0) return basePrompt + getLocaleDirective();

  const sections: string[] = [];

  // 1. User pattern summary
  const patterns = analyzePatterns(judgments);
  if (patterns) {
    sections.push(ko
      ? `## 사용자 패턴 (과거 ${judgments.length}건의 판단 기반)\n${patterns}`
      : `## User pattern (based on ${judgments.length} past judgments)\n${patterns}`);
  }

  // 2. Project-specific context
  if (projectId) {
    const projectContext = buildProjectContext(projectId, judgments);
    if (projectContext) {
      sections.push(ko
        ? `## 이 프로젝트에서의 이전 판단\n${projectContext}`
        : `## Prior judgments in this project\n${projectContext}`);
    }
  }

  // 3. Coda reflections from past projects (learning loop)
  const codaInsights = buildCodaInsights(projectId);
  if (codaInsights) {
    sections.push(codaInsights);
  }

  // 4. (Removed) Convergence patterns from past refine loops —
  //     legacy RefineStep path is gone. Intentionally no-op.

  // 5. Outcome-based insights (Phase 1)
  const outcomes = getStorage<OutcomeRecord[]>(STORAGE_KEYS.OUTCOME_RECORDS, []).filter(o => o.project_id !== projectId);
  if (outcomes.length >= 2) {
    const successCount = outcomes.filter(o => o.overall_success === 'exceeded' || o.overall_success === 'met').length;
    const unspoken = outcomes.flatMap(o => o.materialized_risks).filter(r => r.category === 'unspoken');
    const unspokenHit = unspoken.filter(r => r.actually_happened);
    const lines = ko
      ? [`## 과거 프로젝트 결과 학습`, `- 성공률: ${Math.round(successCount / outcomes.length * 100)}%`]
      : [`## Learning from past project outcomes`, `- Success rate: ${Math.round(successCount / outcomes.length * 100)}%`];
    if (unspoken.length >= 2 && unspokenHit.length / unspoken.length > 0.5) {
      lines.push(ko
        ? '- ⚠️ 침묵의 리스크가 자주 실현됩니다. unspoken 리스크에 더 주의하세요.'
        : '- ⚠️ Unspoken risks materialize often. Pay extra attention to unspoken risks.');
    }
    sections.push(lines.join('\n'));
  }

  // 6. Retrospective actionable insights (Phase 2)
  const retroInsights = getActionableInsights(projectId);
  if (retroInsights.length > 0) {
    const header = ko ? '## 이전 프로젝트 성찰 교훈\n' : '## Lessons from prior project retrospectives\n';
    sections.push(header + retroInsights.map(i => `- "${i}"`).join('\n'));
  }

  // 7. Axis Fingerprint + Eval-based adaptation (Phase 3: Active Adaptation)
  const adaptiveCtx = buildAdaptiveContext();
  if (adaptiveCtx) sections.push(adaptiveCtx);

  if (sections.length === 0) return basePrompt + getLocaleDirective();

  // Append as a bounded context section
  const contextSection = sections.join('\n\n').slice(0, 1200);

  return `${basePrompt}\n\n---\n\n${contextSection}${getLocaleDirective()}`;
}

function analyzePatterns(judgments: JudgmentRecord[]): string | null {
  if (judgments.length < 2) return null;

  const lines: string[] = [];

  // Actor/override patterns — LIGHT reference only, content-based judgment is primary
  const overridesWithDirection = getSignalsByType('actor_override_direction');
  if (overridesWithDirection.length >= 3) {
    const aiToHuman = overridesWithDirection.filter(s => s.signal_data.from_actor === 'ai' && s.signal_data.to_actor === 'human').length;
    const humanToAi = overridesWithDirection.filter(s => s.signal_data.from_actor === 'human' && s.signal_data.to_actor === 'ai').length;
    if (aiToHuman > humanToAi * 2) {
      lines.push(`- 참고: 이 사용자는 과거에 AI→사람 변경 ${aiToHuman}건. 내용에 따라 판단하되, 판단·전략 성격의 작업은 사람 배정을 고려.`);
    } else if (humanToAi > aiToHuman * 2) {
      lines.push(`- 참고: 이 사용자는 과거에 사람→AI 위임 ${humanToAi}건. AI 활용에 적극적.`);
    }
  }

  // Hidden question preference
  const questionSelections = judgments.filter((j) => j.type === 'hidden_question_selection' && j.user_changed);
  if (questionSelections.length >= 2) {
    lines.push('- 이 사용자는 AI가 제안한 질문을 자주 직접 수정합니다. 다양한 관점의 질문을 제안하세요.');
  }

  return lines.length > 0 ? lines.join('\n') : null;
}

function buildProjectContext(projectId: string, judgments: JudgmentRecord[]): string | null {
  const projectJudgments = judgments
    .filter((j) => j.project_id === projectId)
    .slice(-5); // last 5 judgments for this project

  if (projectJudgments.length === 0) return null;

  const lines = projectJudgments.map((j) => {
    const typeLabels: Record<string, string> = {
      hidden_question_selection: '질문 선택',
      conflict_resolution: '쟁점 판단',
      actor_override: '역할 변경',
      feedback_accuracy: '피드백 정확도',
    };
    return `- [${typeLabels[j.type] || j.type}] ${j.context}: "${j.decision}"`;
  });

  return lines.join('\n');
}

/**
 * Build insights from past project coda reflections.
 * This closes the learning loop: coda → next project's AI prompt.
 */
function buildCodaInsights(excludeProjectId?: string): string | null {
  const projects = getStorage<Project[]>(STORAGE_KEYS.PROJECTS, []);
  const withReflection = projects
    .filter((p) => p.meta_reflection && p.id !== excludeProjectId)
    .filter((p) => p.meta_reflection!.surprising_discovery || p.meta_reflection!.next_time_differently)
    .sort((a, b) => (b.meta_reflection!.created_at || '').localeCompare(a.meta_reflection!.created_at || ''))
    .slice(0, 3);

  if (withReflection.length === 0) return null;

  const ko = getCurrentLanguage() === 'ko';
  const lines: string[] = [ko ? '## 이전 프로젝트에서의 깨달음' : '## Lessons from prior projects'];
  for (const p of withReflection) {
    const r = p.meta_reflection!;
    if (r.surprising_discovery) {
      lines.push(ko
        ? `- ${p.name}: 놀라운 발견 — "${r.surprising_discovery}"`
        : `- ${p.name}: surprising discovery — "${r.surprising_discovery}"`);
    }
    if (r.next_time_differently) {
      lines.push(ko
        ? `- ${p.name}: 다음에 다르게 — "${r.next_time_differently}"`
        : `- ${p.name}: next time, differently — "${r.next_time_differently}"`);
    }
  }
  return lines.join('\n');
}

/**
 * Build a rich context string from related project items for cross-tool awareness.
 */
export function buildProjectItemsContext(projectId: string): string {
  const decompositions = getStorage<ReframeItem[]>(STORAGE_KEYS.REFRAME_LIST, [])
    .filter((d) => d.project_id === projectId && d.status === 'done');
  const recasts = getStorage<RecastItem[]>(STORAGE_KEYS.RECAST_LIST, [])
    .filter((o) => o.project_id === projectId && o.status === 'done');
  const syntheses = getStorage<SynthesizeItem[]>(STORAGE_KEYS.SYNTHESIZE_LIST, [])
    .filter((s) => s.project_id === projectId && s.status === 'done');

  const parts: string[] = [];

  if (decompositions.length > 0) {
    const latest = [...decompositions].sort((a, b) => (a.created_at || '').localeCompare(b.created_at || '')).pop()!;
    if (latest.analysis) {
      parts.push(`[항로 재설정] 핵심 질문: ${latest.selected_question || latest.analysis.surface_task}`);
    }
  }

  if (recasts.length > 0) {
    const latest = [...recasts].sort((a, b) => (a.created_at || '').localeCompare(b.created_at || '')).pop()!;
    if (latest.analysis) {
      parts.push(`[선원 배치] ${latest.steps.length}단계, AI ${latest.analysis.ai_ratio}% / 사람 ${latest.analysis.human_ratio}%`);
    }
  }

  if (syntheses.length > 0) {
    const latest = [...syntheses].sort((a, b) => (a.created_at || '').localeCompare(b.created_at || '')).pop()!;
    if (latest.final_synthesis) {
      parts.push(`[합성 결론] ${latest.final_synthesis.slice(0, 100)}`);
    }
  }

  return parts.length > 0 ? parts.join('\n') : '';
}

/**
 * Build persona behavior model from accumulated accuracy data.
 * Phase 3: Structured aspect-level accuracy + calibration guidance.
 */
export function buildPersonaAccuracyContext(personaId: string): string {
  const ratings = getStorage<PersonaAccuracyRating[]>(STORAGE_KEYS.ACCURACY_RATINGS, [])
    .filter((r) => r.persona_id === personaId);

  if (ratings.length < 2) return '';

  const avg = ratings.reduce((sum, r) => sum + r.accuracy_score, 0) / ratings.length;
  const lines: string[] = [];

  lines.push(`## 페르소나 행동 모델 (${ratings.length}회 평가, 정확도 ${avg.toFixed(1)}/5)`);

  // Aspect-level accuracy analysis
  const aspectCounts: Record<string, { accurate: number; inaccurate: number }> = {};
  for (const r of ratings) {
    for (const a of r.which_aspects_accurate) {
      if (!aspectCounts[a]) aspectCounts[a] = { accurate: 0, inaccurate: 0 };
      aspectCounts[a].accurate++;
    }
    for (const a of r.which_aspects_inaccurate) {
      if (!aspectCounts[a]) aspectCounts[a] = { accurate: 0, inaccurate: 0 };
      aspectCounts[a].inaccurate++;
    }
  }

  const good = Object.entries(aspectCounts)
    .filter(([, v]) => v.accurate > v.inaccurate)
    .sort(([, a], [, b]) => (b.accurate - b.inaccurate) - (a.accurate - a.inaccurate));
  const bad = Object.entries(aspectCounts)
    .filter(([, v]) => v.inaccurate >= v.accurate)
    .sort(([, a], [, b]) => (b.inaccurate - b.accurate) - (a.inaccurate - a.accurate));

  if (good.length > 0) {
    lines.push('');
    lines.push('### 강점 (유지)');
    good.forEach(([aspect, counts]) => {
      const accuracy = Math.round((counts.accurate / (counts.accurate + counts.inaccurate)) * 100);
      lines.push(`- ${aspect} (${accuracy}% 정확) — 이 수준을 유지하세요.`);
    });
  }

  if (bad.length > 0) {
    lines.push('');
    lines.push('### 보정 필요 (개선)');
    bad.forEach(([aspect, counts]) => {
      const accuracy = Math.round((counts.accurate / (counts.accurate + counts.inaccurate)) * 100);
      lines.push(`- ${aspect} (${accuracy}% 정확) — 이 부분에서 더 현실적으로 조정하세요.`);
    });
  }

  // Calibration guidance based on overall accuracy pattern
  if (avg < 2.5) {
    lines.push('');
    lines.push('### 보정 지시');
    lines.push('- 전반적으로 시뮬레이션이 실제와 많이 달랐습니다. 더 보수적이고 현실적으로 접근하세요.');
    lines.push('- 극단적 반응보다는 실무적 관점을 우선하세요.');
  } else if (avg > 4.0) {
    lines.push('');
    lines.push('### 보정 지시');
    lines.push('- 시뮬레이션이 매우 정확합니다. 현재 접근 방식을 유지하세요.');
  } else if (bad.length > good.length) {
    lines.push('');
    lines.push('### 보정 지시');
    lines.push(`- 부정확한 측면(${bad.map(([k]) => k).join(', ')})에 집중하여 개선하세요.`);
    lines.push(`- 정확했던 측면(${good.map(([k]) => k).join(', ')})의 톤과 깊이를 유지하세요.`);
  }

  // Cross-project persona knowledge: extract common concern patterns
  const allNotes = ratings
    .filter(r => r.accuracy_notes)
    .map(r => r.accuracy_notes!)
    .slice(-5);
  if (allNotes.length >= 2) {
    lines.push('');
    lines.push('### 사용자 피드백 메모 (최근)');
    allNotes.forEach(n => lines.push(`- "${n}"`));
  }

  return lines.join('\n');
}

/**
 * Build adaptive context from user's decision-making patterns.
 *
 * Phase 3: Active Adaptation — 피드백 루프를 닫는 핵심 함수.
 * Axis Fingerprint (T3) + Sliding Windows (T6) + eval 기반 약점을 주입한다.
 *
 * CLAUDE.md 가이드라인 준수:
 * - "참고: ..." (reference only, not directive)
 * - Content-based judgment is always primary
 * - 최대 5줄
 */
function buildAdaptiveContext(): string | null {
  const evalSummary = getEvalSummary();

  // Gate: 5회 이상 사용 시에만 적응 시작 (premature adaptation 방지)
  if (evalSummary.total_sessions < 5) return null;

  const lines: string[] = ['## 적응형 컨텍스트 (이 사용자의 판단 패턴)'];

  // ── Axis Fingerprint: 최근 10건의 가정 축 분포 (Sliding Window: process = last 10) ──
  const reframeItems = getStorage<ReframeItem[]>(STORAGE_KEYS.REFRAME_LIST, []);
  const doneItems = reframeItems.filter(d => d.status === 'done' && d.analysis);
  const recentItems = doneItems.slice(-10);

  if (recentItems.length >= 3) {
    const axisCounts: Record<string, number> = {
      customer_value: 0, feasibility: 0, business: 0, org_capacity: 0,
    };
    let total = 0;
    for (const item of recentItems) {
      for (const a of item.analysis!.hidden_assumptions || []) {
        if (a.axis && a.axis in axisCounts) {
          axisCounts[a.axis]++;
          total++;
        }
      }
    }

    if (total >= 8) { // 최소 8개 가정이 있어야 축 분포를 신뢰 (과잉 해석 방지)
      const axisLabels: Record<string, string> = {
        customer_value: '고객 가치', feasibility: '실현 가능성',
        business: '비즈니스', org_capacity: '조직 역량',
      };
      const avgPct = 25; // 4 axes = 25% each is balanced
      const gaps = Object.entries(axisCounts)
        .filter(([, count]) => (count / total) * 100 < avgPct * 0.5) // below half of average
        .map(([axis]) => axisLabels[axis] || axis);

      if (gaps.length > 0) {
        lines.push(`- 참고: 최근 ${recentItems.length}건 분석에서 ${gaps.join(', ')} 관점의 가정이 탐색되지 않았습니다. 이 축에서도 가정을 생성해주세요.`);
      }
    }
  }

  // ── Reframe acceptance pattern (Sliding Window: process = last 10) ──
  const recentDone = doneItems.slice(-8);
  if (recentDone.length >= 5) {
    const accepted = recentDone.filter(d => {
      if (!d.analysis) return false;
      return d.selected_question === d.analysis.reframed_question;
    }).length;
    const acceptRate = accepted / recentDone.length;
    if (acceptRate > 0.8) {
      lines.push(`- 참고: 이 사용자는 최근 ${recentDone.length}회 중 ${accepted}회에서 첫 reframe을 수락했습니다. 대안적 프레이밍을 더 강하게 제시해주세요.`);
    }
  }

  // ── Eval 기반 약점 (전체 이력, blind spot = all-time) ──
  const reframeSummary = getStageEvalSummary('reframe');
  if (reframeSummary && reframeSummary.total_sessions >= 5) {
    const rates = reframeSummary.per_eval_rates;
    if (rates['assumptions_diverse'] !== undefined && rates['assumptions_diverse'] < 0.5) {
      lines.push('- 참고: 가정의 다양성(다양한 축 커버)이 낮은 편입니다. 가정을 생성할 때 customer, feasibility, business, org 4축을 모두 고려하세요.');
    }
    if (rates['assumptions_engaged'] !== undefined && rates['assumptions_engaged'] < 0.5) {
      lines.push('- 참고: 사용자가 가정 평가를 자주 건너뜁니다. 핵심 가정 2-3개를 특히 강조해서 평가를 유도하세요.');
    }
  }

  // 최대 5줄 (header 제외)
  if (lines.length <= 1) return null; // header만 있으면 의미 없음
  return lines.slice(0, 6).join('\n'); // header + max 5 insight lines
}

