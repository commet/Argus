#!/usr/bin/env node
/**
 * Argus 훅 — 정해 둔 것에 어긋나면 한 줄 알린다 (단계 7).
 *
 * 두 자리에서 같은 일을 한다:
 *  - `PostToolUse(Write|Edit)` — 어떤 파일을 고쳤나
 *  - `UserPromptSubmit`        — 무슨 말이 오갔나
 *
 * **막지 않는다.** 막는 것은 뒤 단계의 일이고, 여기는 알리는 자리다.
 * 어긋났다고 손을 붙잡으면 사람은 읽지도 않은 법에 갇힌다.
 *
 * 규율:
 *  - **말할지 말지 판정이 형태보다 먼저다.** 판정은 엔진이 한다 (하루 3번 ·
 *    세션당 결정 하나 · 잘못 잡았다고 세 번 들으면 그 규칙은 침묵).
 *  - **일이 없으면 프로세스도 안 띄운다.** 원장이 없거나 오늘 몫을 다 썼으면
 *    엔진을 안 부른다 — 이 훅은 파일을 고칠 때마다 온다.
 *  - **절대 던지지 않고 절대 0 아닌 코드로 끝나지 않는다.**
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const BUDGET_MS = 4000;
const DAILY_LIMIT = 3;

const parseJson = (t) => { try { return JSON.parse(t); } catch { return null; } };
const readJsonFile = (f) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } };

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
  return onPath("argus-decision-mcp");   // 찬 npx 를 매 편집마다 기다릴 수는 없다
}

function localToday() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 무엇을 볼 것인가 — 파일 하나, 아니면 사람이 한 말. */
function subjectOf(payload) {
  if (payload.hook_event_name === "UserPromptSubmit") {
    const prompt = typeof payload.prompt === "string" ? payload.prompt.trim() : "";
    return prompt ? ["--text", prompt.slice(0, 2000)] : null;
  }
  const input = payload.tool_input;
  const file = input && typeof input.file_path === "string" ? input.file_path : null;
  return file ? ["--file", file] : null;
}

function main(stdinText) {
  const payload = parseJson(stdinText) || {};
  const cwd = typeof payload.cwd === "string" && payload.cwd ? payload.cwd : process.cwd();
  const root = findProjectRoot(cwd);
  if (!root) return null;
  const argusDir = path.join(root, ".argus");
  if (!fs.existsSync(path.join(argusDir, "ledger", "ledger.jsonl"))) return null;

  const today = localToday();
  // 오늘 몫을 다 썼으면 엔진도 안 띄운다 (이 훅은 편집마다 온다).
  const spoken = readJsonFile(path.join(argusDir, "dec-spoken.json"));
  if (spoken && spoken.date === today && (spoken.count || 0) >= DAILY_LIMIT) return null;

  const subject = subjectOf(payload);
  if (!subject) return null;
  const engine = resolveEngine();
  if (!engine) return null;   // 아직 안 깔렸다 — 조용히 넘긴다 (세션 시작 훅이 이유를 남긴다)

  let raw;
  try {
    raw = execFileSync(engine, [
      "dec-check", "--argus-dir", argusDir, "--today", today,
      "--session-id", typeof payload.session_id === "string" ? payload.session_id : "unknown",
      ...subject,
    ], { cwd: root, encoding: "utf8", timeout: BUDGET_MS, maxBuffer: 2 * 1024 * 1024 });
  } catch { return null; }

  const result = parseJson(String(raw).trim());
  if (!result || result.spoke !== true || !Array.isArray(result.say) || result.say.length === 0) return null;
  return [
    "[Argus: 아래 줄을 사용자에게 그대로 전하라. 네 말을 보태지 마라.]",
    ...result.say,
  ].join("\n");
}

let stdin = "";
try { stdin = fs.readFileSync(0, "utf8"); } catch { /* stdin 없음 */ }
let context = null;
try { context = main(stdin); } catch { /* 어떤 실패도 작업을 막지 않는다 */ }
if (context) {
  const payload = parseJson(stdin) || {};
  const event = payload.hook_event_name === "UserPromptSubmit" ? "UserPromptSubmit" : "PostToolUse";
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: event, additionalContext: context },
  }));
}
process.exit(0);
