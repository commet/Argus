import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(__dirname, '..', 'Header.tsx'), 'utf8');

describe('application header touch targets', () => {
  it('keeps the tablet header compact until desktop controls fit', () => {
    expect(source).toContain('className="hidden lg:flex items-center gap-3"');
    expect(source).toContain('className="lg:hidden min-w-[44px] min-h-[44px]');
    expect(source).toContain('<nav className="lg:hidden');
    expect(source).not.toContain('className="hidden md:flex items-center gap-3"');
  });

  it('gives desktop navigation controls a consistent minimum height', () => {
    expect(source).toContain('relative min-h-9 px-3.5');
    expect(source).toContain('min-h-9 min-w-9 px-2.5');
    expect(source).toContain('inline-flex min-h-9 items-center px-2.5');
    expect(source).toContain('inline-flex min-h-9 min-w-9 items-center justify-center');
  });

  it('routes the whole project target instead of nesting a tiny badge action', () => {
    expect(source.match(/href=\{showReturnBadge \? dueTarget : item\.href\}/g)).toHaveLength(2);
    expect(source.match(/pointer-events-none absolute/g)).toHaveLength(2);
    expect(source).not.toContain('e.preventDefault(); e.stopPropagation();');
  });
});
