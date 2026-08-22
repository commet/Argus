#!/usr/bin/env node
/**
 * Argus SessionStart 훅 — 이 사람이 여기서 정해 둔 것을 세션 앞에 편다 (단계 6).
 *
 * `capture-sweep.js` 와 반대다: 저쪽은 **절대 말하지 않고**, 이쪽은 **말하는
 * 것이 일**이다. 다만 말하는 것은 사용자가 아니라 **에이전트**에게다 —
 * 도착하는 글의 형식이 곧 계약이다(기획서 §4.9).
 *
 * 규율:
 *  - **펼 것이 없으면 아무것도 안 낸다.** 침묵이 기본이다.
 *  - **원장에 안 쓴다.** 엔진 바이너리를 부른다 (관문 단일성).
 *  - **기다리는 시간에 상한이 있다.** 훅 예산은 5초다. 넘으면 이번 세션은
 *    조용히 넘기고 **왜 넘겼는지 남긴다** — 조용히 사라지지 않는다.
 *  - **절대 던지지 않고 절대 0 아닌 코드로 끝나지 않는다.**
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const STATE_FILE = "dec-brief-state.json";
const BUDGET_MS = 4000;

function parseJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

function findProjectRoot(from) {
  let dir = from;
  while (dir && dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, ".git")) || fs.existsSync(path.join(dir, ".argus"))) return dir;
    dir = path.dirname(dir);
  }
  return null;
}

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

/** 세션 시작은 기다릴 수 없는 자리라 **찬 npx 로는 부르지 않는다.** */
function resolveEngine() {
  const explicit = process.env.ARGUS_MCP_BIN;
  if (explicit && explicit.trim() !== "") {
    try { if (fs.statSync(explicit).isFile()) return { cmd: explicit, ok: true }; } catch { /* 아래로 */ }
    return { cmd: explicit, ok: false, why: `ARGUS_MCP_BIN 이 가리키는 실행 파일이 없다: ${explicit}` };
  }
  const direct = onPath("argus-decision-mcp");
  if (direct) return { cmd: direct, ok: true };
  return { cmd: null, ok: false, why: "엔진이 아직 안 깔려 있다 (세션 시작은 npx 를 기다릴 수 없다)" };
}

function writeState(argusDir, state) {
  try {
    fs.mkdirSync(argusDir, { recursive: true });
    const target = path.join(argusDir, STATE_FILE);
    const tmp = `${target}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state, null, 1), "utf8");
    fs.renameSync(tmp, target);
  } catch { /* 상태를 못 남기는 것이 세션 시작을 막지는 않는다 */ }
}

function localToday() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function main(stdinText) {
  const payload = parseJson(stdinText) || {};
  const cwd = typeof payload.cwd === "string" && payload.cwd ? payload.cwd : process.cwd();
  const root = findProjectRoot(cwd);
  if (!root) return null;                       // 저장소 밖 — 펼 것이 없다
  const argusDir = path.join(root, ".argus");
  if (!fs.existsSync(path.join(argusDir, "ledger", "ledger.jsonl"))) return null; // 아직 아무것도 안 정했다

  const engine = resolveEngine();
  if (!engine.ok) {
    writeState(argusDir, { at: new Date().toISOString(), shown: 0, last_error: engine.why });
    return null;
  }

  let raw;
  try {
    raw = execFileSync(engine.cmd, [
      "dec-brief", "--argus-dir", argusDir, "--cwd", cwd, "--today", localToday(),
    ], { cwd: root, encoding: "utf8", timeout: BUDGET_MS, maxBuffer: 4 * 1024 * 1024 });
  } catch (error) {
    writeState(argusDir, {
      at: new Date().toISOString(), shown: 0,
      last_error: `펴 보지 못했다: ${error && error.message ? String(error.message).split("\n")[0] : String(error)}`,
    });
    return null;
  }

  const result = parseJson(String(raw).trim());
  if (!result || !Array.isArray(result.say) || result.say.length === 0) {
    writeState(argusDir, { at: new Date().toISOString(), shown: 0, last_error: null });
    return null;
  }
  writeState(argusDir, {
    at: new Date().toISOString(),
    shown: Array.isArray(result.shown) ? result.shown.length : 0,
    omitted: result.omitted ?? 0,
    last_error: null,
  });
  return result.say.join("\n");
}

let stdin = "";
try { stdin = fs.readFileSync(0, "utf8"); } catch { /* stdin 없음 */ }
let context = null;
try { context = main(stdin); } catch { /* 어떤 실패도 세션 시작을 막지 않는다 */ }
if (context) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: context },
  }));
}
process.exit(0);
