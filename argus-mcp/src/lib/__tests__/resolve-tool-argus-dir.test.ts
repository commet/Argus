import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { resolveToolArgusDir, ArgusDirError } from '../argus-dir.js';
import { init } from '../../tools/init-config.js';
import { body } from '../../test-helpers.js';

const ORIG = process.env.ARGUS_DIR;
const ORIG_HOME = process.env.ARGUS_HOME;
afterEach(() => {
  if (ORIG === undefined) delete process.env.ARGUS_DIR; else process.env.ARGUS_DIR = ORIG;
  if (ORIG_HOME === undefined) delete process.env.ARGUS_HOME; else process.env.ARGUS_HOME = ORIG_HOME;
});

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

  it('프로젝트 안(이 레포는 깃 저장소)에서는 cwd/.argus 가 기본이다', () => {
    delete process.env.ARGUS_DIR;
    expect(resolveToolArgusDir(undefined)).toBe(path.join(process.cwd(), '.argus'));
  });

  it('M0 exit fixture: 깃 없는 폴더의 zero-config 첫 호출은 개인 홈으로 간다 (2026-07-30 규칙)', async () => {
    // Codex 앱은 대화마다 새 폴더를 만든다 — 옛 기본값(cwd/.argus)은 대화마다
    // 고아 원장을 만들어 기록이 조각났다. 프로젝트 증거(깃/.argus)가 없으면
    // 개인 홈이 기본이다. ARGUS_HOME 주입으로 진짜 사용자 프로필은 안 건드린다.
    delete process.env.ARGUS_DIR;
    const ephemeralCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-appconvo-'));
    const fakeHome = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'argus-home-')), '.argus');
    process.env.ARGUS_HOME = fakeHome;
    const spy = vi.spyOn(process, 'cwd').mockReturnValue(ephemeralCwd);
    try {
      const res = body(await init.handler({}));
      expect(res['ok']).toBe(true);
      expect(String((res['data'] as Record<string, unknown>)['argus_dir'] ?? '')).toBe(fakeHome);
      expect(fs.existsSync(fakeHome)).toBe(true);
      // 고아 원장을 만들지 않는다 — 파편화의 재발 조건.
      expect(fs.existsSync(path.join(ephemeralCwd, '.argus'))).toBe(false);
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
