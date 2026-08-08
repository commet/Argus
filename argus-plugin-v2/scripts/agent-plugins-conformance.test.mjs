/**
 * Agent Plugins v1.0.0 적합성 게이트 (agent-plugins.org, 2026-08-08 도입).
 *
 * OpenAI·Amazon·Cursor·Microsoft·Vercel 이 공동 발표한 이식형 플러그인
 * 표준이다. 이 리포는 이미 표준의 두 컴포넌트(스킬, MCP 서버)를 갖고 있어
 * 적합성 층은 파일 둘뿐이다 — 루트 `plugin.json`(폐쇄 매니페스트)과
 * `mcp.json`(전송 변형 선언). Claude 전용 매니페스트(.claude-plugin/)와
 * 공존하며 서로를 대체하지 않는다.
 *
 * 이 테스트는 스펙 §5(매니페스트)·§7.2(MCP 설정)의 규범 요구를 기계로
 * 고정한다 — 스키마 파일 검증기가 아니라 스펙 본문 규칙의 직접 구현이다
 * (스펙 §5.2: "The specification text is authoritative"). JSON Schema 는
 * draft 2020-12 라 리포의 ajv(v6)로 검증할 수 없고, 외부 의존을 늘리는
 * 대신 폐쇄 필드·이름 제약·서버 변형을 손으로 검사한다.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

// ── §5 매니페스트 ──────────────────────────────────────────────────────────
const manifest = read('plugin.json');

// §5.2 폐쇄 스키마: 허용된 top-level 필드 외에는 아무것도 없어야 한다.
const ALLOWED_MANIFEST_FIELDS = new Set([
  '$schema', 'name', 'version', 'description', 'author', 'homepage',
  'repository', 'license', 'keywords', 'extensions',
]);
for (const key of Object.keys(manifest)) {
  assert.ok(ALLOWED_MANIFEST_FIELDS.has(key), `plugin.json 허용 밖 필드: ${key} (§5.2 폐쇄 스키마)`);
}

// §5.3 필수 필드 + 정확한 $schema 정본 식별자.
assert.equal(
  manifest.$schema,
  'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
  '$schema 는 1.0.0 정본 식별자여야 한다 (§5.2)',
);
assert.equal(typeof manifest.name, 'string', 'name 필수 (§5.3)');

// §5.5 이름 제약: 1–64자, [a-z0-9.-], 처음/끝 영숫자, --·.. 금지.
assert.match(manifest.name, /^[a-z0-9](?:[a-z0-9.-]{0,62}[a-z0-9])?$/, 'name 문자 제약 (§5.5)');
assert.ok(!manifest.name.includes('--') && !manifest.name.includes('..'), 'name 연속 구분자 금지 (§5.5)');

// §5.4 author 는 name/email/url 문자열만.
if (manifest.author !== undefined) {
  for (const [k, v] of Object.entries(manifest.author)) {
    assert.ok(['name', 'email', 'url'].includes(k), `author 허용 밖 필드: ${k} (§5.4)`);
    assert.equal(typeof v, 'string', `author.${k} 는 문자열 (§5.4)`);
  }
}
if (manifest.keywords !== undefined) {
  assert.ok(Array.isArray(manifest.keywords) && manifest.keywords.every((k) => typeof k === 'string'),
    'keywords 는 문자열 배열 (§5.4)');
}

// ── §7.2 MCP 설정 ─────────────────────────────────────────────────────────
const mcp = read('mcp.json');

// §7.2.1 폐쇄 top-level: $schema + mcpServers 뿐.
assert.deepEqual(
  Object.keys(mcp).sort(),
  ['$schema', 'mcpServers'],
  'mcp.json top-level 은 $schema 와 mcpServers 뿐 (§7.2.1)',
);
// §10.1 두 파일의 표준 버전이 일치해야 한다.
assert.equal(
  mcp.$schema,
  'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json',
  'mcp.json $schema 는 plugin.json 과 같은 1.0.0 을 겨냥해야 한다 (§10.1)',
);

const VARIANT_FIELDS = {
  stdio: { required: ['type', 'command'], optional: ['args', 'env', 'cwd'] },
  'streamable-http': { required: ['type', 'url'], optional: ['headers'] },
  sse: { required: ['type', 'url'], optional: ['headers'] },
};

for (const [id, server] of Object.entries(mcp.mcpServers)) {
  const variant = VARIANT_FIELDS[server.type];
  assert.ok(variant, `${id}: 알 수 없는 type "${server.type}" (§7.2.1 폐쇄 변형)`);
  const allowed = new Set([...variant.required, ...variant.optional]);
  for (const key of Object.keys(server)) {
    assert.ok(allowed.has(key), `${id}: ${server.type} 변형 허용 밖 필드 "${key}" (§7.2.1)`);
  }
  for (const key of variant.required) {
    assert.ok(key in server, `${id}: ${server.type} 필수 필드 "${key}" 누락 (§7.2.1)`);
  }
  if (server.type === 'stdio') {
    // command 는 단일 실행 토큰: 셸 문자열 금지, 플러그인 상대면 ./ 로 시작.
    assert.ok(!/\s/.test(server.command), `${id}: command 는 단일 토큰이어야 한다 (§7.2.1)`);
    if (server.command.includes('/')) {
      assert.ok(server.command.startsWith('./'), `${id}: 경로형 command 는 ./ 로 시작 (§4.1)`);
    }
    // 예약 환경변수는 클라이언트 소유다.
    for (const k of Object.keys(server.env ?? {})) {
      assert.ok(k !== 'PLUGIN_ROOT' && k !== 'PLUGIN_DATA', `${id}: env 에 예약 변수 금지 (§9.2)`);
    }
  } else {
    const u = new URL(server.url);
    assert.ok(['https:', 'http:'].includes(u.protocol), `${id}: url 은 http(s) (§7.2.1)`);
    const loopback = u.hostname === 'localhost' || /^127\./.test(u.hostname) || u.hostname === '::1';
    if (u.protocol === 'http:') assert.ok(loopback, `${id}: 비루프백은 HTTPS 필수 (§7.2.1)`);
    assert.equal(u.username, '', `${id}: url 에 사용자 정보 금지 (§7.2.1)`);
    assert.equal(u.hash, '', `${id}: url 에 fragment 금지 (§7.2.1)`);
    // 헤더는 이식형 비밀 통로가 아니다 — 자격증명 모양이 보이면 실패.
    for (const [hk, hv] of Object.entries(server.headers ?? {})) {
      assert.ok(!/authorization|api[-_]?key|token|secret/i.test(hk + hv),
        `${id}: headers 에 비밀 금지 (§7.2.1 — 인가는 클라이언트 관리)`);
    }
  }
}

// ── §7.1 스킬 발견 계약 ───────────────────────────────────────────────────
// skills/ 의 직계 자식 중 SKILL.md 를 가진 디렉토리만 스킬이다. 그 각각은
// Agent Skills 프론트매터(name·description)를 가져야 한다. SKILL.md 없는
// 디렉토리(_generated 등)는 스킬이 아니므로 규격 밖이어도 무방하다 (§7.1).
const skillsDir = path.join(ROOT, 'skills');
const skillDirs = fs.readdirSync(skillsDir).filter((d) => {
  const p = path.join(skillsDir, d);
  return fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, 'SKILL.md'));
});
assert.ok(skillDirs.length >= 5, `발견 가능한 스킬이 너무 적다 (${skillDirs.length}) — 경로가 바뀌었는가?`);
for (const d of skillDirs) {
  const md = fs.readFileSync(path.join(skillsDir, d, 'SKILL.md'), 'utf8');
  const fm = md.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(fm, `skills/${d}/SKILL.md 프론트매터 없음 (Agent Skills 스펙)`);
  assert.ok(/^name:\s*\S/m.test(fm[1]), `skills/${d}: name 프론트매터 필수`);
  assert.ok(/^description:\s*\S/m.test(fm[1]), `skills/${d}: description 프론트매터 필수`);
}

// ── 버전 정합 (리포 자체 규율) ────────────────────────────────────────────
// 표준 매니페스트가 여섯 번째 버전 사본이 됐다 — Claude 매니페스트와 어긋나면
// 설치 표면마다 다른 버전을 주장하게 된다. version-lockstep 게이트와 동일 원칙.
const claudeManifest = read('.claude-plugin/plugin.json');
assert.equal(manifest.version, claudeManifest.version,
  `plugin.json(표준) 버전 ${manifest.version} ≠ .claude-plugin(클로드) 버전 ${claudeManifest.version}`);

console.log(`✅ agent-plugins v1.0.0 conformance · manifest 폐쇄 스키마 · 서버 ${Object.keys(mcp.mcpServers).length}개 변형 검증 · 스킬 ${skillDirs.length}개 프론트매터 확인 · 버전 정합`);
