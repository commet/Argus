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
    // 좁은 예외 하나 (2026-07-26): doctor.md는 구 이름을 **증상으로** 읽는다.
    // 배선이 낡으면(npx가 캐시된 옛 설치본을 재사용) 서버는 연결돼 있는데 옛
    // 이름만 노출한다 — 그 상태를 "미연결"로 보고하면 처방이 틀리고(재연결 vs
    // 캐시 비우기) 영영 안 고쳐진다. 실제로 창업자 배선이 1.2.0에 12일간 얼어
    // 있었던 게 이 경로다. 그래서 진단 문맥에서 구 이름을 **호출법으로 가르치는
    // 것**과 **낡음의 단서로 식별하는 것**을 구별한다: 아래 줄들은 "옛 이름이
    // 보이면 구버전이다"라고만 말하고, 그 도구를 부르라고 시키지 않는다.
    const DIAGNOSTIC_STALE_MARKER = /구버전|낡은 배선/;
    const leaks = files.flatMap((file) => {
      const text = fs.readFileSync(file, 'utf8');
      const isDoctorCommand = path.basename(file) === 'doctor.md';
      return text.split('\n').flatMap((line) => {
        if (isDoctorCommand && DIAGNOSTIC_STALE_MARKER.test(line)) return [];
        const names = line.match(RETIRED_PUBLIC_NAMES) ?? [];
        return names.map((name) => `${path.relative(ROOT, file)}: ${name}`);
      });
    });
    expect(leaks).toEqual([]);
  });

  it('별도 일상 ritual 대신 doctor 비상구 하나만 배송한다', () => {
    const commands = fs.readdirSync(path.join(ROOT, 'argus-plugin-v2', 'commands'))
      .filter((file) => file.endsWith('.md'));
    expect(commands).toEqual(['doctor.md']);
  });
});
