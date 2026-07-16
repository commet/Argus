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

  it('일상 ritual 커맨드는 없고 읽기 전용 doctor 비상구만 남는다', () => {
    const files = fs.readdirSync(path.join(DRIVER, 'commands')).filter((f) => f.endsWith('.md'));
    expect(files).toEqual(['doctor.md']);
  });

  it('README — 설치 2줄과 "플러그인 제거가 원장을 지우지 않는다" 고지 (정본 규칙 3·21)', () => {
    const readme = fs.readFileSync(path.join(DRIVER, 'README.md'), 'utf8');
    expect(readme).toContain('/plugin marketplace add commet/Argus');
    expect(readme).toContain('/plugin install argus-driver@argus');
    expect(readme).toContain('플러그인 제거가 절대 삭제하지 않는다');
  });
});

describe('premises 스킬 — 미결 질문은 fork로 묻지 않는다 (스파인 미러 조항 가드)', () => {
  // 열린 질문의 reconsider가 A/B lean 칩으로 되돌아가는 것을 막는다. MCP
  // argus_premises op=resolve(자유 텍스트, 선택지 없음)가 정본이고, 이 스킬이
  // 거기서 드리프트하면 두 표면이 스파인 위반 여부에서 갈린다. disclaimed lean도
  // 세탁이 아니므로(CLAUDE.md rounds 5–8), 규칙 문구까지 실재를 확인한다.
  const SKILL = path.join(REPO_ROOT, 'argus-plugin-v2', 'skills', 'premises', 'SKILL.md');
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
