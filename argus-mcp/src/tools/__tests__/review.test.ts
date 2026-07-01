import { describe, it, expect } from 'vitest';
import { review } from '../review.js';

const DOC = `# 온보딩 리빌드 전략

## 문제
retention이 낮다. 첫 주 이탈이 60%다.

## 제안
온보딩을 3단계로 리빌드한다.

## 근거
- 경쟁사도 3단계를 쓴다
- 사용자 인터뷰에서 복잡하다는 피드백이 있었다`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function data(res: any): any {
  return res.structuredContent?.data ?? {};
}

describe('argus_review', () => {
  it('returns reviewability, routed lenses, and points at seal', async () => {
    const res = await review.handler({ text: DOC, source_kind: 'markdown', concerns: ['evidence'] });
    expect(res.isError).toBeFalsy();
    const d = data(res);
    expect(d.reviewability.score).toBeGreaterThan(0);
    expect(d.lenses.length).toBeGreaterThan(0);
    // base spine lenses always present
    const ids = d.lenses.map((l: { id: string }) => l.id);
    expect(ids).toContain('claim_evidence');
    expect(ids).toContain('human_judgment');
    expect(res.structuredContent?.next_actions).toContain('argus_seal');
  });

  it('does not dump the source units twice (they ride in extraction_prompt only)', async () => {
    const d = data(await review.handler({ text: DOC, source_kind: 'markdown' }));
    expect(d.extraction_prompt).toBeTruthy();
    expect('units' in d).toBe(false); // no standalone duplicate of the heavy text
    expect(typeof d.units_total).toBe('number');
  });

  it('surfaces no verdict and leaks no internal unit_id into prose', async () => {
    const res = await review.handler({ text: DOC });
    const surface = String(res.structuredContent?.surface ?? '');
    expect(surface).not.toMatch(/진행하세요|틀렸|맞습니다|추천/);
    expect(surface).not.toMatch(/\bu_[0-9a-f]/); // unit ids stay in the units block
  });

  it('degrades honestly on empty input', async () => {
    const res = await review.handler({ text: '' });
    expect(res.isError).toBe(true);
    expect(res.structuredContent?.error_code).toBe('EMPTY');
  });

  it('refuses binary files instead of faking a review', async () => {
    const res = await review.handler({ file_path: '/tmp/deck.pptx' });
    expect(res.isError).toBe(true);
    expect(res.structuredContent?.error_code).toBe('BINARY_UNSUPPORTED');
  });
});
