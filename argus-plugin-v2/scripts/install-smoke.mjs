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
  const result = spawnSync(bin, args, {
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
if (skills.length === 0) fail('no skills found');
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

  const mcpPin = readJson(path.join(stagedPlugin, '.mcp.json'))
    .mcpServers?.['argus-decision']?.args?.find((arg) => /^argus-decision-mcp@/.test(arg));
  const pinnedVersion = String(mcpPin ?? '').split('@').at(-1);
  if (!pinnedVersion) throw new Error('staged .mcp.json has no exact argus-decision-mcp@version pin');

  if (publishedMode) {
    const published = command(npmBin, ['view', `argus-decision-mcp@${pinnedVersion}`, 'version', '--json'], {
      env,
      timeout: 60_000,
    }).trim();
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

  const runtimeClient = new Client(
    { name: 'argus-plugin-install-smoke', version: '1' },
    { capabilities: {} },
  );
  const runtimeTransport = new StdioClientTransport({
    command: installedMcp.command,
    args: installedMcp.args.map(expand),
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
    const reportedVersion = checked.structuredContent?.data?.server_version;
    if (reportedVersion !== pinnedVersion) {
      throw new Error(`installed MCP answered as ${reportedVersion}, expected exact pin ${pinnedVersion}`);
    }
  } finally {
    await runtimeClient.close();
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
