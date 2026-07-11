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

  // ── 적대 probe(loop 14)가 노출한 구멍: info/validation 신호가 특정 표현형을 놓쳐
  //    비-결정 입력이 open_decision으로 새고, 엔진이 사실질문에 크럭스를 날조하거나
  //    닫힌 결정을 재오픈한다(CLAUDE.md honest-gap + mirror-clause 위반). ──
  it('info: where/quantity factual questions (were leaking to open_decision)', () => {
    expect(classifyRequestType('대한민국 수도가 어디야?')).toBe('info');
    expect(classifyRequestType('물은 몇 도에서 끓어?')).toBe('info');
    expect(classifyRequestType('Where is the capital of Korea?')).toBe('info');
    expect(classifyRequestType('How much does it cost?')).toBe('info');
  });

  it('validation: concrete completed actions, not just abstract "decided" verbs', () => {
    expect(classifyRequestType('어제 계약서에 이미 사인했어. 끝난 얘기야.')).toBe('validation');
    expect(classifyRequestType('이미 샀어')).toBe('validation');
    expect(classifyRequestType('I already signed the contract, it’s done')).toBe('validation');
  });

  it('conservative guard preserved: a factual-looking phrase WITH decision framing stays open', () => {
    // 어디서 '시작'할지 = 실제 결정. info 신호가 있어도 action 가드가 지켜야 한다.
    expect(classifyRequestType('어디서 시작할지 정해야 하는데 어디가 나을까?')).toBe('open_decision');
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
