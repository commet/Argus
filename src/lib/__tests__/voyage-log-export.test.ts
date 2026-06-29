/**
 * voyageLogToMarkdown — the ship's log appended to exported deliverables
 * ("the process is the deliverable"). Verifies the active branch's waypoints
 * render with trigger/significance/road-not-taken, and empties cleanly.
 */

import { describe, it, expect } from 'vitest';
import { voyageLogToMarkdown } from '@/lib/export';
import type { ProgressiveSession } from '@/stores/types';

const cp = (id: string, parent: string | null, t: string) =>
  ({ id, parent_id: parent, stage: 'briefing', label: id, created_at: t, state_snapshot: {} }) as never;

const session = (waypoints: unknown[]): ProgressiveSession => ({
  id: 's1', project_id: 'p', problem_text: '경쟁사처럼 챗봇 만들어', decision_maker: null,
  phase: 'complete', round: 0, max_rounds: 5, questions: [], answers: [], snapshots: [],
  workers: [], worker_deploy_phase: 'none', mix: null, dm_feedback: null, final_deliverable: 'doc',
  checkpoints: [cp('c1', null, 't1'), cp('c2', 'c1', 't2')],
  active_checkpoint_id: 'c2',
  branches: [{ id: 'm', name: '본 항로', head_checkpoint_id: 'c2', forked_from_checkpoint_id: null, color: '#000', created_at: 'a' }],
  active_branch_id: 'm',
  waypoints: waypoints as never,
  created_at: 'a', updated_at: 'b',
});

describe('voyageLogToMarkdown', () => {
  it('renders the active branch waypoints with trigger, significance, and road-not-taken', () => {
    const md = voyageLogToMarkdown(session([
      { id: 'w1', checkpoint_id: 'c1', type: 'departure', headline: '경쟁사처럼 챗봇', created_at: 'a' },
      {
        id: 'w2', checkpoint_id: 'c2', type: 'course_change', headline: '이탈의 진짜 원인은?',
        trigger: 'CFO', significance: 'ROI 근거가 필요하다',
        alternatives: [
          { label: '챗봇 직접 제작', why_abandoned: '이탈 원인 미검증', taken: false },
          { label: '이탈 원인 분석', why_abandoned: '', taken: true },
        ],
        created_at: 'b',
      },
    ]), 'ko');

    expect(md).toContain('## 항해일지');
    expect(md).toContain('출항');
    expect(md).toContain('경쟁사처럼 챗봇');
    expect(md).toContain('침로 변경');
    expect(md).toContain('이탈의 진짜 원인은?');
    expect(md).toContain('계기: CFO');
    expect(md).toContain('의미: ROI 근거가 필요하다');
    expect(md).toContain('가지 않은 길: 챗봇 직접 제작 — 이탈 원인 미검증');
    expect(md).not.toContain('이탈 원인 분석'); // the taken path isn't a road-not-taken
  });

  it('returns empty string for no waypoints or null session', () => {
    expect(voyageLogToMarkdown(session([]), 'ko')).toBe('');
    expect(voyageLogToMarkdown(null, 'ko')).toBe('');
    expect(voyageLogToMarkdown(undefined, 'en')).toBe('');
  });

  it('only includes waypoints on the active branch path', () => {
    // a waypoint pointing at a checkpoint NOT on the active path is excluded
    const md = voyageLogToMarkdown(session([
      { id: 'w1', checkpoint_id: 'c1', type: 'departure', headline: 'on path', created_at: 'a' },
      { id: 'wX', checkpoint_id: 'orphan', type: 'reef', headline: 'off path', created_at: 'b' },
    ]), 'en');
    expect(md).toContain('on path');
    expect(md).not.toContain('off path');
  });
});
