/**
 * 훅이 엔진을 찾는 단 한 곳.
 *
 * 왜 따로 떼었나 (2026-10-20 실측): 훅 넷(`dec-brief`·`dec-watch`·`dec-block`·
 * `capture-sweep`)이 각자 `resolveEngine()` 사본을 갖고 있었고, 셋은
 * **PATH 의 `argus-decision-mcp` 하나만** 찾았다. 그런데 플러그인은 엔진을
 * `npx` 로 데려온다(`scripts/mcp-launch.js`) — 전역 설치를 하지 않는다. 그래서
 * `/plugin install` 만 한 사람의 기기에서는 결정 장부 훅 셋이 **영영 침묵**했다.
 * 설치 단위는 플러그인 하나라고 기획서(§2-b)가 약속했는데, 그 약속이 배선에서
 * 끊겨 있었다.
 *
 * 찾는 순서 — 전부 **기다림이 없는** 길이다 (훅 예산은 5초, 찬 npx 는 못 기다린다):
 *   1. `ARGUS_MCP_BIN` — 명시가 이긴다 (테스트·개발)
 *   2. PATH 의 `argus-decision-mcp` — 전역 설치한 사람
 *   3. **npx 캐시의 가장 새 사본** — MCP 서버가 세션 시작에 이미 내려받은 것.
 *      `MIN_DEC_ENGINE` 보다 낡은 사본은 고르지 않는다: 결정 장부 명령을 모르는
 *      엔진은 인자를 무시하고 stdio 서버로 떠서 훅 예산을 다 태운다.
 *
 * 못 찾으면 `ok:false` 와 **이유**를 돌려준다. 조용히 사라지지 않는다.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

/** 결정 장부(`dec-*`) 명령이 처음 들어간 엔진 판. */
const MIN_DEC_ENGINE = "2.1.0";
const PACKAGE = "argus-decision-mcp";

function onPath(name) {
  const exts = process.platform === "win32" ? [".cmd", ".exe", ".bat", ""] : [""];
  for (const dir of (process.env.PATH || "").split(path.delimiter)) {
    if (!dir) continue;
    for (const ext of exts) {
      const candidate = path.join(dir, `${name}${ext}`);
      try { if (fs.statSync(candidate).isFile()) return candidate; } catch { /* 다음 후보 */ }
    }
  }
  return null;
}

function versionAtLeast(version, floor) {
  const a = String(version || "").split(/[.+-]/).slice(0, 3).map((n) => Number.parseInt(n, 10) || 0);
  const b = floor.split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return true;
}

/** npm 이 쓰는 캐시 자리. `npm_config_cache` 가 이기고, 없으면 플랫폼 기본값. */
function npmCacheDir() {
  const configured = process.env.npm_config_cache || process.env.NPM_CONFIG_CACHE;
  if (configured && configured.trim() !== "") return configured;
  if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    return path.join(process.env.LOCALAPPDATA, "npm-cache");
  }
  return path.join(os.homedir(), ".npm");
}

/** npx 캐시에서 가장 새 엔진 사본 — 없으면 null. 디렉터리 몇 개를 읽을 뿐이다. */
function newestCachedEngine() {
  const npxDir = path.join(npmCacheDir(), "_npx");
  let entries;
  try { entries = fs.readdirSync(npxDir); } catch { return null; }
  let best = null;
  for (const entry of entries) {
    const pkgDir = path.join(npxDir, entry, "node_modules", PACKAGE);
    let version;
    try { version = JSON.parse(fs.readFileSync(path.join(pkgDir, "package.json"), "utf8")).version; }
    catch { continue; }
    const entrypoint = path.join(pkgDir, "dist", "index.js");
    try { if (!fs.statSync(entrypoint).isFile()) continue; } catch { continue; }
    if (!best || versionAtLeast(version, best.version) && version !== best.version) {
      best = { version, entrypoint };
    }
  }
  return best;
}

/**
 * 기다림 없이 부를 수 있는 엔진.
 * 돌려주는 모양: `{ ok, cmd, prefix, via, why? }` — 부르는 쪽은
 * `spawn(cmd, [...prefix, ...args])` 로 쓴다.
 */
function resolveFastEngine() {
  const explicit = process.env.ARGUS_MCP_BIN;
  if (explicit && explicit.trim() !== "") {
    try {
      if (fs.statSync(explicit).isFile()) return { ok: true, cmd: explicit, prefix: [], via: "ARGUS_MCP_BIN" };
    } catch { /* 아래에서 정직하게 실패로 돌려준다 */ }
    const viaPath = onPath(path.basename(explicit));
    if (viaPath) return { ok: true, cmd: viaPath, prefix: [], via: "ARGUS_MCP_BIN" };
    return { ok: false, cmd: explicit, prefix: [], via: "ARGUS_MCP_BIN", why: `ARGUS_MCP_BIN 이 가리키는 실행 파일이 없다: ${explicit}` };
  }
  const direct = onPath(PACKAGE);
  if (direct) return { ok: true, cmd: direct, prefix: [], via: "PATH" };

  const cached = newestCachedEngine();
  if (cached && versionAtLeast(cached.version, MIN_DEC_ENGINE)) {
    return { ok: true, cmd: process.execPath, prefix: [cached.entrypoint], via: `npx-cache@${cached.version}` };
  }
  if (cached) {
    return {
      ok: false, cmd: null, prefix: [], via: `npx-cache@${cached.version}`,
      why: `내려받아 둔 엔진(${cached.version})이 결정 장부 이전 판이다 — ${MIN_DEC_ENGINE} 이상이 필요하다. 새 세션이 MCP 를 띄우면 최신 판이 내려온다`,
    };
  }
  return {
    ok: false, cmd: null, prefix: [], via: "none",
    why: "엔진이 아직 내려받아지지 않았다 — 플러그인의 MCP 서버가 한 번 뜨면 다음 세션부터 동작한다 (세션 시작은 npx 를 기다릴 수 없다)",
  };
}

module.exports = { resolveFastEngine, newestCachedEngine, versionAtLeast, onPath, MIN_DEC_ENGINE };
