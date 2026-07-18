/**
 * WaypointCard render verification — the single home of a decision-turn's
 * narration (rail + full chart + mobile trail all render through this). Asserts
 * the type chip, headline, significance, trigger, the road-not-taken with its
 * "이 길 가보기" fork handle, the assumptions drill-down, the optional eyebrow,
 * and the optional action slot.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import type { Waypoint } from '@/stores/types';

vi.mock('@/hooks/useLocale', () => ({ useLocale: () => 'ko' }));

import { WaypointCard, WaypointDetail } from '@/components/workspace/progressive/shared/WaypointCard';

const wp: Waypoint = {
  id: 'w2', checkpoint_id: 'c2', type: 'course_change', headline: '이탈의 진짜 원인은?',
  trigger: '질문: 누가 결정? → CFO', significance: '가격이 아니라 신뢰가 원인일 수 있다',
  created_at: 'y',
  alternatives: [
    { label: '챗봇 직접 제작', why_abandoned: '이탈 원인 미검증', why_abandoned_source: 'user', taken: false },
    { label: '이탈 원인 분석 선행', why_abandoned: '', taken: true },
  ],
};

describe('WaypointCard', () => {
  const html = renderToStaticMarkup(createElement(WaypointCard, {
    waypoint: wp,
    assumptions: ['이탈은 가격 때문이다', '챗봇이 이탈을 막는다'],
    locked: false,
    onTakeRoad: () => {},
    eyebrow: '지금',
    action: createElement('button', null, '이 지점에서 항해'),
  }));

  it('renders the type chip, eyebrow, and headline', () => {
    expect(html).toContain('지금');          // eyebrow
    expect(html).toContain('방향 변경');       // type label (course_change, ko)
    expect(html).toContain('이탈의 진짜 원인은?'); // headline
  });

  it('renders significance and the handed trigger', () => {
    expect(html).toContain('가격이 아니라 신뢰가');
    expect(html).toContain('계기');
    expect(html).toContain('CFO');
  });

  it('renders the road-not-taken with its fork handle, hiding the taken one', () => {
    expect(html).toContain('보류한 선택지');
    expect(html).toContain('챗봇 직접 제작');
    expect(html).toContain('이 길 가보기');
    expect(html).not.toContain('이탈 원인 분석 선행'); // the taken alt is not a road-not-taken
  });

  it('renders the assumptions drill-down and the action slot', () => {
    expect(html).toContain('이 시점의 가정 2');
    expect(html).toContain('챗봇이 이탈을 막는다');
    expect(html).toContain('이 지점에서 항해'); // injected action
  });

  it('WaypointDetail alone omits the chrome (headline/eyebrow) but keeps the body', () => {
    const body = renderToStaticMarkup(createElement(WaypointDetail, {
      waypoint: wp, assumptions: [], locked: false, onTakeRoad: () => {},
    }));
    expect(body).toContain('보류한 선택지');
    expect(body).not.toContain('지금');       // no eyebrow
    expect(body).not.toContain('방향 변경');    // no type chip
  });

  it('keeps a legacy source-less reason stored but does not present it as the user\'s reason', () => {
    const legacy = {
      ...wp,
      alternatives: [{ label: '옛 경로', why_abandoned: 'AI가 예전에 추정한 이유', taken: false }],
    } as Waypoint;
    const body = renderToStaticMarkup(createElement(WaypointDetail, {
      waypoint: legacy, assumptions: [], locked: false, onTakeRoad: () => {},
    }));
    expect(body).toContain('옛 경로');
    expect(body).not.toContain('AI가 예전에 추정한 이유');
  });
});
