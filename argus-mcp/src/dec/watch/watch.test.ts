import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { globMatches } from './glob.js';
import { matchWatch, watchProblems, type WatchRule } from './rule.js';
import { draftWatchFromClause } from './draft.js';
import { chooseWatch, compileWatchPrompt, parseCompiledWatch } from './compile-prompt.js';
import { splitRuleFile } from '../rules/split.js';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

const RULE: WatchRule = {
  paths: ['src/app/**', 'argus-mcp/'],
  phrases: ['웹 화면', 'pkill claude'],
  except_paths: ['src/app/**/*.test.tsx'],
  except_phrases: ['예를 들면'],
  blind_spots: ['다른 이름의 화면 틀을 새로 들이는 것은 못 잡는다.'],
  mode: 'machine',
};

describe('자리 맞추기 — 되는 것이 이게 전부다', () => {
  it('`*` 는 폴더를 안 넘고, `**` 는 넘는다', () => {
    expect(globMatches('src/*.ts', 'src/a.ts')).toBe(true);
    expect(globMatches('src/*.ts', 'src/deep/a.ts')).toBe(false);
    expect(globMatches('src/**', 'src/deep/a.ts')).toBe(true);
    expect(globMatches('src/**/*.ts', 'src/a.ts')).toBe(true);
    expect(globMatches('src/**/*.ts', 'src/deep/a.ts')).toBe(true);
  });
  it('폴더 이름으로 끝나면 그 아래 전부다', () => {
    expect(globMatches('argus-mcp/', 'argus-mcp/src/index.ts')).toBe(true);
    expect(globMatches('argus-mcp/', 'argus-plugin/src/index.ts')).toBe(false);
  });
  it('윈도우 구분자여도 같은 답이다', () => {
    expect(globMatches('src/**', 'src\\deep\\a.ts')).toBe(true);
  });
  it('점·괄호는 글자 그대로다 (정규식으로 새지 않는다)', () => {
    expect(globMatches('a.b.ts', 'axbxts')).toBe(false);
    expect(globMatches('a.b.ts', 'a.b.ts')).toBe(true);
  });
});

describe('걸렸나 — 침묵이 기본이고, 봐주는 자리가 이긴다', () => {
  it('그 자리를 건드리면 걸린다', () => {
    expect(matchWatch(RULE, { kind: 'file_change', path: 'src/app/page.tsx' }))
      .toEqual({ fire: true, channel: 'file', matched: 'src/app/**' });
  });
  it('봐주는 자리는 안 걸린다', () => {
    const verdict = matchWatch(RULE, { kind: 'file_change', path: 'src/app/x.test.tsx' });
    expect(verdict).toMatchObject({ fire: false, reason: 'excepted' });
  });
  it('그 말이 나오면 걸리고, 대소문자·띄어쓰기는 안 따진다', () => {
    expect(matchWatch(RULE, { kind: 'utterance', text: '오늘  웹   화면 좀 볼까' }))
      .toEqual({ fire: true, channel: 'word', matched: '웹 화면' });
  });
  it('봐주는 말이 같이 있으면 안 걸린다', () => {
    expect(matchWatch(RULE, { kind: 'utterance', text: '예를 들면 웹 화면 같은 것' }))
      .toMatchObject({ fire: false, reason: 'excepted' });
  });
  it('상관없는 자리·말에는 조용하다', () => {
    expect(matchWatch(RULE, { kind: 'file_change', path: 'docs/a.md' })).toMatchObject({ fire: false, reason: 'no_match' });
    expect(matchWatch(RULE, { kind: 'utterance', text: '점심 뭐 먹지' })).toMatchObject({ fire: false, reason: 'no_match' });
  });
  it('"기계가 못 잡는다"고 적힌 규칙은 **절대** 안 걸린다', () => {
    const injectOnly: WatchRule = { ...RULE, paths: [], phrases: [], mode: 'inject_only' };
    expect(matchWatch(injectOnly, { kind: 'file_change', path: 'src/app/page.tsx' }))
      .toEqual({ fire: false, reason: 'inject_only' });
    expect(matchWatch(injectOnly, { kind: 'utterance', text: '웹 화면' }))
      .toEqual({ fire: false, reason: 'inject_only' });
  });
});

describe('모양 검사 — 다 잡는다는 거짓말을 막는다', () => {
  it('못 잡는 것을 안 적은 규칙은 안 받는다', () => {
    expect(watchProblems({ ...RULE, blind_spots: [] })).toContain('못 잡는 것을 안 적었다 — 다 잡는다는 말은 거짓이다');
  });
  it('걸릴 자리도 말도 없는데 기계가 잡는다고 하면 안 받는다', () => {
    expect(watchProblems({ ...RULE, paths: [], phrases: [] }).length).toBeGreaterThan(0);
  });
  it('못 잡는다면서 걸릴 자리를 적으면 안 받는다', () => {
    expect(watchProblems({ ...RULE, mode: 'inject_only' }).length).toBeGreaterThan(0);
  });
});

describe('글자만 보고 만드는 초안 — 지어내지 않는다', () => {
  const clauseOf = (text: string) => splitRuleFile('CLAUDE.md', text).clauses[0]!;

  it('백틱 안의 자리와 명령을 갈라 담는다', () => {
    const draft = draftWatchFromClause(clauseOf('- `src/app/**` 를 만지지 않는다. `npm test` 도 쓰지 않는다.'));
    expect(draft.rule.paths).toEqual(['src/app/**']);
    expect(draft.rule.phrases).toEqual(['npm test']);
  });

  it('줄이 접힌 백틱도 한 줄로 펴서 잡는다 (안 그러면 쉼표만 뽑힌다)', () => {
    const draft = draftWatchFromClause(clauseOf(
      '- `pkill claude`, `taskkill /IM\n  claude*`, `Stop-Process -Name claude` 전면 금지.',
    ));
    expect(draft.rule.phrases).toEqual(['pkill claude', 'taskkill /IM claude*', 'Stop-Process -Name claude']);
  });

  it('붙잡을 글자가 없는 규칙은 "읽어주기만"으로 정직하게 내려앉는다', () => {
    const draft = draftWatchFromClause(clauseOf('- 사용자 결정을 함부로 추론하거나 저장하지 않는다.'));
    expect(draft.rule.mode).toBe('inject_only');
    expect(draft.rule.paths).toEqual([]);
    expect(draft.rule.blind_spots.join(' ')).toContain('기계가 볼 수 있는 자리가 없다');
  });

  it('어떤 초안이든 못 잡는 것이 비어 있지 않다', () => {
    const source = fs.readFileSync(path.join(REPO_ROOT, 'CLAUDE.md'), 'utf8');
    const clauses = splitRuleFile('CLAUDE.md', source).clauses;
    expect(clauses.length).toBeGreaterThan(30);
    for (const clause of clauses) {
      const draft = draftWatchFromClause(clause);
      expect(draft.rule.blind_spots.length, clause.clause_id).toBeGreaterThan(0);
      expect(watchProblems(draft.rule), clause.clause_id).toEqual([]);
    }
  });
});

describe('모델의 답을 받는 문 — 반쯤 맞는 것을 조용히 메우지 않는다', () => {
  const good = JSON.stringify({
    paths: ['src/app/**'], phrases: ['웹 화면'], except_paths: [], except_phrases: [],
    blind_spots: ['다른 이름의 틀은 못 잡는다'], mode: 'machine',
  });

  it('제대로 된 답은 받는다 (앞뒤에 말·울타리가 붙어 있어도)', () => {
    const parsed = parseCompiledWatch('여기 있습니다:\n```json\n' + good + '\n```\n감사합니다');
    expect(parsed.ok).toBe(true);
  });

  it('못 잡는 것이 빈 답은 버린다', () => {
    const parsed = parseCompiledWatch(JSON.stringify({ ...JSON.parse(good), blind_spots: [] }));
    expect(parsed.ok).toBe(false);
  });

  it('저장소 밖을 가리키는 자리는 버린다', () => {
    for (const bad of ['/etc/passwd', '../밖', 'C:\\Windows']) {
      const parsed = parseCompiledWatch(JSON.stringify({ ...JSON.parse(good), paths: [bad] }));
      expect(parsed.ok, bad).toBe(false);
    }
  });

  it('JSON 이 아니거나 항목이 너무 많으면 버린다', () => {
    expect(parseCompiledWatch('그건 좀 어렵네요').ok).toBe(false);
    expect(parseCompiledWatch(JSON.stringify({
      ...JSON.parse(good), phrases: Array.from({ length: 50 }, (_, i) => `말${i}`),
    })).ok).toBe(false);
  });

  it('버리면 초안으로 돌아가고, **어느 쪽을 썼는지 밝힌다**', () => {
    const draft = draftWatchFromClause(splitRuleFile('CLAUDE.md', '- `src/app/**` 를 만지지 않는다.').clauses[0]!);
    expect(chooseWatch(draft, good)).toMatchObject({ source: 'model' });
    expect(chooseWatch(draft, null)).toMatchObject({ source: 'draft', problems: [] });
    const fallback = chooseWatch(draft, '{"mode":"machine"}');
    expect(fallback.source).toBe('draft');
    expect(fallback.problems.length).toBeGreaterThan(0);
    expect(fallback.rule).toEqual(draft.rule);
  });

  it('모델에게 주는 말은 조항을 울타리에 넣고, 지어내지 말라고 이른다', () => {
    const clause = splitRuleFile('CLAUDE.md', '- `src/app/**` 를 만지지 않는다.').clauses[0]!;
    const prompt = compileWatchPrompt(clause, draftWatchFromClause(clause));
    expect(prompt).toContain('<user-data>');
    expect(prompt).toContain('</user-data>');
    expect(prompt).toContain('지어내지 마라');
    expect(prompt).toContain('blind_spots 를 반드시 채워라');
    expect(prompt).toContain('정규식을 쓰지 마라');
  });
});
