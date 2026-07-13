/**
 * P2-4 구조 가드 — argus-driver 얇은 플러그인 골격.
 *
 * 이 플러그인은 코드가 거의 없다(설정 3파일 + statusline 사본). 그래서
 * 위험은 로직 버그가 아니라 **조용한 구조 파손**이다: JSON 오타로 설치가
 * 소리 없이 실패하거나, marketplace 항목과 디렉토리가 어긋나거나,
 * statusline 사본이 정본(argus-plugin-v2)에서 드리프트하는 것. 전부
 * 여기서 CI red로 만든다 (LLM-glue invariant: 조용한 파손 금지).
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(here, '..', '..', '..');
const DRIVER = path.join(REPO_ROOT, 'argus-driver');

const readJson = (p: string): Record<string, unknown> =>
  JSON.parse(fs.readFileSync(p, 'utf8')) as Record<string, unknown>;

describe('argus-driver 플러그인 골격 (P2-4)', () => {
  it('plugin.json — 이름·버전·MIT가 실재하고 파싱된다', () => {
    const manifest = readJson(path.join(DRIVER, '.claude-plugin', 'plugin.json'));
    expect(manifest['name']).toBe('argus-driver');
    expect(manifest['license']).toBe('MIT');
    expect(typeof manifest['version']).toBe('string');
    expect(fs.existsSync(path.join(DRIVER, 'LICENSE'))).toBe(true);
  });

  it('.mcp.json — argus-decision-mcp stdio 배선 (스파이크 ②: 설치만으로 자동 배선)', () => {
    const mcp = readJson(path.join(DRIVER, '.mcp.json'));
    const servers = mcp['mcpServers'] as Record<string, { command: string; args: string[] }>;
    const wired = Object.values(servers);
    expect(wired.length).toBeGreaterThan(0);
    const argus = wired.find((s) => s.args.some((a) => a.startsWith('argus-decision-mcp')));
    expect(argus, 'argus-decision-mcp가 배선되어 있어야 한다').toBeDefined();
    expect(argus!.command).toBe('npx');
    // 버전 핸드셰이크의 최소형: 메이저 핀 — 서버 메이저가 바뀌면 설치가
    // 조용히 새 메이저를 받지 않는다 (Distribution 행의 환경 내 몫).
    const pkgArg = argus!.args.find((a) => a.startsWith('argus-decision-mcp'))!;
    expect(pkgArg).toMatch(/^argus-decision-mcp@\^\d+$/);
  });

  it('statusline 사본은 정본(argus-plugin-v2)과 바이트 동일 — 드리프트는 여기서 죽는다', () => {
    // Single Source of Truth 원칙의 의도적 예외: 플러그인은 자기 완결
    // 번들이어야 해서 사본을 배송한다. 대신 이 대조가 두 파일이 서로
    // 다른 말을 하는 상태를 CI에서 불가능하게 만든다. 수정은 정본
    // (argus-plugin-v2/statusline/index.js)에서 하고 복사할 것.
    const canonical = fs.readFileSync(path.join(REPO_ROOT, 'argus-plugin-v2', 'statusline', 'index.js'));
    const shipped = fs.readFileSync(path.join(DRIVER, 'statusline', 'index.js'));
    expect(shipped.equals(canonical)).toBe(true);
  });

  it('marketplace.json — argus-driver 항목이 있고 source 디렉토리가 실존한다', () => {
    const market = readJson(path.join(REPO_ROOT, '.claude-plugin', 'marketplace.json'));
    const plugins = market['plugins'] as Array<{ name: string; source: string; license: string }>;
    const entry = plugins.find((p) => p.name === 'argus-driver');
    expect(entry, 'marketplace에 argus-driver 항목이 있어야 한다').toBeDefined();
    expect(entry!.license).toBe('MIT');
    const sourceDir = path.join(REPO_ROOT, entry!.source);
    expect(fs.existsSync(path.join(sourceDir, '.claude-plugin', 'plugin.json'))).toBe(true);
    expect(fs.existsSync(path.join(sourceDir, '.mcp.json'))).toBe(true);
  });

  it('hooks.json — 파싱되고, 가리키는 스크립트가 전부 실존한다 (P2-5)', () => {
    const hooks = readJson(path.join(DRIVER, 'hooks', 'hooks.json'))['hooks'] as
      Record<string, Array<{ hooks: Array<{ type: string; command: string }> }>>;
    const commands = Object.values(hooks).flat().flatMap((m) => m.hooks);
    expect(commands.length).toBeGreaterThan(0);
    for (const c of commands) {
      expect(c.type).toBe('command');
      const m = /\$\{CLAUDE_PLUGIN_ROOT\}\/(\S+?)"/.exec(c.command);
      expect(m, `플러그인 루트 상대 경로여야 한다: ${c.command}`).not.toBeNull();
      expect(fs.existsSync(path.join(DRIVER, m![1]!)), `${m![1]!} 실존`).toBe(true);
    }
  });

  it('commands/*.md — 프론트매터가 있고, 가리키는 플러그인 루트 스크립트가 실존한다 (P2-6)', () => {
    const commandsDir = path.join(DRIVER, 'commands');
    const files = fs.readdirSync(commandsDir).filter((f) => f.endsWith('.md'));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const body = fs.readFileSync(path.join(commandsDir, f), 'utf8');
      expect(body.startsWith('---\n'), `${f}: 프론트매터 필수`).toBe(true);
      for (const m of body.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/([^\s"'`]+)/g)) {
        expect(fs.existsSync(path.join(DRIVER, m[1]!)), `${f} → ${m[1]!} 실존`).toBe(true);
      }
    }
  });

  it('settle.md — 서버 두뇌 호출 + 전체 목록 + outcome은 사용자 말에서만 (규칙 9·스파인)', () => {
    const settle = fs.readFileSync(path.join(DRIVER, 'commands', 'settle.md'), 'utf8');
    expect(settle).toContain('argus_check_in'); // 재생성 두뇌는 서버
    expect(settle).toContain('argus_resolve'); // 이름통일 후 공개 이름 (구 argus_settle)
    expect(settle).toContain('전체'); // 규칙 9: 전체 목록은 settle 커맨드의 자리
    expect(settle).toContain('제안·암시·예상하지 말'); // 스파인: 모델이 outcome을 제안하지 않는다
  });

  it('README — 설치 2줄과 "플러그인 제거가 원장을 지우지 않는다" 고지 (정본 규칙 3·21)', () => {
    const readme = fs.readFileSync(path.join(DRIVER, 'README.md'), 'utf8');
    expect(readme).toContain('/plugin marketplace add commet/Argus');
    expect(readme).toContain('/plugin install argus-driver@argus');
    expect(readme).toContain('플러그인 제거가 절대 삭제하지 않는다');
  });
});
