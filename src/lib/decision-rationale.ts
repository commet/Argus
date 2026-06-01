import { getStorage, STORAGE_KEYS } from './storage';
import { getCurrentLanguage } from '@/lib/i18n';
import type {
  Project, ReframeItem, RecastItem,
  FeedbackRecord, JudgmentRecord,
  Persona,
} from '@/stores/types';

export function generateDecisionRationale(project: Project | null): string {
  if (!project) return '';
  const ko = getCurrentLanguage() === 'ko';
  const L = (k: string, e: string) => (ko ? k : e);

  const decompositions = getStorage<ReframeItem[]>(STORAGE_KEYS.REFRAME_LIST, [])
    .filter(d => d.project_id === project.id && d.status === 'done');
  const recasts = getStorage<RecastItem[]>(STORAGE_KEYS.RECAST_LIST, [])
    .filter(o => o.project_id === project.id);
  const feedbacks = getStorage<FeedbackRecord[]>(STORAGE_KEYS.FEEDBACK_HISTORY, [])
    .filter(f => f.project_id === project.id);
  const personas = getStorage<Persona[]>(STORAGE_KEYS.PERSONAS, []);
  const judgments = getStorage<JudgmentRecord[]>(STORAGE_KEYS.JUDGMENTS, [])
    .filter(j => j.project_id === project.id);

  const d = decompositions[decompositions.length - 1];
  const o = recasts[recasts.length - 1];
  const fb = feedbacks[feedbacks.length - 1];

  const s: string[] = [];
  const dateStr = new Date().toLocaleDateString(ko ? 'ko-KR' : 'en-US', ko ? undefined : { year: 'numeric', month: 'short', day: 'numeric' });

  s.push(L(`# 판단 근거서: ${project.name}`, `# Decision Rationale: ${project.name}`));
  s.push(L(
    `> 생성일 ${dateStr} — 이 문서는 각 단계에서 *왜 이렇게 판단했는가*를 기록합니다.`,
    `> Generated ${dateStr} — This document records *why each decision was made* at each stage.`,
  ));
  s.push('');

  // ── Executive Summary ──
  {
    const parts: string[] = [];
    if (d?.analysis) {
      parts.push(L(
        `원래 과제는 "${d.analysis.surface_task}"였으나, 전제 점검 결과 "${d.selected_question || d.analysis.reframed_question}"로 질문을 재정의했습니다.`,
        `The original task was "${d.analysis.surface_task}"; after checking assumptions, the question was reframed to "${d.selected_question || d.analysis.reframed_question}".`,
      ));
    }
    if (o?.analysis) {
      const nSteps = o.steps?.length || 0;
      parts.push(L(
        `${nSteps}단계 워크플로우를 설계했으며, 핵심 방향은 "${o.analysis.governing_idea}"입니다.`,
        `Designed a ${nSteps}-step workflow with the governing idea: "${o.analysis.governing_idea}".`,
      ));
    }
    if (fb) {
      const critical = fb.results.flatMap(r => r.classified_risks?.filter(cr => cr.category === 'critical') || []);
      const unspoken = fb.results.flatMap(r => r.classified_risks?.filter(cr => cr.category === 'unspoken') || []);
      if (critical.length || unspoken.length) {
        parts.push(L(
          `이해관계자 검증에서 핵심 위협 ${critical.length}건, 침묵의 리스크 ${unspoken.length}건을 발견했습니다.`,
          `Stakeholder validation surfaced ${critical.length} critical threat${critical.length === 1 ? '' : 's'} and ${unspoken.length} unspoken risk${unspoken.length === 1 ? '' : 's'}.`,
        ));
      }
    }
    if (parts.length > 0) {
      s.push(L('## 요약', '## Summary'));
      s.push('');
      s.push(parts.join(' '));
      s.push('');
    }
  }

  // ── 1. 과제 재정의 ──
  if (d?.analysis) {
    const a = d.analysis;
    s.push(L('## 1. 과제 재정의', '## 1. Task Reframe'));
    s.push('');
    s.push(L(`**원래 과제**: ${a.surface_task}`, `**Original task**: ${a.surface_task}`));
    s.push('');

    if (a.hidden_assumptions?.length) {
      s.push(L('**전제 점검 결과**:', '**Assumption check results**:'));
      for (const ha of a.hidden_assumptions) {
        if (typeof ha === 'string') {
          s.push(`- "${ha}"`);
        } else {
          const evalLabel = ha.evaluation === 'likely_true' ? L('✅ 확인', '✅ Confirmed')
            : ha.evaluation === 'doubtful' ? L('❌ 의심', '❌ Doubtful')
            : ha.evaluation === 'uncertain' ? L('❓ 불확실', '❓ Uncertain')
            : L('⬜ 미평가', '⬜ Unevaluated');
          const ifFalse = ha.risk_if_false ? L(` → 거짓이면: ${ha.risk_if_false}`, ` → If false: ${ha.risk_if_false}`) : '';
          s.push(`- [${evalLabel}] "${ha.assumption}"${ifFalse}`);
        }
      }
      s.push('');
    }

    s.push(L(
      `**재정의된 질문**: ${d.selected_question || a.reframed_question}`,
      `**Reframed question**: ${d.selected_question || a.reframed_question}`,
    ));
    if (a.why_reframing_matters) {
      s.push(L(`**왜 재정의했는가**: ${a.why_reframing_matters}`, `**Why reframe**: ${a.why_reframing_matters}`));
    }
    s.push('');

    // 선택하지 않은 대안
    if (a.hidden_questions?.length > 1) {
      const selected = d.selected_question;
      const alts = a.hidden_questions.filter(hq => hq.question !== selected);
      if (alts.length) {
        s.push(L('**검토했으나 선택하지 않은 방향**:', '**Alternatives considered but not chosen**:'));
        for (const alt of alts) {
          s.push(L(`- ${alt.question} (택하면: ${alt.reasoning})`, `- ${alt.question} (if chosen: ${alt.reasoning})`));
        }
        s.push('');
      }
    }

    if (a.ai_limitations?.length) {
      s.push(L(`**AI 한계**: ${a.ai_limitations.join(' / ')}`, `**AI limitations**: ${a.ai_limitations.join(' / ')}`));
      s.push('');
    }
  }

  // ── 2. 실행 설계 ──
  if (o?.analysis) {
    const a = o.analysis;
    s.push(L('## 2. 실행 설계 근거', '## 2. Execution Design Rationale'));
    s.push('');
    s.push(L(`**핵심 방향**: ${a.governing_idea}`, `**Governing idea**: ${a.governing_idea}`));
    s.push('');

    if (a.storyline) {
      s.push(L('**논리 구조**:', '**Narrative structure**:'));
      s.push(L(`- 상황: ${a.storyline.situation}`, `- Situation: ${a.storyline.situation}`));
      s.push(L(`- 문제: ${a.storyline.complication}`, `- Complication: ${a.storyline.complication}`));
      s.push(L(`- 접근: ${a.storyline.resolution}`, `- Resolution: ${a.storyline.resolution}`));
      s.push('');
    }

    if (o.steps?.length) {
      const actor = (a: string) => a === 'ai' ? 'AI' : a === 'human' ? L('사람', 'Human') : L('협업', 'Both');
      s.push(L(`**워크플로우** (${o.steps.length}단계):`, `**Workflow** (${o.steps.length} steps):`));
      o.steps.forEach((step, i) => {
        s.push(`${i + 1}. [${actor(step.actor)}] ${step.task} → ${step.expected_output}${step.checkpoint ? ' ⚑' : ''}`);
        if (step.checkpoint && step.checkpoint_reason) {
          s.push(L(`   체크포인트: ${step.checkpoint_reason}`, `   Checkpoint: ${step.checkpoint_reason}`));
        }
        if (step.judgment) {
          s.push(L(`   판단 포인트: ${step.judgment}`, `   Judgment point: ${step.judgment}`));
        }
      });
      s.push('');
    }

    if (a.design_rationale) {
      s.push(L(`**이 설계의 근거**: ${a.design_rationale}`, `**Rationale for this design**: ${a.design_rationale}`));
      s.push('');
    }

    if (a.key_assumptions?.length) {
      s.push(L('**핵심 가정**:', '**Key assumptions**:'));
      for (const ka of a.key_assumptions) {
        const imp = ka.importance === 'high' ? '🔴' : '🟡';
        const certainty = ka.certainty === 'high' ? L('높음', 'High')
          : ka.certainty === 'medium' ? L('중간', 'Medium')
          : L('낮음', 'Low');
        s.push(L(
          `- ${imp} ${ka.assumption} (확신도: ${certainty})`,
          `- ${imp} ${ka.assumption} (confidence: ${certainty})`,
        ));
        if (ka.if_wrong) s.push(L(`  틀리면 → ${ka.if_wrong}`, `  If wrong → ${ka.if_wrong}`));
      }
      s.push('');
    }
  }

  // ── 3. 이해관계자 검증 ──
  if (fb) {
    s.push(L('## 3. 이해관계자 검증', '## 3. Stakeholder Validation'));
    s.push('');

    for (const result of fb.results) {
      const persona = personas.find(p => p.id === result.persona_id);
      const name = persona?.name || L('이해관계자', 'Stakeholder');
      const influence = persona?.influence === 'high' ? L(' (영향력 높음)', ' (high influence)') : '';
      s.push(`### ${name}${influence}`);
      s.push('');
      s.push(L(`**반응**: "${result.overall_reaction}"`, `**Reaction**: "${result.overall_reaction}"`));
      s.push('');

      if (result.failure_scenario) {
        s.push(L(`**실패 시나리오**: ${result.failure_scenario}`, `**Failure scenario**: ${result.failure_scenario}`));
        s.push('');
      }

      if (result.classified_risks?.length) {
        s.push(L('**리스크 분류**:', '**Risk categorization**:'));
        for (const risk of result.classified_risks) {
          const icon = risk.category === 'critical' ? L('🔴 핵심 위협', '🔴 Critical threat')
            : risk.category === 'manageable' ? L('🟡 관리 가능', '🟡 Manageable')
            : L('🟣 침묵의 리스크', '🟣 Unspoken risk');
          s.push(`- ${icon}: ${risk.text}`);
        }
        s.push('');
      }

      if (result.approval_conditions?.length) {
        s.push(L('**승인 조건**:', '**Approval conditions**:'));
        for (const c of result.approval_conditions) s.push(`- [ ] ${c}`);
        s.push('');
      }
    }

    if (fb.synthesis) {
      s.push(L(`**종합**: ${fb.synthesis}`, `**Synthesis**: ${fb.synthesis}`));
      s.push('');
    }
  }

  // ── 4. 판단 이력 ──
  if (judgments.length > 0) {
    const overrides = judgments.filter(j => j.user_changed);
    s.push(L('## 4. 판단 이력', '## 4. Judgment History'));
    s.push('');
    s.push(L(
      `총 ${judgments.length}건의 판단 기록, AI 제안 수정 ${overrides.length}건`,
      `${judgments.length} judgment record${judgments.length === 1 ? '' : 's'} total, ${overrides.length} AI suggestion${overrides.length === 1 ? '' : 's'} overridden`,
    ));
    s.push('');

    if (overrides.length > 0) {
      for (const j of overrides.slice(0, 8)) {
        const typeLabel = j.type === 'actor_override' ? L('역할 변경', 'Owner change')
          : j.type === 'hidden_question_selection' ? L('질문 선택', 'Question selection')
          : j.type;
        s.push(`- [${typeLabel}] ${j.context} → ${j.decision}`);
      }
      if (overrides.length > 8) s.push(L(`- ... 외 ${overrides.length - 8}건`, `- ... and ${overrides.length - 8} more`));
      s.push('');
    }
  }

  // ── 5. 성찰 ──
  if (project.meta_reflection) {
    const mr = project.meta_reflection;
    s.push(L('## 5. 성찰', '## 5. Reflection'));
    s.push('');
    if (mr.understanding_change) s.push(L(`**이해의 변화**: ${mr.understanding_change}`, `**How understanding changed**: ${mr.understanding_change}`));
    if (mr.surprising_discovery) s.push(L(`**놀라운 발견**: ${mr.surprising_discovery}`, `**Surprising discovery**: ${mr.surprising_discovery}`));
    if (mr.next_time_differently) s.push(L(`**다음엔 다르게**: ${mr.next_time_differently}`, `**Next time, differently**: ${mr.next_time_differently}`));
    s.push('');
  }

  s.push('---');
  s.push(L(
    '*Argus 판단 근거서 — 각 단계의 판단 이유와 맥락을 기록합니다.*',
    '*Argus Decision Rationale — records the reasoning and context behind each stage.*',
  ));

  return s.join('\n');
}
