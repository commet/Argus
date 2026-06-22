import { describe, it, expect } from 'vitest';
import { classifyRequestType, classifyReadiness } from '../request-type-classifier';

describe('classifyRequestType (step-0 gate)', () => {
  it('detects validation (already decided)', () => {
    expect(classifyRequestType('이미 정했는데 괜찮을까?')).toBe('validation');
    expect(classifyRequestType('하기로 했고 확인만 하고 싶어')).toBe('validation');
    expect(classifyRequestType("we're going with React, just sanity-check me")).toBe('validation');
  });

  it('detects vent (emotional, no question/action)', () => {
    expect(classifyRequestType('진짜 너무 지친다')).toBe('vent');
    expect(classifyRequestType("I'm just venting, work is exhausting")).toBe('vent');
  });

  it('detects info (plain factual question)', () => {
    expect(classifyRequestType('How does OAuth work?')).toBe('info');
    expect(classifyRequestType('설명해줘 React 원리')).toBe('info');
  });

  it('defaults to open_decision (the conservative error)', () => {
    expect(classifyRequestType('A안이냐 B안이냐?')).toBe('open_decision');
    expect(classifyRequestType('should we ship now or wait?')).toBe('open_decision');
    expect(classifyRequestType('')).toBe('open_decision');
  });

  it('a decision that merely mentions feelings is still open_decision (vent needs no action/question)', () => {
    expect(classifyRequestType('이 일이 좀 힘든데 그만둘지 말지 정해야 해')).toBe('open_decision');
  });
});

describe('classifyReadiness (open_decision axis 2)', () => {
  it('detects resistance only on explicit textual signals', () => {
    expect(classifyReadiness('몇 달째 못 정하겠어')).toBe('resistance');
    expect(classifyReadiness('I keep putting it off, going back and forth for weeks now')).toBe('resistance');
  });

  it('defaults to ready (never inferred from tone)', () => {
    expect(classifyReadiness('A냐 B냐 처음 고민이야')).toBe('ready');
    expect(classifyReadiness('should I take the job?')).toBe('ready');
  });
});
