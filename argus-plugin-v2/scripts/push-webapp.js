#!/usr/bin/env node
/*
 * Argus webapp bridge.
 *
 * First-class plugin path for sending local Argus artifacts to the webapp:
 *   node ${CLAUDE_PLUGIN_ROOT}/scripts/push-webapp.js connect --token <argus_pat_...>
 *   node ${CLAUDE_PLUGIN_ROOT}/scripts/push-webapp.js push
 *   node ${CLAUDE_PLUGIN_ROOT}/scripts/push-webapp.js pull
 *   node ${CLAUDE_PLUGIN_ROOT}/scripts/push-webapp.js sync
 *
 * This intentionally duplicates the small, useful bridge that first lived in
 * tools/argus-watch, so normal plugin users do not need a separate CLI.
 */
const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");
const crypto = require("crypto");
const { spawn } = require("child_process");

const args = process.argv.slice(2);
const cmd = args[0];
const flags = parseFlags(args.slice(1));
const root = findProjectRoot();

function parseFlags(items) {
  const out = { _: [] };
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (item.startsWith("--")) {
      const key = item.slice(2);
      if (i + 1 < items.length && !items[i + 1].startsWith("--")) out[key] = items[++i];
      else out[key] = true;
    } else {
      out._.push(item);
    }
  }
  return out;
}

function findProjectRoot() {
  let dir = process.cwd();
  while (dir && dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, ".git")) || fs.existsSync(path.join(dir, ".argus"))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

function argusDir() {
  return path.join(root, ".argus");
}

function ledgerDir() {
  return path.join(argusDir(), "ledger");
}

function configFile() {
  return path.join(ledgerDir(), "push.json");
}

// Restraint marker (spine): if the user declines the auto approve tab once, we
// do NOT re-open it on every later seal. Cleared the moment a real connection
// is saved. Absent = never offered / never declined.
function connectDeclinedFile() {
  return path.join(ledgerDir(), "connect-declined");
}

function ledgerFile() {
  return path.join(ledgerDir(), "ledger.jsonl");
}

function semanticLedgerFile() {
  return path.join(ledgerDir(), "semantic-v3.jsonl");
}

function pullStateFile() {
  return path.join(ledgerDir(), "pull-state.json");
}

function ensureLedgerIgnored() {
  fs.mkdirSync(argusDir(), { recursive: true });
  const gitignore = path.join(argusDir(), ".gitignore");
  let text = "";
  try {
    text = fs.readFileSync(gitignore, "utf8");
  } catch {
    text = "";
  }
  if (/^ledger\/$/m.test(text) || /^ledger\/push\.json$/m.test(text)) return;
  const prefix = text && !text.endsWith("\n") ? "\n" : "";
  fs.writeFileSync(
    gitignore,
    `${text}${prefix}# Argus: personal push token and prediction ledger.\nledger/\n`,
  );
}

function loadConfig() {
  let saved = {};
  try {
    saved = JSON.parse(fs.readFileSync(configFile(), "utf8"));
  } catch {
    saved = {};
  }
  return {
    token: flags.token || process.env.ARGUS_PUSH_TOKEN || saved.token || null,
    url: String(flags.url || process.env.ARGUS_PUSH_URL || saved.url || "https://argus.voyage").replace(/\/$/, ""),
    // Auto-sync is ON by default once connected (the first approve IS the opt-in).
    // `auto:false` is the opt-out switch: it silences the automatic post-seal push
    // (--ensure-connect) while an explicit settings push still works.
    auto: saved.auto !== false,
  };
}

function saveConfig(token, url) {
  ensureLedgerIgnored();
  fs.mkdirSync(ledgerDir(), { recursive: true });
  // Preserve other fields (e.g. the `auto` opt-out) across reconnects.
  let prev = {};
  try { prev = JSON.parse(fs.readFileSync(configFile(), "utf8")); } catch { prev = {}; }
  fs.writeFileSync(configFile(), JSON.stringify({ ...prev, token, url }, null, 2));
  // A real connection clears any prior decline — the user changed their mind.
  try { fs.unlinkSync(connectDeclinedFile()); } catch { /* never declined */ }
}

// Opt-out switch for automatic post-seal sync. Persisted in push.json.
function setAuto(on) {
  ensureLedgerIgnored();
  fs.mkdirSync(ledgerDir(), { recursive: true });
  let prev = {};
  try { prev = JSON.parse(fs.readFileSync(configFile(), "utf8")); } catch { prev = {}; }
  fs.writeFileSync(configFile(), JSON.stringify({ ...prev, auto: !!on }, null, 2));
}

function loadPullState() {
  try {
    const parsed = JSON.parse(fs.readFileSync(pullStateFile(), "utf8"));
    return {
      appliedEventIds: Array.isArray(parsed.appliedEventIds) ? parsed.appliedEventIds : [],
      lastPulledAt: parsed.lastPulledAt || null,
      // Forward page cursor (server: created_at > cursor, ascending). Without
      // it a backlog larger than one page (max 500) re-fetched the SAME first
      // page forever — every event deduped, "Pulled 0", and the tail never
      // arrived (2026-08-09 audit).
      cursor: typeof parsed.cursor === "string" ? parsed.cursor : null,
    };
  } catch {
    return { appliedEventIds: [], lastPulledAt: null, cursor: null };
  }
}

function savePullState(state) {
  ensureLedgerIgnored();
  fs.mkdirSync(ledgerDir(), { recursive: true });
  fs.writeFileSync(pullStateFile(), JSON.stringify(state, null, 2));
}

function walk(dir, depth, predicate, out = []) {
  if (depth < 0) return out;
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, depth - 1, predicate, out);
    else if (entry.isFile() && predicate(entry.name, full)) out.push(full);
  }
  return out;
}

function collectFiles() {
  const files = [];
  const ledgerPath = ledgerFile();
  if (fs.existsSync(ledgerPath)) {
    files.push({ name: "ledger.jsonl", content: fs.readFileSync(ledgerPath, "utf8") });
  }

  const sessionsDir = path.join(argusDir(), "sessions");
  const bearings = walk(
    sessionsDir,
    8,
    (name) => name === "current_bearing.json" || name === "current-bearing.json",
  );
  for (const file of bearings) {
    files.push({ name: path.relative(root, file).replace(/\\/g, "/"), content: fs.readFileSync(file, "utf8") });
  }
  return files;
}

function readLedgerEventIds() {
  const ids = new Set();
  let text = "";
  try {
    text = fs.readFileSync(ledgerFile(), "utf8").replace(/^\uFEFF/, "");
  } catch {
    return ids;
  }
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line);
      if (event.event_id) ids.add(String(event.event_id));
    } catch {
      // Corrupt lines are ignored by the ledger reader too.
    }
  }
  return ids;
}

function readSemanticEventIds() {
  const ids = new Set();
  let text = "";
  try {
    text = fs.readFileSync(semanticLedgerFile(), "utf8").replace(/^\uFEFF/, "");
  } catch {
    return ids;
  }
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line);
      if (event.event_id) ids.add(String(event.event_id));
    } catch {
      // The v3 reader preserves invalid lines as diagnostics; the bridge never
      // rewrites or erases them.
    }
  }
  return ids;
}

// ── Ledger write discipline (mirror of decision-ledger.js, which itself
// mirrors argus-mcp lib/ledger-append.ts) ──────────────────────────────────
//
// Until 2026-08-09 this file wrote the SAME ledger.jsonl with a bare
// appendFileSync — no lock (interleaves with a settle running in another
// window), no torn-tail heal (a crash-torn last line fuses with the pulled
// event and replay drops BOTH), no fsync (power loss eats a pull the CLI
// already reported as done). The lock path protocol (`${file}.lock`) matches
// decision-ledger.js so the two writers exclude each other cross-process.

const PULL_LOCK_TRIES = 60;
const PULL_LOCK_WAIT_MS = 50;
const PULL_LOCK_STALE_MS = 30_000;

function pullSleepSync(ms) {
  const buf = new SharedArrayBuffer(4);
  Atomics.wait(new Int32Array(buf), 0, 0, ms);
}

function pullLockStealable(lockPath) {
  try {
    const stat = fs.statSync(lockPath);
    return Date.now() - stat.mtimeMs > PULL_LOCK_STALE_MS;
  } catch {
    return false;
  }
}

function pullWithFileLockSync(file, fn) {
  const lockPath = `${file}.lock`;
  const nonce = crypto.randomUUID();
  const body = JSON.stringify({ nonce, pid: process.pid, started_at: new Date().toISOString() });
  const tmp = `${lockPath}.${nonce}.tmp`;
  let acquired = false;
  for (let i = 0; i < PULL_LOCK_TRIES && !acquired; i++) {
    try {
      fs.writeFileSync(tmp, body, "utf8");
      fs.linkSync(tmp, lockPath);
      acquired = true;
    } catch (error) {
      if (error && error.code !== "EEXIST") {
        try {
          const fd = fs.openSync(lockPath, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY);
          fs.writeSync(fd, body, null, "utf8");
          fs.closeSync(fd);
          acquired = true;
        } catch { /* another writer holds the lock */ }
      }
      if (!acquired) {
        if (pullLockStealable(lockPath)) {
          try {
            const grave = `${lockPath}.stale-${nonce}`;
            fs.renameSync(lockPath, grave);
            fs.unlinkSync(grave);
          } catch { /* another contender won the steal */ }
          continue;
        }
        pullSleepSync(PULL_LOCK_WAIT_MS);
      }
    } finally {
      try { fs.unlinkSync(tmp); } catch { /* linked or never created */ }
    }
  }
  if (!acquired) throw new Error(`ARGUS_LEDGER_BUSY: could not acquire ${lockPath}; nothing was written`);
  try {
    return fn();
  } finally {
    try {
      const current = JSON.parse(fs.readFileSync(lockPath, "utf8"));
      if (current.nonce === nonce) fs.unlinkSync(lockPath);
    } catch { /* gone, malformed, or no longer ours */ }
  }
}

function pullNeedsLeadingNewline(file) {
  let fd;
  try {
    const size = fs.statSync(file).size;
    if (size === 0) return false;
    fd = fs.openSync(file, fs.constants.O_RDONLY);
    const buf = Buffer.alloc(1);
    fs.readSync(fd, buf, 0, 1, size - 1);
    return buf[0] !== 0x0a;
  } catch {
    return false;
  } finally {
    if (fd !== undefined) { try { fs.closeSync(fd); } catch { /* already closed */ } }
  }
}

function pullAppendJsonlBatch(file, objects) {
  return pullWithFileLockSync(file, () => {
    const body = objects.map((object) => JSON.stringify(object)).join("\n") + "\n";
    const lines = (pullNeedsLeadingNewline(file) ? "\n" : "") + body;
    let fd;
    try {
      fd = fs.openSync(file, fs.constants.O_APPEND | fs.constants.O_CREAT | fs.constants.O_WRONLY);
      fs.writeSync(fd, lines, null, "utf8");
      try {
        fs.fsyncSync(fd);
      } catch (error) {
        if (!["EINVAL", "ENOTSUP", "EOPNOTSUPP"].includes(error && error.code)) throw error;
      }
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
    }
  });
}

// Network events cross a trust boundary before they land in the permanent
// ledger (same rule as argus-mcp sync.ts, where `outcome:"constructor"` once
// slipped through a prototype chain). Strings are stripped of control chars
// and capped at 4000 chars WITH a visible marker — silent truncation would
// make the record lie about itself.
const PULL_TEXT_CAP = 4000;
const PULL_BANNED_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function sanitizeWebValue(value, depth = 0) {
  if (depth > 8) return null;
  if (typeof value === "string") {
    const clean = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
    return clean.length > PULL_TEXT_CAP ? `${clean.slice(0, PULL_TEXT_CAP)}…(truncated)` : clean;
  }
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, 200).map((item) => sanitizeWebValue(item, depth + 1));
  if (typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value)) {
      if (PULL_BANNED_KEYS.has(key)) continue;
      out[key] = sanitizeWebValue(value[key], depth + 1);
    }
    return out;
  }
  return null; // functions/symbols cannot come from JSON; drop honestly
}

function appendWebEvent(event) {
  if (!event || typeof event !== "object") throw new Error("web event payload is not an object");
  if (!event.event || !event.id) throw new Error("web event payload must include event and id");
  if (typeof event.event !== "string" || !/^[a-z0-9_.-]{1,64}$/i.test(event.event)) {
    throw new Error(`web event has an invalid event kind: ${String(event.event).slice(0, 80)}`);
  }
  ensureLedgerIgnored();
  fs.mkdirSync(ledgerDir(), { recursive: true });
  const line = sanitizeWebValue({
    ...event,
    origin: event.origin || "webapp",
    pulled_at: new Date().toISOString(),
  });
  pullAppendJsonlBatch(ledgerFile(), [line]);
}

/** Append an already-shaped v3 event byte-for-byte in meaning. Unlike the v2
 * bridge payload, this is an event ledger, not a mutable projection. */
function appendSemanticEvents(events) {
  if (!Array.isArray(events) || events.length === 0) throw new Error("semantic event batch is empty");
  for (const event of events) {
    if (!event || typeof event !== "object" || !event.event || !event.event_id || event.v !== 3) {
      throw new Error("semantic event batch contains an invalid v3 envelope");
    }
  }
  ensureLedgerIgnored();
  fs.mkdirSync(ledgerDir(), { recursive: true });
  pullAppendJsonlBatch(semanticLedgerFile(), events.map((event) => sanitizeWebValue(event)));
}

function postJson(url, body, headers) {
  const target = new URL(url);
  const client = target.protocol === "http:" ? http : https;
  const payload = JSON.stringify(body);
  const options = {
    method: "POST",
    hostname: target.hostname,
    port: target.port || (target.protocol === "http:" ? 80 : 443),
    path: `${target.pathname}${target.search}`,
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload),
      ...headers,
    },
  };

  return new Promise((resolve, reject) => {
    const req = client.request(options, (res) => {
      let raw = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { raw += chunk; });
      res.on("end", () => {
        let data = {};
        try {
          data = raw ? JSON.parse(raw) : {};
        } catch {
          data = { raw };
        }
        resolve({ status: res.statusCode || 0, ok: (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300, data });
      });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function getJson(url, headers) {
  const target = new URL(url);
  const client = target.protocol === "http:" ? http : https;
  const options = {
    method: "GET",
    hostname: target.hostname,
    port: target.port || (target.protocol === "http:" ? 80 : 443),
    path: `${target.pathname}${target.search}`,
    headers,
  };

  return new Promise((resolve, reject) => {
    const req = client.request(options, (res) => {
      let raw = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { raw += chunk; });
      res.on("end", () => {
        let data = {};
        try {
          data = raw ? JSON.parse(raw) : {};
        } catch {
          data = { raw };
        }
        resolve({ status: res.statusCode || 0, ok: (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300, data });
      });
    });
    req.on("error", reject);
    req.end();
  });
}

// ── 무념 연동 (BLUEPRINT §9.9 V1) — 승인 탭 1회, 복붙 0 ──────────────
// 정본은 argus-mcp/src/a0/account-connect.ts (PKCE loopback + device 폴백).
// 여기서 얻는 access_token은 argus_pat_ 이며, /api/mcp/oauth/token 이 승인 후
// plugin_tokens 테이블에 민팅하므로 /api/plugin/ingest(=push/pull)에 그대로 유효.
function base64url(bytes) {
  return crypto.randomBytes(bytes).toString("base64url");
}
function pkceChallenge(verifier) {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}
function openBrowser(targetUrl) {
  const command = process.platform === "win32" ? "explorer.exe" : process.platform === "darwin" ? "open" : "xdg-open";
  try {
    const child = spawn(command, [targetUrl], { detached: true, stdio: "ignore", windowsHide: true });
    child.unref();
    return true;
  } catch {
    return false;
  }
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function tokenFromResponse(data) {
  if (!data || typeof data.access_token !== "string" || !data.access_token.startsWith("argus_pat_")) {
    throw new Error("The account returned an invalid credential.");
  }
  return data.access_token;
}

async function connectWithBrowser(url) {
  const verifier = base64url(48);
  const state = base64url(24);
  const server = http.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const redirectUri = `http://127.0.0.1:${server.address().port}/callback`;

  const codePromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Account connection timed out.")), 5 * 60 * 1000);
    server.on("request", (request, response) => {
      const reqUrl = new URL(request.url || "/", "http://127.0.0.1");
      if (reqUrl.pathname !== "/callback") {
        response.writeHead(404).end("Not found");
        return;
      }
      const code = reqUrl.searchParams.get("code");
      if (!code || reqUrl.searchParams.get("state") !== state) {
        response.writeHead(400, { "content-type": "text/plain; charset=utf-8" }).end("Invalid or expired Argus connection.");
        return;
      }
      clearTimeout(timer);
      response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" })
        .end('<!doctype html><meta charset="utf-8"><title>Argus connected</title><body style="font:16px system-ui;max-width:38rem;margin:15vh auto;padding:2rem"><h1>Argus 계정이 연결됐어요</h1><p>이 창을 닫고 터미널로 돌아가면 됩니다.</p></body>');
      resolve(code);
    });
  });

  const authorize = new URL(`${url}/en/auth/callback/mcp-connect`);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("code_challenge", pkceChallenge(verifier));
  authorize.searchParams.set("code_challenge_method", "S256");
  authorize.searchParams.set("client_name", "Argus Plugin");

  console.log("브라우저에서 Argus 승인 탭을 열게요…");
  if (!openBrowser(authorize.toString())) {
    console.log(`브라우저가 안 열리면 이 주소를 여세요:\n${authorize.toString()}`);
  }

  try {
    const code = await codePromise;
    const res = await postJson(`${url}/api/mcp/oauth/token`, {
      grant_type: "authorization_code",
      code,
      code_verifier: verifier,
      redirect_uri: redirectUri,
    });
    if (!res.ok) throw new Error(`토큰 교환 실패 (${res.data.error || res.status}).`);
    return tokenFromResponse(res.data);
  } finally {
    server.close();
  }
}

async function connectWithDevice(url) {
  const start = await postJson(`${url}/api/mcp/oauth/device`, { client_name: "Argus Plugin" });
  if (!start.ok || !start.data.device_code || !start.data.user_code || !start.data.verification_uri) {
    throw new Error(`기기 승인을 시작하지 못했어요 (${start.data.error || start.status}).`);
  }
  let interval = typeof start.data.interval === "number" ? Math.max(1, start.data.interval) : 5;
  const deadline = Date.now() + (typeof start.data.expires_in === "number" ? start.data.expires_in : 600) * 1000;
  console.log(`${start.data.verification_uri} 를 열고 코드를 입력하세요: ${start.data.user_code}`);
  while (Date.now() < deadline) {
    await sleep(interval * 1000);
    const poll = await postJson(`${url}/api/mcp/oauth/token`, {
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      device_code: start.data.device_code,
    });
    if (poll.ok) return tokenFromResponse(poll.data);
    const err = poll.data.error;
    if (err === "authorization_pending") continue;
    if (err === "slow_down") { interval += 5; continue; }
    if (err === "access_denied") throw new Error("연동이 거절됐어요.");
    if (err === "expired_token") break;
    throw new Error(`기기 승인 실패 (${err || poll.status}).`);
  }
  throw new Error("기기 승인이 만료됐어요. 다시 시도하세요.");
}

async function connect() {
  const url = String(flags.url || process.env.ARGUS_PUSH_URL || "https://argus.voyage").replace(/\/$/, "");
  const explicitToken = flags.token || flags._[0];

  // Advanced/CI: an explicit argus_pat_ still works, no browser needed.
  if (explicitToken && String(explicitToken).startsWith("argus_pat_")) {
    saveConfig(String(explicitToken), url);
    console.log("Argus webapp connection saved.");
    console.log(`Token is stored locally at ${path.relative(root, configFile()).replace(/\\/g, "/")} and ignored by git.`);
    return;
  }

  // Default: one approve tap — no token to copy-paste. The approve click IS the
  // opt-in (BLUEPRINT §9.4 egress-0-before-opt-in; never a zero-click upload).
  let token;
  try {
    token = flags.headless ? await connectWithDevice(url) : await connectWithBrowser(url);
  } catch (error) {
    console.error(`연동 실패: ${error.message}`);
    process.exit(1);
  }
  saveConfig(token, url);
  console.log("연결됐어요. 이제 봉인할 때마다 판단 기록이 자동으로 웹앱 항구에 닿습니다.");
  console.log(`토큰은 ${path.relative(root, configFile()).replace(/\\/g, "/")} 에 로컬 저장되고 git에서 제외됩니다.`);
  console.log("자동 전송을 끄려면 /argus:settings push --auto off (언제든 다시 --auto on).");
}

async function push() {
  const config = loadConfig();
  let { token, url } = config;

  // Opt-out toggle: `settings push --auto off` silences automatic post-seal
  // sync (an explicit settings push still works); `--auto on` re-enables it.
  if (flags.auto === "on" || flags.auto === "off") {
    setAuto(flags.auto === "on");
    console.log(flags.auto === "on"
      ? "자동 동기화 켜짐 — 봉인할 때마다 웹앱으로 자동 전송."
      : "자동 동기화 꺼짐 — /argus:settings push 로 수동 전송하세요.");
    return;
  }

  // The AUTOMATIC path (called after each seal via --ensure-connect). If the user
  // turned auto-sync off, this is a silent no-op; explicit settings push is unaffected.
  if (flags["ensure-connect"] && config.auto === false) return;

  // Auto-trigger (BLUEPRINT §9.9 V1): the seal path calls `push --ensure-connect`.
  // First seal with no credential → open the approve tab once. The approve click
  // IS the opt-in; nothing uploads before it. The seal is already durable in the
  // local ledger, so declining loses the sync, never the decision.
  if (!token && flags["ensure-connect"]) {
    if (fs.existsSync(connectDeclinedFile())) return; // declined before — never nag (spine)
    console.log("웹앱에서 정산 알림·항해 지도를 받으려면 승인 한 번이면 돼요. 브라우저 탭을 엽니다…");
    try {
      token = flags.headless ? await connectWithDevice(url) : await connectWithBrowser(url);
      saveConfig(token, url);
      console.log("연결됐어요. 방금 봉인한 결정을 웹앱으로 보냅니다.");
      console.log("이후 봉인은 자동으로 전송돼요. 끄려면 /argus:settings push --auto off.");
    } catch (error) {
      try { fs.writeFileSync(connectDeclinedFile(), new Date().toISOString()); } catch { /* best effort */ }
      console.log(`웹앱 연동은 건너뜁니다 (${error.message}). 결정은 로컬에 안전히 봉인됐고, 언제든 /argus:settings connect 로 이어붙일 수 있어요.`);
      return;
    }
  }

  if (!token) {
    console.error("아직 웹앱에 연결 안 됐어요. /argus:settings connect 를 먼저 실행하세요 (승인 탭 1회).");
    process.exit(1);
  }
  const files = collectFiles();
  if (files.length === 0) {
    console.log("Nothing to push yet. Run /argus:review, /argus:history scan, or /argus:check first.");
    return;
  }
  const bytes = files.reduce((sum, file) => sum + Buffer.byteLength(file.content), 0);
  if (bytes > 15 * 1024 * 1024) {
    console.error("Push payload is over 15MB. Remove old session artifacts or use manual import.");
    process.exit(1);
  }

  console.log(`Pushing ${files.length} Argus artifact(s) to ${url}...`);
  let res;
  try {
    res = await postJson(`${url}/api/plugin/ingest`, { files }, { Authorization: `Bearer ${token}` });
  } catch (error) {
    console.error(`Push failed: ${error.message}`);
    process.exit(1);
  }
  if (!res.ok) {
    console.error(`Push failed (${res.status}): ${res.data.error || "unknown error"}`);
    if (res.status === 401) console.error("연결이 만료·철회됐을 수 있어요. /argus:settings connect 를 다시 실행해 승인하세요.");
    process.exit(1);
  }
  const summary = res.data.summary || {};
  console.log(`Pushed. Decisions: ${summary.decisions?.written || 0}; headings: ${summary.bearings?.written || 0}.`);
  if (Array.isArray(summary.skipped) && summary.skipped.length) {
    console.log(`Skipped ${summary.skipped.length} artifact(s) with unrecognized shape.`);
  }
  console.log(`Open in webapp: ${url}/import`);
}

async function pull() {
  const { token, url } = loadConfig();
  if (!token) {
    console.error("아직 웹앱에 연결 안 됐어요. /argus:settings connect 를 먼저 실행하세요 (승인 탭 1회).");
    process.exit(1);
  }

  const state = loadPullState();
  const applied = new Set(state.appliedEventIds);
  for (const id of readLedgerEventIds()) applied.add(id);
  for (const id of readSemanticEventIds()) applied.add(id);

  const limit = Number(flags.limit || 200);
  const endpoint = new URL(`${url}/api/plugin/events`);
  endpoint.searchParams.set("limit", String(Math.max(1, Math.min(500, limit || 200))));
  // Manual --after wins; otherwise resume from the saved cursor so a backlog
  // longer than one page advances instead of re-reading page one forever.
  const afterCursor = flags.after ? String(flags.after) : state.cursor;
  if (afterCursor) endpoint.searchParams.set("after", afterCursor);

  let res;
  try {
    res = await getJson(endpoint.toString(), { Authorization: `Bearer ${token}` });
  } catch (error) {
    console.error(`Pull failed: ${error.message}`);
    process.exit(1);
  }
  if (!res.ok) {
    console.error(`Pull failed (${res.status}): ${res.data.error || "unknown error"}`);
    if (res.status === 401) console.error("연결이 만료·철회됐을 수 있어요. /argus:settings connect 를 다시 실행해 승인하세요.");
    process.exit(1);
  }

  const events = Array.isArray(res.data.events) ? res.data.events : [];
  let written = 0;
  let skipped = 0;
  // The page is created_at-ascending; the last item's stamp is the next cursor.
  // The dedup set covers the `>` boundary (an equal-stamp sibling on the next
  // page would be filtered by the server; the applied-ids set catches re-reads).
  let nextCursor = state.cursor;
  for (const item of events) {
    if (item && typeof item.created_at === "string" && (!nextCursor || item.created_at > nextCursor)) {
      nextCursor = item.created_at;
    }
  }
  for (const item of events) {
    const eventId = item && item.event_id ? String(item.event_id) : null;
    if (!eventId || applied.has(eventId)) {
      skipped += 1;
      continue;
    }
    const payload = item.payload && typeof item.payload === "object" ? item.payload : null;
    if (!payload) {
      skipped += 1;
      continue;
    }
    if (item.event === "semantic_v3") {
      const semanticEvents = Array.isArray(payload.semantic_events) ? payload.semantic_events : null;
      if (!semanticEvents || semanticEvents.length === 0) {
        skipped += 1;
        continue;
      }
      try {
        appendSemanticEvents(semanticEvents);
      } catch (error) {
        console.error(`Skipped invalid semantic batch ${eventId}: ${error.message}`);
        skipped += 1;
        continue;
      }
      applied.add(eventId);
      for (const semanticEvent of semanticEvents) {
        if (semanticEvent && semanticEvent.event_id) applied.add(String(semanticEvent.event_id));
      }
      written += semanticEvents.length;
      continue;
    }
    appendWebEvent({ ...payload, event_id: eventId });
    applied.add(eventId);
    written += 1;
  }

  savePullState({
    appliedEventIds: [...applied].slice(-5000),
    lastPulledAt: new Date().toISOString(),
    cursor: nextCursor,
  });

  console.log(`Pulled ${written} web event(s) into ${path.relative(root, ledgerFile()).replace(/\\/g, "/")}.`);
  if (skipped) console.log(`Skipped ${skipped} already-applied or invalid event(s).`);
  // A full page means more may be waiting — say so instead of letting the user
  // believe the pull was complete (no-silent-caps).
  if (events.length >= Math.max(1, Math.min(500, limit || 200))) {
    console.log("More events may remain — run pull again to continue from the saved cursor.");
  }
}

async function sync() {
  await pull();
  await push();
}

async function status() {
  const { token, url } = loadConfig();
  const files = collectFiles();
  const state = loadPullState();
  console.log(`Webapp: ${url}`);
  console.log(`Token: ${token ? "configured" : "not configured"}`);
  console.log(`Artifacts ready: ${files.length}`);
  console.log(`Web events applied: ${state.appliedEventIds.length}`);
  console.log(`Last pull: ${state.lastPulledAt || "never"}`);
}

const commands = { connect, push, pull, sync, status };
if (!cmd || !commands[cmd]) {
  console.log("Usage:");
  console.log("  /argus:settings connect (브라우저 승인 탭 1회 — 복붙 없음)");
  console.log("  /argus:settings push");
  console.log("  /argus:settings pull");
  console.log("  /argus:settings sync");
  console.log("  /argus:settings push --status");
  process.exit(cmd ? 1 : 0);
}

if (cmd === "push" && flags.status) {
  status().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
} else {
  commands[cmd]().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
