import { describe, it, expect, afterEach } from 'vitest';
import path from 'path';
import { resolveToolArgusDir, ArgusDirError } from '../argus-dir.js';

const ORIG = process.env.ARGUS_DIR;
afterEach(() => { if (ORIG === undefined) delete process.env.ARGUS_DIR; else process.env.ARGUS_DIR = ORIG; });

const ABS = path.resolve('/tmp/some/.argus');

describe('resolveToolArgusDir — the ergonomic argus_dir resolution', () => {
  it('uses the per-call arg when given (it wins over env)', () => {
    process.env.ARGUS_DIR = path.resolve('/env/.argus');
    expect(resolveToolArgusDir(ABS)).toBe(ABS);
  });

  it('falls back to ARGUS_DIR env when the arg is omitted', () => {
    process.env.ARGUS_DIR = ABS;
    expect(resolveToolArgusDir(undefined)).toBe(ABS);
    expect(resolveToolArgusDir('')).toBe(ABS);
  });

  it('throws one actionable error when neither is available', () => {
    delete process.env.ARGUS_DIR;
    expect(() => resolveToolArgusDir(undefined)).toThrow(ArgusDirError);
    try { resolveToolArgusDir(undefined); } catch (e) {
      expect((e as Error).message).toContain('ARGUS_DIR');
    }
  });

  it('still enforces path safety on the env value (no traversal)', () => {
    process.env.ARGUS_DIR = '/tmp/../etc/.argus';
    expect(() => resolveToolArgusDir(undefined)).toThrow(ArgusDirError);
  });
});
