#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const errors = [];

function walk(dir, predicate, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, predicate, out);
    else if (entry.isFile() && predicate(full)) out.push(full);
  }
  return out;
}

function rel(file) {
  return path.relative(root, file).replace(/\\/g, "/");
}

function check(condition, message) {
  if (!condition) errors.push(message);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    errors.push(`${rel(file)}: invalid JSON: ${error.message}`);
    return null;
  }
}

for (const file of walk(root, (p) => p.endsWith(".json"))) {
  readJson(file);
}

const manifestPath = path.join(root, ".claude-plugin", "plugin.json");
const manifest = readJson(manifestPath);

if (manifest) {
  // Claude Code auto-discovers skills/<name>/SKILL.md and agents/*.md.
  // These fields are either redundant (commands/agents) or not in the plugin
  // spec at all (references/statusline) — their presence means someone
  // regressed to the pre-2.2 invented-manifest shape.
  for (const field of ["commands", "agents", "references", "statusline"]) {
    check(!(field in manifest), `manifest must not declare "${field}" (skills/agents auto-discover; "${field}" is not in the plugin spec)`);
  }
  check(manifest.name === "argus", "manifest name must be argus (it is the /argus: namespace)");
  check(typeof manifest.version === "string" && manifest.version.length > 0, "manifest must declare a version");
}

const SKILLS = ["sail", "clarify", "team", "verify", "boss", "revise", "chart", "helm", "help", "settle", "log"];
for (const skill of SKILLS) {
  const skillPath = path.join(root, "skills", skill, "SKILL.md");
  check(fs.existsSync(skillPath), `missing skills/${skill}/SKILL.md (auto-discovered as /argus:${skill})`);
  if (fs.existsSync(skillPath)) {
    const body = fs.readFileSync(skillPath, "utf8");
    check(/^---\r?\n/.test(body) && /\r?\ndescription:/.test(body.split(/\r?\n---/)[0] + "\n"), `skills/${skill}/SKILL.md missing frontmatter description`);
    // Path-resolution regression guard: bundled files are referenced via
    // ${CLAUDE_PLUGIN_ROOT}; only sail documents the legacy fallbacks.
    if (skill !== "sail") {
      check(!body.includes("~/.claude/argus-"), `skills/${skill}/SKILL.md hardcodes ~/.claude/argus-* (use \${CLAUDE_PLUGIN_ROOT}/data|lib per sail §Path Resolution)`);
    }
  }
}

const agentFiles = fs.existsSync(path.join(root, "agents"))
  ? fs.readdirSync(path.join(root, "agents")).filter((f) => f.endsWith(".md"))
  : [];
check(agentFiles.length === 17, `agents/ should hold 17 agent .md files, found ${agentFiles.length}`);

for (const schema of [
  "analysis-snapshot.json",
  "worker-result.json",
  "verification-ledger.json",
  "current-bearing.json",
  "mix-result.json",
  "dm-feedback.json",
  "final-scaffold.json",
  "minimal-scaffold.json",
  "draft.json",
  "session.json",
  "config.json"
]) {
  check(fs.existsSync(path.join(root, "data", "schemas", schema)), `missing data/schemas/${schema}`);
}

const installPath = path.join(root, "install.sh");
if (fs.existsSync(installPath)) {
  const install = fs.readFileSync(installPath, "utf8");
  check(!install.includes("\r\n"), "install.sh must use LF line endings for bash");
  for (const command of ["sail", "clarify", "team", "verify", "boss", "revise", "chart"]) {
    check(new RegExp(`\\b${command}\\b`).test(install), `install.sh does not verify ${command}`);
  }
}

const finalScaffold = readJson(path.join(root, "data", "schemas", "final-scaffold.json"));
if (finalScaffold) {
  check(finalScaffold.required?.includes("verification"), "FinalScaffold must require verification");
  check(
    finalScaffold.properties?.verification?.properties?.routing_decision?.enum?.includes("not_run"),
    "FinalScaffold verification routing_decision must include not_run"
  );
}

const currentBearing = readJson(path.join(root, "data", "schemas", "current-bearing.json"));
if (currentBearing) {
  for (const field of [
    "label",
    "current_course",
    "why_this_course",
    "fog_or_reef",
    "road_not_taken",
    "next_helm",
    "contract_seed",
    "blocked",
    "detail_path"
  ]) {
    check(currentBearing.required?.includes(field), `CurrentBearing must require ${field}`);
  }
  check(currentBearing.properties?.why_this_course?.maxItems === 3, "CurrentBearing why_this_course[] must be capped at 3 items");
  check(currentBearing.properties?.road_not_taken?.minItems === 1, "CurrentBearing road_not_taken[] must require at least 1 item");
  check(currentBearing.properties?.road_not_taken?.maxItems === 2, "CurrentBearing road_not_taken[] must be capped at 2 items");
  check(
    currentBearing.properties?.current_course?.properties?.status?.enum?.includes("collect_evidence"),
    "CurrentBearing current_course.status must include collect_evidence"
  );
}

const sailSkillPath = path.join(root, "skills", "sail", "SKILL.md");
if (fs.existsSync(sailSkillPath)) {
  const sail = fs.readFileSync(sailSkillPath, "utf8");
  check(sail.includes("Current Bearing"), "sail skill must define Current Bearing rendering");
  check(!sail.includes("## Step 7 - SurfaceCard"), "sail skill must not use SurfaceCard as the Step 7 output");
  check(sail.includes("No machinery selling"), "sail skill must forbid machinery selling");
}

const draft = readJson(path.join(root, "data", "schemas", "draft.json"));
if (draft) {
  // v2.1: the draft node is a thin tree pointer — boss review is a small boolean
  // flag; the full feedback/scaffold/mix live write-once in the version dir.
  check(draft.properties?.boss_reviewed?.type === "boolean", "Draft.boss_reviewed must be a boolean flag");
  check(!draft.properties?.final_scaffold && !draft.properties?.final_mix && !draft.properties?.dm_feedback,
    "Draft must not embed final_scaffold/final_mix/dm_feedback (they belong in the version dir, not the session skeleton)");
}

const statusline = path.join(root, "statusline", "index.js");
if (fs.existsSync(statusline)) {
  const result = spawnSync(process.execPath, ["--check", statusline], { encoding: "utf8" });
  check(result.status === 0, `statusline syntax check failed: ${result.stderr || result.stdout}`);
}

// SessionStart contract-reminder hook: hooks.json must reference an existing,
// syntactically valid script, and the script must never be allowed to grow a
// top-level throw (a broken hook taxes every session start).
const hooksJson = readJson(path.join(root, "hooks", "hooks.json"));
if (hooksJson) {
  const sessionStart = hooksJson.hooks?.SessionStart;
  check(Array.isArray(sessionStart) && sessionStart.length > 0, "hooks.json must register a SessionStart hook");
}
const contractsScript = path.join(root, "scripts", "check-contracts.js");
check(fs.existsSync(contractsScript), "missing scripts/check-contracts.js (referenced by hooks/hooks.json)");
if (fs.existsSync(contractsScript)) {
  const result = spawnSync(process.execPath, ["--check", contractsScript], { encoding: "utf8" });
  check(result.status === 0, `check-contracts syntax check failed: ${result.stderr || result.stdout}`);
}

const simulation = path.join(root, "scripts", "simulate-plugin.js");
if (fs.existsSync(simulation)) {
  const result = spawnSync(process.execPath, ["--check", simulation], { encoding: "utf8" });
  check(result.status === 0, `simulation syntax check failed: ${result.stderr || result.stdout}`);
} else {
  check(false, "missing scripts/simulate-plugin.js");
}

if (errors.length) {
  console.error("Argus plugin validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Argus plugin validation passed.");
