#!/usr/bin/env node
/**
 * Clean-install smoke check.
 *
 * This is deliberately a real Claude Code lifecycle, not another manifest
 * linter. It creates an isolated CLAUDE_CONFIG_DIR, adds a staged local
 * marketplace, installs Argus, checks the installed inventory, starts the MCP,
 * disables/enables/updates the plugin, and uninstalls it.
 *
 * Default mode stages the plugin with its MCP command pointed at this checkout's
 * built dist/index.js. That proves the pre-publish artifact and the actual
 * Claude host journey without pretending an unpublished npm version exists.
 *
 * Release mode leaves the npx pin untouched and additionally requires that the
 * exact package version exists on npm:
 *
 *   node argus-plugin-v2/scripts/install-smoke.mjs
 *   node argus-plugin-v2/scripts/install-smoke.mjs --published
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(pluginRoot, '..');
const mcpRoot = path.join(repoRoot, 'argus-mcp');
const publishedMode = process.argv.includes('--published')
  || process.env.ARGUS_INSTALL_SMOKE_RUNTIME === 'published';
const claudeBin = 'claude';
const npmBin = 'npm';
const requireFromMcp = createRequire(path.join(mcpRoot, 'package.json'));
const { Client } = await import(pathToFileURL(
  requireFromMcp.resolve('@modelcontextprotocol/sdk/client/index.js'),
).href);
const { StdioClientTransport } = await import(pathToFileURL(
  requireFromMcp.resolve('@modelcontextprotocol/sdk/client/stdio.js'),
).href);

const errors = [];
const fail = (message) => errors.push(message);
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

function command(bin, args, options = {}) {
  const run = () => spawnSync(bin, args, {
    cwd: options.cwd ?? repoRoot,
    env: options.env ?? process.env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: options.timeout ?? 120_000,
    windowsHide: true,
    // Node cannot spawn .cmd shims directly on Windows (EINVAL). The arguments
    // in this script are all fixed or paths created by mkdtemp, so resolving the
    // installed claude/npm shim through cmd.exe is both bounded and portable.
    shell: process.platform === 'win32',
  });
  let result = run();
  // Measured 2026-08-09: Windows can occasionally fail a freshly spawned
  // Claude CLI with STATUS_DLL_INIT_FAILED (0xC0000142) while the same isolated
  // lifecycle succeeds immediately afterwards. Retry this host-start failure
  // once; a repeated crash is still reported as a real red gate.
  const windowsDllInitFailure = result.status === 0xC0000142 || result.status === -1073741502;
  if (process.platform === 'win32' && windowsDllInitFailure) result = run();
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (result.error) throw new Error(`${bin} ${args.join(' ')}: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`${bin} ${args.join(' ')} exited ${result.status}\n${output.trim()}`);
  }
  return output;
}

// ── Static install preconditions ────────────────────────────────────────────
const market = readJson(path.join(repoRoot, '.claude-plugin', 'marketplace.json'));
const manifest = readJson(path.join(pluginRoot, '.claude-plugin', 'plugin.json'));
const marketPlugin = (market.plugins || []).find((plugin) => plugin.name === manifest.name);
if (!marketPlugin) fail(`marketplace.json has no plugin named "${manifest.name}"`);
else {
  if (marketPlugin.version !== manifest.version) {
    fail(`version mismatch: marketplace ${marketPlugin.version} vs plugin ${manifest.version}`);
  }
  const source = path.resolve(repoRoot, String(marketPlugin.source ?? '').replace(/^\.\//, ''));
  if (!fs.existsSync(source)) fail(`plugin source path does not resolve: ${marketPlugin.source}`);
}

const skillsDir = path.join(pluginRoot, 'skills');
const skills = fs.readdirSync(skillsDir)
  .filter((name) => !name.startsWith('_') && fs.statSync(path.join(skillsDir, name)).isDirectory());
const expectedSkills = ['check', 'help', 'history', 'loop', 'review', 'settings'];
if (JSON.stringify(skills.sort()) !== JSON.stringify(expectedSkills)) {
  fail(`skills/ must expose exactly ${expectedSkills.join(', ')}; found ${skills.join(', ')}`);
}
for (const skill of skills) {
  const file = path.join(skillsDir, skill, 'SKILL.md');
  if (!fs.existsSync(file)) {
    fail(`skill "${skill}" missing SKILL.md`);
    continue;
  }
  const head = fs.readFileSync(file, 'utf8').slice(0, 800);
  if (!/^---[\s\S]*\bname:\s*\S/m.test(head)) fail(`skill "${skill}" missing frontmatter name`);
  if (!/^---[\s\S]*\bdescription:\s*\S/m.test(head)) fail(`skill "${skill}" missing frontmatter description`);
}

const agentsDir = path.join(pluginRoot, 'agents');
const expectedAgents = ['domain-reviewer.md', 'evidence-reviewer.md', 'risk-reviewer.md', 'synthesizer.md'];
const actualAgents = fs.readdirSync(agentsDir).filter((name) => name.endsWith('.md')).sort();
if (JSON.stringify(actualAgents) !== JSON.stringify(expectedAgents)) {
  fail(`agents/ must contain only: ${expectedAgents.join(', ')}`);
}
for (const file of actualAgents) {
  const body = fs.readFileSync(path.join(agentsDir, file), 'utf8');
  if (!/\nmodel:\s*inherit\r?\n/.test(body)) fail(`${file} must use model: inherit`);
  if (!/\nmaxTurns:\s*\d+\r?\n/.test(body)) fail(`${file} must declare maxTurns`);
}

const hooksPath = path.join(pluginRoot, 'hooks', 'hooks.json');
if (fs.existsSync(hooksPath)) {
  try {
    const hooks = readJson(hooksPath);
    const commands = JSON.stringify(hooks).match(/scripts\/[A-Za-z0-9_.-]+\.(?:js|mjs)/g) || [];
    for (const referenced of commands) {
      if (!fs.existsSync(path.join(pluginRoot, referenced))) fail(`hooks.json references missing ${referenced}`);
    }
  } catch (error) {
    fail(`hooks.json invalid JSON: ${error.message}`);
  }
}

const schemaDir = path.join(pluginRoot, 'data', 'schemas');
if (fs.existsSync(schemaDir)) {
  for (const file of fs.readdirSync(schemaDir).filter((name) => name.endsWith('.json'))) {
    try {
      readJson(path.join(schemaDir, file));
    } catch (error) {
      fail(`schema ${file} invalid JSON: ${error.message}`);
    }
  }
}

const readme = fs.readFileSync(path.join(pluginRoot, 'README.md'), 'utf8');
if (!/plugin marketplace add commet\/Argus/i.test(readme)) fail('README missing marketplace add command');
if (!/plugin install argus@argus/i.test(readme)) fail('README missing plugin install command');

if (errors.length) {
  console.error(`Install smoke FAILED before Claude launch:\n  - ${errors.join('\n  - ')}`);
  process.exit(1);
}

// ── Real isolated Claude Code lifecycle ─────────────────────────────────────
//
// Everything above this line reads files. Everything below drives the actual
// Claude Code CLI, so it cannot run where that CLI is absent. Skip LOUDLY there
// rather than failing: this gate's entire value is that it touched a real
// install, and a red light that only means "the tool isn't here" trains people
// to ignore red lights. CI installs the CLI so the skip never fires there.
{
  const probe = spawnSync(claudeBin, ['--version'], { encoding: 'utf8', shell: process.platform === 'win32' });
  if (probe.error || probe.status !== 0) {
    console.log('Install smoke: manifest checks passed.');
    console.log('⏭  real Claude Code lifecycle SKIPPED — the `claude` CLI is not on PATH here.');
    process.exit(0);
  }
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-plugin-install-'));
const stagedRepo = path.join(tempRoot, 'marketplace');
const configDir = path.join(tempRoot, 'claude-config');
const stagedPlugin = path.join(stagedRepo, 'argus-plugin-v2');
const env = {
  ...process.env,
  CLAUDE_CONFIG_DIR: configDir,
  CLAUDE_PROJECT_DIR: repoRoot,
};

try {
  fs.mkdirSync(stagedRepo, { recursive: true });
  fs.cpSync(path.join(repoRoot, '.claude-plugin'), path.join(stagedRepo, '.claude-plugin'), { recursive: true });
  fs.cpSync(pluginRoot, stagedPlugin, {
    recursive: true,
    filter: (source) => !source.includes(`${path.sep}node_modules${path.sep}`),
  });

  command(claudeBin, ['--version'], { env });
  command(claudeBin, ['plugin', 'validate', stagedRepo], { env });

  // 2026-07-30: the wire goes through scripts/mcp-launch.js (online → registry-
  // fresh bare name; offline → --offline cached copy, measured). The spec string
  // lives in the launcher, so the smoke follows it there — same contract, new home.
  const stagedArgs = readJson(path.join(stagedPlugin, '.mcp.json'))
    .mcpServers?.['argus-decision']?.args ?? [];
  const launcherArg = stagedArgs.find((arg) => /mcp-launch\.js$/.test(String(arg)));
  if (!launcherArg) throw new Error('staged .mcp.json does not launch scripts/mcp-launch.js');
  const launcherSrc = fs.readFileSync(path.join(stagedPlugin, 'scripts', 'mcp-launch.js'), 'utf8');
  const mcpPin = (/--package=(argus-decision-mcp[^"'\s]*)/.exec(launcherSrc) || [])[1];
  // The plugin names no version on purpose (measured 2026-07-29: npx re-resolves
  // a bare name every launch, a range never does), so what has to be true here is
  // the opposite of a pin — and the release still has to actually be on npm, or
  // a bare name resolves to yesterday's build for everyone.
  if (!mcpPin) throw new Error('staged mcp-launch.js does not exec argus-decision-mcp');
  if (/argus-decision-mcp@/.test(String(mcpPin))) {
    throw new Error(`staged wiring pins a version (${mcpPin}) — one install must keep receiving fixes`);
  }
  const pinnedVersion = readJson(path.join(mcpRoot, 'package.json')).version;

  if (publishedMode) {
    // npm publish can return before every registry edge serves the new version.
    // Retry the exact immutable version for a bounded 30 seconds; never fall
    // back to latest or a range, which could make a stale release look green.
    let published = '';
    let lastRegistryError;
    for (let attempt = 1; attempt <= 6; attempt++) {
      try {
        published = command(
          npmBin,
          ['view', `argus-decision-mcp@${pinnedVersion}`, 'version', '--json', '--prefer-online'],
          { env, timeout: 60_000 },
        ).trim();
        break;
      } catch (error) {
        lastRegistryError = error;
        if (attempt < 6) await new Promise((resolve) => setTimeout(resolve, 5_000));
      }
    }
    if (!published) throw lastRegistryError;
    if (!published.includes(pinnedVersion)) {
      throw new Error(`npm did not return the pinned version ${pinnedVersion}: ${published}`);
    }
  } else {
    command(npmBin, ['run', 'build'], { cwd: mcpRoot, env, timeout: 180_000 });
    const localDist = path.join(mcpRoot, 'dist', 'index.js');
    if (!fs.existsSync(localDist)) throw new Error(`local MCP build missing: ${localDist}`);
    const localMcp = readJson(path.join(stagedPlugin, '.mcp.json'));
    localMcp.mcpServers['argus-decision'] = {
      command: process.execPath,
      args: [localDist],
      env: { ARGUS_DIR: '${CLAUDE_PROJECT_DIR}/.argus' },
    };
    fs.writeFileSync(path.join(stagedPlugin, '.mcp.json'), `${JSON.stringify(localMcp, null, 2)}\n`);
  }

  command(claudeBin, ['plugin', 'marketplace', 'add', stagedRepo, '--scope', 'user'], { env });
  command(claudeBin, ['plugin', 'install', 'argus@argus', '--scope', 'user'], { env });

  let installed = JSON.parse(command(claudeBin, ['plugin', 'list', '--json'], { env }));
  let argus = installed.find((plugin) => plugin.id === 'argus@argus');
  if (!argus) throw new Error('argus@argus absent after install');
  if (!argus.enabled) throw new Error('argus@argus installed but disabled');
  if (argus.version !== manifest.version) {
    throw new Error(`installed plugin version ${argus.version}, expected ${manifest.version}`);
  }
  if (!argus.mcpServers?.['argus-decision']) throw new Error('installed plugin inventory has no Argus MCP');

  const details = command(claudeBin, ['plugin', 'details', 'argus@argus'], { env });
  if (!/argus-decision/i.test(details)) throw new Error('plugin details omit the Argus MCP');
  if (!/skill/i.test(details)) throw new Error('plugin details omit skills');

  const mcpList = command(claudeBin, ['mcp', 'list'], { env, timeout: 180_000 });
  const argusLine = mcpList.split(/\r?\n/).find((line) => /plugin:argus:argus-decision/i.test(line));
  if (!argusLine) throw new Error(`claude mcp list omitted plugin:argus:argus-decision\n${mcpList}`);
  if (!/Connected|연결됨|✓/.test(argusLine) || /Failed|실패|Disconnected|✗/.test(argusLine)) {
    throw new Error(`installed Argus MCP did not connect: ${argusLine.trim()}`);
  }

  // "Connected" is only the host's health label. Drive the exact command and
  // arguments reported by the INSTALLED inventory, then ask that process which
  // version and tools it actually serves. This catches a green plugin manager
  // wired to a stale npx cache, a wrong bin entry, or a different MCP process.
  const installedMcp = argus.mcpServers?.['argus-decision'];
  if (!installedMcp?.command || !Array.isArray(installedMcp.args)) {
    throw new Error('installed inventory has no executable Argus MCP command');
  }
  const journeyProject = path.join(tempRoot, 'user-project');
  fs.mkdirSync(journeyProject, { recursive: true });
  const expand = (value) => String(value)
    .replaceAll('${CLAUDE_PROJECT_DIR}', journeyProject)
    .replaceAll('${CLAUDE_PLUGIN_ROOT}', argus.installPath);
  const installedEnv = Object.fromEntries(
    Object.entries(installedMcp.env ?? {}).map(([key, value]) => [key, expand(value)]),
  );
  const journeyArgusDir = installedEnv.ARGUS_DIR || path.join(journeyProject, '.argus');
  if (path.resolve(journeyArgusDir) !== path.resolve(journeyProject, '.argus')) {
    throw new Error(`installed ARGUS_DIR does not resolve inside the isolated user project: ${journeyArgusDir}`);
  }

  const expandedRuntimeArgs = installedMcp.args.map(expand);
  const windowsNpmShim = process.platform === 'win32'
    && ['npm', 'npx'].includes(installedMcp.command.toLowerCase());
  const runtimeCommand = windowsNpmShim
    ? (process.env.ComSpec || 'cmd.exe')
    : installedMcp.command;
  const runtimeArgs = windowsNpmShim
    ? ['/d', '/s', '/c', installedMcp.command, ...expandedRuntimeArgs]
    : expandedRuntimeArgs;
  if (process.env.ARGUS_INSTALL_SMOKE_DEBUG === '1') {
    console.error(`installed runtime: ${JSON.stringify({ command: runtimeCommand, args: runtimeArgs })}`);
  }

  // Registry-propagation retry (2026-07-30, measured on the v2.0.18 run):
  // seconds after `npm publish` returns, a registry edge can still resolve the
  // bare name to the PREVIOUS version — this probe launched 2.0.17 and went red
  // while 2.0.18 was in fact live. A bare name re-asks the registry on every
  // launch, so the honest move is to relaunch a few times over ~1 minute
  // before declaring the real 2.0.4-class accident (published build ≠ tag).
  const launchAndCheck = async () => {
    const runtimeClient = new Client(
      { name: 'argus-plugin-install-smoke', version: '1' },
      { capabilities: {} },
    );
    const runtimeTransport = new StdioClientTransport({
      // npm exposes npm/npx as .cmd shims on Windows. Claude Code knows how to launch
      // that host command, but Node's direct spawn (used by this independent
      // inventory check) needs the bounded cmd.exe shim explicitly.
      command: runtimeCommand,
      args: runtimeArgs,
      // Never run npm exec from the argus-mcp source checkout. npm prefers a
      // matching top-level local package there, but top-level packages do not get
      // their own node_modules/.bin link. A real user's host starts in their
      // project, so make the independent probe do the same.
      cwd: journeyProject,
      env: {
        ...env,
        CLAUDE_PROJECT_DIR: journeyProject,
        ...installedEnv,
      },
    });
    try {
      await runtimeClient.connect(runtimeTransport);
      const listed = await runtimeClient.listTools();
      const toolNames = new Set(listed.tools.map((tool) => tool.name));
      for (const expected of [
        'argus_check_in',
        'argus_predict',
        'argus_resolve',
        'argus_capture',
        'argus_patterns',
        'argus_settings',
      ]) {
        if (!toolNames.has(expected)) {
          throw new Error(`installed MCP is missing public tool ${expected}: ${[...toolNames].join(', ')}`);
        }
      }
      const checked = await runtimeClient.callTool({
        name: 'argus_check_in',
        arguments: { argus_dir: journeyArgusDir },
      });
      return checked.structuredContent?.data?.server_version;
    } finally {
      await runtimeClient.close();
    }
  };
  let reportedVersion;
  for (let attempt = 1; attempt <= 6; attempt++) {
    reportedVersion = await launchAndCheck();
    if (reportedVersion === pinnedVersion) break;
    if (attempt < 6) {
      console.error(`installed MCP answered as ${reportedVersion}, expected ${pinnedVersion} — registry may still be propagating, retry ${attempt}/5 in 12s`);
      await new Promise((resolve) => setTimeout(resolve, 12_000));
    }
  }
  if (reportedVersion !== pinnedVersion) {
    throw new Error(`installed MCP answered as ${reportedVersion}, expected exact pin ${pinnedVersion}`);
  }

  command(claudeBin, ['plugin', 'disable', 'argus@argus', '--scope', 'user'], { env });
  installed = JSON.parse(command(claudeBin, ['plugin', 'list', '--json'], { env }));
  argus = installed.find((plugin) => plugin.id === 'argus@argus');
  if (!argus || argus.enabled) throw new Error('disable lifecycle did not disable argus@argus');

  command(claudeBin, ['plugin', 'enable', 'argus@argus', '--scope', 'user'], { env });
  installed = JSON.parse(command(claudeBin, ['plugin', 'list', '--json'], { env }));
  argus = installed.find((plugin) => plugin.id === 'argus@argus');
  if (!argus?.enabled) throw new Error('enable lifecycle did not re-enable argus@argus');

  command(claudeBin, ['plugin', 'update', 'argus@argus', '--scope', 'user'], { env });
  command(claudeBin, ['plugin', 'uninstall', 'argus@argus', '--scope', 'user', '--yes'], { env });
  installed = JSON.parse(command(claudeBin, ['plugin', 'list', '--json'], { env }));
  if (installed.some((plugin) => plugin.id === 'argus@argus')) {
    throw new Error('argus@argus remained installed after uninstall');
  }

  const runtime = publishedMode ? `published npm ${pinnedVersion}` : 'local pre-publish MCP build';
  console.log(
    `Install smoke passed: real Claude Code install → inventory → MCP connect → disable/enable/update → uninstall `
    + `+ installed-command tool call (${skills.length} skills, plugin v${manifest.version}, ${runtime}).`,
  );
} catch (error) {
  console.error(`Install smoke FAILED (${publishedMode ? 'published' : 'local'} runtime):\n${error.message}`);
  process.exitCode = 1;
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
