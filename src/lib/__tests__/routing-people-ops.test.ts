import { describe, it, expect } from 'vitest';
import { scoreAgentForTask } from '../agent-capabilities';
import { classifySteps } from '../task-classifier';
import type { TaskType, ContextDomain, OutputType } from '../task-classifier';

const s = (id: string, tt: TaskType, dom: ContextDomain, out: OutputType) =>
  scoreAgentForTask(id, tt, null, dom, out);

describe('sujin_hr(수진/HR) vs yerin(예린/PM) — people vs ops separation', () => {
  // Before: HR keywords (채용/조직/인력) classified as `ops`, so HR and PM
  // tied at 1.0 on planning+ops+plan → coin-flip (27 ambiguous combos).

  it('people-domain planning routes to HR, not PM', () => {
    expect(s('sujin_hr', 'planning', 'people', 'plan'))
      .toBeGreaterThan(s('yerin', 'planning', 'people', 'plan'));
  });

  it('ops-domain planning routes to PM, not HR', () => {
    expect(s('yerin', 'planning', 'ops', 'plan'))
      .toBeGreaterThan(s('sujin_hr', 'planning', 'ops', 'plan'));
  });

  it('classifies a hiring/org task as the people domain (end-to-end)', () => {
    const [hiring] = classifySteps([{ task: '신규 팀 채용 계획과 온보딩 설계', output: '채용 계획서' }]);
    expect(hiring.contextDomain).toBe('people');

    const [culture] = classifySteps([{ task: 'org culture and retention strategy', output: 'plan' }]);
    expect(culture.contextDomain).toBe('people');
  });

  it('keeps a pure ops task (process/automation) in the ops domain', () => {
    const [ops] = classifySteps([{ task: '운영 프로세스 자동화와 효율 개선', output: '실행 계획' }]);
    expect(ops.contextDomain).toBe('ops');
  });
});
