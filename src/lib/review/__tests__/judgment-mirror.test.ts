import { describe, expect, it } from 'vitest';
import { receiptToMarkdown } from '../render';
import type { JudgmentReceipt } from '../schema';

function judgmentMirror(over: Partial<JudgmentReceipt> = {}): JudgmentReceipt {
  return {
    kind: 'judgment',
    receipt_id: 'mcp_d1',
    root_mode: 'judgment',
    state: 'sealed',
    artifact_id: 'mcp_d1',
    source_kind: 'mcp_file',
    source_title: 'CLI sealed prediction',
    source_fingerprint: 'd1',
    core_question: 'Will beta conversion beat 4%?',
    judgment_obligations: [{
      obligation_id: 'o_d1',
      statement: 'Ship the beta to the finance cohort first',
      owner: 'user',
      why_human: '',
      evidence_needed: '',
      anchors: [],
      owned_by_user: true,
    }],
    claim_ledger: [],
    hidden_assumptions: [],
    forks: [],
    findings: [],
    current_heading: '',
    falsifiable_followups: [{
      followup_id: 'f_d1',
      predicate: 'beta conversion beats 4%',
      predicate_owner: 'user',
      pass_condition: 'conversion >= 4%',
      fail_condition: 'conversion < 4%',
      check_by: '2026-08-10',
      sealed_at: '2026-07-07T00:00:00.000Z',
    }],
    companion_thread: [],
    provenance: {
      schema_version: '1',
      extraction_tool: 'argus-decision-mcp',
      extraction_version: '1',
      lens_versions: {},
      model_provider: 'unknown',
      model_name: 'argus-decision-mcp',
      prompt_hash: '',
      created_at: '2026-07-07T00:00:00.000Z',
    },
    created_at: '2026-07-07T00:00:00.000Z',
    updated_at: '2026-07-07T00:00:00.000Z',
    ...over,
  };
}

describe('judgment mirror receipt contract', () => {
  it('renders without review-only fields or a fabricated review score', () => {
    const markdown = receiptToMarkdown(judgmentMirror());

    expect(markdown).toContain('AI verdict: none');
    expect(markdown).toContain('Will beta conversion beat 4%?');
    expect(markdown).toContain('beta conversion beats 4%');
    expect(markdown).not.toContain('/100');
    expect(markdown).not.toContain('Reviewability');
    expect(markdown).not.toContain('Applied lenses');
  });

  it('treats a missing legacy review payload as a judgment mirror fallback', () => {
    const markdown = receiptToMarkdown(judgmentMirror({ kind: undefined }));

    expect(markdown).toContain('AI verdict: none');
    expect(markdown).not.toContain('/100');
  });
});
