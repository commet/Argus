import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..', '..', '..', '..');

const RETIRED_PUBLIC_NAMES = /\bargus_(?:harvest|seal|settle|recall|init|config|sync|review|open_decision|premises|recheck|amend|dismiss|watch|candidates|snooze)\b/g;

describe('새 공개 체계의 어휘 경계', () => {
  it('MCP를 relay하는 플러그인 표면과 LOGBOOK이 구 도구명을 다시 가르치지 않는다', () => {
    // 구 argus-driver 전체 스윕의 승계(O3 방1): 흡수된 파일들 + 플러그인의
    // MCP-어휘 접점(README·statusline)만 명시 스윕한다. 스킬·에이전트 본문은
    // 자기 가드가 따로 있고, 여기 어휘 경계의 대상이 아니다.
    const files = [
      path.join(ROOT, 'argus-plugin-v2', 'hooks', 'session-start.js'),
      path.join(ROOT, 'argus-plugin-v2', 'hooks', 'ambient-nudge.js'),
      path.join(ROOT, 'argus-plugin-v2', 'scripts', 'doctor.js'),
      path.join(ROOT, 'argus-plugin-v2', 'commands', 'doctor.md'),
      path.join(ROOT, 'argus-plugin-v2', 'statusline', 'index.js'),
      path.join(ROOT, 'argus-plugin-v2', 'README.md'),
      path.join(ROOT, 'argus-plugin-v2', 'README.ko.md'),
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
    const commands = fs.readdirSync(path.join(ROOT, 'argus-plugin-v2', 'commands'))
      .filter((file) => file.endsWith('.md'));
    expect(commands).toEqual(['doctor.md']);
  });
});
