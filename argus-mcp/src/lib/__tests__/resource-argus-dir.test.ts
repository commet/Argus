import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { resolveArgusDirForResource, resolveToolArgusDir, requireArgusDir, ArgusDirError } from '../argus-dir.js';
import { readResource } from '../../resources.js';

/**
 * §9.7 O1 방2 exit contract: tools and resources must tell the same storage
 * story. A zero-config install (no ARGUS_DIR, no per-call arg) writes its
 * ledger to ~/.argus via tools — the passive `argus://attention` resource has
 * to read that SAME ledger, or the return loop's front door stays dark while
 * everything else looks fine (the honest-structure failure mode).
 */

const ORIG = process.env.ARGUS_DIR;
afterEach(() => {
  if (ORIG === undefined) delete process.env.ARGUS_DIR;
  else process.env.ARGUS_DIR = ORIG;
  vi.restoreAllMocks();
});

describe('resolveArgusDirForResource — same storage model as tools', () => {
  it('zero-config (no env): resource and tool resolve to the SAME ~/.argus', () => {
    delete process.env.ARGUS_DIR;
    const resourceDir = resolveArgusDirForResource();
    expect(resourceDir).toBe(path.join(os.homedir(), '.argus'));
    expect(resourceDir).toBe(resolveToolArgusDir(undefined));
  });

  it('valid absolute ARGUS_DIR: resource and tool resolve to the same dir', () => {
    const abs = path.resolve('/env/.argus');
    process.env.ARGUS_DIR = abs;
    expect(resolveArgusDirForResource()).toBe(abs);
    expect(resolveToolArgusDir(undefined)).toBe(abs);
  });

  it('env SET but unexpanded (${...}): resource degrades to null where the tool throws — never silently reads a different ledger', () => {
    process.env.ARGUS_DIR = '${CLAUDE_PROJECT_DIR}/.argus';
    expect(resolveArgusDirForResource()).toBeNull();
    expect(() => requireArgusDir(process.env.ARGUS_DIR)).toThrow(ArgusDirError);
  });

  it('env SET but %VAR% form or relative: null (unbound), not a ~/.argus fallback', () => {
    process.env.ARGUS_DIR = '%USERPROFILE%\\.argus';
    expect(resolveArgusDirForResource()).toBeNull();
    process.env.ARGUS_DIR = 'relative/.argus';
    expect(resolveArgusDirForResource()).toBeNull();
  });
});

describe('argus://attention on a zero-config install (journey)', () => {
  function fakeHome(): string {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-reshome-'));
    vi.spyOn(os, 'homedir').mockReturnValue(home);
    return home;
  }

  it('sees the ledger that zero-config tools wrote (overdue prediction surfaces, not {unbound})', () => {
    delete process.env.ARGUS_DIR;
    const home = fakeHome();
    const dir = path.join(home, '.argus');
    fs.mkdirSync(path.join(dir, 'ledger'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'ledger', 'ledger.jsonl'),
      JSON.stringify({ v: 1, ts: '2026-01-01T00:00:00Z', id: 'd1', event: 'seal', predicate: 'ships before friday', check_by: '2020-01-01' }) + '\n',
    );
    const res = readResource('argus://attention');
    const payload = JSON.parse(res.contents[0]!.text) as Record<string, unknown>;
    expect(payload['unbound']).toBeUndefined();
    expect(payload['decision_count']).toBe(1);
    expect(JSON.stringify(payload['decisions'])).toContain('ships before friday');
  });

  it('fresh home with no .argus at all: bound and empty, not {unbound} and not a throw', () => {
    delete process.env.ARGUS_DIR;
    fakeHome();
    const res = readResource('argus://attention');
    const payload = JSON.parse(res.contents[0]!.text) as Record<string, unknown>;
    expect(payload['unbound']).toBeUndefined();
    expect(payload['decision_count']).toBe(0);
    expect(payload['fact_count']).toBe(0);
  });

  it('set-but-invalid ARGUS_DIR: {unbound} payload names the actual problem', () => {
    process.env.ARGUS_DIR = '${CLAUDE_PROJECT_DIR}/.argus';
    const res = readResource('argus://attention');
    const payload = JSON.parse(res.contents[0]!.text) as Record<string, unknown>;
    expect(payload['unbound']).toBe(true);
    expect(String(payload['hint'])).toContain('ARGUS_DIR is set but is not an expanded absolute path');
  });
});
