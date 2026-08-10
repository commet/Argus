Here's a vitest unit test for `slugify`:

```ts
import { describe, it, expect } from 'vitest';
import { slugify } from './slugify'; // adjust path to wherever slugify lives

describe('slugify', () => {
  it('lowercases the input', () => {
    expect(slugify('HELLO')).toBe('hello');
  });

  it('trims leading and trailing whitespace', () => {
    expect(slugify('  hello world  ')).toBe('hello-world');
  });

  it('replaces spaces with hyphens', () => {
    expect(slugify('hello world')).toBe('hello-world');
  });

  it('collapses runs of non-alphanumeric characters into a single hyphen', () => {
    expect(slugify('hello   ---___ world')).toBe('hello-world');
  });

  it('strips hyphens left at the start/end after punctuation is stripped', () => {
    expect(slugify('--hello world--')).toBe('hello-world');
    expect(slugify('!!!Hello World!!!')).toBe('hello-world');
  });

  it('keeps digits', () => {
    expect(slugify('Top 10 Tips 2026')).toBe('top-10-tips-2026');
  });

  it('treats underscores as separators', () => {
    expect(slugify('snake_case_name')).toBe('snake-case-name');
  });

  it('leaves an already-valid slug unchanged', () => {
    expect(slugify('already-a-slug')).toBe('already-a-slug');
  });

  it('returns an empty string when nothing alphanumeric remains', () => {
    expect(slugify('!!!')).toBe('');
    expect(slugify('   ')).toBe('');
  });

  it('returns an empty string for empty input', () => {
    expect(slugify('')).toBe('');
  });
});
```

Drop this next to the source as `slugify.test.ts` (fix the import path to match where `slugify` actually lives), then run it scoped with `npm test -- slugify`.
