import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { JudgmentPatternsCard } from '../JudgmentPatternsCard';
import type { Project } from '@/stores/types';
import { createItem } from '@/lib/decision-items';

vi.mock('@/components/ui/Card', () => ({ Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

describe('JudgmentPatternsCard navigation', () => {
  it('turns a record fact into a route back to the decisions that created it', () => {
    const projects = [
      { id: 'a', name: '출시 시점', decision_contract: {} },
      { id: 'b', name: '채용 계획', decision_contract: {} },
    ] as Project[];
    const items = ['a', 'b'].map((id) => createItem({
      decision_id: id,
      type: 'premise',
      text: '다음 분기 매출은 지금 수준을 유지한다',
      source: 'user',
      external: false,
      load_bearing: true,
    }, Date.now()));
    const html = renderToStaticMarkup(
      <JudgmentPatternsCard projects={projects} items={items} locale="ko" onSelectDecision={() => {}} />,
    );
    expect(html).toContain('<button');
    expect(html).toContain('출시 시점');
    expect(html).toContain('채용 계획');
  });
});
