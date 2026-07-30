#!/usr/bin/env node
/*
 * MCP launcher: current-when-online, alive-when-offline (2026-07-30, measured).
 *
 * The wiring is deliberately UNPINNED — npx re-resolves a bare name against the
 * registry every launch, so one install keeps receiving fixes (3.0.14 decision).
 * Measured cost of that decision: with the registry unreachable, `npm exec`
 * neither falls back to the cache nor fails fast — it hangs, and the decision
 * tools silently never appear (a 45s probe saw no output at all). `--offline`
 * DOES launch the newest cached copy.
 *
 * So: probe the registry with a short timeout, then
 *   reachable   → `npm exec` on the bare name (byte-identical to the old wire)
 *   unreachable → `npm exec --offline` (stale-but-alive; doctor shows staleness)
 *
 * stdio is inherited — this process is a pure prelude, the MCP server owns the
 * pipes the moment it spawns. Exit codes pass through.
 */
const { spawn } = require("node:child_process");
const https = require("node:https");

const PROBE_TIMEOUT_MS = 2500;

function registryReachable(cb) {
  // Test hook: force the offline path without needing to unplug the machine.
  if (process.env.ARGUS_MCP_LAUNCH_FORCE_OFFLINE === "1") return cb(false);
  let settled = false;
  const done = (ok) => { if (!settled) { settled = true; cb(ok); } };
  try {
    const req = https.request(
      { host: "registry.npmjs.org", method: "HEAD", path: "/argus-decision-mcp", timeout: PROBE_TIMEOUT_MS },
      (res) => { res.resume(); done(true); },
    );
    req.on("timeout", () => { req.destroy(); done(false); });
    req.on("error", () => done(false));
    req.end();
  } catch {
    done(false);
  }
}

registryReachable((online) => {
  const args = [
    "exec", "--yes",
    ...(online ? [] : ["--offline"]),
    "--package=argus-decision-mcp", "--", "argus-decision-mcp",
  ];
  const isWin = process.platform === "win32";
  const child = spawn(isWin ? "npm.cmd" : "npm", args, {
    stdio: "inherit",
    shell: isWin,
  });
  child.on("exit", (code, signal) => process.exit(signal ? 1 : (code ?? 1)));
  child.on("error", () => process.exit(1));
});
