import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(__dirname, '..', 'ShareComposer.tsx'), 'utf8');

describe('ShareComposer action feedback', () => {
  it('announces copy completion and names the file download', () => {
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain("L('내용 복사', 'Copy content')");
    expect(source).toContain("L('마크다운 파일로 저장', 'Download as a Markdown file')");
  });

  it('keeps instant and channel actions from submitting an ancestor form', () => {
    const buttonTypes = source.match(/type="button"/g) ?? [];
    expect(buttonTypes.length).toBeGreaterThanOrEqual(3);
  });
});
