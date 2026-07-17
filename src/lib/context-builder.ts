import { getStorage, STORAGE_KEYS } from '@/lib/storage';
import type { JudgmentRecord, ReframeItem, RecastItem, SynthesizeItem, PersonaAccuracyRating } from '@/stores/types';
import { getCurrentLanguage } from '@/lib/i18n';
import { buildStoredPromptInfluence } from '@/lib/epistemic/control-plane';
import { generateId } from '@/lib/uuid';

export interface EnhancedPromptInfluenceOptions {
  callId?: string;
  domain?: string;
  sessionId?: string;
  role?: string;
}

/**
 * Returns the LLM response-language directive.
 * Appended to every enhanced system prompt so the model outputs in the user's locale
 * regardless of the prompt body's language.
 */
function getLocaleDirective(): string {
  const locale = getCurrentLanguage();
  const lang = locale === 'ko' ? 'Korean' : 'English';
  return `\n\n---\n\n## Response Language\nAlways respond in ${lang}. Headings, field values (not JSON keys), explanations, examples — all in ${lang}. Do not mix languages.`;
}

/**
 * Adds explicit judgments from the current project to a system prompt.
 * Derived cross-history memory remains quarantined until E2 can issue a
 * revocable, scoped grant and record exactly what influenced the prompt.
 */
export function buildEnhancedSystemPrompt(
  basePrompt: string,
  projectId?: string,
  influence?: EnhancedPromptInfluenceOptions,
): string {
  const ko = getCurrentLanguage() === 'ko';
  const judgments = getStorage<JudgmentRecord[]>(STORAGE_KEYS.JUDGMENTS, []);

  const sections: string[] = [];

  // E2 single influence gate. With no explicitly user-authorized E grant this
  // returns no prompt section. When it does return one, it has already written
  // the corresponding used/excluded trace and stays ahead of the legacy 1200
  // character context bound so a traced section cannot be silently truncated.
  const eInfluence = buildStoredPromptInfluence({
    call_id: influence?.callId ?? `web-prompt:${generateId()}`,
    surface: 'web',
    domain: influence?.domain,
    project_id: projectId,
    session_id: influence?.sessionId,
    role: influence?.role,
    prompt_budget_chars: 800,
  });
  sections.push(...eInfluence.prompt_sections);

  // Same-project user decisions are explicit context, not derived identity.
  if (projectId) {
    const projectContext = buildProjectContext(projectId, judgments);
    if (projectContext) {
      sections.push(ko
        ? `## 이 프로젝트에서의 이전 판단\n${projectContext}`
        : `## Prior judgments in this project\n${projectContext}`);
    }
  }

  if (sections.length === 0) return basePrompt + getLocaleDirective();

  // Append as a bounded context section
  const contextSection = sections.join('\n\n').slice(0, 1200);

  return `${basePrompt}\n\n---\n\n${contextSection}${getLocaleDirective()}`;
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
