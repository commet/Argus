import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(__dirname, '..', 'page.tsx'), 'utf8');

describe('login accessibility contract', () => {
  it('keeps a page heading and persistent labels for every auth field', () => {
    expect(source).toContain('<h1');
    expect(source).toContain('{authTitle}</h1>');

    for (const id of ['auth-name', 'auth-email', 'auth-password']) {
      expect(source).toContain(`htmlFor="${id}"`);
      expect(source).toContain(`id="${id}"`);
    }
  });

  it('exposes role choices and asynchronous feedback semantically', () => {
    expect(source).toContain('<fieldset>');
    expect(source).toContain('<legend');
    expect(source).toContain('role="alert"');
    expect(source).toContain('role="status"');
    expect(source).toContain('aria-busy={submitting}');
  });

  it('describes durable account value without promising a temporary quota or an AI team', () => {
    expect(source).toContain('기기가 바뀌어도 저장한 판단과 확인일 이어보기');
    expect(source).toContain('판단 기록을 초대한 사람과 공유');
    expect(source).not.toContain('결정 6~8개');
    expect(source).not.toContain('리뷰어 팀 저장');
    expect(source).not.toContain('4~5');
    expect(source).not.toContain('4–5 decisions/day');
  });
});
