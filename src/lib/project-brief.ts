import { getStorage, STORAGE_KEYS } from './storage';
import { getCurrentLanguage } from '@/lib/i18n';
import type { Project, ReframeItem, RecastItem, SynthesizeItem, FeedbackRecord, HiddenAssumption } from '@/stores/types';

export function generateProjectBrief(project: Project | null): string {
  if (!project) return '';
  const ko = getCurrentLanguage() === 'ko';
  const L = (k: string, e: string) => (ko ? k : e);

  const decompositions = getStorage<ReframeItem[]>(STORAGE_KEYS.REFRAME_LIST, [])
    .filter((d) => d.project_id === project.id && d.status === 'done');
  const recasts = getStorage<RecastItem[]>(STORAGE_KEYS.RECAST_LIST, [])
    .filter((o) => o.project_id === project.id);
  const syntheses = getStorage<SynthesizeItem[]>(STORAGE_KEYS.SYNTHESIZE_LIST, [])
    .filter((s) => s.project_id === project.id && s.status === 'done');
  const feedbacks = getStorage<FeedbackRecord[]>(STORAGE_KEYS.FEEDBACK_HISTORY, [])
    .filter((f) => f.project_id === project.id);

  const sections: string[] = [];
  const dateStr = new Date().toLocaleDateString(ko ? 'ko-KR' : 'en-US', ko ? undefined : { year: 'numeric', month: 'short', day: 'numeric' });

  // Header
  sections.push(`# ${project.name}`);
  sections.push(`> Argus Project Brief — ${dateStr}`);
  sections.push('');

  // 0. Thought trajectory
  if (decompositions.length > 0) {
    const latestD = decompositions[decompositions.length - 1];
    const latestO = recasts.length > 0 ? recasts[recasts.length - 1] : null;

    sections.push(L('## 사고의 궤적', '## Thought trajectory'));
    sections.push(L(`처음 주어진 과제: ${latestD.input_text}`, `Original task: ${latestD.input_text}`));
    if (latestD.analysis) {
      sections.push(L(
        `재정의된 질문: **${latestD.selected_question || latestD.analysis.surface_task}**`,
        `Reframed question: **${latestD.selected_question || latestD.analysis.surface_task}**`,
      ));
      if (latestO?.analysis) {
        sections.push(L(`핵심 방향: ${latestO.analysis.governing_idea}`, `Governing idea: ${latestO.analysis.governing_idea}`));
      }
      const hyp = latestD.analysis.reframed_question || latestD.analysis.hypothesis || '';
      const nAssump = latestD.analysis.hidden_assumptions.length;
      sections.push(L(
        `이 방향은 "${hyp}"에서 출발, ${nAssump}건의 전제 점검 후 도출.`,
        `Starting from "${hyp}", arrived at this direction after checking ${nAssump} assumption${nAssump === 1 ? '' : 's'}.`,
      ));
      if (feedbacks.length > 0) {
        const latestF = feedbacks[feedbacks.length - 1];
        const criticalCount = latestF.results.flatMap(r => (r.classified_risks || []).filter(cr => cr.category === 'critical')).length;
        const unspokenCount = latestF.results.flatMap(r => (r.classified_risks || []).filter(cr => cr.category === 'unspoken')).length;
        if (criticalCount > 0 || unspokenCount > 0) {
          const criticalLabel = criticalCount > 0
            ? L(`🔴 핵심 위협 ${criticalCount}건`, `🔴 ${criticalCount} critical threat${criticalCount === 1 ? '' : 's'}`)
            : '';
          const unspokenLabel = unspokenCount > 0
            ? L(`/ 🟣 침묵의 리스크 ${unspokenCount}건`, `/ 🟣 ${unspokenCount} unspoken risk${unspokenCount === 1 ? '' : 's'}`)
            : '';
          sections.push(L(
            `리허설 주요 리스크: ${criticalLabel} ${unspokenLabel}`,
            `Rehearsal top risks: ${criticalLabel} ${unspokenLabel}`,
          ));
        }
      }
    }
    sections.push('');
  }

  // 1. Problem Definition (from decompose)
  if (decompositions.length > 0) {
    const latest = decompositions[decompositions.length - 1];
    sections.push(L('## 1. 악보 해석 | 문제 재정의', '## 1. Score Reading | Problem Reframe'));
    if (latest.analysis) {
      sections.push(L('### 표면 과제', '### Surface task'));
      sections.push(latest.analysis.surface_task);
      sections.push('');
      if (latest.selected_question) {
        sections.push(L('### 재정의된 핵심 질문', '### Reframed core question'));
        sections.push(`**${latest.selected_question}**`);
        sections.push('');
      }
      if (latest.analysis.why_reframing_matters) {
        sections.push(latest.analysis.why_reframing_matters);
        sections.push('');
      }
      if (latest.analysis.hidden_assumptions?.length > 0) {
        sections.push(L('### 전제 점검 결과', '### Assumption check results'));
        latest.analysis.hidden_assumptions.forEach((a: HiddenAssumption | string) => {
          if (typeof a === 'string') {
            sections.push(`- ${a}`);
          } else {
            const evalLabel = a.evaluation === 'likely_true' ? L('✅ 확인됨', '✅ Likely true')
              : a.evaluation === 'doubtful' ? L('❌ 의심됨', '❌ Doubtful')
              : a.evaluation === 'uncertain' ? L('❓ 불확실', '❓ Uncertain')
              : L('⬜ 미평가', '⬜ Unevaluated');
            const ifFalse = a.risk_if_false ? L(` → 거짓이면: ${a.risk_if_false}`, ` → If false: ${a.risk_if_false}`) : '';
            sections.push(`- ${evalLabel} — ${a.assumption}${ifFalse}`);
          }
        });
        sections.push('');
      }
      if (latest.analysis.ai_limitations.length > 0) {
        sections.push(L('### AI 한계', '### AI limitations'));
        latest.analysis.ai_limitations.forEach((l) => sections.push(`- ${l}`));
        sections.push('');
      }
    }
  }

  // 2. Workflow Design (from recast)
  if (recasts.length > 0) {
    const latest = recasts[recasts.length - 1];
    sections.push(L('## 2. 편곡 | 실행 설계', '## 2. Arrangement | Execution Design'));
    if (latest.analysis) {
      sections.push(L(`**목표**: ${latest.analysis.goal_summary}`, `**Goal**: ${latest.analysis.goal_summary}`));
      sections.push(L(`**예상 소요시간**: ${latest.analysis.total_estimated_time}`, `**Estimated time**: ${latest.analysis.total_estimated_time}`));
      sections.push(L(
        `**AI 비율**: ${latest.analysis.ai_ratio}% | **사람 비율**: ${latest.analysis.human_ratio}%`,
        `**AI share**: ${latest.analysis.ai_ratio}% | **Human share**: ${latest.analysis.human_ratio}%`,
      ));
      sections.push('');
      const actorLabels: Record<string, string> = ko
        ? { ai: '🤖 AI', human: '🧠 사람', both: '🤝 협업' }
        : { ai: '🤖 AI', human: '🧠 Human', both: '🤝 Both' };
      sections.push(L(
        '| # | 담당 | 할 일 | 시간 | 체크포인트 |',
        '| # | Owner | Task | Time | Checkpoint |',
      ));
      sections.push('|---|------|-------|------|-----------|');
      const steps = latest.steps.length > 0 ? latest.steps : latest.analysis.steps;
      steps.forEach((s, i) => {
        const cp = s.checkpoint ? `⚑ ${s.checkpoint_reason}` : '-';
        sections.push(`| ${i + 1} | ${actorLabels[s.actor]} | ${s.task} | ${s.estimated_time || '-'} | ${cp} |`);
      });
      sections.push('');
    }
  }

  // 3. Synthesis / Judgments (from synthesize)
  if (syntheses.length > 0) {
    const latest = syntheses[syntheses.length - 1];
    sections.push(L('## 3. 조율 (판단 합성)', '## 3. Synthesis (Judgment)'));
    if (latest.analysis) {
      if (latest.analysis.agreements.length > 0) {
        sections.push(L('### 합의점', '### Agreements'));
        latest.analysis.agreements.forEach((a) => sections.push(`- ✓ ${a}`));
        sections.push('');
      }
      const judgedConflicts = latest.analysis.conflicts.filter((c) => c.user_judgment);
      if (judgedConflicts.length > 0) {
        sections.push(L('### 쟁점별 판단', '### Judgments by conflict'));
        judgedConflicts.forEach((c) => {
          sections.push(`**${c.topic}**`);
          sections.push(`- ${c.side_a.source}: ${c.side_a.position}`);
          sections.push(`- ${c.side_b.source}: ${c.side_b.position}`);
          const myJudgment = L('**내 판단**', '**My judgment**');
          sections.push(`- ${myJudgment}: ${c.user_judgment}${c.user_reasoning ? ` (${c.user_reasoning})` : ''}`);
          sections.push('');
        });
      }
    }
  }

  // 4. Stakeholder Validation (from persona feedback)
  if (feedbacks.length > 0) {
    const latest = feedbacks[feedbacks.length - 1];
    sections.push(L('## 4. 리허설 | 사전 검증', '## 4. Rehearsal | Pre-validation'));
    sections.push(L(`**대상 자료**: ${latest.document_title}`, `**Document**: ${latest.document_title}`));
    sections.push(L(
      `**관점**: ${latest.feedback_perspective} | **강도**: ${latest.feedback_intensity}`,
      `**Perspective**: ${latest.feedback_perspective} | **Intensity**: ${latest.feedback_intensity}`,
    ));
    sections.push('');

    for (const result of latest.results) {
      const concerns = result.concerns || [];
      const praise = result.praise || [];
      const questions = result.first_questions || [];
      const wantsMore = result.wants_more || [];

      sections.push(`### ${result.overall_reaction ? result.overall_reaction : L('리허설', 'Rehearsal')}`);
      if (questions.length > 0) {
        sections.push(L('**예상 질문**', '**Anticipated questions**'));
        questions.forEach((q) => sections.push(`- ${q}`));
      }
      if (praise.length > 0) {
        sections.push(L('**긍정 포인트**', '**Praise**'));
        praise.forEach((p) => sections.push(`- ✓ ${p}`));
      }
      if (concerns.length > 0) {
        sections.push(L('**우려사항**', '**Concerns**'));
        concerns.forEach((c) => sections.push(`- ⚠ ${c}`));
      }
      if (wantsMore.length > 0) {
        sections.push(L('**추가 요구**', '**Wants more**'));
        wantsMore.forEach((w) => sections.push(`- ${w}`));
      }
      sections.push('');
    }

    if (latest.synthesis) {
      sections.push(L('### 종합 분석', '### Synthesis'));
      sections.push(latest.synthesis);
      sections.push('');
    }
  }

  // Footer
  sections.push('---');
  sections.push(`*Generated by Argus — Think before you recast*`);

  return sections.join('\n');
}
