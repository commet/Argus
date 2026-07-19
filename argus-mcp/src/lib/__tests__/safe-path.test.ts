import { describe, it, expect } from 'vitest';
import path from 'path';
import os from 'os';
import { safeSegment, assertInside, PathSafetyError } from '../safe-path.js';

describe('safeSegment', () => {
  it('accepts clean segments', () => {
    expect(safeSegment('migrate-db_2026.07')).toBe('migrate-db_2026.07');
  });

  // Windows aliasing / reserved device names → silent data loss or cryptic FS
  // failure. NUL.ics resolves to the null device (write vanishes); "build."
  // aliases to "build" (overwrite). All must be refused loud.
  it.each(['CON', 'con', 'nul', 'NUL.ics', 'aux', 'prn', 'com1', 'lpt9', 'build.', 'trail ', '...'])(
    'rejects reserved/aliasing segment %s',
    (seg) => { expect(() => safeSegment(seg)).toThrow(PathSafetyError); },
  );

  it.each(['..', '.', 'a/b', 'a\\b', '..\\..\\x', '../../etc', '%2e%2e', '%2f', 'a%5cb', '', 'a'.repeat(129), 'x\0y'])(
    'rejects %s',
    (bad) => {
      expect(() => safeSegment(bad as string)).toThrow(PathSafetyError);
    },
  );
});

describe('assertInside', () => {
  const root = path.join(os.tmpdir(), 'argus-safe-root');

  it('allows the root and children', () => {
    expect(() => assertInside(root, path.join(root, 'a', 'b'))).not.toThrow();
    expect(() => assertInside(root, root)).not.toThrow();
  });

  it('blocks escapes', () => {
    expect(() => assertInside(root, path.join(root, '..', 'evil'))).toThrow(PathSafetyError);
    expect(() => assertInside(root, path.join(os.tmpdir(), 'elsewhere'))).toThrow(PathSafetyError);
  });
});
