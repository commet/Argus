import { describe, it, expect } from 'vitest';
import { scoreAgentForTask } from '../agent-capabilities';
import type { TaskType, ContextDomain, OutputType } from '../task-classifier';

const s = (id: string, tt: TaskType, dom: ContextDomain, out: OutputType) =>
  scoreAgentForTask(id, tt, null, dom, out);

describe('coverage: synthesis has a primary owner', () => {
  // Before: no agent had synthesis as taskTypes[0] (only navigator, a reviewer),
  // so "combine the team's findings into one conclusion" routed ambiguously.
  it('synthesis routes to research_director over the other synthesis-capable agents', () => {
    const rd = s('research_director', 'synthesis', 'market', 'report');
    for (const other of ['hyunwoo', 'chief_strategist', 'sujin', 'yerin']) {
      expect(rd).toBeGreaterThan(s(other, 'synthesis', 'market', 'report'));
    }
  });

  it('analysis still routes correctly (junseo for tech, research_director keeps market)', () => {
    expect(s('junseo', 'analysis', 'tech', 'plan'))
      .toBeGreaterThan(s('research_director', 'analysis', 'tech', 'plan'));
    expect(s('research_director', 'analysis', 'market', 'report'))
      .toBeGreaterThan(s('junseo', 'analysis', 'market', 'report'));
  });
});
