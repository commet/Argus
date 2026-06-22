/**
 * VoyagePhaseRail render verification — the 3-phase voyage skeleton that
 * replaced the flat 5-step ProgressLine. Asserts:
 *  - the three voyage names (묶기/듣기/닿기) always form the skeleton,
 *  - the operational→voyage mapping (incl. the conversing+crew → Listen
 *    special-case carried over from the old stageIdx), and
 *  - the deaf-rower invariant line surfaces during Listen.
 * Pure unit test of voyagePhaseOf + a static-markup render (no browser).
 */

import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';

vi.mock('@/hooks/useLocale', () => ({ useLocale: () => 'ko' }));

import { VoyagePhaseRail, voyagePhaseOf } from '@/components/workspace/progressive/VoyagePhaseRail';

const render = (phase: string, crewDeployed = false) =>
  renderToStaticMarkup(createElement(VoyagePhaseRail, { phase, crewDeployed }));

describe('voyagePhaseOf mapping', () => {
  it('groups Bind stages', () => {
    for (const p of ['idle', 'assembling', 'analyzing']) {
      expect(voyagePhaseOf(p)).toBe('bind');
    }
    expect(voyagePhaseOf('conversing', false)).toBe('bind');
  });

  it('moves conversing into Listen once crew is deployed', () => {
    expect(voyagePhaseOf('conversing', true)).toBe('listen');
  });

  it('groups Listen stages', () => {
    for (const p of ['mixing', 'lead_synthesizing', 'dm_feedback', 'refining', 'testing']) {
      expect(voyagePhaseOf(p)).toBe('listen');
    }
  });

  it('maps complete to Land', () => {
    expect(voyagePhaseOf('complete')).toBe('land');
  });
});

describe('VoyagePhaseRail render', () => {
  it('always renders the three voyage names as the skeleton', () => {
    const html = render('analyzing');
    expect(html).toContain('묶기');
    expect(html).toContain('듣기');
    expect(html).toContain('닿기');
  });

  it('shows the operational substage under the active phase', () => {
    expect(render('analyzing')).toContain('분석');
    expect(render('conversing', false)).toContain('질문');
    expect(render('mixing')).toContain('팀 작업');
    expect(render('refining')).toContain('검토');
  });

  it('surfaces the deaf-rower invariant during Listen', () => {
    expect(render('mixing')).toContain('AI가 대신 정할 수 없어요 — 당신이 확인합니다.');
  });

  it('exposes an accessible N/3 + phase current-state line', () => {
    const html = render('mixing');
    expect(html).toContain('2/3');
    expect(html).toContain('항해 2/3단계');
  });

  it('does not show the deaf-rower line during Bind', () => {
    expect(render('analyzing')).not.toContain('AI가 대신 정할 수 없어요');
  });
});
