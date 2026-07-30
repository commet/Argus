/**
 * doctor [10] npx 캐시 줄 — 정확 핀일 때 낡은 사본은 무해하다.
 *
 * 2026-07-27 창업자 도그푸딩 화면: 캐시에 옛 사본 6개가 남아 있어 `⚠ 낡은
 * 배선이다`가 여섯 줄 떴다 — 정작 그 세션은 핀한 1.15.0을 물고 있었다.
 * 경고의 전제("범위 스펙이면 npx가 캐시된 옛 설치본을 재사용한다")는 정확 핀
 * 시대에 더는 성립하지 않는다: 낡은 사본은 선택될 수 없다. 진단이 겁을 주면
 * 사람은 진단을 안 읽는다.
 *
 * 계약: 핀이 정확 버전이고 그 버전이 캐시에 있으면 → 일치 줄만 그대로 보이고
 * 낡은 것들은 한 줄로 접힌다(⚠ 없음). 핀이 캐시에 없으면 → 예전처럼 각 줄 경고.
 *
 * 무엇이 이걸 빨간불로 만드나: 누군가 접기를 되돌려 사본마다 경고를 다시 뿜는다.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DOCTOR = path.join(HERE, 'doctor.js');
const MCP_CONFIG = path.join(HERE, '..', '.mcp.json');
// 2026-07-30: the wire goes through a launcher (online → registry-fresh,
// offline → cached copy; measured: a bare `npm exec` HANGS with the registry
// unreachable). The spec string therefore lives inside the launcher — follow it
// like doctor does, and keep asserting the same two facts.
const MCP_ARGS = Object.values(JSON.parse(fs.readFileSync(MCP_CONFIG, 'utf8')).mcpServers)
  .flatMap((server) => server.args || []);
const LAUNCHER_ARG = MCP_ARGS.find((arg) => typeof arg === 'string' && /mcp-launch\.js$/.test(arg));
assert.ok(LAUNCHER_ARG, 'plugin .mcp.json must launch scripts/mcp-launch.js');
const LAUNCHER_SRC = fs.readFileSync(path.join(HERE, 'mcp-launch.js'), 'utf8');
const MCP_SPEC = (/--package=(argus-decision-mcp[^"'\s]*)/.exec(LAUNCHER_SRC) || [])[1];
// The plugin deliberately names NO version: npx re-resolves a bare name every
// launch, so one install stays current, while a range would be satisfied from
// the cache forever (measured 2026-07-29). A version here is the regression.
assert.ok(MCP_SPEC, 'mcp-launch.js must exec argus-decision-mcp');
assert.doesNotMatch(String(MCP_SPEC), /argus-decision-mcp@/,
  'plugin MCP must NOT pin a version — one install has to keep receiving fixes');
// The launcher must keep BOTH halves of the measured tradeoff: fresh online
// (no --offline on the default path) and alive offline (--offline fallback).
assert.ok(LAUNCHER_SRC.includes("'--offline'") || LAUNCHER_SRC.includes('"--offline"'),
  'mcp-launch.js must carry the measured --offline fallback');
const PIN = '';

function runDoctor(cacheRoot, pin) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-doc-repo-'));
  const pluginRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-doc-plugin-'));
  // doctor [11] reads the host's ~/.claude/settings.json. Point it at an empty
  // temp dir so this fixture run stays hermetic — otherwise whatever status line
  // the developer happens to have configured decides whether this test passes.
  const claudeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-doc-claude-'));
  fs.writeFileSync(path.join(pluginRoot, '.mcp.json'), JSON.stringify({
    mcpServers: {
      'argus-decision': {
        command: 'npm',
        args: pin
          ? ['exec', '--yes', `--package=argus-decision-mcp@${pin}`, '--', 'argus-decision-mcp']
          : ['exec', '--yes', '--package=argus-decision-mcp', '--', 'argus-decision-mcp'],
      },
    },
  }));
  try {
    return execFileSync(process.execPath, [DOCTOR], {
      cwd: repo,
      encoding: 'utf8',
      env: {
        ...process.env,
        npm_config_cache: cacheRoot,
        LOCALAPPDATA: cacheRoot,
        CLAUDE_PLUGIN_ROOT: pluginRoot,
        CLAUDE_CONFIG_DIR: claudeDir,
      },
    });
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(pluginRoot, { recursive: true, force: true });
    fs.rmSync(claudeDir, { recursive: true, force: true });
  }
}

/** The [10] section only — later sections have their own contracts and their own ⚠. */
function cacheBlock(out) {
  const from = out.indexOf('[10]');
  const to = out.indexOf('[11]');
  return to > from ? out.slice(from, to) : out.slice(from);
}

function makeCache(versions) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-npx-'));
  const npx = path.join(root, '_npx');
  versions.forEach((v, i) => {
    const mod = path.join(npx, `entry${i}`, 'node_modules', 'argus-decision-mcp');
    fs.mkdirSync(mod, { recursive: true });
    fs.writeFileSync(path.join(mod, 'package.json'), JSON.stringify({ name: 'argus-decision-mcp', version: v }));
  });
  return root;
}

let failures = 0;
function check(name, cond, detail) {
  if (cond) { console.log(`  ok   ${name}`); return; }
  failures++; console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
}

console.log('doctor [10] 캐시 노이즈 계약\n');

// ① 버전 미고정(현재 배선) + 캐시에 남은 사본 다수 → 한 줄로 접힘, 경고 없음
//
// 이 파일이 지키는 것은 바뀌지 않았다: 무해한 캐시 잔물로 창업자 화면에
// ⚠ 여섯 줄을 뿜지 않는다(2026-07-27 도그푸딩). 바뀐 것은 "무해한 이유"다 —
// 예전엔 정확한 핀이라 낡은 걸 안 골랐고, 지금은 버전을 안 박아 npx가 매번 다시 받는다.
{
  const cache = makeCache(['1.3.0', '1.4.2', '1.5.0']);
  const out = runDoctor(cache, '');
  const block = cacheBlock(out);
  check('버전 고정이 없다고 명시한다', /버전 고정 없음 — 매 실행 최신/.test(block), block.slice(0, 400));
  check('남은 사본은 한 줄로 접힌다', /캐시에 남은 사본 3개 \(1\.3\.0, 1\.4\.2, 1\.5\.0\)/.test(block), block.slice(0, 400));
  check('낙은-배선 경고를 띄우지 않는다', !/낡은 배선이다/.test(block), block.slice(0, 400));
  check('⚠ 줄을 뿜지 않는다', !/⚠/.test(block), block.slice(0, 400));
  fs.rmSync(cache, { recursive: true, force: true });
}

// ② 범위 스펙은 여전히 위험하다 — 실측된 동결 경로이므로 크게 경고해야 한다.
{
  const cache = makeCache(['1.3.0']);
  const out = runDoctor(cache, '^2');
  const block = cacheBlock(out);
  check('범위 스펙이면 경고한다', /범위 스펙이다/.test(block), block.slice(0, 400));
  fs.rmSync(cache, { recursive: true, force: true });
}

console.log(failures === 0 ? '\n✅ 캐시 줄 계약 유지' : `\n❌ ${failures}건 실패`);
process.exit(failures === 0 ? 0 : 1);
