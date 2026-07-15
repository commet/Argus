#!/usr/bin/env node
/*
 * Argus decision ledger utility.
 *
 * Product shape:
 *   /argus:sail and /argus:scan are entry points.
 *   /argus:predict and /argus:resolve are common ledger state changes.
 *
 * This script absorbs the useful argus-watch scan/seal path into the plugin
 * bundle, so normal plugin users do not install a second CLI.
 */
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { execFile } = require("child_process");

const args = process.argv.slice(2);
const cmd = args[0];
const flags = parseFlags(args.slice(1));
const root = findProjectRoot();

const TYPES = new Set(["direction", "scope", "kill", "adopt", "defer", "constraint", "approval"]);
const STAKES = new Set(["high", "medium", "low"]);

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

function ledgerFile() {
  return path.join(ledgerDir(), "ledger.jsonl");
}

function scanStateFile() {
  return path.join(ledgerDir(), "scan-state.json");
}

function rel(file) {
  return path.relative(root, file).replace(/\\/g, "/");
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
  if (/^ledger\/$/m.test(text)) return;
  const prefix = text && !text.endsWith("\n") ? "\n" : "";
  fs.writeFileSync(gitignore, `${text}${prefix}# Argus: personal prediction ledger.\nledger/\n`);
}

function appendEvent(event) {
  ensureLedgerIgnored();
  fs.mkdirSync(ledgerDir(), { recursive: true });
  fs.appendFileSync(ledgerFile(), `${JSON.stringify({ ...event, at: new Date().toISOString() })}\n`);
}

function loadLedger() {
  const map = new Map();
  let text = "";
  try {
    text = fs.readFileSync(ledgerFile(), "utf8").replace(/^\uFEFF/, "");
  } catch {
    return map;
  }
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    const cur = map.get(event.id);
    switch (event.event) {
      case "harvest":
        if (!cur) {
          map.set(event.id, {
            id: event.id,
            status: "candidate",
            harvested_at: event.at,
            project: event.project,
            session: event.session,
            decided_at: event.decided_at,
            quote: event.quote,
            decision: event.decision,
            type: event.type,
            stakes: event.stakes,
            history: [],
          });
        }
        break;
      case "seal":
        if (cur) {
          Object.assign(cur, {
            status: "sealed",
            sealed_at: event.at,
            predicate: event.predicate,
            falsified_if: event.falsified_if,
            check_by: event.check_by,
            author: event.author,
          });
        }
        break;
      case "amend":
        if (cur) {
          cur.history.push({
            predicate: cur.predicate,
            falsified_if: cur.falsified_if,
            check_by: cur.check_by,
            amended_at: event.at,
          });
          Object.assign(cur, {
            predicate: event.predicate || cur.predicate,
            falsified_if: event.falsified_if || cur.falsified_if,
            check_by: event.check_by || cur.check_by,
          });
        }
        break;
      case "dismiss":
        if (cur) {
          cur.status = "dismissed";
          cur.dismissed_at = event.at;
          cur.dismiss_reason = event.reason;
        }
        break;
      case "settle":
        if (cur) {
          cur.status = "settled";
          cur.outcome = event.outcome;
          cur.settled_at = event.at;
          cur.settle_note = event.note;
          cur.basis = event.basis;
        }
        break;
    }
  }
  return map;
}

function loadScanState() {
  try {
    return JSON.parse(fs.readFileSync(scanStateFile(), "utf8"));
  } catch {
    return { files: {} };
  }
}

function saveScanState(state) {
  ensureLedgerIgnored();
  fs.mkdirSync(ledgerDir(), { recursive: true });
  fs.writeFileSync(scanStateFile(), JSON.stringify(state, null, 2));
}

function localToday(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function addDaysISO(todayISO, days) {
  const parts = todayISO.split("-").map(Number);
  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]) + days * 86400000).toISOString().slice(0, 10);
}

function stableId(sessionId, quote) {
  return crypto.createHash("sha256").update(`${sessionId}|${quote}`).digest("hex").slice(0, 8);
}

function truncate(text, max = 90) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  return value.length > max ? `${value.slice(0, max - 1)}...` : value;
}

function slugVariants(projectDir) {
  const abs = path.resolve(projectDir);
  const raw = abs.replace(/[^A-Za-z0-9]/g, "-");
  const variants = new Set([raw, raw.toLowerCase()]);
  const parts = abs.split(/[\\/]+/).filter(Boolean);
  for (let n = 3; n <= Math.min(6, parts.length); n += 1) {
    const tail = parts.slice(-n).join("-").replace(/[^A-Za-z0-9]/g, "-");
    variants.add(tail);
    variants.add(tail.toLowerCase());
  }
  return variants;
}

function transcriptRoot() {
  return path.join(os.homedir(), ".claude", "projects");
}

function discoverTranscripts({ all = false, projectDir = process.cwd() } = {}) {
  const base = transcriptRoot();
  if (!fs.existsSync(base)) return [];
  const dirs = [];
  if (all) {
    for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
      if (entry.isDirectory()) dirs.push(path.join(base, entry.name));
    }
  } else {
    const variants = slugVariants(projectDir);
    for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const name = entry.name;
      const lower = name.toLowerCase();
      if (variants.has(name) || variants.has(lower) || [...variants].some((v) => lower.endsWith(v.toLowerCase()))) {
        dirs.push(path.join(base, name));
      }
    }
  }

  const files = [];
  for (const dir of dirs) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".jsonl")) continue;
      const file = path.join(dir, entry.name);
      const stat = fs.statSync(file);
      files.push({
        file,
        project: path.basename(dir),
        mtime: stat.mtimeMs,
        size: stat.size,
      });
    }
  }
  return files.sort((a, b) => a.mtime - b.mtime);
}

function readJsonl(file) {
  return fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "").split("\n").filter(Boolean);
}

function parseTranscript(file) {
  const lines = readJsonl(file);
  const turns = [];
  let sessionId = path.basename(file, ".jsonl");

  for (const line of lines) {
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    if (event.sessionId) sessionId = event.sessionId;
    if (event.isSidechain || event.isMeta || event.type === "attachment") continue;

    if (event.type === "user" && event.message) {
      const content = event.message.content;
      let text = "";
      if (typeof content === "string") text = content;
      else if (Array.isArray(content)) {
        text = content.filter((part) => part.type === "text").map((part) => part.text).join("\n");
        if (!text && content.some((part) => part.type === "tool_result")) continue;
      }
      text = text.trim();
      if (!text) continue;
      if (/^<(local-command-caveat|command-name|system-reminder)/.test(text)) continue;
      if (/^Caveat: The messages below/.test(text)) continue;
      turns.push({ role: "USER", ts: event.timestamp, text });
    } else if (event.type === "assistant" && event.message && Array.isArray(event.message.content)) {
      const raw = event.message.content.filter((part) => part.type === "text").map((part) => part.text).join("\n").trim();
      if (!raw) continue;
      const text = raw.length > 700 ? `${raw.slice(0, 700)} ...[+${raw.length - 700} chars]` : raw;
      turns.push({ role: "ASSISTANT", ts: event.timestamp, text });
    }
  }

  const merged = [];
  for (const turn of turns) {
    const prev = merged[merged.length - 1];
    if (prev && prev.role === "ASSISTANT" && turn.role === "ASSISTANT" && prev.text.length < 1400) {
      prev.text += `\n${turn.text}`;
    } else {
      merged.push({ ...turn });
    }
  }
  return { sessionId, turns: merged };
}

function segmentTurns(turns, maxChars = 9000) {
  const segments = [];
  let current = [];
  let size = 0;
  for (const turn of turns) {
    const len = turn.text.length + 30;
    if (size + len > maxChars && current.length > 0 && turn.role === "USER") {
      segments.push(current);
      current = [];
      size = 0;
    }
    current.push(turn);
    size += len;
  }
  if (current.length) segments.push(current);
  return segments.filter((segment) => segment.some((turn) => turn.role === "USER"));
}

function renderSegment(segment) {
  return segment.map((turn) => `**[${turn.role}${turn.ts ? ` ${String(turn.ts).slice(0, 16)}` : ""}]** ${turn.text}`).join("\n\n");
}

function callClaude(prompt, { model = "sonnet", timeoutMs = 180000 } = {}) {
  const denied = "Bash,Edit,Write,Read,Glob,Grep,WebFetch,WebSearch,Agent,Task,NotebookEdit";
  return new Promise((resolve, reject) => {
    execFile(
      "claude",
      ["-p", prompt, "--model", model, "--output-format", "json", "--disallowedTools", denied],
      { encoding: "utf8", timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 },
      (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }
        try {
          const parsed = JSON.parse(stdout);
          if (parsed.is_error) reject(new Error(`claude -p error: ${String(parsed.result).slice(0, 300)}`));
          else resolve(parsed.result);
        } catch (parseError) {
          reject(parseError);
        }
      },
    );
  });
}

function extractJson(text) {
  const candidates = [...String(text).matchAll(/```(?:json)?\s*([\s\S]*?)```/g)]
    .map((match) => match[1])
    .filter((candidate) => /[[{]/.test(candidate));
  candidates.push(String(text));
  let last = new Error("no JSON found in model output");
  for (const candidate of candidates) {
    try {
      return scanJson(candidate);
    } catch (error) {
      last = error;
    }
  }
  throw last;
}

function scanJson(candidate) {
  const start = candidate.search(/[[{]/);
  if (start === -1) throw new Error("no JSON found in model output");
  const text = candidate.slice(start);
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === "\"") {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{" || ch === "[") depth += 1;
    else if (ch === "}" || ch === "]") {
      depth -= 1;
      if (depth === 0) return JSON.parse(text.slice(0, i + 1));
    }
  }
  throw new Error("unbalanced JSON in model output");
}

async function callClaudeJson(prompt, opts) {
  return extractJson(await callClaude(prompt, opts));
}

async function pool(items, worker, concurrency) {
  const results = new Array(items.length);
  let next = 0;
  async function lane() {
    while (next < items.length) {
      const index = next++;
      try {
        results[index] = await worker(items[index], index);
      } catch (error) {
        results[index] = { __error: error.message };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(concurrency, 1), items.length) }, lane));
  return results;
}

async function detectDecisions(segmentText, opts) {
  const prompt = `You are Argus's decision-moment detector.

Find only moments where the HUMAN user chose, approved, rejected, deferred, constrained, or changed a direction.

Include:
- choosing option A over B
- adopting/killing/deferring a feature, plan, architecture, product direction, or scope
- setting a durable constraint or policy
- approving an assistant proposal as the direction to take

Exclude:
- ordinary questions, brainstorming, venting, or asking for advice
- assistant-only implementation choices that the user did not approve
- routine execution of an already-decided task
- vague preferences with no direction fixed

Return only JSON:
{"decisions":[{"quote":"human words, <=200 chars","decision":"one sentence describing what was decided","type":"direction|scope|kill|adopt|defer|constraint|approval","stakes":"high|medium|low"}]}

If no real decision was made, return {"decisions":[]}.

<conversation>
${segmentText}
</conversation>`;
  const out = await callClaudeJson(prompt, opts);
  const arr = Array.isArray(out) ? out : out.decisions;
  if (!Array.isArray(arr)) throw new Error("detector returned no decisions array");
  return arr.filter((d) => d && typeof d.quote === "string" && typeof d.decision === "string" && TYPES.has(d.type) && STAKES.has(d.stakes));
}

async function draftSeal(decision, opts) {
  const today = localToday();
  const prompt = `Turn this human decision into one falsifiable, later-checkable contract.

Decision: ${decision.decision}
Human quote: "${decision.quote || ""}"
Type/stakes: ${decision.type || "unknown"} / ${decision.stakes || "unknown"}
Today: ${today}

Rules:
- Do not judge whether the decision is good.
- The predicate must be observable later.
- falsified_if must name a concrete observation that would disprove the predicate.
- check_by must be an ISO date, usually 7-90 days out.

Return only JSON:
{"predicate":"...","falsified_if":"...","check_by":"YYYY-MM-DD"}`;
  const out = await callClaudeJson(prompt, opts);
  if (!out || typeof out.predicate !== "string" || typeof out.falsified_if !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(out.check_by || "")) {
    throw new Error("seal draft incomplete");
  }
  return out;
}

async function cmdScan() {
  if (flags.list) {
    cmdList("candidate");
    return;
  }
  const files = discoverTranscripts({ all: !!flags["all-projects"], projectDir: flags.project || process.cwd() })
    .filter((file) => !flags.since || file.mtime > Date.now() - Number(flags.since) * 86400000);

  if (!files.length) {
    console.log("No Claude Code transcripts found for this project.");
    console.log(`Looked under: ${transcriptRoot()}`);
    return;
  }

  const state = loadScanState();
  const ledger = loadLedger();
  const jobs = [];
  const prevStates = new Map();
  let skipped = 0;

  for (const item of files) {
    const prev = state.files[item.file];
    if (prev && prev.size === item.size) {
      skipped += 1;
      continue;
    }
    prevStates.set(item.file, prev);
    const { sessionId, turns } = parseTranscript(item.file);
    const userIndexes = turns.map((turn, index) => (turn.role === "USER" ? index : -1)).filter((index) => index >= 0);
    const prevUsers = prev ? (prev.userTurns || 0) : 0;
    let fresh = [];
    if (prevUsers === 0) fresh = turns;
    else if (prevUsers < userIndexes.length) fresh = turns.slice(Math.max(0, userIndexes[prevUsers] - 1));
    if (fresh.some((turn) => turn.role === "USER")) {
      for (const segment of segmentTurns(fresh)) jobs.push({ ...item, sessionId, segment });
    }
    state.files[item.file] = { size: item.size, userTurns: userIndexes.length, scanned_at: new Date().toISOString() };
  }

  if (!jobs.length) {
    saveScanState(state);
    console.log(`Scan complete. No new transcript turns.${skipped ? ` (${skipped} unchanged file(s) skipped.)` : ""}`);
    return;
  }

  const model = String(flags.model || "sonnet");
  const concurrency = Number(flags.concurrency || 3);
  console.log(`Scanning ${jobs.length} conversation segment(s) with Claude (${model})...`);
  const results = await pool(jobs, (job) => detectDecisions(renderSegment(job.segment), { model }), concurrency);
  let failed = 0;
  let written = 0;

  results.forEach((decisions, index) => {
    const job = jobs[index];
    if (!Array.isArray(decisions)) {
      failed += 1;
      return;
    }
    for (const decision of decisions) {
      const id = stableId(job.sessionId, decision.quote);
      if (ledger.has(id)) continue;
      const decidedAt = job.segment.find((turn) => turn.role === "USER")?.ts || null;
      appendEvent({
        event: "harvest",
        id,
        project: job.project,
        session: job.sessionId,
        decided_at: decidedAt,
        ...decision,
      });
      ledger.set(id, { id, status: "candidate" });
      written += 1;
      console.log(`  ${id} [${decision.stakes}/${decision.type}] ${truncate(decision.decision)}`);
    }
  });

  if (failed) {
    const failedFiles = new Set(results.map((result, index) => (!Array.isArray(result) ? jobs[index].file : null)).filter(Boolean));
    for (const file of failedFiles) {
      const prev = prevStates.get(file);
      if (prev) state.files[file] = prev;
      else delete state.files[file];
    }
  }
  saveScanState(state);

  if (!written) console.log("Scan complete. No new decision candidates found.");
  else console.log(`Scan complete. ${written} candidate(s) found. Next: /argus:predict <id>`);
  if (failed) console.log(`Skipped ${failed} segment(s) that failed detection; they will retry next scan.`);
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

function findBearingSeeds() {
  const sessionsDir = path.join(argusDir(), "sessions");
  const files = walk(sessionsDir, 8, (name) => name === "current_bearing.json" || name === "current-bearing.json");
  const ledger = loadLedger();
  const sealedPredicates = new Set([...ledger.values()].map((item) => item.predicate).filter(Boolean));
  const seeds = [];
  for (const file of files) {
    let obj;
    try {
      obj = JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
    } catch {
      continue;
    }
    const seed = obj && obj.contract_seed;
    if (!seed || typeof seed.predicate !== "string" || !seed.predicate.trim()) continue;
    const parts = file.split(path.sep);
    const sessionIndex = parts.lastIndexOf("sessions") + 1;
    const session = obj.session || (sessionIndex > 0 ? parts[sessionIndex] : "unknown");
    const label = obj.label || obj.version_label || path.basename(path.dirname(file));
    const id = `bearing:${session}:${label || "v0"}`;
    if (ledger.has(id) || sealedPredicates.has(seed.predicate)) continue;
    const generated = obj.generated_at || null;
    seeds.push({
      kind: "seed",
      id,
      file,
      session,
      label,
      generated_at: generated,
      decision: obj.current_course?.summary || seed.predicate,
      predicate: seed.predicate,
      falsified_if: seed.fail_condition || seed.falsified_if || "opposite observed",
      check_by: seed.check_by,
      stakes: obj.classification?.stakes || undefined,
    });
  }
  return seeds.sort((a, b) => String(b.generated_at || "").localeCompare(String(a.generated_at || "")));
}

function listSealable() {
  const ledger = loadLedger();
  const candidates = [...ledger.values()].filter((item) => item.status === "candidate");
  const seeds = findBearingSeeds();
  return { candidates, seeds };
}

function cmdList(status = flags.status || "candidate") {
  const ledger = loadLedger();
  const items = [...ledger.values()].filter((item) => status === "all" || item.status === status);
  if (!items.length) {
    console.log(`No ${status} ledger item(s).`);
    return;
  }
  for (const item of items) {
    console.log(`${item.id} [${item.status}${item.stakes ? `/${item.stakes}` : ""}] ${truncate(item.decision || item.predicate || item.quote)}`);
    if (item.status === "sealed" || item.status === "settled") {
      console.log(`  predicate: ${truncate(item.predicate, 120)}`);
      console.log(`  check_by: ${item.check_by || "none"}${item.outcome ? `; outcome: ${item.outcome}` : ""}`);
    }
  }
}

function printSealable() {
  const { candidates, seeds } = listSealable();
  if (!candidates.length && !seeds.length) {
    console.log("No sealable decisions found.");
    console.log("Use /argus:sail for a new decision or /argus:scan to recover past decisions.");
    return;
  }
  if (seeds.length) {
    console.log("Sail seeds:");
    for (const seed of seeds) {
      console.log(`  ${seed.id} ${truncate(seed.predicate)}${seed.check_by ? ` (check_by ${seed.check_by})` : ""}`);
    }
  }
  if (candidates.length) {
    console.log("Scan candidates:");
    for (const item of candidates) {
      console.log(`  ${item.id} [${item.stakes || "unknown"}] ${truncate(item.decision || item.quote)}`);
    }
  }
  console.log("Next: /argus:predict <id>");
}

function findSeedById(id) {
  const seeds = findBearingSeeds();
  if (flags["latest-seed"]) return seeds[0] || null;
  return seeds.find((seed) => seed.id === id) || null;
}

async function cmdSeal() {
  if (flags.list) {
    printSealable();
    return;
  }
  const target = flags["latest-seed"] ? null : flags._[0];
  if (!target && !flags["latest-seed"]) {
    printSealable();
    return;
  }

  const seed = findSeedById(target);
  if (seed) {
    const checkBy = flags["check-by"] || seed.check_by;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(checkBy || ""))) {
      console.error(`Seed ${seed.id} has no ISO check_by date. Run /argus:predict ${seed.id} --check-by YYYY-MM-DD`);
      process.exit(1);
    }
    appendEvent({
      event: "harvest",
      id: seed.id,
      project: path.basename(root),
      session: seed.session,
      decided_at: seed.generated_at,
      quote: seed.predicate,
      decision: seed.decision,
      type: "adopt",
      stakes: seed.stakes,
    });
    appendEvent({
      event: "seal",
      id: seed.id,
      predicate: flags.predicate || seed.predicate,
      falsified_if: flags["falsified-if"] || seed.falsified_if,
      check_by: checkBy,
    });
    console.log(`Sealed ${seed.id}`);
    console.log(`  predicate: ${truncate(flags.predicate || seed.predicate, 140)}`);
    console.log(`  check_by: ${checkBy}`);
    return;
  }

  const ledger = loadLedger();
  const decision = ledger.get(target);
  if (!decision) {
    console.error(`Unknown seal target: ${target}`);
    console.error("Run /argus:predict --list to see candidates and sail seeds.");
    process.exit(1);
  }
  if (decision.status !== "candidate") {
    console.error(`${target} is ${decision.status}, not candidate. Only candidates can be sealed.`);
    process.exit(1);
  }

  let draft = {
    predicate: flags.predicate,
    falsified_if: flags["falsified-if"],
    check_by: flags["check-by"],
  };
  if (!draft.predicate || !draft.falsified_if || !draft.check_by) {
    console.log(`Drafting a checkable contract for ${target}...`);
    const generated = await draftSeal(decision, { model: flags.model || "sonnet" });
    draft = {
      predicate: draft.predicate || generated.predicate,
      falsified_if: draft.falsified_if || generated.falsified_if,
      check_by: draft.check_by || generated.check_by,
    };
  }
  if (!draft.predicate || !draft.falsified_if || !/^\d{4}-\d{2}-\d{2}$/.test(draft.check_by || "")) {
    console.error("Seal needs predicate, falsified_if, and ISO check_by.");
    console.error(`Run /argus:predict ${target} --predicate "..." --falsified-if "..." --check-by ${addDaysISO(localToday(), 14)}`);
    process.exit(1);
  }
  appendEvent({
    event: "seal",
    id: target,
    predicate: draft.predicate,
    falsified_if: draft.falsified_if,
    check_by: draft.check_by,
    author: flags.author,
  });
  console.log(`Sealed ${target}`);
  console.log(`  predicate: ${truncate(draft.predicate, 140)}`);
  console.log(`  check_by: ${draft.check_by}`);
}

function cmdStatus() {
  const ledger = loadLedger();
  const { candidates, seeds } = listSealable();
  const rows = [...ledger.values()];
  console.log(`Candidates: ${candidates.length}`);
  console.log(`Sail seeds: ${seeds.length}`);
  console.log(`Sealed: ${rows.filter((row) => row.status === "sealed").length}`);
  console.log(`Settled: ${rows.filter((row) => row.status === "settled").length}`);
  console.log(`Ledger: ${rel(ledgerFile())}`);
}

// Single-source writer for the settle event (was hand-written JSON in the resolve
// skill — the drift source). The CLI owns the canonical v1 shape; appendEvent
// stamps `at`. Reality answers; Argus never grades — so no score is recorded.
function cmdSettle() {
  const id = flags._[0];
  const outcome = String(flags.outcome || "");
  const OUTCOMES = ["happened", "avoided", "partial"];
  const BASES = ["reasoned", "luck", "external", "mixed"];
  if (!id) {
    console.error('Usage: decision-ledger.js settle <id> --outcome happened|avoided|partial [--basis reasoned|luck|external|mixed] [--note "<one sentence>"]');
    process.exit(1);
  }
  if (!OUTCOMES.includes(outcome)) {
    console.error(`--outcome must be one of ${OUTCOMES.join("|")}`);
    process.exit(1);
  }
  const event = { event: "settle", id, outcome };
  if (flags.basis) {
    const basis = String(flags.basis);
    if (!BASES.includes(basis)) {
      console.error(`--basis must be one of ${BASES.join("|")}`);
      process.exit(1);
    }
    event.basis = basis;
  }
  if (flags.note) event.note = String(flags.note);
  appendEvent(event);
  console.log(`Settled ${id}: ${outcome}${event.basis ? ` (${event.basis})` : ""}`);
}

const commands = { scan: cmdScan, seal: cmdSeal, settle: cmdSettle, list: () => cmdList(), status: cmdStatus };
if (!cmd || !commands[cmd]) {
  console.log("Usage:");
  console.log("  /argus:scan [--since days] [--all-projects] [--model sonnet] [--list]");
  console.log("  /argus:predict --list");
  console.log("  /argus:predict <id>");
  console.log("  /argus:predict --latest-seed");
  console.log("  node decision-ledger.js status");
  process.exit(cmd ? 1 : 0);
}

Promise.resolve(commands[cmd]()).catch((error) => {
  console.error(error.message);
  process.exit(1);
});
