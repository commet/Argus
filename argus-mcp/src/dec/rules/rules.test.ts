import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { discoverRuleFiles } from './discover.js';
import { splitRuleFile, unmarkedBlocks, verifyClauseAnchors } from './split.js';
import { parseScope, isValidScope, scopeSay } from '../scope.js';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

function tmpRepo(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-rules-'));
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body, 'utf8');
  }
  return dir;
}

describe('규칙 파일 찾기 — 목록은 고정이고 짧다', () => {
  it('아는 자리에 있는 것만 읽고, 각각 어느 도구의 것인지 안다', () => {
    const repo = tmpRepo({
      'CLAUDE.md': '# 규칙\n\n- 절대 하지 않는다\n',
      '.cursorrules': '- never do this\n',
      'README.md': '규칙 파일이 아니다\n',
    });
    const found = discoverRuleFiles(repo);
    expect(found.files.map((f) => f.rel)).toEqual(['CLAUDE.md', '.cursorrules']);
    expect(found.files.map((f) => f.tool)).toEqual(['Claude Code', 'Cursor']);
  });

  it('읽을 규칙 파일이 없으면 정직하게 0을 말한다 (지어내지 않는다)', () => {
    expect(discoverRuleFiles(tmpRepo({ 'README.md': '아무것도 없다\n' })).files).toEqual([]);
  });

  it('빈 파일·너무 큰 파일은 이유와 함께 건너뛴다', () => {
    const repo = tmpRepo({ 'CLAUDE.md': '', 'AGENTS.md': 'x'.repeat(600 * 1024) });
    const found = discoverRuleFiles(repo);
    expect(found.files).toEqual([]);
    expect(found.skipped.map((s) => s.rel).sort()).toEqual(['.cursorrules', 'AGENTS.md', 'CLAUDE.md'].filter((r) => r !== '.cursorrules'));
    expect(found.skipped.every((s) => s.why.length > 0)).toBe(true);
  });
});

describe('조항으로 가르기 — 원문을 바꾸지 않는다', () => {
  const source = [
    '# 제목',
    '',
    '## 규칙',
    '',
    '지켜야 할 것 셋:',
    '',
    '- **첫째 규칙이다.** 이렇게 하지 않는다.',
    '- 둘째 규칙이고 반드시 이렇게 한다.',
    '  이어지는 본문 줄이고, 여기까지가 한 조항이다.',
    '  - 안쪽 항목도 따로 조항이 되고 금지된다.',
    '',
    '```bash',
    'npm test   # 이건 조항이 아니다',
    '```',
    '',
    '| 표 | 도 |',
    '| -- | -- |',
    '| 아니다 | 조항이 |',
    '',
    '> 창업자 지시다. 이건 반드시 지킨다.',
    '',
    '설명하는 문단이고 아무 표지가 없어 그냥 이야기',
  ].join('\n');

  it('조항의 원문이 파일에 바이트로 그대로 있다', () => {
    const result = splitRuleFile('CLAUDE.md', source);
    expect(verifyClauseAnchors(source, result.clauses)).toEqual({ ok: true, missing: [] });
    for (const clause of result.clauses) expect(source).toContain(clause.text);
  });

  it('코드·제목·표·머리말은 조항이 아니고, 왜 뺐는지 남는다', () => {
    const result = splitRuleFile('CLAUDE.md', source);
    const reasons = new Set(result.skipped.map((s) => s.why));
    expect(reasons.has('코드')).toBe(true);
    expect(reasons.has('제목')).toBe(true);
    expect(reasons.has('표')).toBe(true);
    expect(reasons.has('머리말')).toBe(true); // "지켜야 할 것 셋:"
    expect(result.clauses.some((c) => c.text.includes('npm test'))).toBe(false);
  });

  it('안쪽 항목도 따로 조항이 된다 (조항 하나 = 서명 하나)', () => {
    const result = splitRuleFile('CLAUDE.md', source);
    expect(result.clauses.some((c) => c.text.includes('안쪽 항목도 따로 조항이'))).toBe(true);
    expect(result.clauses.some((c) => c.text.includes('둘째 규칙이고') && c.text.includes('안쪽 항목'))).toBe(false);
  });

  it('인용문(창업자 지시)은 조항으로 잡는다', () => {
    expect(splitRuleFile('CLAUDE.md', source).clauses.some((c) => c.kind === 'quote')).toBe(true);
  });

  it('왜 규칙으로 봤는지 표지가 조항마다 남는다', () => {
    for (const clause of splitRuleFile('CLAUDE.md', source).clauses) {
      expect(clause.markers.length, clause.text).toBeGreaterThan(0);
    }
  });

  it('같은 글은 같은 id 를 갖고, 앞에 줄이 늘어도 id 가 안 바뀐다', () => {
    const a = splitRuleFile('CLAUDE.md', source).clauses;
    const b = splitRuleFile('CLAUDE.md', `머리말 한 줄\n\n${source}`).clauses;
    const idOf = (list: typeof a, needle: string) => list.find((c) => c.text.includes(needle))?.clause_id;
    expect(idOf(a, '첫째 규칙이다')).toBe(idOf(b, '첫째 규칙이다'));
    expect(a.find((c) => c.text.includes('첫째'))!.line_start)
      .not.toBe(b.find((c) => c.text.includes('첫째'))!.line_start);
  });
});

describe('놓친 것을 감추지 않는다', () => {
  const source = [
    '## 규칙',
    '',
    '기능 삭제 시: 컴포넌트 삭제 → 참조 확인 → import 제거(정리는 선택)',
    '',
    '어제 점심에 김치찌개를 먹었고 맛이 괜찮았던 편',
  ].join('\n');

  it('화살표로 순서를 적은 절차도 규칙으로 잡는다 (표지가 없다고 버렸더니 절 하나가 통째로 빠졌다)', () => {
    const result = splitRuleFile('CLAUDE.md', source);
    expect(result.clauses.some((c) => c.text.includes('컴포넌트 삭제 →'))).toBe(true);
    expect(result.clauses.find((c) => c.text.includes('컴포넌트 삭제 →'))!.markers).toContain('순서');
  });

  it('표지가 없어 안 올린 덩어리도 원문 그대로 돌려준다 (세기만 하면 조용한 공백이 된다)', () => {
    const result = splitRuleFile('CLAUDE.md', source);
    const unmarked = unmarkedBlocks(source, result);
    expect(unmarked.length).toBeGreaterThan(0);
    expect(unmarked.some((u) => u.text.includes('김치찌개'))).toBe(true);
    for (const block of unmarked) expect(source).toContain(block.text);
  });
});

describe('이 저장소의 CLAUDE.md 에 실제로 대본다', () => {
  it('조항이 수십 건 나오고, 전부 바이트로 대조된다', () => {
    const file = path.join(REPO_ROOT, 'CLAUDE.md');
    const source = fs.readFileSync(file, 'utf8');
    const result = splitRuleFile('CLAUDE.md', source);
    // 정확한 수를 박지 않는다 — 문서를 고칠 때마다 빨간불이 되면 규칙 문서를
    // 못 고친다. "수십 건이 나온다"가 이 단계의 주장이다.
    expect(result.clauses.length).toBeGreaterThanOrEqual(35);
    expect(result.clauses.length).toBeLessThanOrEqual(80);
    expect(verifyClauseAnchors(source, result.clauses).missing).toEqual([]);
    expect(result.clauses.some((c) => c.text.includes('claude 프로세스를 절대 죽이지 않는다'))).toBe(true);
    expect(result.clauses.every((c) => c.section.length > 0)).toBe(true);
  });
});

describe('걸리는 곳(scope) — 값은 셋뿐이고, 빈 값은 없다', () => {
  it('repo · global · path:<자리> 만 받는다', () => {
    expect(parseScope('repo')).toEqual({ kind: 'repo' });
    expect(parseScope('global')).toEqual({ kind: 'global' });
    expect(parseScope('path:argus-mcp/**')).toEqual({ kind: 'path', glob: 'argus-mcp/**' });
    for (const bad of ['', '  ', 'REPO', 'path:', 'path:/etc', 'path:../밖', 'task:pr', 'anything']) {
      expect(isValidScope(bad), bad).toBe(false);
    }
  });

  it('화면에는 기계 문자열 대신 사람 말이 나간다', () => {
    expect(scopeSay('repo')).toBe('이 저장소에서 하는 모든 일');
    expect(scopeSay('global')).toBe('어느 저장소에서든');
    expect(scopeSay('path:src/**')).toBe('src/** 안에서');
  });
});
