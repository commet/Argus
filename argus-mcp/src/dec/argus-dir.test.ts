import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { nearestLedgerDir } from './dec-cli.js';

/**
 * `--argus-dir` 없이 친 명령은 **이미 있는 장부**를 찾아 쓴다 — 화면이 가르치는
 * `dec-amend`·`dec-misfire` 가 그 깃발 없이 적혀 있어서, 그대로 치면 죽었다.
 * 없는 장부를 새로 만들지 않고, 프로젝트 경계(.git) 위로 새지 않는다.
 */
const made: string[] = [];
function tmp(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-dir-'));
  made.push(dir);
  return dir;
}
afterEach(() => { for (const d of made.splice(0)) fs.rmSync(d, { recursive: true, force: true }); });

describe('nearestLedgerDir', () => {
  it('하위 폴더에서 쳐도 프로젝트의 장부를 찾는다', () => {
    const repo = tmp();
    fs.mkdirSync(path.join(repo, '.git'));
    fs.mkdirSync(path.join(repo, '.argus', 'ledger'), { recursive: true });
    fs.writeFileSync(path.join(repo, '.argus', 'ledger', 'ledger.jsonl'), '');
    const deep = path.join(repo, 'src', 'app');
    fs.mkdirSync(deep, { recursive: true });
    expect(nearestLedgerDir(deep)).toBe(path.join(repo, '.argus'));
  });

  it('장부가 없으면 만들지 않고 null 이다', () => {
    const repo = tmp();
    fs.mkdirSync(path.join(repo, '.git'));
    expect(nearestLedgerDir(repo)).toBeNull();
    expect(fs.existsSync(path.join(repo, '.argus'))).toBe(false);
  });

  it('프로젝트 경계 위의 장부로 새지 않는다', () => {
    const outer = tmp();
    fs.mkdirSync(path.join(outer, '.argus', 'ledger'), { recursive: true });
    fs.writeFileSync(path.join(outer, '.argus', 'ledger', 'ledger.jsonl'), '');
    const inner = path.join(outer, 'other-repo');
    fs.mkdirSync(path.join(inner, '.git'), { recursive: true });
    expect(nearestLedgerDir(inner)).toBeNull();
  });
});
