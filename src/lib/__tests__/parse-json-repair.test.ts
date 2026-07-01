import { describe, it, expect } from 'vitest';
import { parseJSON, repairTruncatedJSON } from '@/lib/llm';

/**
 * Regression pins for the truncated-JSON salvage path (the stream-path
 * last-resort after a max_tokens cutoff). The fix that matters most is the
 * adaptive retry in callLLMStreamThenParse + the raised MAX_TOKENS_CAP; this
 * repair is the floor under both. These tests lock its contract:
 *  - recover early/complete fields when a later field truncates
 *  - NEVER emit corrupt JSON (an object key mistaken for a value) — return null
 *  - return null when nothing is salvageable (first-field value cutoff)
 */
describe('repairTruncatedJSON', () => {
  it('recovers prior fields + complete array elements when an array tail is cut', () => {
    const t = '{"insight":"abc","real_question":"why","skeleton":["a","b","c';
    expect(repairTruncatedJSON(t)).toEqual({
      insight: 'abc',
      real_question: 'why',
      skeleton: ['a', 'b'],
    });
  });

  it('recovers complete fields when a later string value is cut mid-token', () => {
    const t = '{"a":"x","b":"y","skeleton":["one","two"],"real_question":"why is';
    expect(repairTruncatedJSON(t)).toEqual({
      a: 'x',
      b: 'y',
      skeleton: ['one', 'two'],
    });
  });

  it('drops a dangling object key (no value) without corrupting the object', () => {
    // "b" is a key awaiting its value — must NOT be closed as {"a":"x","b"}.
    expect(repairTruncatedJSON('{"a":"x","b":')).toEqual({ a: 'x' });
    expect(repairTruncatedJSON('{"a":"x","b"')).toEqual({ a: 'x' });
  });

  it('returns null when truncation is inside the first field value (unrecoverable)', () => {
    expect(repairTruncatedJSON('{"insight":"long text cut here')).toBeNull();
  });

  it('handles nested object/array truncation, keeping complete inner items', () => {
    const t = '{"steps":[{"task":"do x","who":"ai"},{"task":"do y"';
    expect(repairTruncatedJSON(t)).toEqual({
      steps: [{ task: 'do x', who: 'ai' }],
    });
  });

  it('returns null when there is no object at all', () => {
    expect(repairTruncatedJSON('not json')).toBeNull();
    expect(repairTruncatedJSON('')).toBeNull();
  });
});

describe('parseJSON wires the repair as Strategy 4', () => {
  it('parses clean JSON normally', () => {
    expect(parseJSON('{"a":1,"b":[2,3]}')).toEqual({ a: 1, b: [2, 3] });
  });

  it('extracts JSON from a markdown fence', () => {
    expect(parseJSON('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('salvages a truncated object instead of throwing', () => {
    const parsed = parseJSON<{ real_question?: string; skeleton?: string[] }>(
      '{"real_question":"why","skeleton":["a","b","c',
    );
    expect(parsed.real_question).toBe('why');
    expect(parsed.skeleton).toEqual(['a', 'b']);
  });

  it('still throws when nothing is salvageable', () => {
    expect(() => parseJSON('totally not json at all')).toThrow();
  });
});
