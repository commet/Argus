Here's a comprehensive vitest unit test for the `slugify` function:

```typescript
import { describe, it, expect } from 'vitest';
import { slugify } from './your-path'; // adjust import path

describe('slugify', () => {
  it('converts to lowercase', () => {
    expect(slugify('HELLO')).toBe('hello');
  });

  it('trims whitespace', () => {
    expect(slugify('  hello  ')).toBe('hello');
  });

  it('replaces spaces with dashes', () => {
    expect(slugify('hello world')).toBe('hello-world');
  });

  it('replaces multiple spaces with single dash', () => {
    expect(slugify('hello   world')).toBe('hello-world');
  });

  it('removes non-alphanumeric characters', () => {
    expect(slugify('hello@world!')).toBe('hello-world');
  });

  it('removes leading dashes', () => {
    expect(slugify('-hello')).toBe('hello');
  });

  it('removes trailing dashes', () => {
    expect(slugify('hello-')).toBe('hello');
  });

  it('handles mixed case and special characters', () => {
    expect(slugify('Hello World!')).toBe('hello-world');
  });

  it('handles empty string', () => {
    expect(slugify('')).toBe('');
  });

  it('handles only whitespace', () => {
    expect(slugify('   ')).toBe('');
  });

  it('preserves numbers', () => {
    expect(slugify('Hello 123 World')).toBe('hello-123-world');
  });

  it('collapses consecutive dashes', () => {
    expect(slugify('hello---world')).toBe('hello-world');
  });

  it('handles real-world example', () => {
    expect(slugify('How to Build a Rocket!')).toBe('how-to-build-a-rocket');
  });
});
```

This covers the function's core behavior: lowercase conversion, trimming, replacing non-alphanumeric sequences with dashes, and stripping leading/trailing dashes. Adjust the import path to match your project structure.
