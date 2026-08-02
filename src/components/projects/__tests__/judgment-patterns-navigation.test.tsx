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

  it('says when compact mode has hidden records', () => {
    const projects = Array.from({ length: 4 }, (_, index) => ({
      id: `d${index}`,
      name: `결정 ${index}`,
      decision_contract: {},
    })) as Project[];
    const items = projects.map((project, index) => ({
      ...createItem({
        decision_id: project.id,
        type: 'premise',
        text: `아직 답하지 않은 질문 ${index}?`,
        source: 'user',
        external: false,
        load_bearing: false,
      }, Date.now() - index * 86_400_000),
      type: 'open_question' as const,
    }));
    const html = renderToStaticMarkup(
      <JudgmentPatternsCard projects={projects} items={items} locale="ko" onSelectDecision={() => {}} />,
    );
    // Four questions are compacted to three: the omitted record is not silent.
    expect(html).toContain('나머지 1건 보기');
    expect(html).toContain('aria-expanded="false"');
  });
});
