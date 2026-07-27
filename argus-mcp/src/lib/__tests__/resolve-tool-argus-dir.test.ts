import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { resolveToolArgusDir, ArgusDirError } from '../argus-dir.js';
import { init } from '../../tools/init-config.js';
import { body } from '../../test-helpers.js';

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

  it('defaults to ~/.argus when neither is available (첫 설치의 문, §9.4)', () => {
    delete process.env.ARGUS_DIR;
    expect(resolveToolArgusDir(undefined)).toBe(path.join(process.cwd(), '.argus'));
  });

  it('M0 exit fixture: a zero-config FIRST TOOL CALL succeeds into ~/.argus', async () => {
    delete process.env.ARGUS_DIR;
    // fake home so the test never touches the real user profile
    const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-project-'));
    const spy = vi.spyOn(process, 'cwd').mockReturnValue(fakeHome);
    try {
      const res = body(await init.handler({}));
      expect(res['ok']).toBe(true);
      const expected = path.join(fakeHome, '.argus');
      expect(String((res['data'] as Record<string, unknown>)['argus_dir'] ?? '')).toContain('.argus');
      expect(fs.existsSync(expected)).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  it('names the real problem when the host did not expand a config variable', () => {
    delete process.env.ARGUS_DIR;
    for (const literal of ['${CLAUDE_PROJECT_DIR}/.argus', '%USERPROFILE%\\.argus']) {
      try {
        resolveToolArgusDir(literal);
        expect.unreachable('should have thrown on unexpanded variable');
      } catch (e) {
        expect(e).toBeInstanceOf(ArgusDirError);
        expect((e as Error).message).toContain('did not expand');
        expect((e as Error).message).toContain('absolute project .argus path');
      }
    }
  });

  it('still enforces path safety on the env value (no traversal)', () => {
    process.env.ARGUS_DIR = '/tmp/../etc/.argus';
    expect(() => resolveToolArgusDir(undefined)).toThrow(ArgusDirError);
  });
});
