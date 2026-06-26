/**
 * VoyageMapRail render verification — exercises the rail's own composition logic
 * (collapse spine ↔ full rail, 해도 hero with/without a charted course, and the
 * trail/crew section gating) with seeded store data. Heavy children (BranchMap,
 * Logbook, AgentSidebar, VoyageChart) are stubbed so this asserts the RAIL's
 * wiring, not theirs (those have their own render tests). Closest deterministic
 * proxy to a visual check with no browser.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import type { ProgressiveSession, WorkerTask } from '@/stores/types';

// ── Mutable mock state the mocks read at render time ──
const state: {
  collapsed: boolean;
  workers: WorkerTask[];
  session: Partial<ProgressiveSession>;
} = {
  collapsed: false,
  workers: [],
  session: {},
};

vi.mock('@/hooks/useLocale', () => ({ useLocale: () => 'ko' }));
vi.mock('@/components/workspace/progressive/SeaChart', () => ({
  SeaChart: () => createElement('div', null, 'SEACHART_STUB'),
}));
vi.mock('@/components/workspace/progressive/VoyageChart', () => ({ VoyageChart: () => null }));
vi.mock('@/components/workspace/progressive/Logbook', () => ({
  Logbook: () => createElement('div', null, 'LOGBOOK_STUB'),
}));
vi.mock('@/components/workspace/progressive/AgentSidebar', () => ({
  AgentSidebar: () => createElement('div', null, 'CREW_STUB'),
  isWorkingStatus: (s: string) => s === 'running',
}));
vi.mock('@/components/workspace/progressive/WorkerPanel', () => ({
  useWorkers: () => state.workers,
}));
vi.mock('@/stores/useSettingsStore', () => ({
  useSettingsStore: (sel: (s: unknown) => unknown) =>
    sel({ settings: { voyage_map_collapsed: state.collapsed }, updateSettings: () => {} }),
}));
vi.mock('@/stores/useProgressiveStore', () => ({
  useProgressiveStore: (sel: (s: unknown) => unknown) =>
    sel({ sessions: [state.session], currentSessionId: 's1' }),
}));

import { VoyageMapRail } from '@/components/workspace/progressive/VoyageMapRail';

const charted: Partial<ProgressiveSession> = {
  id: 's1',
  active_branch_id: 'b-main',
  active_checkpoint_id: 'c1',
  checkpoints: [{ id: 'c1', parent_id: null, stage: 'origin', label: 'o', created_at: 'x', state_snapshot: {} as never }],
  branches: [{ id: 'b-main', name: '본 항로', head_checkpoint_id: 'c1', forked_from_checkpoint_id: null, status: 'sailing', color: '#2d4a7c', created_at: 'x' }],
  waypoints: [{ id: 'w1', checkpoint_id: 'c1', type: 'departure', headline: '출항', created_at: 'x' }],
};

describe('VoyageMapRail — full (expanded)', () => {
  it('renders the rail header, 해도 hero, and the inline branch-graph when charted', () => {
    state.collapsed = false;
    state.workers = [{ id: 'wk1', status: 'running' } as WorkerTask];
    state.session = charted;
    const html = renderToStaticMarkup(createElement(VoyageMapRail));
    expect(html).toContain('항해 지도');     // rail header
    expect(html).toContain('해도');           // hero eyebrow
    expect(html).toContain('전체 해도');       // full-chart entry (hasChart)
    expect(html).toContain('지금');           // current-position caption label
    expect(html).toContain('SEACHART_STUB'); // the inline graph hero
    expect(html).toContain('LOGBOOK_STUB');   // trail section (hasWaypoints)
    expect(html).toContain('CREW_STUB');      // crew section (hasWorkers)
  });

  it('shows the empty-chart identity (no graph) before the first fork is logged', () => {
    state.collapsed = false;
    state.workers = [];
    state.session = { id: 's1', checkpoints: [], branches: [], waypoints: [] };
    const html = renderToStaticMarkup(createElement(VoyageMapRail));
    expect(html).toContain('해도');                 // hero still present
    expect(html).toContain('갈림길이 여기 해도로');  // empty-state copy
    expect(html).not.toContain('SEACHART_STUB');   // no graph yet
    expect(html).not.toContain('전체 해도');         // no full-chart entry yet
    expect(html).not.toContain('LOGBOOK_STUB');     // no trail (no waypoints)
    expect(html).not.toContain('CREW_STUB');        // no crew
  });
});

describe('VoyageMapRail — collapsed spine', () => {
  it('renders a slim spine with the vertical label and glanceable counts', () => {
    state.collapsed = true;
    state.workers = [{ id: 'wk1', status: 'running' } as WorkerTask];
    state.session = { ...charted, waypoints: [
      { id: 'w1', checkpoint_id: 'c1', type: 'departure', headline: '출항', created_at: 'x' },
      { id: 'w2', checkpoint_id: 'c1', type: 'course_change', headline: '침로', created_at: 'y' },
    ] };
    const html = renderToStaticMarkup(createElement(VoyageMapRail));
    expect(html).toContain('항해 지도');        // vertical label
    expect(html).toContain('>2<');              // waypoint count badge
    expect(html).not.toContain('SEACHART_STUB'); // graph not rendered while collapsed
    expect(html).not.toContain('LOGBOOK_STUB');
  });
});
