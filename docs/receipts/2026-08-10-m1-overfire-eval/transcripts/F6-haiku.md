Here's a comprehensive test suite for that `slugify` function:

```typescript
import { describe, it, expect } from 'vitest';
import { slugify } from './path-to-your-file'; // adjust path as needed

describe('slugify', () => {
  it('converts basic text to lowercase slug', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('trims whitespace', () => {
    expect(slugify('  Hello World  ')).toBe('hello-world');
  });

  it('replaces multiple spaces with single hyphen', () => {
    expect(slugify('Hello    World')).toBe('hello-world');
  });

  it('removes special characters', () => {
    expect(slugify('Hello! World? #Test')).toBe('hello-world-test');
  });

  it('removes leading hyphens', () => {
    expect(slugify('--hello')).toBe('hello');
  });

  it('removes trailing hyphens', () => {
    expect(slugify('hello--')).toBe('hello');
  });

  it('handles empty string', () => {
    expect(slugify('')).toBe('');
  });

  it('preserves numbers', () => {
    expect(slugify('Test 123')).toBe('test-123');
  });

  it('handles mixed case with underscores', () => {
    expect(slugify('CamelCase_Test_123')).toBe('camelcase-test-123');
  });

  it('collapses multiple consecutive special chars to single hyphen', () => {
    expect(slugify('hello---world')).toBe('hello-world');
  });
});
```

Adjust the import path to match where your `slugify` function lives. The tests cover the main behaviors: lowercasing, trimming, space/special-char replacement, hyphen cleanup, and a few edge cases.
