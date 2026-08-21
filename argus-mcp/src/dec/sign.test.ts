import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runDecSignCli } from './dec-cli.js';
import { foldDecisions } from './fold.js';
import { splitRuleFile } from './rules/split.js';

/**
 * 확인 한 타 (단계 5) — 이미 쓰고 있던 조항 하나를 법으로 만드는 자리.
 *
 * 고정하는 계약:
 *  1. 조항을 고르면 결정 파일이 생기고, 그 안에 **원래 규칙 문장 그대로** 있다
 *  2. 사람이 쓴 이유는 그 사람 것으로 들어가고, **안 쓰면 기계가 안 채운다**
 *  3. 어긋난 걸 아는 방법이 결정과 함께 저장되고 파일에 사람 말로 나온다
 *  4. 기계가 못 잡는 조항은 그렇게 서명된다 — 잡는 척하지 않는다
 *  5. 서명 직전에 원문을 바이트로 다시 대조한다 (읽은 뒤 파일이 바뀌었을 수 있다)
 *  6. 서명자 없이는 법이 되지 않는다
 */

let repo: string;
let argusDir: string;
let out: string[];

const RULES = [
  '# 규칙',
  '',
  '## 화면',
  '',
  '- **웹 화면은 나중에.** `src/app/**` 를 지금 만지지 않는다.',
  '- 사용자 결정을 함부로 추론하거나 저장하지 않는다.',
].join('\n');

beforeEach(() => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-sign-'));
  argusDir = path.join(repo, '.argus');
  fs.mkdirSync(argusDir, { recursive: true });
  fs.writeFileSync(path.join(repo, 'CLAUDE.md'), RULES, 'utf8');
  out = [];
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
    out.push(String(chunk)); return true;
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(repo, { recursive: true, force: true });
});

const clauseIdFor = (needle: string): string =>
  splitRuleFile('CLAUDE.md', RULES).clauses.find((c) => c.text.includes(needle))!.clause_id;

const sign = (extra: string[]): Promise<void> => runDecSignCli([
  '--argus-dir', argusDir, '--repo', repo, '--author', '창업자',
  '--review', '2026-09-04', '--today', '2026-08-21', ...extra,
]);

const read = (id: string): string =>
  fs.readFileSync(path.join(repo, 'decisions', `${id}.md`), 'utf8');

describe('확인 한 타 — 조항 하나가 법이 된다', () => {
  it('고른 조항의 문장이 그대로 파일에 들어가고, 출처가 어디였는지 남는다', async () => {
    await sign(['--from-clause', clauseIdFor('웹 화면은 나중에')]);
    const record = foldDecisions(argusDir).records[0]!;
    expect(record.id).toBe('D-0001');
    expect(record.decision).toContain('웹 화면은 나중에');
    expect(record.quote).toContain('`src/app/**` 를 지금 만지지 않는다');
    expect(record.origin).toMatchObject({ kind: 'rule_file', ref: clauseIdFor('웹 화면은 나중에') });
    expect(read('D-0001')).toContain('웹 화면은 나중에');
  });

  it('내가 쓴 이유는 내 것으로 들어간다', async () => {
    await sign(['--from-clause', clauseIdFor('웹 화면은 나중에'), '--because', '터미널부터 손에 익히고 싶어서.']);
    expect(read('D-0001')).toContain('터미널부터 손에 익히고 싶어서.');
    expect(JSON.parse(out.join('')).because_written).toBe(true);
  });

  it('이유를 안 쓰면 **기계가 대신 채우지 않는다** (강제하면 소유권이 0이 된다)', async () => {
    await sign(['--from-clause', clauseIdFor('웹 화면은 나중에')]);
    expect(foldDecisions(argusDir).records[0]?.because).toBeUndefined();
    expect(read('D-0001')).not.toContain('## 왜 이렇게 정했나');
    expect(JSON.parse(out.join('')).because_written).toBe(false);
  });

  it('어긋난 걸 아는 방법이 함께 저장되고 파일에 사람 말로 나온다', async () => {
    await sign(['--from-clause', clauseIdFor('웹 화면은 나중에')]);
    const record = foldDecisions(argusDir).records[0]!;
    expect(record.watch).toBe('machine');
    expect(record.watch_rule?.paths).toContain('src/app/**');
    const text = read('D-0001');
    expect(text).toContain('이 자리를 건드리면: src/app/**');
    expect(text).toContain('### 못 잡는 것');
  });

  it('기계가 못 잡는 조항은 그렇게 서명된다 — 잡는 척하지 않는다', async () => {
    await sign(['--from-clause', clauseIdFor('함부로 추론하거나')]);
    const record = foldDecisions(argusDir).records[0]!;
    expect(record.watch).toBe('inject_only');
    expect(record.watch_rule?.paths).toEqual([]);
    expect(read('D-0001')).toContain('기계가 못 알아챈다');
  });

  it('읽은 뒤 파일이 바뀌었으면 서명하지 않는다 (원문 바이트 대조)', async () => {
    const id = clauseIdFor('웹 화면은 나중에');
    fs.writeFileSync(path.join(repo, 'CLAUDE.md'), RULES.replace('나중에', '지금'), 'utf8');
    await expect(sign(['--from-clause', id])).rejects.toThrow(/NO_SUCH_CLAUSE|CLAUSE_MOVED/);
    expect(foldDecisions(argusDir).records).toEqual([]);
  });

  it('서명자 없이는 법이 되지 않는다', async () => {
    await expect(runDecSignCli([
      '--argus-dir', argusDir, '--repo', repo, '--from-clause', clauseIdFor('웹 화면은 나중에'),
    ])).rejects.toThrow(/--author/);
  });

  it('제목에 마크다운 찌꺼기가 안 남는다 (목록 기호·굵게 표시)', async () => {
    await sign(['--from-clause', clauseIdFor('웹 화면은 나중에')]);
    const record = foldDecisions(argusDir).records[0]!;
    expect(record.decision).toBe('웹 화면은 나중에. `src/app/**` 를 지금 만지지 않는다.');
    expect(read('D-0001')).toContain('# 웹 화면은 나중에.');
    expect(record.decision.startsWith('-')).toBe(false);
    // `src/app/**` 의 `**` 는 자리를 가리키는 글자지 굵게 표시가 아니다 —
    // 강조만 걷고 뜻은 남긴다.
    expect(record.decision).not.toContain('**웹');
    // 원문은 손대지 않는다 — 바이트로 대조되는 값이다.
    expect(record.quote).toContain('- **웹 화면은 나중에.**');
  });

  it('규칙 파일에서 온 것을 **"대화에서"라고 말하지 않는다** (출처를 지어내지 않는다)', async () => {
    await sign(['--from-clause', clauseIdFor('웹 화면은 나중에')]);
    const text = read('D-0001');
    expect(text).toContain('## 원래 이렇게 적혀 있었다');
    expect(text).toContain('CLAUDE.md');
    expect(text).not.toContain('대화에서 그대로 옮겼다');
    expect(text).not.toContain('## 그때 한 말');
  });

  it('두 번째 서명은 다음 번호를 받는다 (번호가 겹치지 않는다)', async () => {
    await sign(['--from-clause', clauseIdFor('웹 화면은 나중에')]);
    await sign(['--from-clause', clauseIdFor('함부로 추론하거나')]);
    expect(foldDecisions(argusDir).records.map((r) => r.id)).toEqual(['D-0001', 'D-0002']);
  });
});
