import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { alreadyGreeted, markGreeted, sayHello } from './hello.js';
import { splitRuleFile } from './rules/split.js';

/**
 * 첫 인사 (2026-09-09) — **이걸 짓기 전에 실측한 것**: 갓 설치한 사람이 세션을
 * 열어도 · 무엇을 타이핑해도 · 세션을 닫아도 훅 셋이 전부 침묵했다. 첫 결정을
 * 넣는 길을 알려주는 자리가 0개였다. 여기서 고정하는 것은 그 반대다 —
 * **말할 때는 진짜 숫자로 말하고, 말할 것이 없으면 조용하다.**
 */

const RULES = `# 규칙

- **claude 프로세스를 절대 죽이지 않는다.** \`pkill claude\` 는 전면 금지다.
- **\`src/app/**\` 안에서는 이렇게 짓는다.**

> 인용이 접히면 둘째 줄에 표지가
> 남는다 — 그걸 걷는지 본다. \`docs/note.md\` 를 고칠 때만이다.
`;

describe('첫 인사 — 말할 것이 있을 때만 말한다', () => {
  let repo: string;
  let data: string;
  const git = (...a: string[]): void => { execFileSync('git', a, { cwd: repo, stdio: 'ignore' }); };

  beforeEach(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'hello-repo-'));
    data = fs.mkdtempSync(path.join(os.tmpdir(), 'hello-data-'));
    git('init'); git('config', 'user.email', 'a@b.c'); git('config', 'user.name', 't');
    fs.writeFileSync(path.join(repo, 'CLAUDE.md'), RULES, 'utf8');
    git('add', '-A'); git('commit', '-m', '규칙을 적는다');
  });
  afterEach(() => {
    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(data, { recursive: true, force: true });
  });

  it('규칙 파일이 없으면 아무 말도 안 한다', () => {
    fs.rmSync(path.join(repo, 'CLAUDE.md'));
    const r = sayHello(repo);
    expect(r.greet).toBe(false);
    expect(r.why_silent).toBe('no_rule_files');
    expect(r.say).toEqual([]);
  });

  it('읽을 조항이 없으면 아무 말도 안 한다', () => {
    fs.writeFileSync(path.join(repo, 'CLAUDE.md'), '# 제목만 있다\n', 'utf8');
    expect(sayHello(repo).why_silent).toBe('no_clauses');
  });

  it('말할 때는 읽은 것과 부딪힌 것을 숫자로 말한다', () => {
    fs.writeFileSync(path.join(repo, 'x.ts'), 'x', 'utf8');
    git('add', '-A'); git('commit', '-m', 'pkill claude 로 정리했다');
    const r = sayHello(repo);
    expect(r.greet).toBe(true);
    expect(r.clause_count).toBeGreaterThan(0);
    const text = r.say.join('\n');
    expect(text).toContain('CLAUDE.md');
    // **구속력이 없다는 것을 먼저 말한다** — 읽은 것이 법이 된 줄 알면 안 된다.
    expect(text).toContain('아직 아무 구속력도 없다');
    expect(text).toContain('한 번만 한다');
  });

  it('부딪힌 것이 없으면 있는 척하지 않는다', () => {
    const r = sayHello(repo);
    expect(r.greet).toBe(true);
    expect(r.say.join('\n')).toContain('부딪힌 것은 없었다');
  });

  it('사람을 판정하지 않는다 (거울 조항)', () => {
    fs.writeFileSync(path.join(repo, 'x.ts'), 'x', 'utf8');
    git('add', '-A'); git('commit', '-m', 'pkill claude 로 정리했다');
    const text = sayHello(repo).say.join('\n');
    for (const word of ['어겼', '위반', '잘못', '점수', '등급']) {
      expect(text, `"${word}" 는 판정하는 말이다`).not.toContain(word);
    }
  });

  it('한 저장소에 한 번만 — 표식은 플러그인 자리에 남는다', () => {
    expect(alreadyGreeted(data, repo)).toBe(false);
    markGreeted(data, repo);
    expect(alreadyGreeted(data, repo)).toBe(true);
    // 다른 저장소는 따로 센다.
    expect(alreadyGreeted(data, '/다른/자리')).toBe(false);
    // 표식 둘 자리가 없으면 "인사했다"고 우기지 않는다.
    expect(alreadyGreeted(undefined, repo)).toBe(false);
  });
});

describe('우리가 쓴 것을 남의 규칙으로 되읽지 않는다', () => {
  it('argus 덩어리는 조항이 아니다', () => {
    const withBlock = `# 규칙

- **진짜 규칙이다.** \`pkill claude\` 금지.

<!-- argus:decisions begin -->
- **D-0001** 우리가 쓴 문장이다
  누구에게: 나 · 걸리는 곳: 이 저장소
<!-- argus:decisions end -->
`;
    const clauses = splitRuleFile('AGENTS.md', withBlock).clauses;
    expect(clauses.some((c) => c.text.includes('D-0001'))).toBe(false);
    expect(clauses.some((c) => c.text.includes('pkill claude'))).toBe(true);
  });

  it('덩어리를 걷어도 줄 번호가 안 밀린다 (서명이 바이트로 대조한다)', () => {
    const src = `# 규칙

<!-- argus:decisions begin -->
- 우리가 쓴 것
<!-- argus:decisions end -->

- **뒤에 오는 진짜 규칙.** \`pkill claude\` 금지.
`;
    const clause = splitRuleFile('AGENTS.md', src).clauses.find((c) => c.text.includes('pkill'));
    expect(clause).toBeDefined();
    const line = src.split('\n')[clause!.line_start - 1];
    expect(line, '줄 번호가 원문의 그 줄을 가리켜야 한다').toContain('pkill claude');
  });
});
