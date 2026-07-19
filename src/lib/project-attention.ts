import {
  isItemDueForRecheck,
  isItemDueForReconsider,
  itemRecheckDays,
  itemReconsiderDays,
  type DecisionItem,
} from '@/lib/decision-items';
import { normalizePremiseText } from '@/lib/premises-core';
import type { SharedGround } from '@/lib/judgment-graph';
import type { JudgmentReceipt } from '@/lib/review';
import type { FeedbackRecord, Project } from '@/stores/types';
import { traceLocators } from '@/lib/evidence-trace';

export type ProjectAttentionKind = 'check_in' | 'premise_recheck' | 'open_question' | 'receipt_check_in' | 'ground_shift' | 'stakeholder_check';

export interface ProjectAttentionItem {
  id: string;
  kind: ProjectAttentionKind;
  title: string;
  context: string;
  locator: string;
  projectId?: string;
  ageDays?: number;
  affected: Array<{ id: string; label: string; scope: 'project' | 'review' }>;
}

export function buildProjectAttention(input: {
  projects: Project[];
  decisionItems: DecisionItem[];
  dueProjectIds: string[];
  dueReceipts: JudgmentReceipt[];
  feedbackHistory?: FeedbackRecord[];
  shiftedGround?: SharedGround | null;
  now: number;
}): ProjectAttentionItem[] {
  const projects = input.projects || [];
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const liveItems = (input.decisionItems || []).filter((item) => item.status === 'active');
  const premiseGroups = new Map<string, DecisionItem[]>();

  for (const item of liveItems) {
    if (item.type !== 'premise') continue;
    const key = normalizePremiseText(item.text);
    if (!key) continue;
    const group = premiseGroups.get(key) || [];
    group.push(item);
    premiseGroups.set(key, group);
  }

  const rows: Array<ProjectAttentionItem & { priority: number }> = [];

  for (const projectId of input.dueProjectIds || []) {
    const project = projectById.get(projectId);
    if (!project) continue;
    const predicate = project.decision_contract?.predicates?.find((item) => item.text?.trim())?.text?.trim();
    rows.push({
      id: `check-in:${project.id}`,
      kind: 'check_in',
      title: predicate || project.name,
      context: project.name,
      locator: traceLocators.projectContract(project.id),
      projectId: project.id,
      affected: [{ id: project.id, label: project.name, scope: 'project' }],
      priority: 0,
    });
  }

  for (const item of liveItems) {
    const project = projectById.get(item.decision_id);
    if (!project) continue;
    if (isItemDueForRecheck(item, input.now)) {
      const sameGround = premiseGroups.get(normalizePremiseText(item.text)) || [item];
      const affectedIds = [...new Set(sameGround.map((candidate) => candidate.decision_id))];
      rows.push({
        id: `premise:${item.id}`,
        kind: 'premise_recheck',
        title: item.text,
        context: project.name,
        locator: traceLocators.projectItem(project.id, item.id),
        projectId: project.id,
        ageDays: itemRecheckDays(item, input.now),
        affected: affectedIds.map((id) => ({ id, label: projectById.get(id)?.name || id, scope: 'project' as const })),
        priority: 1,
      });
    } else if (isItemDueForReconsider(item, input.now)) {
      rows.push({
        id: `question:${item.id}`,
        kind: 'open_question',
        title: item.text,
        context: project.name,
        locator: traceLocators.projectItem(project.id, item.id),
        projectId: project.id,
        ageDays: itemReconsiderDays(item, input.now),
        affected: [{ id: project.id, label: project.name, scope: 'project' }],
        priority: 2,
      });
    }
  }

  for (const receipt of input.dueReceipts || []) {
    rows.push({
      id: `receipt:${receipt.receipt_id}`,
      kind: 'receipt_check_in',
      title: receipt.core_question || receipt.source_title,
      context: receipt.source_title,
      locator: traceLocators.reviewReceipt(receipt.receipt_id),
      affected: [{ id: receipt.receipt_id, label: receipt.source_title, scope: 'review' }],
      priority: 0,
    });
  }

  for (const record of input.feedbackHistory || []) {
    if (!record.project_id) continue;
    const project = projectById.get(record.project_id);
    if (!project) continue;
    for (const result of record.results || []) {
      for (const check of result.reality_checks || []) {
        if (check.status !== 'pending') continue;
        rows.push({
          id: `stakeholder:${record.id}:${check.id}`,
          kind: 'stakeholder_check',
          title: check.statement,
          context: `${project.name} · ${record.document_title}`,
          locator: traceLocators.rehearseRealityCheck(record.id, check.id),
          projectId: project.id,
          affected: [{ id: project.id, label: project.name, scope: 'project' }],
          priority: 1,
        });
      }
    }
  }

  const ground = input.shiftedGround;
  if (ground?.drift && ground.live_bets.length > 0 && ground.members[0]) {
    const first = ground.members[0];
    const affected = [...new Map(ground.live_bets.map((bet) => [bet.receipt_id, bet])).values()]
      .map((bet) => ({ id: bet.receipt_id, label: bet.source_title, scope: 'review' as const }));
    rows.push({
      id: `ground:${ground.key}`,
      kind: 'ground_shift',
      title: ground.text,
      context: ground.drift.finding,
      locator: traceLocators.reviewPremise(first.receipt_id, first.premise.premise_id),
      affected,
      priority: -1,
    });
  }

  return rows
    .sort((a, b) => a.priority - b.priority || (b.ageDays ?? 0) - (a.ageDays ?? 0) || a.context.localeCompare(b.context))
    .map((row) => ({
      id: row.id,
      kind: row.kind,
      title: row.title,
      context: row.context,
      locator: row.locator,
      projectId: row.projectId,
      ageDays: row.ageDays,
      affected: row.affected,
    }));
}
