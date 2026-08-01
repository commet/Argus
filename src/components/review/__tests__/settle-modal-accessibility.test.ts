import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(__dirname, '..', 'SettleModal.tsx'), 'utf8');

describe('SettleModal accessibility contract', () => {
  it('behaves like a modal dialog and restores the surrounding page', () => {
    expect(source).toContain('role="dialog"');
    expect(source).toContain('aria-modal="true"');
    expect(source).toContain("event.key === 'Escape'");
    expect(source).toContain('previousFocus?.focus?.()');
    expect(source).toContain("document.body.style.overflow = 'hidden'");
  });

  it('names its close action and associates both text fields', () => {
    expect(source).toContain("aria-label={L('닫기', 'Close')}");
    expect(source).toContain('htmlFor="settle-what-happened"');
    expect(source).toContain('id="settle-what-happened"');
    expect(source).toContain('htmlFor="settle-learned"');
    expect(source).toContain('id="settle-learned"');
  });
});
