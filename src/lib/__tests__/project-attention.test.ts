import { describe, expect, it } from 'vitest';
import { createItem, markRechecked } from '@/lib/decision-items';
import { buildProjectAttention } from '@/lib/project-attention';
import type { FeedbackRecord, Project } from '@/stores/types';

const NOW = new Date('2026-07-19T00:00:00.000Z').getTime();
const OLD = new Date('2026-01-01T00:00:00.000Z').getTime();

function project(id: string, name: string, due = false): Project {
  return {
    id,
    name,
    description: '',
    refs: [],
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...(due ? {
      decision_contract: {
        id: `contract-${id}`,
        project_id: id,
        created_at: '2026-01-01T00:00:00.000Z',
        check_in_at: '2026-07-01T00:00:00.000Z',
        predicates: [{ id: `predicate-${id}`, text: '이번 변화로 이탈률이 줄어든다', source: 'user_lean', authored: 'user' }],
      },
    } : {}),
  } as Project;
}

describe('project attention derivation', () => {
  it('combines due returns, premise rechecks and deferred questions without inventing relationships', () => {
    const sharedA = createItem({ decision_id: 'a', type: 'premise', text: '고객 이탈의 주원인은 온보딩이다', source: 'user', external: true, load_bearing: true }, OLD);
    const sharedB = createItem({ decision_id: 'b', type: 'premise', text: '  고객 이탈의 주원인은 온보딩이다  ', source: 'user', external: true, load_bearing: true }, OLD);
    const unrelated = createItem({ decision_id: 'c', type: 'premise', text: '가격이 원인이다', source: 'user', external: true, load_bearing: true }, OLD);
    const question = createItem({ decision_id: 'b', type: 'open_question', text: '기존 고객에게 먼저 적용할까?', source: 'user' }, OLD);
    const fresh = markRechecked(unrelated, NOW);

    const rows = buildProjectAttention({
      projects: [project('a', '온보딩 개선', true), project('b', '요금제 전환'), project('c', '가격 실험')],
      decisionItems: [sharedA, sharedB, fresh, question],
      dueProjectIds: ['a'],
      dueReceipts: [],
      now: NOW,
    });

    expect(rows.map((row) => row.kind)).toEqual(['check_in', 'premise_recheck', 'premise_recheck', 'open_question']);
    expect(rows[0]).toMatchObject({ title: '이번 변화로 이탈률이 줄어든다', locator: 'argus://project/a/contract' });
    const premise = rows.find((row) => row.id === `premise:${sharedA.id}`)!;
    expect(premise.affected.map((item) => item.label)).toEqual(['온보딩 개선', '요금제 전환']);
    expect(rows.some((row) => row.title === '가격이 원인이다')).toBe(false);
  });

  it('surfaces moved shared ground with an exact receipt and premise locator', () => {
    const rows = buildProjectAttention({
      projects: [],
      decisionItems: [],
      dueProjectIds: [],
      dueReceipts: [],
      now: NOW,
      shiftedGround: {
        key: 'ground',
        text: '금리가 유지된다',
        drift: { finding: '기준금리가 올랐다' },
        members: [{ receipt_id: 'r/1', source_title: '투자안', premise: { premise_id: 'p 1' } as never }],
        live_bets: [{ receipt_id: 'r/1', source_title: '투자안', followup_id: 'f1', predicate: '투자한다', check_by: '2026-08-01' }],
      },
    });

    expect(rows[0]).toMatchObject({
      kind: 'ground_shift',
      context: '기준금리가 올랐다',
      locator: 'argus://review/r%2F1/premise/p%201',
    });
  });

  it('surfaces only pending stakeholder reality checks and returns to the exact rehearsal check', () => {
    const feedback = {
      id: 'feedback/one',
      project_id: 'a',
      document_title: '출시 계획',
      document_text: '본문',
      persona_ids: ['cfo'],
      feedback_perspective: '',
      feedback_intensity: '',
      synthesis: '',
      created_at: '2026-07-18T00:00:00.000Z',
      results: [{
        persona_id: 'cfo', overall_reaction: '', failure_scenario: '', untested_assumptions: [],
        classified_risks: [], first_questions: [], praise: [], concerns: [], wants_more: [], approval_conditions: [],
        reality_checks: [
          { id: 'check pending', statement_id: 's1', statement: '재무팀이 가격안을 승인할 것이다', question: '실제로 승인했나?', status: 'pending', created_at: '2026-07-18T00:00:00.000Z' },
          { id: 'check-done', statement_id: 's2', statement: '법무 검토가 끝났다', question: '끝났나?', status: 'confirmed', created_at: '2026-07-17T00:00:00.000Z', checked_at: '2026-07-18T00:00:00.000Z' },
        ],
      }],
    } as FeedbackRecord;

    const rows = buildProjectAttention({
      projects: [project('a', '요금제 출시')],
      decisionItems: [],
      dueProjectIds: [],
      dueReceipts: [],
      feedbackHistory: [feedback],
      now: NOW,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      kind: 'stakeholder_check',
      title: '재무팀이 가격안을 승인할 것이다',
      context: '요금제 출시 · 출시 계획',
      locator: 'argus://rehearse/feedback%2Fone/reality-check/check%20pending',
      projectId: 'a',
    });
  });
});
