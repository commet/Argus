import { describe, expect, it } from 'vitest';
import { buildCompanionBrief } from '../companion-brief';
import { clearPendingBriefChanges, dueOpenQuestions, pendingBriefChanges } from '../companion-brief-routing';
import type { JudgmentReceipt } from '../review';

function receipt(overrides: Partial<JudgmentReceipt> = {}): JudgmentReceipt {
  return {
    receipt_id: 'r1',
    state: 'sealed',
    source_title: '조달 시점 판단',
    core_question: '지금 조달할까?',
    falsifiable_followups: [{ followup_id: 'f1', predicate: 'p', pass_condition: 'yes', fail_condition: 'no', check_by: '2026-08-01', sealed_at: '2026-06-01T00:00:00.000Z' }],
    tracked_premises: [],
    ...overrides,
  } as JudgmentReceipt;
}

describe('companion-brief T5 routing helpers', () => {
  it('turns pending minor drift into a brief change with source and confidence, then clears it', () => {
    const r = receipt({
      tracked_premises: [{
        premise_id: 'p_rate',
        ordinal: 2,
        kind: 'premise',
        text: '기준금리가 3.5% 근처에 머문다',
        external: true,
        load_bearing: true,
        source: 'user_stated',
        status: 'active',
        amend_history: [],
        recheck_count: 2,
        last_recheck: {
          finding: '기준금리 3.51%',
          numeric_value: 3.51,
          baseline_finding: '기준금리 3.5%',
          baseline_numeric_value: 3.5,
          drifted: false,
          baseline_only: false,
          source: 'url',
          source_detail: 'https://bok.example/current (2026-07-07)',
          confidence: 'high',
          brief_pending: true,
          brief_kind: 'premise_minor_drift',
          ts: '2026-07-07T09:00:00.000Z',
        },
      }],
    });

    const changes = pendingBriefChanges(r);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      text: '기준금리가 3.5% 근처에 머문다',
      fact: '기준금리 3.51%',
      current_value: 3.51,
      source_url: 'https://bok.example/current',
      source_date: '2026-07-07',
      confidence: 'high',
    });

    const md = buildCompanionBrief([{ source_title: r.source_title, core_question: r.core_question, predicates: [], changes }]).markdown;
    expect(md).toContain('변화가 있어요');
    expect(md).toContain('기준금리 3.51%');
    expect(md).toContain('https://bok.example/current');

    const cleared = clearPendingBriefChanges(r);
    expect(cleared.tracked_premises?.[0].last_recheck?.brief_pending).toBeUndefined();
  });

  it('routes due open questions into T3 brief-only nudges', () => {
    const r = receipt({
      tracked_premises: [{
        premise_id: 'p_reg',
        ordinal: 1,
        kind: 'open_question',
        text: '내년 규제 완화 여부',
        external: true,
        load_bearing: false,
        source: 'ai_surfaced',
        status: 'active',
        amend_history: [],
        recheck_count: 0,
        added_ts: '2026-06-01T00:00:00.000Z',
      }],
    });

    expect(dueOpenQuestions(r, '2026-07-07')).toEqual([{ ordinal: 1, text: '내년 규제 완화 여부' }]);
  });

  /**
   * `monitoring_enabled:false` is the user pressing "stop nudging me about this",
   * and the nudge copy promises exactly that. `isMonitored` honoured it for
   * premises; `isReconsiderable` looked only at kind+status, so a MUTED open
   * question was still emailed every day — a no-op switch on precisely the items
   * whose copy promises it works (2026-07-29).
   */
  it('stays silent on an open question the user muted', () => {
    const muted = receipt({
      tracked_premises: [{
        premise_id: 'p_reg',
        ordinal: 1,
        kind: 'open_question',
        text: '내년 규제 완화 여부',
        external: true,
        load_bearing: false,
        monitoring_enabled: false,
        source: 'ai_surfaced',
        status: 'active',
        amend_history: [],
        recheck_count: 0,
        added_ts: '2026-06-01T00:00:00.000Z',
      }],
    });

    expect(dueOpenQuestions(muted, '2026-07-07')).toEqual([]);
  });
});
