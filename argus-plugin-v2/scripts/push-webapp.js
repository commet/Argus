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
  };
}

function saveConfig(token, url) {
  ensureLedgerIgnored();
  fs.mkdirSync(ledgerDir(), { recursive: true });
  fs.writeFileSync(configFile(), JSON.stringify({ token, url }, null, 2));
}

function loadPullState() {
  try {
    const parsed = JSON.parse(fs.readFileSync(pullStateFile(), "utf8"));
    return {
      appliedEventIds: Array.isArray(parsed.appliedEventIds) ? parsed.appliedEventIds : [],
      lastPulledAt: parsed.lastPulledAt || null,
    };
  } catch {
    return { appliedEventIds: [], lastPulledAt: null };
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

function appendWebEvent(event) {
  if (!event || typeof event !== "object") throw new Error("web event payload is not an object");
  if (!event.event || !event.id) throw new Error("web event payload must include event and id");
  ensureLedgerIgnored();
  fs.mkdirSync(ledgerDir(), { recursive: true });
  const line = {
    ...event,
    origin: event.origin || "webapp",
    pulled_at: new Date().toISOString(),
  };
  fs.appendFileSync(ledgerFile(), `${JSON.stringify(line)}\n`);
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
  fs.appendFileSync(semanticLedgerFile(), `${events.map((event) => JSON.stringify(event)).join("\n")}\n`);
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

async function connect() {
  const token = flags.token || flags._[0];
  if (!token || !String(token).startsWith("argus_pat_")) {
    console.error("Usage: /argus:connect <argus_pat_...> or /argus:connect --token <argus_pat_...>");
    process.exit(1);
  }
  const url = String(flags.url || process.env.ARGUS_PUSH_URL || "https://argus.voyage").replace(/\/$/, "");
  saveConfig(String(token), url);
  console.log("Argus webapp connection saved.");
  console.log(`Token is stored locally at ${path.relative(root, configFile()).replace(/\\/g, "/")} and ignored by git.`);
  console.log("Next: /argus:push");
}

async function push() {
  const { token, url } = loadConfig();
  if (!token) {
    console.error("No webapp token found. Run /argus:connect <argus_pat_...> first.");
    process.exit(1);
  }
  const files = collectFiles();
  if (files.length === 0) {
    console.log("Nothing to push yet. Run /argus:sail, /argus:scan, or /argus:settle first.");
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
    if (res.status === 401) console.error("The token may be revoked or invalid. Issue a new token in the webapp settings, then run /argus:connect again.");
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
    console.error("No webapp token found. Run /argus:connect <argus_pat_...> first.");
    process.exit(1);
  }

  const state = loadPullState();
  const applied = new Set(state.appliedEventIds);
  for (const id of readLedgerEventIds()) applied.add(id);
  for (const id of readSemanticEventIds()) applied.add(id);

  const limit = Number(flags.limit || 200);
  const endpoint = new URL(`${url}/api/plugin/events`);
  endpoint.searchParams.set("limit", String(Math.max(1, Math.min(500, limit || 200))));
  if (flags.after) endpoint.searchParams.set("after", String(flags.after));

  let res;
  try {
    res = await getJson(endpoint.toString(), { Authorization: `Bearer ${token}` });
  } catch (error) {
    console.error(`Pull failed: ${error.message}`);
    process.exit(1);
  }
  if (!res.ok) {
    console.error(`Pull failed (${res.status}): ${res.data.error || "unknown error"}`);
    if (res.status === 401) console.error("The token may be revoked or invalid. Issue a new token in the webapp settings, then run /argus:connect again.");
    process.exit(1);
  }

  const events = Array.isArray(res.data.events) ? res.data.events : [];
  let written = 0;
  let skipped = 0;
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
  });

  console.log(`Pulled ${written} web event(s) into ${path.relative(root, ledgerFile()).replace(/\\/g, "/")}.`);
  if (skipped) console.log(`Skipped ${skipped} already-applied or invalid event(s).`);
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
  console.log("  /argus:connect <argus_pat_...>");
  console.log("  /argus:push");
  console.log("  /argus:pull");
  console.log("  /argus:sync");
  console.log("  /argus:push --status");
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
