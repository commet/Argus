#!/usr/bin/env node
/**
 * Argus Stop 훅 — 대화 수집을 **자동으로** 돌린다 (시공 계획 N6 · 단계 0-b).
 *
 * 무엇이 빠져 있었나. 큐에 **넣는** 것은 이미 자동이었다 —
 * `hooks/session-start.js` 가 세션이 열릴 때 harvest 항목을 하나 넣는다.
 * 그런데 큐를 **비우는** 것(대화를 실제로 읽어 후보를 만드는 것)은
 * `check_in` 도구 안에서만 돌았다. 즉 AI 가 그 도구를 부르기로 마음먹어야
 * 수집이 일어났다. CLAUDE.md 가 금지한 모양이다 — *"라우팅·순서는 결정론
 * 구조가 갖고, LLM 은 셀 안의 창의 작업만."* 이 훅이 그 배선을 옮긴다.
 *
 * 규율 (어기면 이 파일이 세션을 세금으로 만든다):
 *  - **아무것도 출력하지 않는다.** 수집은 조용한 일이고, 말하는 것은
 *    확인하는 순간의 몫이다. 침묵이 기본이다.
 *  - **절대 던지지 않고 절대 0 아닌 코드로 끝나지 않는다.**
 *  - **기다리지 않는다.** 훅 예산은 5초이고 훑기는 그보다 오래 걸릴 수 있다.
 *    떼어내서 띄우고(detached) 바로 끝낸다.
 *  - **일이 없으면 프로세스도 안 띄운다.** Stop 은 턴마다 오므로, 엔진이
 *    이미 쓰는 표식(`harvest-last-run.json`)을 먼저 읽어 하루 한 번만 띄운다.
 *  - **원장에 직접 쓰지 않는다.** 엔진 바이너리를 부른다 (관문 단일성).
 *  - **조용히 실패하지 않는다.** 띄우는 데 실패하면 그 사실을
 *    `capture-sweep-state.json` 에 남긴다 (덮어쓰기 — 새 append 자리 아님).
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const STATE_FILE = "capture-sweep-state.json";

function localToday() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function argusHome() {
  const env = process.env.ARGUS_HOME;
  return env && env.trim() !== "" ? env : path.join(os.homedir(), ".argus");
}

/** cwd 에서 위로 올라가며 프로젝트 뿌리를 찾는다 (decision-ledger.js 와 같은 규칙). */
function findProjectRoot(from) {
  let dir = from;
  while (dir && dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, ".git")) || fs.existsSync(path.join(dir, ".argus"))) return dir;
    dir = path.dirname(dir);
  }
  return null;
}

function readJsonFile(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; }
}

function parseJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

function writeStateAtomic(dataDir, state) {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    const target = path.join(dataDir, STATE_FILE);
    const tmp = `${target}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state, null, 1), "utf8");
    fs.renameSync(tmp, target);
  } catch { /* 상태를 못 남기는 것이 세션을 막지는 않는다 */ }
}

function pidAlive(pid) {
  try { process.kill(pid, 0); return true; }
  catch (error) { return !!error && error.code === "EPERM"; }
}

/**
 * 엔진 바이너리를 찾는다. PATH 에 있으면 그것을(빠름), 없으면 npx 로 —
 * 플러그인의 mcp.json 이 엔진을 `npx -y argus-decision-mcp` 로 띄우므로
 * 설치되지 않은 기기에서도 같은 방식이 통한다.
 */
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

function resolveEngine() {
  const explicit = process.env.ARGUS_MCP_BIN;
  if (explicit && explicit.trim() !== "") {
    // 있는지 **여기서** 본다. spawn 의 error 이벤트는 비동기라, 훅이 끝난 뒤에
    // 온다 — 그 이벤트에 기대면 기동 실패가 영영 아무데도 안 남는다.
    try {
      if (fs.statSync(explicit).isFile()) return { cmd: explicit, prefix: [], ok: true };
    } catch { /* 아래에서 정직하게 실패로 돌려준다 */ }
    const viaPath = onPath(path.basename(explicit));
    if (viaPath) return { cmd: viaPath, prefix: [], ok: true };
    return { cmd: explicit, prefix: [], ok: false, why: `ARGUS_MCP_BIN 이 가리키는 실행 파일이 없다: ${explicit}` };
  }
  const direct = onPath("argus-decision-mcp");
  if (direct) return { cmd: direct, prefix: [], ok: true };
  const npx = onPath("npx");
  if (npx) return { cmd: npx, prefix: ["-y", "argus-decision-mcp"], ok: true };
  return { cmd: "npx", prefix: ["-y", "argus-decision-mcp"], ok: false, why: "엔진도 npx 도 PATH 에서 못 찾았다" };
}

function main(stdinText) {
  const payload = parseJson(stdinText) || {};

  // 관문 1 — 임시 상태 자리가 없으면 큐 자체가 없다.
  const dataDir = process.env.CLAUDE_PLUGIN_DATA;
  if (!dataDir) return;

  // 관문 2 — 수집은 명시 동의가 있어야 돈다 (엔진도 다시 검사한다).
  const config = readJsonFile(path.join(argusHome(), "config.json"));
  if (!(config && config.harvest && config.harvest.opt_in === true)) return;

  // 관문 3 — 엔진이 쓰는 그 표식을 읽는다. 하루 한 번이면 오늘 몫은 끝났다.
  const today = localToday();
  const marker = readJsonFile(path.join(dataDir, "harvest-last-run.json"));
  if (marker && marker.date === today) return;

  // 관문 4 — 이미 돌고 있으면 또 띄우지 않는다.
  const prior = readJsonFile(path.join(dataDir, STATE_FILE));
  if (prior && prior.running_pid && prior.spawned_date === today && pidAlive(prior.running_pid)) return;

  const cwd = typeof payload.cwd === "string" && payload.cwd ? payload.cwd : process.cwd();
  const root = findProjectRoot(cwd);
  if (!root) return; // 저장소 밖 — 비울 큐가 없다
  const argusDir = path.join(root, ".argus");

  const engine = resolveEngine();
  if (!engine.ok) {
    writeStateAtomic(dataDir, {
      spawned_date: today, spawned_at: new Date().toISOString(),
      engine: engine.cmd, running_pid: null, last_error: `수집을 띄우지 못했다: ${engine.why}`,
    });
    return;
  }
  const argv = [
    ...engine.prefix,
    "capture-drain",
    "--argus-dir", argusDir,
    "--data-dir", dataDir,
    "--today", today,
  ];

  try {
    const child = spawn(engine.cmd, argv, {
      cwd: root,
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    writeStateAtomic(dataDir, {
      spawned_date: today, spawned_at: new Date().toISOString(),
      engine: engine.cmd, running_pid: child.pid || null, last_error: null,
    });
    child.unref();
  } catch (error) {
    writeStateAtomic(dataDir, {
      spawned_date: today, spawned_at: new Date().toISOString(),
      engine: engine.cmd, running_pid: null,
      last_error: `수집을 띄우지 못했다: ${error && error.message ? error.message : String(error)}`,
    });
  }
}

let stdin = "";
try { stdin = fs.readFileSync(0, "utf8"); } catch { /* stdin 없음 */ }
try { main(stdin); } catch { /* 어떤 실패도 세션을 막지 않는다 */ }
process.exit(0);
