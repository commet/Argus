/**
 * Skill Quality Eval v2 — 프레임워크 테스트
 */

import {
  evaluateSkillOutput,
  evaluatePipelineChaining,
  buildContentJudgePrompts,
  buildBatchJudgePrompt,
  formatEvalReport,
  TEST_SCENARIOS,
  type SkillName,
} from '@/lib/skill-quality-eval';

/* ── Framework basics ── */

describe('evaluateSkillOutput', () => {
  it('returns structural + content evals for each skill', () => {
    const skills: SkillName[] = ['reframe', 'recast', 'rehearse', 'refine', 'argus'];
    for (const skill of skills) {
      const result = evaluateSkillOutput(skill, '');
      expect(result.skill).toBe(skill);
      expect(result.structural.length).toBeGreaterThan(0);
      expect(result.content_evals.length).toBeGreaterThan(0);
    }
  });

  it('empty output fails structural evals', () => {
    const result = evaluateSkillOutput('reframe', '');
    expect(result.structural.every(s => !s.passed)).toBe(true);
  });

  it('content evals have exemplars', () => {
    const result = evaluateSkillOutput('reframe', '');
    for (const e of result.content_evals) {
      expect(e.pass_example.length).toBeGreaterThan(10);
      expect(e.fail_example.length).toBeGreaterThan(10);
      expect(e.decision_line.length).toBeGreaterThan(10);
    }
  });
});

describe('buildContentJudgePrompts', () => {
  it('returns 1 prompt per content eval (single-aspect)', () => {
    const prompts = buildContentJudgePrompts('reframe', 'test output');
    const result = evaluateSkillOutput('reframe', '');
    expect(prompts.length).toBe(result.content_evals.length);
    // Each prompt is independent
    for (const p of prompts) {
      expect(p.system).toContain('PASS');
      expect(p.system).toContain('FAIL');
      expect(p.user).toContain('test output');
    }
  });
});

describe('buildBatchJudgePrompt', () => {
  it('combines all evals into single prompt with JSON format', () => {
    const prompt = buildBatchJudgePrompt('rehearse', 'test output');
    expect(prompt).toContain('test output');
    expect(prompt).toContain('"id"');
    expect(prompt).toContain('"pass"');
  });
});

describe('TEST_SCENARIOS', () => {
  it('has both build and decide contexts', () => {
    const contexts = new Set(TEST_SCENARIOS.map(s => s.context));
    expect(contexts.has('build')).toBe(true);
    expect(contexts.has('decide')).toBe(true);
  });

  it('has at least 5 scenarios', () => {
    expect(TEST_SCENARIOS.length).toBeGreaterThanOrEqual(5);
  });
});

/* ── Structural eval: golden outputs ── */

describe('/reframe structural', () => {
  const GOOD = `# 🎯 Reframe
**원래 질문:** 동남아 진출
**진짜 질문:** 우리 제품이 살아남을 최소 조건은?

## 가정
- ✓ 시장 맞을 것 (고객)
- ? 파트너 없이 가능 (실행)
- ✗ 6개월 PMF (타이밍) — 비현실
- ? B2B 시장 충분 (사업)

## 먼저 확인
- 현지 사용 현황 3곳 조사
> 💡 진출 vs 파트너십 프레임

Context Contract
context: decide
reframed_question: "최소 생존 조건"`;

  it('good output passes all structural', () => {
    const result = evaluateSkillOutput('reframe', GOOD);
    expect(result.structural.every(s => s.passed)).toBe(true);
  });
});

describe('/rehearse structural', () => {
  const GOOD = `# 👥 Rehearse

준호: [critical] false positive 20% 넘으면 끔
수진: [unspoken] 시니어는 리뷰가 영향력 행사 시간
🔇 침묵의 리스크: 셀프 디스럽션

Context Contract
classified_risks:
  critical: [...]
  unspoken: [...]`;

  it('good output passes all structural', () => {
    const result = evaluateSkillOutput('rehearse', GOOD);
    expect(result.structural.every(s => s.passed)).toBe(true);
  });
});

/* ── Pipeline chaining ── */

describe('evaluatePipelineChaining', () => {
  it('passes full pipeline', () => {
    const result = evaluatePipelineChaining({
      reframe: 'Context Contract\nassumptions_uncertain:\n  - "가정1"\n💡 멘토링이 진짜 경쟁자',
      recast: 'Context Contract\ninherited from reframe\ntarget_user:\n  name: 준호',
      rehearse: 'Context Contract\n준호의 리뷰\n영향력 행사\nsharpest critique',
      refine: 'Context Contract\nsharpest_critique_resolved\nCritical 3 → 1',
    });
    expect(result.every(e => e.passed)).toBe(true);
  });

  it('detects missing contract', () => {
    const result = evaluatePipelineChaining({ reframe: 'no contract' });
    expect(result.find(e => e.id === 'reframe_contract')?.passed).toBe(false);
  });

  it('detects broken persona chain', () => {
    const result = evaluatePipelineChaining({
      recast: 'Context Contract\ntarget_user:\n  name: 철수',
      rehearse: 'Context Contract\n영희가 리뷰',
    });
    expect(result.find(e => e.id === 'persona_continuity')?.passed).toBe(false);
  });
});
