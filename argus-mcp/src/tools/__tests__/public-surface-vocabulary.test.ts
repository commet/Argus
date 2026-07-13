import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..', '..', '..', '..');

const RETIRED_PUBLIC_NAMES = /\bargus_(?:harvest|seal|settle|recall|init|config|sync|review|open_decision|premises|recheck|amend|dismiss|watch|candidates|snooze)\b/g;

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...filesUnder(absolute));
    else out.push(absolute);
  }
  return out;
}

describe('새 공개 체계의 어휘 경계', () => {
  it('Claude driver와 LOGBOOK이 구 도구명을 다시 가르치지 않는다', () => {
    const files = [
      ...filesUnder(path.join(ROOT, 'argus-driver')).filter((file) => !file.endsWith('.mcp.json')),
      path.join(ROOT, 'argus-mcp', 'src', 'v2', 'logbook.ts'),
      path.join(ROOT, '.claude-plugin', 'marketplace.json'),
    ];
    const leaks = files.flatMap((file) => {
      const names = fs.readFileSync(file, 'utf8').match(RETIRED_PUBLIC_NAMES) ?? [];
      return names.map((name) => `${path.relative(ROOT, file)}: ${name}`);
    });
    expect(leaks).toEqual([]);
  });

  it('별도 일상 ritual 대신 doctor 비상구 하나만 배송한다', () => {
    const commands = fs.readdirSync(path.join(ROOT, 'argus-driver', 'commands'))
      .filter((file) => file.endsWith('.md'));
    expect(commands).toEqual(['doctor.md']);
  });
});
