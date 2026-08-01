import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../../../app/[locale]/workspace/page.tsx', import.meta.url), 'utf8');

describe('workspace account promise', () => {
  it('explains continuity without publishing a temporary quota', () => {
    expect(source).toContain('기기를 바꿔도 기록과 확인 날짜');
    expect(source).toContain('records and review dates');
    expect(source).not.toContain('4~5');
    expect(source).not.toContain('4–5 decisions');
    expect(source).not.toContain('6~8');
  });
});
