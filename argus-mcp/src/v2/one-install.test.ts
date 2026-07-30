/**
 * O3 방1 구조 가드 — 하나의 설치 (one install).
 *
 * driver + plugin-v2 통합 후의 위험은 로직 버그가 아니라 **조용한 구조 파손**
 * 이다: JSON 오타로 설치가 소리 없이 실패하거나, marketplace가 다시 두
 * 플러그인으로 갈라지거나, 번들(.mcp.json·훅·doctor)이 빠진 채 배송되는 것.
 * 전부 여기서 CI red로 만든다 (LLM-glue invariant: 조용한 파손 금지).
 *
 * 전신: driver-plugin.test.ts (P2-4~P2-6). 어서션은 병합본(argus 플러그인
 * 하나) 기준으로 승계했고, statusline 바이트 동일성 대조는 사본 자체가
 * 사라져(정본 단일 사본) 존재 이유와 함께 은퇴했다.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(here, '..', '..', '..');
const PLUGIN = path.join(REPO_ROOT, 'argus-plugin-v2');
const MCP_ROOT = path.resolve(here, '..', '..');

const readJson = (p: string): Record<string, unknown> =>
  JSON.parse(fs.readFileSync(p, 'utf8')) as Record<string, unknown>;

describe('argus 플러그인 골격 — 하나의 설치 (O3 방1)', () => {
  it('plugin.json — 이름·버전·MIT가 실재하고 파싱된다', () => {
    const manifest = readJson(path.join(PLUGIN, '.claude-plugin', 'plugin.json'));
    expect(manifest['name']).toBe('argus');
    expect(manifest['license']).toBe('MIT');
    expect(typeof manifest['version']).toBe('string');
    expect(fs.existsSync(path.join(PLUGIN, 'LICENSE'))).toBe(true);
  });

  it('.mcp.json — argus-decision-mcp stdio 배선 (설치만으로 자동 배선)', () => {
    const mcp = readJson(path.join(PLUGIN, '.mcp.json'));
    const servers = mcp['mcpServers'] as Record<string, { command: string; args: string[] }>;
    const wired = Object.values(servers);
    expect(wired.length).toBeGreaterThan(0);
    // 2026-07-30: 배선은 런처를 거친다 — 온라인이면 매 실행 최신(bare 이름
    // 레지스트리 재조회), 오프라인이면 캐시 폴백(실측: 맨 npm exec 는 레지스트리
    // 불달 시 뜨지도 실패하지도 않고 매달린다). 스펙 문자열은 런처 안에 산다.
    const argus = wired.find((s) => s.args.some((a) => /mcp-launch\.js$/.test(a)));
    expect(argus, 'mcp-launch.js 런처가 배선되어 있어야 한다').toBeDefined();
    expect(argus!.command).toBe('node');
    const launcherSrc = fs.readFileSync(path.join(PLUGIN, 'scripts', 'mcp-launch.js'), 'utf8');
    expect(launcherSrc).toContain('--package=argus-decision-mcp');
    expect(launcherSrc, '오프라인 폴백(--offline)이 런처의 존재 이유다').toContain('--offline');

    // 배선은 **버전을 적지 않는다.** 그 이유는 두 번의 사고와 한 번의 측정이다.
    //
    // ① 메이저 핀(`@^1`) 시절: npx는 스펙이 RANGE면 캐시에 조건을 만족하는
    //    설치본이 있는 한 그걸 재사용하고 레지스트리를 보지 않는다. 창업자 기기의
    //    캐시에 1.2.0이 한 번 앉은 뒤(2026-07-13) 1.3.0~1.9.0이 npm에 올라가는 동안
    //    12일간 배선이 1.2.0에 얼어 있었다. 레포는 자기 자신과 일관됐고 npm은
    //    최신을 갖고 있었는데, **아무도 볼 수 없던 숫자가 사용자가 만지던 그 숫자였다.**
    //
    // ② 정확 핀 시절: 그 함정은 닫혔지만 새 함정이 열렸다 — 핀은 사람이 고치기
    //    전까지 낡는다. 2026-07-29에 창업자의 Codex와 플러그인이 서로 다른 버전을,
    //    그리고 둘 다 최신이 아닌 걸 가리키고 있었다.
    //
    // ③ 그래서 전제를 재었다. 같은 스펙 문자열로 두 번, 캐시에 조건을 만족하는
    //    낡은 빌드를 심어두고:
    //
    //        argus-decision-mcp          → 현재 발행본을 띄운다
    //        argus-decision-mcp@^2.0.0   → 낡은 캐시본을 띄운다
    //
    //    언는 것은 RANGE이지 버전 표기 자체가 아니었다. 범위는 캐시로 만족되지만
    //    맨 이름은 npx가 매번 레지스트리에 다시 물어야 하기 때문이다. ①은 범위였고,
    //    정확 핀은 그걸 우연히 고쳤다 — 버전을 빼면 의도적으로 고쳐지고, 설치가
    //    손볼 일이 없어진다.
    expect(launcherSrc, '버전을 박으면 이 플러그인을 쓴 사람은 새 서버를 영영 못 받는다')
      .not.toMatch(/argus-decision-mcp@/);
  });

  it('범위 스펙은 어느 자리에도 없다 (캐시에 얼어붙는 유일한 형태)', () => {
    const mcp = readJson(path.join(PLUGIN, '.mcp.json'));
    const servers = mcp['mcpServers'] as Record<string, { args: string[] }>;
    const all = Object.values(servers).flatMap((s) => s.args);
    const launcherSrc = fs.readFileSync(path.join(PLUGIN, 'scripts', 'mcp-launch.js'), 'utf8');
    for (const text of [...all, launcherSrc]) {
      expect(text, '범위/태그 스펙은 npx 캐시에 얼어붙는다 (실측 2026-07-29)')
        .not.toMatch(/argus-decision-mcp@[\^~*]|argus-decision-mcp@latest/);
    }
  });

  it('server.json(레지스트리) 버전도 package.json과 일치한다', () => {
    const selfVersion = readJson(path.join(MCP_ROOT, 'package.json'))['version'] as string;
    const registry = readJson(path.join(MCP_ROOT, 'server.json'));
    expect(registry['version']).toBe(selfVersion);
    const pkgs = registry['packages'] as Array<{ identifier: string; version: string }>;
    for (const p of pkgs) {
      if (p.identifier === 'argus-decision-mcp') expect(p.version).toBe(selfVersion);
    }
  });

  it('marketplace.json — 플러그인은 정확히 하나(argus)고 driver 잔재가 없다', () => {
    const market = readJson(path.join(REPO_ROOT, '.claude-plugin', 'marketplace.json'));
    const plugins = market['plugins'] as Array<{ name: string; source: string; license: string }>;
    expect(plugins.map((p) => p.name), '설치 명령이 하나가 되려면 항목도 하나여야 한다').toEqual(['argus']);
    expect(plugins[0]!.license).toBe('MIT');
    const sourceDir = path.join(REPO_ROOT, plugins[0]!.source);
    expect(fs.existsSync(path.join(sourceDir, '.claude-plugin', 'plugin.json'))).toBe(true);
    expect(fs.existsSync(path.join(sourceDir, '.mcp.json'))).toBe(true);
    // 두 플러그인 시대의 잔재 금지 — 디렉토리가 되돌아오면 "하나의 설치"가 깨진 것.
    expect(fs.existsSync(path.join(REPO_ROOT, 'argus-driver'))).toBe(false);
  });

  it('hooks.json — 파싱되고, 스크립트가 전부 실존하며, 흡수한 훅 2개가 배선되어 있다', () => {
    const hooks = readJson(path.join(PLUGIN, 'hooks', 'hooks.json'))['hooks'] as
      Record<string, Array<{ hooks: Array<{ type: string; command: string }> }>>;
    const commands = Object.values(hooks).flat().flatMap((m) => m.hooks);
    expect(commands.length).toBeGreaterThan(0);
    const referenced: string[] = [];
    for (const c of commands) {
      expect(c.type).toBe('command');
      const m = /\$\{CLAUDE_PLUGIN_ROOT\}\/(\S+?)"/.exec(c.command);
      expect(m, `플러그인 루트 상대 경로여야 한다: ${c.command}`).not.toBeNull();
      referenced.push(m![1]!);
      expect(fs.existsSync(path.join(PLUGIN, m![1]!)), `${m![1]!} 실존`).toBe(true);
    }
    // 흡수 계약: 조용한 SessionStart 점검 + ambient 방아쇠 — 파일만 있고
    // 배선이 빠지는 조용한 파손을 막는다 (소비 없는 생산 금지).
    expect(referenced).toContain('hooks/session-start.js');
    expect(referenced).toContain('hooks/ambient-nudge.js');
  });

  it('별도 commands/*.md를 배송하지 않고 doctor는 내부 워크플로로 존재한다', () => {
    const commandsDir = path.join(PLUGIN, 'commands');
    const files = fs.existsSync(commandsDir)
      ? fs.readdirSync(commandsDir).filter((f) => f.endsWith('.md'))
      : [];
    expect(files).toEqual([]);
    expect(fs.existsSync(path.join(PLUGIN, 'lib', 'workflows', 'doctor.md'))).toBe(true);
    for (const f of files) {
      const body = fs.readFileSync(path.join(commandsDir, f), 'utf8');
      expect(body.startsWith('---\n'), `${f}: 프론트매터 필수`).toBe(true);
      for (const m of body.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/([^\s"'`]+)/g)) {
        expect(fs.existsSync(path.join(PLUGIN, m[1]!)), `${f} → ${m[1]!} 실존`).toBe(true);
      }
    }
  });

  it('공개 commands 디렉터리에 별도 비상구를 다시 만들지 않는다', () => {
    const commandsDir = path.join(PLUGIN, 'commands');
    const files = fs.existsSync(commandsDir)
      ? fs.readdirSync(commandsDir).filter((f) => f.endsWith('.md'))
      : [];
    expect(files).toEqual([]);
  });

  it('statusline — 정본 단일 사본이 플러그인에 실린다 (driver 사본 시대 종료)', () => {
    expect(fs.existsSync(path.join(PLUGIN, 'statusline', 'index.js'))).toBe(true);
  });

  it('README(en/ko) — 설치 2줄 + 제거-비삭제 고지, 두 번째 플러그인 언급 0', () => {
    for (const [name, notice] of [
      ['README.md', 'Uninstalling the plugin never deletes'],
      ['README.ko.md', '플러그인 제거가 절대 삭제하지 않는다'],
    ] as const) {
      const readme = fs.readFileSync(path.join(PLUGIN, name), 'utf8');
      expect(readme, name).toContain('/plugin marketplace add commet/Argus');
      expect(readme, name).toContain('/plugin install argus@argus');
      expect(readme, `${name}: 제거가 원장을 지우지 않는다는 고지 (정본 규칙 3·21)`).toContain(notice);
      expect(readme, `${name}: 설치를 가르치는 문서에 두 번째 플러그인이 없어야 한다`).not.toContain('argus-driver');
    }
  });
});

describe('premises 스킬 — 미결 질문은 fork로 묻지 않는다 (스파인 미러 조항 가드)', () => {
  // 열린 질문의 reconsider가 A/B lean 칩으로 되돌아가는 것을 막는다. MCP
  // argus_premises op=resolve(자유 텍스트, 선택지 없음)가 정본이고, 이 스킬이
  // 거기서 드리프트하면 두 표면이 스파인 위반 여부에서 갈린다. disclaimed lean도
  // 세탁이 아니므로(CLAUDE.md rounds 5–8), 규칙 문구까지 실재를 확인한다.
  const SKILL = path.join(REPO_ROOT, 'argus-plugin-v2', 'lib', 'workflows', 'premises.md');
  const body = fs.readFileSync(SKILL, 'utf8');

  it('reconsider 단계가 A/B lean 칩(fork)을 다시 들이지 않는다', () => {
    // 과거 위반 형태의 지문: "[A로 기운다] [B로 기운다]" 류 + "balanced example lean".
    expect(body).not.toMatch(/기운다/);
    expect(body).not.toMatch(/balanced\s+example\s+leans?/i);
    // "poles to think against"를 생성하라는 지시가 없어야 한다 (금지 문구는 예외).
    expect(body).not.toMatch(/Offer\s+\*\*2[^\n]*leans/i);
  });

  it('미결 질문은 사용자의 말(자유 텍스트)로만 닫힌다고 명시한다', () => {
    expect(body).toMatch(/op=resolve/); // MCP 정본과의 대응을 문서가 못박는다
    expect(body).toMatch(/NO A\/B fork|multiple-choice crux IS a fork/);
    expect(body).toMatch(/열어둔 채로 둬도 괜찮아요/); // leave-open이 유효한 답
  });

  it('leave-open은 소비처 없는 이벤트를 만들지 않는다 (LLM-glue: 죽은 와이어 금지)', () => {
    // items.jsonl 쓰기는 이제 단일소스 CLI(decision-ledger.js premises <op>)가
    // 소유한다(플러그인-코어 Option A). 소비 계약은 스킬 산문이 아니라 그 CLI가
    // emit하는 op 집합 ↔ 리듀서(check-contracts.js)가 소비하는 case 집합으로
    // 옮겨졌다: CLI가 내보내는 모든 op를 리듀서가 소비해야 한다(죽은 와이어 금지).
    const reducer = fs.readFileSync(path.join(REPO_ROOT, 'argus-plugin-v2', 'scripts', 'check-contracts.js'), 'utf8');
    const cli = fs.readFileSync(path.join(REPO_ROOT, 'argus-plugin-v2', 'scripts', 'decision-ledger.js'), 'utf8');
    const consumes = (ev: string) => new RegExp(`case\\s+"${ev}"`).test(reducer);
    const opsMatch = cli.match(/const OPS = \[([^\]]+)\]/);
    expect(opsMatch, 'decision-ledger.js premises must declare a const OPS list').toBeTruthy();
    const ops = [...opsMatch![1]!.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]!);
    expect(ops.length).toBeGreaterThan(0);
    for (const ev of ops) {
      expect(consumes(ev), `items.jsonl op "${ev}"는 리듀서가 소비해야 한다`).toBe(true);
    }
    // 그리고 스킬은 items.jsonl JSON을 더 이상 손으로 쓰지 않는다(단일소스).
    expect(body).not.toMatch(/\{\s*"?event"?:\s*"(add|edit|alert|recheck|dismiss|extract)"/);
    // reconsider/still_open은 이 표면에 존재하지 않는다 — 지시로도 등장 금지.
    expect(body).not.toMatch(/append\s+`?\{event:"reconsider"/);
  });
});
