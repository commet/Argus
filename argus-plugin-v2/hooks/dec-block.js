#!/usr/bin/env node
/**
 * Argus PreToolUse 훅 — 하지 않기로 정한 일을 **실제로 막는다** (단계 9, L3).
 *
 * `dec-watch.js` 의 쌍둥이지만 세 가지가 반대다:
 *  - 저쪽은 손이 움직인 **뒤**(PostToolUse), 이쪽은 **전**(PreToolUse)
 *  - 저쪽은 **절대 2로 안 끝나고**, 이쪽은 막을 때 **2로 끝난다**
 *  - 저쪽은 하루 3번 상한이 있고, 이쪽은 **없다** — 막는 것은 발화가 아니다.
 *    금지가 하루 세 번 뒤부터 안 막히면 그건 잠긴 문이 아니다.
 *
 * 막는 것은 **금지형(`ban`)뿐**이다. 그 판정은 엔진이 한다 (`dec-block`).
 *
 * **판정을 못 하면 안 막는다.** 엔진이 없거나·느리거나·원장을 못 읽으면
 * 조용히 통과시킨다. 기획서 §4.1 의 fail-closed 는 *"기록을 남길 수 없으면
 * 영향력 0"* 이라는 뜻이다 — 반대로 걸면 원장 한 줄이 깨졌을 때 사람의
 * 하루가 통째로 멈춘다. **막는 쪽이 안전한 기본값이 아니다.**
 *
 * **우회 방법을 안 적는다.** 문장은 전부 엔진이 만든다(`block/say.ts`) —
 * 훅이 친절을 보태면 잠긴 문마다 열쇠 설명서가 붙는다 (기획서 §4.3).
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const BUDGET_MS = 4000;

const parseJson = (t) => { try { return JSON.parse(t); } catch { return null; } };

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

function resolveEngine() {
  const explicit = process.env.ARGUS_MCP_BIN;
  if (explicit && explicit.trim() !== "") {
    try { if (fs.statSync(explicit).isFile()) return explicit; } catch { return null; }
    return null;
  }
  return onPath("argus-decision-mcp");
}

/**
 * 무엇을 볼 것인가.
 *
 * `Bash` 는 **명령 문자열**이 곧 하려는 일이라 말 채널로 본다.
 * `Write`·`Edit` 는 **고치려는 파일**이다. 파일 내용은 안 보낸다 — 훅은
 * 편집마다 오고, 본문을 통째로 넘기면 느려지고 내용이 프로세스 인자로 샌다.
 */
function subjectOf(payload) {
  const input = payload.tool_input || {};
  if (payload.tool_name === "Bash") {
    const command = typeof input.command === "string" ? input.command.trim() : "";
    return command ? ["--text", command.slice(0, 2000)] : null;
  }
  const file = typeof input.file_path === "string" ? input.file_path : null;
  return file ? ["--file", file] : null;
}

function main(stdinText) {
  const payload = parseJson(stdinText) || {};
  const cwd = typeof payload.cwd === "string" && payload.cwd ? payload.cwd : process.cwd();
  const root = findProjectRoot(cwd);
  if (!root) return null;
  const argusDir = path.join(root, ".argus");
  if (!fs.existsSync(path.join(argusDir, "ledger", "ledger.jsonl"))) return null;

  const subject = subjectOf(payload);
  if (!subject) return null;
  const engine = resolveEngine();
  if (!engine) return null;

  let raw;
  try {
    raw = execFileSync(engine, ["dec-block", "--argus-dir", argusDir, ...subject],
      { cwd: root, encoding: "utf8", timeout: BUDGET_MS, maxBuffer: 2 * 1024 * 1024 });
  } catch {
    return null;   // 못 물어봤으면 못 막는다
  }

  const result = parseJson(String(raw).trim());
  if (!result || result.block !== true || !Array.isArray(result.say) || result.say.length === 0) return null;
  return result.say.join("\n");
}

let stdin = "";
try { stdin = fs.readFileSync(0, "utf8"); } catch { /* stdin 없음 */ }
let deny = null;
try { deny = main(stdin); } catch { deny = null; }   // 훅이 깨지면 통과다
if (deny) {
  process.stderr.write(`${deny}\n`);
  process.exit(2);
}
process.exit(0);
