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

// O3 방2 5-axis surface: 공개 5 + alias 2 + 숨김 내부 스킬. 구 단계 스킬
// (clarify/team/verify/boss/revise)은 skills/review/의 step 파일로 이주 —
// 그 실존은 아래 REVIEW_STEPS가 검사한다 (activation-contract.test.ts와 동형).
const SKILLS = ["review", "check", "history", "settings", "help", "sail", "resolve", "scan", "predict", "premises", "versions", "principles", "preapprove", "journal", "configure", "connect", "push", "pull", "sync"];
const REVIEW_STEPS = ["pipeline", "clarify", "team", "verify", "boss", "revise"];
for (const step of REVIEW_STEPS) {
  check(fs.existsSync(path.join(root, "skills", "review", `${step}.md`)), `missing skills/review/${step}.md (review pipeline step)`);
}
for (const skill of SKILLS) {
  const skillPath = path.join(root, "skills", skill, "SKILL.md");
  check(fs.existsSync(skillPath), `missing skills/${skill}/SKILL.md (auto-discovered as /argus:${skill})`);
  if (fs.existsSync(skillPath)) {
    const body = fs.readFileSync(skillPath, "utf8");
    check(/^---\r?\n/.test(body) && /\r?\ndescription:/.test(body.split(/\r?\n---/)[0] + "\n"), `skills/${skill}/SKILL.md missing frontmatter description`);
    // Frontmatter hygiene: an unquoted description containing ": " breaks
    // strict YAML parsers (gray-matter/js-yaml — "bad indentation of a
    // mapping entry"), and descriptions past ~1024 chars risk truncation,
    // which would clip whatever scoping clause sits at the tail.
    const descMatch = (body.split(/\r?\n---/)[0] + "\n").match(/\ndescription:[ \t]*(.*)\r?\n/);
    if (descMatch) {
      const desc = descMatch[1];
      if (!/^["']/.test(desc)) {
        check(!desc.includes(": "), `skills/${skill}/SKILL.md description contains unquoted ": " (breaks strict YAML — use an em-dash or quote the value)`);
      }
      check(desc.length <= 1024, `skills/${skill}/SKILL.md description is ${desc.length} chars (>1024 risks truncation)`);
    }
    // agentskills naming conformance (agentskills.io/specification): the `name`
    // field must exist, follow the lowercase/hyphen rules (≤64, no leading/
    // trailing/consecutive hyphen), and MATCH the parent directory — which is
    // also the /argus:<dir> invocation, so a mismatch is both a spec violation
    // and a broken command. Portable-standard alignment; argument-hint /
    // allowed-tools stay legitimate (Claude Code fields, not flagged).
    const nameMatch = (body.split(/\r?\n---/)[0] + "\n").match(/\nname:[ \t]*(.*)\r?\n/);
    check(nameMatch, `skills/${skill}/SKILL.md missing frontmatter name (agentskills requires name)`);
    if (nameMatch) {
      const name = nameMatch[1].trim().replace(/^["']|["']$/g, "");
      check(name === skill, `skills/${skill}/SKILL.md name "${name}" must equal the skill directory "${skill}" (agentskills: name must match parent dir; also the /argus:${skill} invocation)`);
      check(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name), `skills/${skill}/SKILL.md name "${name}" violates agentskills naming (lowercase a-z 0-9 with single hyphens; no leading/trailing/consecutive hyphen)`);
      check(name.length <= 64, `skills/${skill}/SKILL.md name is ${name.length} chars (>64, agentskills limit)`);
    }
    // Path-resolution regression guard: bundled files are referenced via
    // ${CLAUDE_PLUGIN_ROOT}; only sail documents the legacy fallbacks.
    if (skill !== "sail") {
      check(!body.includes("~/.claude/argus-"), `skills/${skill}/SKILL.md hardcodes ~/.claude/argus-* (use \${CLAUDE_PLUGIN_ROOT}/data|lib per sail §Path Resolution)`);
    }
    // Intake convention guards (v2.4.0): the entry-point skills must show an
    // argument hint and must keep natural-language target detection primary —
    // a regression back to @-syntax-only intake re-imposes a learned syntax.
    if (skill === "sail" || skill === "clarify") {
      check(/\nargument-hint:/.test(body.split(/\r?\n---/)[0] + "\n"), `skills/${skill}/SKILL.md frontmatter must declare argument-hint`);
    }
  }
}

const clarifySkillPath = path.join(root, "skills", "review", "clarify.md");
if (fs.existsSync(clarifySkillPath)) {
  const clarify = fs.readFileSync(clarifySkillPath, "utf8");
  check(/natural language is the primary form/i.test(clarify), "clarify §Inputs must keep natural-language target detection as the primary intake path (prose-first contract, v2.4.0)");
  // Document intake must stay deterministic: one pinned extraction recipe,
  // no per-machine improvisation (the "environment lottery" failure mode).
  check(clarify.includes("## Document Extraction"), "clarify must keep the §Document Extraction section (pinned, dependency-free office-doc recipe)");
  for (const fmt of ["pptx", "docx", "xlsx", "hwpx"]) {
    check(clarify.includes(fmt), `clarify §Document Extraction must cover .${fmt}`);
  }
  check(/do not install/i.test(clarify), "clarify §Document Extraction must forbid installing parsers (deterministic intake)");
  // Step-0 request-type gate (v2.5.0): clarify must classify request_type before
  // reframing, so a closed decision / vent / plain question is not force-run
  // through the full engine (the C5 finding). Guard the section and the four types.
  check(/request-type & readiness gate/i.test(clarify), "clarify must keep the Step 1.7 request-type & readiness gate (step-0: whether to run the engine)");
  for (const t of ["open_decision", "validation", "vent", "info"]) {
    check(clarify.includes(t), `clarify Step 1.7 must define request_type "${t}"`);
  }
  check(/resistance/i.test(clarify), "clarify Step 1.7 must cover the readiness=resistance axis (avoidance is not an analysis bottleneck)");
  // Under-fire dial (v2.6.0): clarify must apply the load-bearing test to its own
  // reframe and default to restraint (frame_status: flat) when no fork changes
  // the answer — the ~60% over-fire the validated stress test measured.
  check(/frame_status/.test(clarify), "clarify must set frame_status (flat|load_bearing) — the under-fire dial (v2.6.0)");
  check(/load-bearing/i.test(clarify) && /\bflat\b/i.test(clarify), "clarify Step 2 must require a reframe to be LOAD-BEARING or not made (no manufactured reframe on a flat decision)");
  check(/AI-generated plan/.test(clarify) && /current-conversation-plan/.test(clarify), "clarify must detect AI-generated/current Claude Code plans as first-class developer approval targets");
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

// clarify Step 3.5 hard-depends on this file ("never rewrite from memory");
// it is data, not a schema, so the schema loop above does not cover it.
check(
  fs.existsSync(path.join(root, "data", "prompts", "probe-prompts.md")),
  "missing data/prompts/probe-prompts.md (clarify Step 3.5 probe prompts)"
);

// Step-0 gate schema sync (v2.5.0): the two new axes must be declared on the
// AnalysisSnapshot (a silent field would never travel to sail's router).
const analysisSnapshot = readJson(path.join(root, "data", "schemas", "analysis-snapshot.json"));
if (analysisSnapshot) {
  check(
    Array.isArray(analysisSnapshot.properties?.request_type?.enum) &&
      ["open_decision", "validation", "vent", "info"].every((t) => analysisSnapshot.properties.request_type.enum.includes(t)),
    "AnalysisSnapshot must declare request_type with open_decision/validation/vent/info (clarify Step 1.7)"
  );
  check(
    Array.isArray(analysisSnapshot.properties?.readiness?.enum) &&
      ["ready", "resistance"].every((r) => analysisSnapshot.properties.readiness.enum.includes(r)),
    "AnalysisSnapshot must declare readiness with ready/resistance (clarify Step 1.7)"
  );
  check(
    Array.isArray(analysisSnapshot.properties?.frame_status?.enum) &&
      ["flat", "load_bearing"].every((f) => analysisSnapshot.properties.frame_status.enum.includes(f)),
    "AnalysisSnapshot must declare frame_status with flat/load_bearing (clarify Step 2 — the under-fire dial, v2.6.0)"
  );
}

const installPath = path.join(root, "install.sh");
if (fs.existsSync(installPath)) {
  const install = fs.readFileSync(installPath, "utf8");
  check(!install.includes("\r\n"), "install.sh must use LF line endings for bash");
  for (const command of SKILLS) {
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
  // v2.6.0 under-fire: road_not_taken must be ALLOWED to be empty on a flat
  // decision. minItems:1 previously ENFORCED the over-fire (a manufactured
  // alternative to fill the slot) — flipped to 0. maxItems stays 2.
  check(currentBearing.properties?.road_not_taken?.minItems === 0, "CurrentBearing road_not_taken[] must allow empty (minItems 0) — a flat decision has no road not taken (v2.6.0 under-fire default)");
  check(currentBearing.properties?.road_not_taken?.maxItems === 2, "CurrentBearing road_not_taken[] must be capped at 2 items");
  check(
    currentBearing.properties?.current_course?.properties?.status?.enum?.includes("collect_evidence"),
    "CurrentBearing current_course.status must include collect_evidence"
  );
  check(
    ["predicate", "check_by", "pass_condition", "fail_condition"].every((field) => currentBearing.properties?.contract_seed?.required?.includes(field)),
    "CurrentBearing contract_seed must require predicate/check_by/pass_condition/fail_condition"
  );
  check(
    !("author" in (currentBearing.properties?.contract_seed?.properties || {})),
    "CurrentBearing contract_seed must not include author; absence is the AI-surfaced provenance signal"
  );
}

const sailSkillPath = path.join(root, "skills", "review", "pipeline.md");
if (fs.existsSync(sailSkillPath)) {
  const sail = fs.readFileSync(sailSkillPath, "utf8");
  check(sail.includes("current call"), "sail skill must define current call rendering");
  // Friction cap (2026-07-15): the whole run surfaces at most 2 AskUserQuestion.
  check(/Question Budget/.test(sail) && /at most \*\*?2|at most 2/.test(sail), "sail must declare the Question Budget — at most 2 AskUserQuestion per run (friction #1)");
  check(/Wake[\s\S]{0,400}NOT an `?AskUserQuestion/.test(sail), "sail Step 7.5 Wake must be surfaced, NOT an AskUserQuestion (it never spends a budget slot)");
  check(!sail.includes("## Step 7 - SurfaceCard"), "sail skill must not use SurfaceCard as the Step 7 output");
  check(sail.includes("No machinery selling"), "sail skill must forbid machinery selling");
  // Step-0 gate routing (v2.5.0): sail must read request_type and refuse to
  // escalate a non-open request into the crew pipeline.
  check(sail.includes("request_type"), "sail must route on request_type — only open_decision flows team/verify/boss (clarify Step 1.7)");
  // Under-fire default (v2.6.0): sail must have a flatness gate, must NOT mandate
  // a forced/fabricated road-not-taken, and must forbid the engine-weighted pole.
  check(/frame_status/.test(sail) && /[Ff]latness gate/.test(sail), "sail must have a flatness gate (Step 6·0.5) keyed on frame_status — the under-fire default (v2.6.0)");
  check(!/create one from the rejected obvious alternative/.test(sail), "sail must NOT mandate fabricating a road-not-taken ('create one from the rejected obvious alternative') — that clause manufactured the ~60% flat-decision over-fire (v2.6.0)");
  check(!/Always include 1-2 road-not-taken items for medium\/high decisions\./.test(sail), "sail must not force 1-2 road-not-taken on every medium/high decision — load-bearing-gated, empty on flat (v2.6.0)");
  check(/engine-weighted pole/i.test(sail) && /[Ss]wap-test/.test(sail), "sail must forbid the engine-weighted pole and apply the swap-test parity check (asymmetric_steer was the modal harm — v2.6.0)");
  // Privacy regression guard: the ledger holds verbatim predictions/outcomes,
  // and settle/helm both assert that sail's gitignore covers it.
  check(/^ledger\/$/m.test(sail), "sail Step 0 .argus/.gitignore block must include a ledger/ line (privacy default for the settlement ledger)");
  check(/Developer Decision Contract/.test(sail), "sail must keep the Developer Decision Contract (file/PR/test/failure-mode/next-patch standard)");
  check(/failure mode/i.test(sail) && /smallest useful engineering move/i.test(sail), "sail Developer Decision Contract must require concrete failure mode + smallest engineering next step");
  check(!/- `author`: `"?ai_surfaced"?`/.test(sail), "sail must not tell current_bearing.contract_seed to include author (schema rejects it; absence means AI-surfaced)");
}

const teamSkillPath = path.join(root, "skills", "review", "team.md");
if (fs.existsSync(teamSkillPath)) {
  const team = fs.readFileSync(teamSkillPath, "utf8");
  check(/developer payload/i.test(team), "team worker prompt must require a developer payload for code decisions");
  check(/affected surface/i.test(team) && /missing test\/check/i.test(team), "team developer payload must include affected surface and missing test/check");
  check(/target_type` in `\{pr, file, branch, issue, design_doc, plan\}`/.test(team), "team explicit-target path must include plan targets");
  check(/target_context\.kind == "plan"/.test(team), "team must treat target_context.kind == plan as the artifact under review");
}

const verifySkillPath = path.join(root, "skills", "review", "verify.md");
if (fs.existsSync(verifySkillPath)) {
  const verify = fs.readFileSync(verifySkillPath, "utf8");
  check(/Developer-output gate/.test(verify), "verify must keep the Developer-output gate for repo/PR claims");
  check(/concrete repo artifact/i.test(verify), "verify Developer-output gate must require concrete repo artifacts for headline support");
}

// Settlement is reality-only (v2.6.0): settle must NOT auto-offer /argus:sail on
// a missed/partial outcome (reopen-on-settle was over-fire).
const settleSkillPath = path.join(root, "skills", "resolve", "SKILL.md");
if (fs.existsSync(settleSkillPath)) {
  const settle = fs.readFileSync(settleSkillPath, "utf8");
  check(!/열린 질문이 하나 남았네요 — 잡아보려면: \/argus:sail/.test(settle), "settle must not auto-offer /argus:sail on a missed/partial outcome (reopen-on-settle over-fire, v2.6.0)");
  check(/reality-only/i.test(settle), "settle must state settlement is reality-only — reopening is the user's explicit move (v2.6.0)");
  // Single-source ledger writes (plugin-core Option A): every ledger mutation goes
  // through decision-ledger.js so the JSON shape can't drift from what the readers
  // replay (the Honest-Structure invariant — a hand-written template is a wire the
  // compiler/CI can't see). resolve imports a due seed via `record` and pushes a
  // pending contract via `amend`; neither may hand-write harvest/seal/amend JSON.
  check(/decision-ledger\.js" record\b/.test(settle), "resolve must import a read seed through `decision-ledger.js record`, not hand-written harvest+seal JSON");
  check(/decision-ledger\.js" amend\b/.test(settle), "resolve must push a pending contract through `decision-ledger.js amend`, not hand-written amend JSON");
  check(!/\{"event":"(harvest|seal|amend)"/.test(settle), "resolve must not hand-write harvest/seal/amend ledger JSON — route through decision-ledger.js (single-source shape)");
}

// clarify's BIND lean and preapprove's plan seal both birth a FRESH predicate —
// they must use `decision-ledger.js record` (harvest+seal), never hand-written JSON.
const clarifyLeanPath = path.join(root, "skills", "review", "clarify.md");
if (fs.existsSync(clarifyLeanPath)) {
  const clarify = fs.readFileSync(clarifyLeanPath, "utf8");
  check(/decision-ledger\.js" record\b/.test(clarify), "clarify BIND lean must be written through `decision-ledger.js record`, not hand-written harvest+seal JSON");
  check(/record[\s\S]{0,220}--author user/.test(clarify), "clarify's record call must carry --author user (the lean is the user's own bet, R57/R58 provenance)");
  check(!/\{"event":"(harvest|seal|amend)"/.test(clarify), "clarify must not hand-write harvest/seal ledger JSON — route through decision-ledger.js");
}
const preapproveLedgerPath = path.join(root, "skills", "preapprove", "SKILL.md");
if (fs.existsSync(preapproveLedgerPath)) {
  const preapprove = fs.readFileSync(preapproveLedgerPath, "utf8");
  check(/decision-ledger\.js" record\b/.test(preapprove), "preapprove must seal a plan through `decision-ledger.js record`, not hand-written harvest+seal JSON");
  check(!/\{"event":"(harvest|seal|amend)"/.test(preapprove), "preapprove must not hand-write harvest/seal ledger JSON — route through decision-ledger.js");
}
// sail's in-session Wake (Step 7.5) records the lean's 1st settlement — a ledger
// `wake` event that must go through the single-source CLI, never hand-written JSON.
const sailWakePath = path.join(root, "skills", "review", "pipeline.md");
if (fs.existsSync(sailWakePath)) {
  const sailWake = fs.readFileSync(sailWakePath, "utf8");
  check(/decision-ledger\.js" wake\b/.test(sailWake), "sail Wake (Step 7.5) must record through `decision-ledger.js wake`, not hand-written wake JSON");
  check(!/\{"event":"wake"/.test(sailWake), "sail must not hand-write a wake ledger JSON line — route through decision-ledger.js (single-source shape)");
}

// The tracked-items store (.argus/items.jsonl) is also single-source (Option A):
// premises (add/edit/alert/recheck/dismiss) and clarify (extract) must route through
// `decision-ledger.js premises <op>`, never hand-written items JSON. The reducer that
// replays them is check-contracts.js; argus-mcp one-install.test.ts locks the
// CLI-op ↔ reducer-consumption contract.
const ITEMS_JSON = /\{\s*"?event"?:\s*"(extract|add|edit|alert|recheck|dismiss)"/;
const premisesItemsPath = path.join(root, "skills", "premises", "SKILL.md");
if (fs.existsSync(premisesItemsPath)) {
  const premises = fs.readFileSync(premisesItemsPath, "utf8");
  check(/decision-ledger\.js" premises\b/.test(premises), "premises must write items through `decision-ledger.js premises <op>`, not hand-written items.jsonl JSON");
  check(!ITEMS_JSON.test(premises), "premises must not hand-write items.jsonl event JSON — route through decision-ledger.js (single-source shape)");
}
const clarifyItemsPath = path.join(root, "skills", "review", "clarify.md");
if (fs.existsSync(clarifyItemsPath)) {
  const clarifyItems = fs.readFileSync(clarifyItemsPath, "utf8");
  check(/decision-ledger\.js" premises extract\b/.test(clarifyItems), "clarify must emit decision items through `decision-ledger.js premises extract`, not hand-written extract JSON");
  check(!ITEMS_JSON.test(clarifyItems), "clarify must not hand-write items.jsonl event JSON — route through decision-ledger.js");
}

const draft = readJson(path.join(root, "data", "schemas", "draft.json"));
if (draft) {
  // v2.1: the draft node is a thin tree pointer — boss review is a small boolean
  // flag; the full feedback/scaffold/mix live write-once in the version dir.
  check(draft.properties?.boss_reviewed?.type === "boolean", "Draft.boss_reviewed must be a boolean flag");
  check(!draft.properties?.final_scaffold && !draft.properties?.final_mix && !draft.properties?.dm_feedback,
    "Draft must not embed final_scaffold/final_mix/dm_feedback (they belong in the version dir, not the session skeleton)");
}

const sessionSchema = readJson(path.join(root, "data", "schemas", "session.json"));
if (sessionSchema) {
  check(
    sessionSchema.properties?.invoking_context?.properties?.target_type?.enum?.includes("plan"),
    "Session invoking_context.target_type must include plan (AI-generated plan approval path)"
  );
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

const pushScript = path.join(root, "scripts", "push-webapp.js");
check(fs.existsSync(pushScript), "missing scripts/push-webapp.js (used by /argus:connect, /argus:push, /argus:pull, and /argus:sync)");
if (fs.existsSync(pushScript)) {
  const result = spawnSync(process.execPath, ["--check", pushScript], { encoding: "utf8" });
  check(result.status === 0, `push-webapp syntax check failed: ${result.stderr || result.stdout}`);
}

const decisionLedgerScript = path.join(root, "scripts", "decision-ledger.js");
check(fs.existsSync(decisionLedgerScript), "missing scripts/decision-ledger.js (used by /argus:scan and /argus:predict)");
if (fs.existsSync(decisionLedgerScript)) {
  const result = spawnSync(process.execPath, ["--check", decisionLedgerScript], { encoding: "utf8" });
  check(result.status === 0, `decision-ledger syntax check failed: ${result.stderr || result.stdout}`);
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
