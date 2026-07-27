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

function runDoctor(cacheRoot, pin) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-doc-repo-'));
  const pluginRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-doc-plugin-'));
  fs.writeFileSync(path.join(pluginRoot, '.mcp.json'), JSON.stringify({
    mcpServers: { 'argus-decision': { command: 'npx', args: ['-y', `argus-decision-mcp@${pin}`] } },
  }));
  try {
    return execFileSync(process.execPath, [DOCTOR], {
      cwd: repo,
      encoding: 'utf8',
      env: { ...process.env, npm_config_cache: cacheRoot, LOCALAPPDATA: cacheRoot, CLAUDE_PLUGIN_ROOT: pluginRoot },
    });
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(pluginRoot, { recursive: true, force: true });
  }
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

// ① 핀이 캐시에 있음 + 낡은 사본 다수 → 접힘, 경고 없음
{
  const cache = makeCache(['1.15.0', '1.3.0', '1.4.2', '1.5.0']);
  const out = runDoctor(cache, '1.15.0');
  const block = out.slice(out.indexOf('[10]'));
  check('일치 사본은 그대로 보인다', /캐시 1\.15\.0 \(핀과 일치\)/.test(block), block.slice(0, 400));
  check('낡은 사본은 한 줄로 접힌다', /낡은 사본 3개 \(1\.3\.0, 1\.4\.2, 1\.5\.0\)/.test(block), block.slice(0, 400));
  check('접혔을 때 낡은-배선 경고가 없다', !/낡은 배선이다/.test(block), block.slice(0, 400));
  fs.rmSync(cache, { recursive: true, force: true });
}

// ② 핀이 캐시에 없음 → 예전처럼 각 줄 경고 (진짜 위험한 경우는 여전히 크게)
{
  const cache = makeCache(['1.3.0', '1.5.0']);
  const out = runDoctor(cache, '1.15.0');
  const block = out.slice(out.indexOf('[10]'));
  check('핀 부재 시 사본마다 경고한다', (block.match(/낡은 배선이다/g) || []).length === 2, block.slice(0, 400));
  check('핀이 캐시에 없다는 사실도 말한다', /핀한 1\.15\.0이 캐시에 없다/.test(block), block.slice(0, 400));
  fs.rmSync(cache, { recursive: true, force: true });
}

console.log(failures === 0 ? '\n✅ 캐시 줄 계약 유지' : `\n❌ ${failures}건 실패`);
process.exit(failures === 0 ? 0 : 1);
