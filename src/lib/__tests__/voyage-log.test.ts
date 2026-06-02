/**
 * Chronicler salience gate — unit tests for deriveWaypoint (Phase 2).
 *
 * Validates the deterministic detect+classify+suppress behavior in isolation:
 * always-salient endpoints, conditional turns, honest triggers read from state,
 * road-not-taken capture, priority when multiple types qualify, and (crucially)
 * suppression of non-turns.
 */

import { describe, it, expect, vi } from 'vitest';

let _id = 0;
vi.mock('@/lib/uuid', () => ({ generateId: vi.fn(() => `wp-${++_id}`) }));
vi.mock('@/lib/i18n', () => ({ getCurrentLanguage: vi.fn(() => 'en') }));

import { deriveWaypoint } from '@/lib/voyage-log';
import type {
  VoyageCheckpoint,
  VoyageCheckpointState,
  VoyageStage,
  AnalysisSnapshot,
  FlowQuestion,
  FlowAnswer,
  DMFeedbackResult,
} from '@/stores/types';

const snap = (over: Partial<AnalysisSnapshot>): AnalysisSnapshot => ({
  version: 0,
  real_question: 'baseline question',
  hidden_assumptions: [],
  skeleton: [],
  ...over,
});

const baseState = (over: Partial<VoyageCheckpointState>): VoyageCheckpointState => ({
  phase: 'conversing', round: 0, questions: [], answers: [], snapshots: [],
  workers: [], worker_deploy_phase: 'none', mix: null, dm_feedback: null,
  final_deliverable: null, final_mix: null, user_notes: null,
  decision_maker: null, lead_synthesis: null,
  ...over,
});

const cp = (stage: VoyageStage, state: VoyageCheckpointState, id = 'cp-x'): VoyageCheckpoint => ({
  id, parent_id: null, stage, label: stage, created_at: '2026-01-01T00:00:00.000Z', state_snapshot: state,
});

describe('deriveWaypoint — Chronicler salience gate', () => {
  it('origin → departure, with the problem text as trigger', () => {
    const wp = deriveWaypoint({
      newCheckpoint: cp('origin', baseState({ snapshots: [snap({})] })),
      prevState: null,
      problemText: 'Competitor launched a chatbot, should we build one too?',
    });
    expect(wp?.type).toBe('departure');
    expect(wp?.headline).toContain('Competitor');
    expect(wp?.trigger).toContain('chatbot');
  });

  it('anchor → anchorage (always)', () => {
    const wp = deriveWaypoint({ newCheckpoint: cp('anchor', baseState({})), prevState: null, problemText: 'x' });
    expect(wp?.type).toBe('anchorage');
  });

  it('briefing with a turned real_question → course_change, with road-not-taken + handed trigger', () => {
    const q: FlowQuestion = { id: 'q1', text: 'Who decides?', type: 'short', engine_phase: 'reframe' };
    const a: FlowAnswer = { question_id: 'q1', value: 'The CFO, who needs ROI' };
    const prev = baseState({ snapshots: [snap({ real_question: 'Should we build a chatbot?' })] });
    const cur = baseState({
      questions: [q], answers: [a],
      snapshots: [snap({ real_question: 'What is the real cause of churn?' })],
    });
    const wp = deriveWaypoint({ newCheckpoint: cp('briefing', cur), prevState: prev, problemText: 'x' });
    expect(wp?.type).toBe('course_change');
    expect(wp?.headline).toContain('churn');
    expect(wp?.trigger).toContain('CFO');
    // road not taken = the prior framing, plus the path taken
    expect(wp?.alternatives).toHaveLength(2);
    expect(wp?.alternatives?.find(x => !x.taken)?.label).toContain('chatbot');
    expect(wp?.alternatives?.find(x => x.taken)?.label).toContain('churn');
  });

  it('briefing with an unchanged real_question → suppressed (null)', () => {
    const same = snap({ real_question: 'Same question' });
    const wp = deriveWaypoint({
      newCheckpoint: cp('briefing', baseState({ snapshots: [same] })),
      prevState: baseState({ snapshots: [snap({ real_question: 'Same question' })] }),
      problemText: 'x',
    });
    expect(wp).toBeNull();
  });

  it('briefing with a net assumption decrease → reef naming the resolved assumption', () => {
    const prev = baseState({ snapshots: [snap({ hidden_assumptions: ['churn is price', 'users want chat'] })] });
    const cur = baseState({ snapshots: [snap({ hidden_assumptions: ['churn is price'] })] });
    const wp = deriveWaypoint({ newCheckpoint: cp('briefing', cur), prevState: prev, problemText: 'x' });
    expect(wp?.type).toBe('reef');
    expect(wp?.headline).toContain('users want chat');
  });

  it('course_change wins over reef when both qualify (higher altitude)', () => {
    const prev = baseState({ snapshots: [snap({ real_question: 'Q old', hidden_assumptions: ['a', 'b'] })] });
    const cur = baseState({ snapshots: [snap({ real_question: 'Q new', hidden_assumptions: ['a'] })] });
    const wp = deriveWaypoint({ newCheckpoint: cp('briefing', cur), prevState: prev, problemText: 'x' });
    expect(wp?.type).toBe('course_change');
  });

  it('review with a critical concern → headwind attributed to the reviewer', () => {
    const fb: DMFeedbackResult = {
      persona_name: 'Kim', persona_role: 'CFO', first_reaction: '', good_parts: [],
      concerns: [
        { text: 'minor wording', severity: 'minor', fix_suggestion: '', applied: false },
        { text: 'No ROI estimate — cannot approve budget', severity: 'critical', fix_suggestion: '', applied: false },
      ],
      would_ask: [], approval_condition: '',
    };
    const wp = deriveWaypoint({ newCheckpoint: cp('review', baseState({ dm_feedback: fb })), prevState: null, problemText: 'x' });
    expect(wp?.type).toBe('headwind');
    expect(wp?.headline).toContain('ROI');
    expect(wp?.trigger).toContain('CFO');
  });

  it('review without a critical concern → suppressed', () => {
    const fb: DMFeedbackResult = {
      persona_name: 'Kim', persona_role: 'CFO', first_reaction: '', good_parts: [],
      concerns: [{ text: 'small nit', severity: 'minor', fix_suggestion: '', applied: false }],
      would_ask: [], approval_condition: '',
    };
    const wp = deriveWaypoint({ newCheckpoint: cp('review', baseState({ dm_feedback: fb })), prevState: null, problemText: 'x' });
    expect(wp).toBeNull();
  });

  it('process stages (crew_set, crew_done, mix) → suppressed', () => {
    for (const stage of ['crew_set', 'crew_done', 'mix'] as VoyageStage[]) {
      expect(deriveWaypoint({ newCheckpoint: cp(stage, baseState({})), prevState: baseState({}), problemText: 'x' })).toBeNull();
    }
  });
});
