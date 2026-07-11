/**
 * git 발견 테스트 — 일반 리포·worktree·submodule 포인터·부재의 네 지형.
 * 핵심 수용 기준: 같은 리포의 main checkout과 worktree가 **같은** common dir
 * (= 같은 repository_id = 같은 내구 원장)에 도달한다 — 정본 규칙 20의
 * "어느 worktree에서 봉인해도 main에서 돌아온다"의 발견 절반.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { gitCommonDirOf } from './git-discovery.js';
import { registerRepository, lookupRepository } from './ledger.js';

let base: string;
beforeEach(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-gitd-'));
});
afterEach(() => {
  fs.rmSync(base, { recursive: true, force: true });
});

/** 실제 git 레이아웃을 파일로 재현한다 (git 바이너리 불요 — 우리가 읽는 건
 *  파일 구조이지 git의 동작이 아니다). */
function makeRepo(name: string): string {
  const repo = path.join(base, name);
  fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
  return repo;
}

function makeWorktree(mainRepo: string, name: string): string {
  const wtGitdir = path.join(mainRepo, '.git', 'worktrees', name);
  fs.mkdirSync(wtGitdir, { recursive: true });
  // git의 실제 배치: worktree gitdir의 commondir 파일이 본체를 상대경로로 가리킨다.
  fs.writeFileSync(path.join(wtGitdir, 'commondir'), '../..\n');
  const wt = path.join(base, name);
  fs.mkdirSync(wt, { recursive: true });
  fs.writeFileSync(path.join(wt, '.git'), `gitdir: ${wtGitdir}\n`);
  return wt;
}

describe('gitCommonDirOf', () => {
  it('finds the .git dir of a normal repo, from a nested subdirectory too', () => {
    const repo = makeRepo('plain');
    const nested = path.join(repo, 'src', 'deep', 'deeper');
    fs.mkdirSync(nested, { recursive: true });
    const expected = fs.realpathSync(path.join(repo, '.git'));
    expect(gitCommonDirOf(repo)).toBe(expected);
    expect(gitCommonDirOf(nested)).toBe(expected); // walk-up
  });

  it('a worktree resolves to the MAIN repo common dir — the rule-20 guarantee', () => {
    const main = makeRepo('main-repo');
    const wt = makeWorktree(main, 'feature-wt');
    const mainCommon = gitCommonDirOf(main)!;
    expect(gitCommonDirOf(wt)).toBe(mainCommon); // 같은 집

    // 그래서 registry 경유로 같은 repository_id = 같은 내구 원장에 닿는다.
    const home = path.join(base, 'argus-home');
    const id = registerRepository(home, mainCommon);
    expect(lookupRepository(home, gitCommonDirOf(wt)!)).toBe(id);
  });

  it('a submodule pointer file WITHOUT commondir resolves to its own gitdir', () => {
    const host = makeRepo('host');
    const modGitdir = path.join(host, '.git', 'modules', 'lib');
    fs.mkdirSync(modGitdir, { recursive: true });
    const sub = path.join(host, 'lib');
    fs.mkdirSync(sub, { recursive: true });
    fs.writeFileSync(path.join(sub, '.git'), 'gitdir: ../.git/modules/lib\n');
    expect(gitCommonDirOf(sub)).toBe(fs.realpathSync(modGitdir)); // 서브모듈은 자기 원장
  });

  it('returns null outside any repo, and for a dangling pointer — never a guess', () => {
    const bare = path.join(base, 'no-repo', 'sub');
    fs.mkdirSync(bare, { recursive: true });
    expect(gitCommonDirOf(bare)).toBe(null);

    const broken = path.join(base, 'broken');
    fs.mkdirSync(broken, { recursive: true });
    fs.writeFileSync(path.join(broken, '.git'), 'gitdir: /nonexistent/place\n');
    expect(gitCommonDirOf(broken)).toBe(null); // 모르면 모른다고 — 기본값 조작 금지
  });
});
