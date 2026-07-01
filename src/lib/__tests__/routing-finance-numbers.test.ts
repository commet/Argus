import { describe, it, expect } from 'vitest';
import { scoreAgentForTask } from '../agent-capabilities';
import type { TaskType, ContextDomain, OutputType } from '../task-classifier';

// Helper: score with no secondary type.
const s = (id: string, tt: TaskType, dom: ContextDomain, out: OutputType) =>
  scoreAgentForTask(id, tt, null, dom, out);

describe('minjae(규민/numbers) vs hyeyeon(혜연/finance) — routing separation', () => {
  // Before this change both had identical domains [finance,market,ops] and
  // tied at 1.0 on any calc+finance+numbers task → coin-flip routing.

  it('valuation (calculation + finance + numbers) routes to hyeyeon', () => {
    expect(s('hyeyeon', 'calculation', 'finance', 'numbers'))
      .toBeGreaterThan(s('minjae', 'calculation', 'finance', 'numbers'));
  });

  it('financial-statement analysis (analysis + finance + report) routes to hyeyeon', () => {
    expect(s('hyeyeon', 'analysis', 'finance', 'report'))
      .toBeGreaterThan(s('minjae', 'analysis', 'finance', 'report'));
  });

  it('market sizing (calculation + market + numbers) routes to minjae', () => {
    expect(s('minjae', 'calculation', 'market', 'numbers'))
      .toBeGreaterThan(s('hyeyeon', 'calculation', 'market', 'numbers'));
  });

  it('ROI / scenario compare (calculation + finance + comparison) routes to minjae', () => {
    // Even on the finance domain, minjae wins ROI because comparison is its
    // 2nd output and calculation its 1st task type.
    expect(s('minjae', 'calculation', 'finance', 'comparison'))
      .toBeGreaterThan(s('hyeyeon', 'calculation', 'finance', 'comparison'));
  });

  it('finance audit/critique (critique + finance + risk_assessment) routes to hyeyeon', () => {
    expect(s('hyeyeon', 'critique', 'finance', 'risk_assessment'))
      .toBeGreaterThan(s('minjae', 'critique', 'finance', 'risk_assessment'));
  });
});
