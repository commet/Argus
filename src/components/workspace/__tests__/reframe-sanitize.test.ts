import { describe, it, expect } from 'vitest';
import { cleanStreamPreview, cleanTaskLabel } from '../ReframeStep';

describe('cleanStreamPreview — no raw JSON leaks into the drafting preview', () => {
  // The exact shape that leaked to the user's screen: JSON keys, an enum
  // value, braces, and quotes mixed into a half-streamed object.
  const leaked = `을 갖추고 있다.", "risk_if_false": "시범 운영은 소수 핵심 인원이 집중 관리했지만, 확대 시 동일한 관리 밀도를 유지하지 못하면 품질 이슈가 재발한다.", "axis": "org_capacity" }, "reasoning_narrative": "이 보고의 핵심 긴장은 '비용 절감'과 '품질 이슈'가 공존한다는 점입니다.`;
  const out = cleanStreamPreview(leaked);

  it('strips English JSON keys', () => {
    expect(out).not.toMatch(/risk_if_false|reasoning_narrative|axis/);
  });
  it('strips snake_case enum values', () => {
    expect(out).not.toContain('org_capacity');
  });
  it('strips braces, brackets and stray quotes', () => {
    expect(out).not.toMatch(/[{}[\]"]/);
  });
  it('keeps the human Korean prose', () => {
    expect(out).toContain('품질 이슈가 재발');
    expect(out).toContain('비용 절감');
  });
  it('returns empty string for empty input', () => {
    expect(cleanStreamPreview('')).toBe('');
  });
});

describe('cleanTaskLabel — history chip shows the task, not prompt plumbing', () => {
  it('unwraps the [맥락]…[과제] context wrapper', () => {
    const item = {
      input_text: '[맥락]\n과제 성격: 분석하면 답이 나온다\n목표: 뚜렷하다\n\n[과제]\nSK 물류 회사의 AI 도입 성과를 경영진에게 보고',
      analysis: null,
    } as Parameters<typeof cleanTaskLabel>[0];
    const label = cleanTaskLabel(item);
    expect(label).toBe('SK 물류 회사의 AI 도입 성과를 경영진에게 보고');
    expect(label).not.toContain('[맥락]');
    expect(label).not.toContain('과제 성격');
  });

  it('prefers a clean surface_task when present', () => {
    const item = {
      input_text: '[맥락]\n...\n[과제]\n원본 프롬프트',
      analysis: { surface_task: 'AI 도입 성과 보고' },
    } as Parameters<typeof cleanTaskLabel>[0];
    expect(cleanTaskLabel(item)).toBe('AI 도입 성과 보고');
  });

  it('handles a bare task with no wrapper', () => {
    const item = { input_text: '중국 시장 진출 전략', analysis: null } as Parameters<typeof cleanTaskLabel>[0];
    expect(cleanTaskLabel(item)).toBe('중국 시장 진출 전략');
  });
});
