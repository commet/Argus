import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(__dirname, '..', 'page.tsx'), 'utf8');

describe('guide language follows the current judgment architecture', () => {
  it('teaches one Argus flow instead of a parallel-agent spectacle', () => {
    expect(source).toContain('Argus가 숨은 전제와 열린 질문을 보여줘요');
    expect(source).toContain("label: L('AI 검토 방식', 'AI review modes')");
    expect(source).toContain('각각 언제 쓰이는지');
    expect(source).not.toContain('전문 에이전트들을 구경');
    expect(source).not.toContain('work in parallel during analysis');
  });
});
