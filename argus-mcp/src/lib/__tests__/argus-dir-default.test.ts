import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveDefaultArgusDir } from '../argus-dir.js';

/**
 * 기본 원장 위치 규칙 (2026-07-30) — "프로젝트 증거가 있으면 프로젝트 원장,
 * 없으면 개인 홈 원장". Codex 앱이 대화마다 새 폴더를 만들어 기록이 대화 단위로
 * 조각나던 실측에서 나온 규칙이다 (사용자당 하나의 논리 데이터셋 — ADR 07-27).
 *
 * 빨간불 조건:
 *   · 깃 없는 임시 폴더가 고아 원장(cwd/.argus)을 만드는 것 (파편화 부활)
 *   · 깃 저장소나 기존 .argus 가 홈으로 끌려가는 것 (프로젝트 격리 파괴)
 */

function tmp(name: string): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), `argus-dirrule-${name}-`));
  return d;
}
const HOME = path.join(os.tmpdir(), 'argus-dirrule-home', '.argus');

describe('resolveDefaultArgusDir', () => {
  it('깃도 .argus 도 없는 폴더(앱 대화·임시)는 개인 홈으로 간다', () => {
    const cwd = tmp('ephemeral');
    expect(resolveDefaultArgusDir(cwd, HOME)).toBe(HOME);
  });

  it('깃 저장소 안이면 프로젝트 원장(cwd/.argus)이다', () => {
    const cwd = tmp('gitrepo');
    fs.mkdirSync(path.join(cwd, '.git'));
    expect(resolveDefaultArgusDir(cwd, HOME)).toBe(path.join(cwd, '.argus'));
  });

  it('깃 저장소의 하위 폴더도 프로젝트 원장이다 (위로 걸어 올라가 찾는다)', () => {
    const root = tmp('gitdeep');
    fs.mkdirSync(path.join(root, '.git'));
    const sub = path.join(root, 'packages', 'web');
    fs.mkdirSync(sub, { recursive: true });
    expect(resolveDefaultArgusDir(sub, HOME)).toBe(path.join(sub, '.argus'));
  });

  it('기존 .argus 가 있으면 깃이 없어도 그대로 존중한다 (기록을 옮기지 않는다)', () => {
    const cwd = tmp('legacy');
    fs.mkdirSync(path.join(cwd, '.argus'));
    expect(resolveDefaultArgusDir(cwd, HOME)).toBe(path.join(cwd, '.argus'));
  });

  it('git worktree 파일형 .git 도 저장소로 본다', () => {
    const cwd = tmp('worktree');
    fs.writeFileSync(path.join(cwd, '.git'), 'gitdir: elsewhere');
    expect(resolveDefaultArgusDir(cwd, HOME)).toBe(path.join(cwd, '.argus'));
  });
});
