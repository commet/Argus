/**
 * resolveCheckpointNav — unit coverage for the pure fork-vs-switch decision the
 * chart's confirm dialog and the store's navigateToCheckpoint both read.
 */
import { describe, it, expect } from 'vitest';
import { resolveCheckpointNav } from '@/lib/voyage-nav';
import type { VoyageCheckpoint, VoyageBranch, VoyageCheckpointState } from '@/stores/types';

const st = {} as VoyageCheckpointState;
const cp = (id: string, parent: string | null): VoyageCheckpoint => ({
  id, parent_id: parent, stage: 'briefing', label: id, created_at: id, state_snapshot: st,
});
const br = (id: string, head: string, forkedFrom: string | null): VoyageBranch => ({
  id, name: id, head_checkpoint_id: head, forked_from_checkpoint_id: forkedFrom,
  status: 'sailing', color: '#000', created_at: id,
});

// main: c1 → c2 → c3 (active, head c3). fork: c1 → f1 (head f1).
const checkpoints = [cp('c1', null), cp('c2', 'c1'), cp('c3', 'c2'), cp('f1', 'c1')];
const branches = [br('main', 'c3', null), br('fork', 'f1', 'c1')];

describe('resolveCheckpointNav', () => {
  it('noop when targeting the current checkpoint', () => {
    expect(resolveCheckpointNav(checkpoints, branches, 'main', 'c3', 'c3')).toEqual({ action: 'noop' });
  });

  it('forks when the point is on the active course (go back & diverge)', () => {
    expect(resolveCheckpointNav(checkpoints, branches, 'main', 'c3', 'c2'))
      .toEqual({ action: 'fork', fromCheckpointId: 'c2' });
  });

  it('forks on shared ancestry too', () => {
    expect(resolveCheckpointNav(checkpoints, branches, 'main', 'c3', 'c1'))
      .toEqual({ action: 'fork', fromCheckpointId: 'c1' });
  });

  it('switches when the point belongs to another explored course', () => {
    // active = fork (head f1); tapping c2/c3 (main-only) returns to main.
    expect(resolveCheckpointNav(checkpoints, branches, 'fork', 'f1', 'c3'))
      .toEqual({ action: 'switch', branchId: 'main' });
  });

  it('forks from an unowned point (e.g. a checkpoint id with no branch)', () => {
    expect(resolveCheckpointNav(checkpoints, branches, 'main', 'c3', 'ghost'))
      .toEqual({ action: 'fork', fromCheckpointId: 'ghost' });
  });
});
