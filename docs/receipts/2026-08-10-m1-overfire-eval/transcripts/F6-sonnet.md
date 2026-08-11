Here's a vitest test file for `slugify`, covering the main behaviors and a couple of edge cases worth pinning down (empty/degenerate input, and non-ASCII characters getting dropped rather than transliterated):

```js
// slugify.test.js
import { describe, it, expect } from 'vitest';
import { slugify } from './slugify';

describe('slugify', () => {
  it('lowercases and hyphenates spaces', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('trims leading/trailing whitespace', () => {
    expect(slugify('  Hello World  ')).toBe('hello-world');
  });

  it('collapses runs of separators into a single hyphen', () => {
    expect(slugify('Hello   World!!')).toBe('hello-world');
    expect(slugify('a---b___c')).toBe('a-b-c');
  });

  it('strips hyphens that would otherwise lead or trail', () => {
    expect(slugify('--Hello World--')).toBe('hello-world');
    expect(slugify('!!!Hello!!!')).toBe('hello');
  });

  it('preserves digits', () => {
    expect(slugify('Product 123')).toBe('product-123');
  });

  it('leaves an already-valid slug unchanged', () => {
    expect(slugify('already-a-slug')).toBe('already-a-slug');
  });

  it('returns an empty string when nothing alphanumeric survives', () => {
    expect(slugify('!!!')).toBe('');
    expect(slugify('   ')).toBe('');
    expect(slugify('')).toBe('');
  });

  it('strips non-ASCII letters rather than transliterating them', () => {
    // 'é' falls outside [a-z0-9], so it's dropped, not converted to 'e'
    expect(slugify('café')).toBe('caf');
  });
});
```

I assumed `slugify` is exported from a sibling `./slugify` module — adjust the import (and file extension, if this is TS elsewhere) to match where it actually lives.

One heads-up since we're inside `argus-mcp`: per the repo's CLAUDE.md, the MIT-zone packages (`argus-mcp`, `argus-plugin-v2`) run their own test harness that only actually executes in CI — a local `npm test` here won't confirm this passes the way it would for app code under `src/`.
