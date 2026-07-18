import { describe, expect, it } from 'vitest';
import type { ProgressiveSession } from '@/stores/types';
import { buildWorkspaceDecisionTrace, parseTraceLocator, traceLocators } from '@/lib/evidence-trace';

const session = {
  id: 'session/one',
  problem_text: '요금제를 출시할까?',
  questions: [{ id: 'q 1', text: '성공 기준은?', type: 'short', engine_phase: 'reframe' }],
  answers: [{ question_id: 'q 1', value: '전환율 12%' }],
  snapshots: [{ version: 1, real_question: '작게 검증할 방법은?', hidden_assumptions: ['기존 고객은 이탈하지 않는다'], skeleton: [] }],
  workers: [{
    id: 'worker-1', step_index: 0, task: '가격 분석', who: 'ai', expected_output: '분석',
    status: 'done', persona: null, level: 'senior', stream_text: '',
    result: '**핵심 발견**\n가격 민감도 근거가 아직 없다.', human_input: null,
    error: null, approved: true, completion_note: null, started_at: null, completed_at: null,
  }],
  mix: null,
} as unknown as ProgressiveSession;

describe('workspace decision trace', () => {
  it('keeps user context and worker contribution distinct from direct evidence', () => {
    const trace = buildWorkspaceDecisionTrace(session, { locale: 'ko', workerName: () => '가격 분석가' });
    expect(trace.claims[0]).toMatchObject({ role: 'question', text: '작게 검증할 방법은?' });
    expect(trace.sources.map((source) => source.authorship)).toEqual(['user', 'user', 'ai']);
    expect(trace.edges.map((edge) => [edge.relation, edge.strength])).toEqual([
      ['derived_from', 'contextual'],
      ['derived_from', 'contextual'],
      ['contributed_to', 'contextual'],
    ]);

    const assumption = trace.claims.find((claim) => claim.role === 'assumption')!;
    expect(assumption.status).toBe('needs_evidence');
    expect(trace.edges.some((edge) => edge.claim_id === assumption.id)).toBe(false);
  });

  it('produces stable deep locators including page regions', () => {
    expect(traceLocators.answer('session/one', 'q 1')).toBe('argus://workspace/session%2Fone/answer/q%201');
    expect(traceLocators.documentRegion('doc/alpha', 0, [0.123456, 0.2, 0.3, 0.4]))
      .toBe('argus://document/doc%2Falpha/page/1#xywh=0.1235,0.2,0.3,0.4');
    expect(parseTraceLocator(traceLocators.answer('session/one', 'q 1'))).toEqual({
      scope: 'workspace', sessionId: 'session/one', target: 'answer', targetId: 'q 1',
    });
    expect(parseTraceLocator(traceLocators.documentRegion('doc/alpha', 2, [0.1, 0.2, 0.3, 0.4]))).toEqual({
      scope: 'document', documentId: 'doc/alpha', page: 2, bbox: [0.1, 0.2, 0.3, 0.4],
    });
    expect(parseTraceLocator(traceLocators.projectItem('project/one', 'item 1'))).toEqual({
      scope: 'project', projectId: 'project/one', target: 'item', targetId: 'item 1',
    });
    expect(parseTraceLocator(traceLocators.reviewPremise('receipt/one', 'premise 1'))).toEqual({
      scope: 'review', receiptId: 'receipt/one', premiseId: 'premise 1',
    });
    expect(parseTraceLocator(traceLocators.rehearseDocument('feedback/one', 7))).toEqual({
      scope: 'rehearse', recordId: 'feedback/one', target: 'document', line: 7,
    });
    expect(parseTraceLocator(traceLocators.rehearseFeedback('feedback/one', 'persona 1', 'concern', 2))).toEqual({
      scope: 'rehearse', recordId: 'feedback/one', target: 'feedback', personaId: 'persona 1', kind: 'concern', index: 2,
    });
    expect(parseTraceLocator(traceLocators.synthesizeSource('synthesis/one', 0, 12))).toEqual({
      scope: 'synthesize', itemId: 'synthesis/one', target: 'source', sourceIndex: 0, line: 12,
    });
    expect(parseTraceLocator(traceLocators.synthesizeConflict('synthesis/one', 'conflict 1'))).toEqual({
      scope: 'synthesize', itemId: 'synthesis/one', target: 'conflict', conflictId: 'conflict 1',
    });
  });
});
