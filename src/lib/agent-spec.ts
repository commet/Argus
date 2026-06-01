import { getStorage, STORAGE_KEYS } from './storage';
import type { Project, ReframeItem, RecastItem, FeedbackRecord, HiddenAssumption } from '@/stores/types';
import { buildReframeContext } from './context-chain';
import { projectFilter } from './output-helpers';

export function generateAgentSpec(project: Project | null): string {
  const pf = projectFilter(project);
  const decompositions = getStorage<ReframeItem[]>(STORAGE_KEYS.REFRAME_LIST, [])
    .filter((d) => pf(d) && d.status === 'done');
  const recasts = getStorage<RecastItem[]>(STORAGE_KEYS.RECAST_LIST, [])
    .filter(pf);
  const feedbacks = getStorage<FeedbackRecord[]>(STORAGE_KEYS.FEEDBACK_HISTORY, [])
    .filter(pf);

  const lines: string[] = [];

  lines.push(`# Argus Agent Spec`);
  lines.push(`# Generated: ${new Date().toISOString().split('T')[0]}`);
  lines.push('');
  lines.push(`project:`);
  lines.push(`  name: "${project?.name || 'Untitled'}"`);
  lines.push(`  created: "${project?.created_at?.split('T')[0] || new Date().toISOString().split('T')[0]}"`);;
  lines.push('');

  // Task definition from decompose
  if (decompositions.length > 0) {
    const latest = decompositions[decompositions.length - 1];
    if (latest.analysis) {
      lines.push(`task_definition:`);
      lines.push(`  surface_task: "${latest.analysis.surface_task}"`);
      lines.push(`  reframed_question: "${latest.selected_question || latest.analysis.surface_task}"`);
      const hyp = latest.analysis.reframed_question || latest.analysis.hypothesis || '';
      lines.push(`  hypothesis: "${hyp}"`);
      if (latest.analysis.hidden_assumptions.length > 0) {
        lines.push(`  assumptions_to_validate:`);
        latest.analysis.hidden_assumptions.forEach((a: HiddenAssumption | string) => {
          const text = typeof a === 'string' ? a : a.assumption;
          lines.push(`    - "${text}"`);
        });
      }
      if (latest.analysis.ai_limitations.length > 0) {
        lines.push(`  ai_limitations:`);
        latest.analysis.ai_limitations.forEach((l) => lines.push(`    - "${l}"`));
      }
      lines.push('');

      // Context chain
      lines.push(`context_chain:`);
      lines.push(`  hypothesis: "${latest.analysis.reframed_question || latest.analysis.hypothesis || ''}"`);
      lines.push(`  assumptions_to_validate:`);
      latest.analysis.hidden_assumptions.forEach((a: HiddenAssumption | string) => {
        const text = typeof a === 'string' ? a : a.assumption;
        lines.push(`    - "${text}"`);
      });
      if (feedbacks.length > 0) {
        const latestF = feedbacks[feedbacks.length - 1];
        const risks = latestF.results.flatMap(r => (r.classified_risks || []).filter(cr => cr.category === 'critical'));
        if (risks.length > 0) {
          lines.push(`  risks_addressed:`);
          risks.forEach(r => lines.push(`    - "${r.text}"`));
        }
      }
      lines.push('');
    }
  }

  // Workflow from recast
  if (recasts.length > 0) {
    const latest = recasts[recasts.length - 1];
    const steps = latest.steps.length > 0 ? latest.steps : latest.analysis?.steps || [];

    lines.push(`workflow:`);
    if (latest.analysis) {
      lines.push(`  goal: "${latest.analysis.goal_summary}"`);
      lines.push(`  total_time: "${latest.analysis.total_estimated_time}"`);
      lines.push(`  ai_ratio: ${latest.analysis.ai_ratio}`);
      lines.push(`  human_ratio: ${latest.analysis.human_ratio}`);
    }
    lines.push(`  steps:`);

    // Build assumption map for validation linking
    const reframeCtx = decompositions.length > 0 && decompositions[decompositions.length - 1].analysis
      ? buildReframeContext(decompositions[decompositions.length - 1])
      : null;

    steps.forEach((step, i) => {
      lines.push(`    - step: ${i + 1}`);
      lines.push(`      task: "${step.task}"`);
      lines.push(`      actor: ${step.actor}`);
      lines.push(`      reasoning: "${step.actor_reasoning}"`);
      if (step.expected_output) {
        lines.push(`      expected_output: "${step.expected_output}"`);
      }
      if (step.estimated_time) {
        lines.push(`      estimated_time: "${step.estimated_time}"`);
      }
      if (step.checkpoint) {
        lines.push(`      checkpoint: true`);
        lines.push(`      checkpoint_reason: "${step.checkpoint_reason}"`);
      }
      // Link assumptions this step could validate
      if (reframeCtx?.unverified_assumptions.length) {
        const relevant = reframeCtx.unverified_assumptions.filter(a =>
          step.task.includes(a.assumption.substring(0, 8))
        );
        if (relevant.length > 0) {
          lines.push(`      validates_assumption: "${relevant[0].assumption.slice(0, 50)}"`);
        }
      }
      // Link review findings for this step
      if (latest.analysis?.reviews) {
        const stepWarnings = latest.analysis.reviews
          .flatMap(r => r.findings)
          .filter(f => f.affected_steps?.includes(i + 1) && f.severity === 'high');
        if (stepWarnings.length > 0) {
          lines.push(`      warnings:`);
          stepWarnings.forEach(w => lines.push(`        - "${w.text}"`));
        }
      }
    });
    lines.push('');
  }

  // Evaluation from persona feedback
  if (feedbacks.length > 0) {
    const latest = feedbacks[feedbacks.length - 1];
    lines.push(`evaluation:`);
    lines.push(`  perspective: "${latest.feedback_perspective}"`);
    lines.push(`  stakeholders:`);
    for (const result of latest.results) {
      lines.push(`    - persona_id: "${result.persona_id}"`);
      lines.push(`      overall_reaction: "${result.overall_reaction}"`);
      if (result.concerns.length > 0) {
        lines.push(`      concerns:`);
        result.concerns.forEach((c) => lines.push(`        - "${c}"`));
      }
      if (result.first_questions.length > 0) {
        lines.push(`      expected_questions:`);
        result.first_questions.forEach((q) => lines.push(`        - "${q}"`));
      }
    }
    lines.push('');

    // Guardrails from concerns
    const allConcerns = latest.results.flatMap((r) => r.concerns || []);
    const allWantsMore = latest.results.flatMap((r) => r.wants_more || []);
    if (allConcerns.length > 0 || allWantsMore.length > 0) {
      lines.push(`guardrails:`);
      if (allConcerns.length > 0) {
        lines.push(`  must_address:`);
        allConcerns.forEach((c) => lines.push(`    - "${c}"`));
      }
      if (allWantsMore.length > 0) {
        lines.push(`  must_include:`);
        allWantsMore.forEach((w) => lines.push(`    - "${w}"`));
      }
    }
  }

  return lines.join('\n');
}
