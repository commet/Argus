import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  fetchFromSupabase: vi.fn(() => Promise.resolve([])),
  upsertToSupabase: vi.fn(),
  softDeleteFromSupabase: vi.fn(),
}));

import { buildProjectReturnUrl } from '../return-email';
import { selectDueReturnProject } from '../project-return';
import { toReceiptRow } from '../review-sync';
import type { Project } from '@/stores/types';
import type { JudgmentReceipt } from '../review';

describe('process 1 journey fixture', () => {
  it('keeps one due decision intact from email CTA to missed settlement row', () => {
    const project: Project = {
      id: 'p1',
      name: 'Pricing launch',
      description: '',
      refs: [],
      created_at: '2026-07-01T00:00:00.000Z',
      updated_at: '2026-07-01T00:00:00.000Z',
      decision_contract: {
        id: 'c1',
        project_id: 'p1',
        created_at: '2026-07-01T00:00:00.000Z',
        check_in_at: '2026-07-07T00:00:00.000Z',
        predicates: [{ id: 'pred_1', source: 'governing_idea', text: 'conversion stays above 4%' }],
      },
    };

    const cta = buildProjectReturnUrl('https://argus.voyage', 'ko', 'c1:pred_1');
    expect(cta).toBe('https://argus.voyage/ko/project?from=checkin&return=c1%3Apred_1');
    expect(selectDueReturnProject([project], 'c1:pred_1', new Date('2026-07-07T09:00:00.000Z').getTime())?.id).toBe('p1');

    const receipt = {
      receipt_id: 'mcp_d1',
      root_mode: 'review',
      state: 'settled',
      artifact_id: 'mcp_d1',
      source_kind: 'mcp_file',
      source_title: 'Pricing launch',
      source_fingerprint: 'fp',
      profile: {} as JudgmentReceipt['profile'],
      reviewability: {} as JudgmentReceipt['reviewability'],
      routing: { selected: [], skipped: [], disclosure: '' },
      core_question: 'Will conversion stay above 4%?',
      judgment_obligations: [],
      claim_ledger: [],
      hidden_assumptions: [],
      forks: [],
      findings: [],
      current_heading: '',
      falsifiable_followups: [{
        followup_id: 'f1',
        predicate: 'conversion stays above 4%',
        predicate_owner: 'user',
        pass_condition: 'conversion >= 4%',
        fail_condition: 'conversion < 4%',
        check_by: '2026-07-07',
        sealed_at: '2026-07-01T00:00:00.000Z',
        settled_at: '2026-07-07T09:00:00.000Z',
        outcome: 'missed',
        what_happened: 'conversion landed at 3.2%',
      }],
      companion_thread: [],
      provenance: {} as JudgmentReceipt['provenance'],
      created_at: '2026-07-01T00:00:00.000Z',
      updated_at: '2026-07-07T09:00:00.000Z',
    } satisfies JudgmentReceipt;

    const row = toReceiptRow(receipt);
    expect(row.state).toBe('settled');
    expect(row.next_check_by).toBeNull();
    expect(row.data.falsifiable_followups[0].outcome).toBe('missed');
  });
});
