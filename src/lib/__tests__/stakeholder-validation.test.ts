import { describe, expect, it } from 'vitest';
import { buildStakeholderValidationMatrix, extractDocumentClaims } from '@/lib/stakeholder-validation';
import type { FeedbackRecord, Persona } from '@/stores/types';

const persona: Persona = {
  id: 'cfo',
  name: '재무 책임자',
  role: 'CFO',
  organization: 'Argus',
  priorities: '',
  communication_style: '',
  known_concerns: '',
  relationship_notes: '',
  influence: 'high',
  extracted_traits: [],
  feedback_logs: [],
  created_at: '',
  updated_at: '',
};

const record: FeedbackRecord = {
  id: 'feedback/one',
  document_title: '성장 계획',
  document_text: '# 목표\n\n이번 분기 유료 전환율을 12%로 높인다.\n\n# 실행\n\n온보딩 화면을 단순화하고 2주간 실험한다.',
  persona_ids: ['cfo'],
  feedback_perspective: '',
  feedback_intensity: '',
  results: [{
    persona_id: 'cfo',
    overall_reaction: '',
    failure_scenario: '',
    untested_assumptions: [],
    classified_risks: [{ text: '유료 전환율 12%의 산출 근거가 부족하다.', category: 'critical' }],
    first_questions: ['법무 검토 일정은 언제인가?'],
    praise: ['온보딩 화면을 단순화하는 실험은 지지한다.'],
    concerns: [],
    wants_more: [],
    approval_conditions: ['최근 전환율 기준선을 먼저 확인해야 한다.'],
  }],
  synthesis: '',
  created_at: '',
};

describe('stakeholder validation matrix', () => {
  it('extracts document claim units with exact source lines', () => {
    expect(extractDocumentClaims(record.id, record.document_text)).toMatchObject([
      { text: '이번 분기 유료 전환율을 12%로 높인다.', section: '목표', lineStart: 3, lineEnd: 3 },
      { text: '온보딩 화면을 단순화하고 2주간 실험한다.', section: '실행', lineStart: 7, lineEnd: 7 },
    ]);
  });

  it('links explicit overlap while preserving unrelated feedback as unmapped', () => {
    const matrix = buildStakeholderValidationMatrix(record, [persona]);
    expect(matrix.rows[0].cells[0].statements.map((statement) => statement.kind)).toEqual(['risk']);
    expect(matrix.rows[0].cells[0].tone).toBe('challenge');
    expect(matrix.rows[0].cells[1].statements.map((statement) => statement.kind)).toEqual(['support']);
    expect(matrix.rows[0].unmapped.map((statement) => statement.text)).toEqual([
      '최근 전환율 기준선을 먼저 확인해야 한다.',
      '법무 검토 일정은 언제인가?',
    ]);
  });
});
