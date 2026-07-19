import { getStorage, STORAGE_KEYS } from './storage';
import { getCurrentLanguage } from '@/lib/i18n';
import type {
  Project,
  ReframeItem,
  RecastItem,
  SynthesizeItem,
  FeedbackRecord,
  HiddenAssumption,
  ProgressiveSession,
} from '@/stores/types';

function latestProgressiveSession(projectId: string): ProgressiveSession | null {
  const sessions = getStorage<ProgressiveSession[]>(STORAGE_KEYS.PROGRESSIVE_SESSIONS, [])
    .filter((session) => session.project_id === projectId);
  return sessions.sort((a, b) => {
    const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
    const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
    return aTime - bTime;
  }).at(-1) ?? null;
}

function resolveSessionText(session: ProgressiveSession, value: string | null | undefined): string {
  if (!value) return '';
  if (!value.startsWith('@cpblob:')) return value;
  return session.checkpoint_blobs?.[value.slice('@cpblob:'.length)] ?? value;
}

function exportedDraft(session: ProgressiveSession): { label?: string; text: string } {
  const drafts = Array.isArray(session.drafts) ? session.drafts : [];
  const selected = drafts.find((draft) => draft.id === session.released_draft_id)
    ?? drafts.find((draft) => draft.id === session.active_draft_id);
  const text = resolveSessionText(session, selected?.final_text || session.final_deliverable);
  return { label: selected?.version_label, text: text.trim() };
}

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
  const progressive = latestProgressiveSession(project.id);

  const sections: string[] = [];
  const dateStr = new Date().toLocaleDateString(ko ? 'ko-KR' : 'en-US', ko ? undefined : { year: 'numeric', month: 'short', day: 'numeric' });

  // Header
  sections.push(`# ${project.name}`);
  sections.push(`> Argus Project Brief — ${dateStr}`);
  sections.push('');

  if (project.description?.trim()) {
    sections.push(project.description.trim());
    sections.push('');
  }

  // The main web flow now stores its work in ProgressiveSession. The previous
  // exporter only read the four legacy tool stores, so a completed voyage
  // downloaded as a title plus empty markdown headings. Keep the legacy export
  // below, but lead with the data the project page actually renders.
  if (progressive) {
    const mix = progressive.final_mix ?? progressive.mix;
    const draft = exportedDraft(progressive);

    sections.push(L('## 프로젝트 요약', '## Project summary'));
    if (progressive.problem_text?.trim()) {
      sections.push(L(`**시작 질문**: ${progressive.problem_text.trim()}`, `**Starting question**: ${progressive.problem_text.trim()}`));
    }
    if (progressive.decision_maker?.trim()) {
      sections.push(L(`**결정 담당자**: ${progressive.decision_maker.trim()}`, `**Decision owner**: ${progressive.decision_maker.trim()}`));
    }
    if (mix?.executive_summary?.trim()) {
      sections.push('');
      sections.push(L('### 핵심 요약', '### Executive summary'));
      sections.push(mix.executive_summary.trim());
    }
    if ((mix?.key_assumptions || []).length > 0) {
      sections.push('');
      sections.push(L('### 확인이 필요한 전제', '### Assumptions to verify'));
      mix!.key_assumptions.forEach((assumption) => sections.push(`- ${assumption}`));
    }
    if ((mix?.next_steps || []).length > 0) {
      sections.push('');
      sections.push(L('### 다음 행동', '### Next actions'));
      mix!.next_steps.forEach((step) => sections.push(`- ${step}`));
    }
    sections.push('');

    if (draft.text) {
      sections.push(L(
        `## 최종 결과물${draft.label ? ` · ${draft.label}` : ''}`,
        `## Final deliverable${draft.label ? ` · ${draft.label}` : ''}`,
      ));
      sections.push(draft.text);
      sections.push('');
    } else if ((mix?.sections || []).length > 0) {
      sections.push(L('## 작업 결과', '## Work product'));
      mix!.sections.forEach((section) => {
        sections.push(`### ${section.heading}`);
        sections.push(section.content);
        sections.push('');
      });
    }
  }

  const contract = project.decision_contract;
  if (contract) {
    const receipt = contract.judgment_receipt;
    const predicates = Array.isArray(contract.predicates) ? contract.predicates : [];
    sections.push(L('## 판단과 확인 계획', '## Decision and follow-up'));
    if (receipt?.human_judgment?.trim()) {
      sections.push(L('### 기록한 판단', '### Saved decision'));
      sections.push(receipt.human_judgment.trim());
      sections.push('');
    }
    if (receipt?.real_question?.trim()) {
      sections.push(L('### 나중에 확인할 질문', '### Question to revisit'));
      sections.push(receipt.real_question.trim());
      sections.push('');
    }
    if (contract.check_in_at) {
      const checkIn = new Date(contract.check_in_at);
      if (!Number.isNaN(checkIn.getTime())) {
        sections.push(L(
          `**확인 예정일**: ${checkIn.toLocaleDateString('ko-KR')}`,
          `**Review date**: ${checkIn.toLocaleDateString('en-US')}`,
        ));
      }
    }
    if (predicates.length > 0) {
      sections.push('');
      sections.push(L('### 확인할 항목', '### Checks'));
      predicates.forEach((predicate) => {
        const checked = predicate.verdict && predicate.verdict !== 'pending' ? 'x' : ' ';
        sections.push(`- [${checked}] ${predicate.text}`);
      });
    }
    if (receipt?.what_happened?.trim()) {
      sections.push('');
      sections.push(L('### 실제로 확인한 결과', '### What actually happened'));
      sections.push(receipt.what_happened.trim());
    }
    sections.push('');
  }

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
    sections.push(L('## 1. 항로 재설정 | 문제 재정의', '## 1. Set the Heading | Problem Reframe'));
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
    sections.push(L('## 2. 선원 배치 | 실행 설계', '## 2. Crew Assignment | Execution Design'));
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
      const steps = (latest.steps?.length ? latest.steps : latest.analysis.steps) ?? [];
      steps.forEach((s, i) => {
        const cp = s.checkpoint ? `⚑ ${s.checkpoint_reason}` : '-';
        sections.push(`| ${i + 1} | ${actorLabels[s.actor] ?? s.actor} | ${s.task} | ${s.estimated_time || '-'} | ${cp} |`);
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
