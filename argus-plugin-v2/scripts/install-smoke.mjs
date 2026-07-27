#!/usr/bin/env node
// Clean-install smoke check — the automated half of "does `/plugin install argus@argus`
// actually work on a fresh machine." Validates the install preconditions that a
// marketplace install depends on, so a broken manifest can't ship undetected.
// (The human half — one real install + screenshot — is still owed; this guards the rest.)
//
// Checks: marketplace.json ↔ plugin.json version parity; the plugin source path
// resolves; every skill dir has a SKILL.md with frontmatter name/description; every
// bounded reviewer definitions resolve; hooks.json + every schema parse;
// the documented install commands are present in the README.
//
// Run: node argus-plugin-v2/scripts/install-smoke.mjs   (exit 0 ok / 1 fail)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(pluginRoot, '..');

const errors = [];
const fail = (m) => errors.push(m);
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

// 1. marketplace.json ↔ plugin.json
const market = readJson(path.join(repoRoot, '.claude-plugin', 'marketplace.json'));
const manifest = readJson(path.join(pluginRoot, '.claude-plugin', 'plugin.json'));
const marketPlugin = (market.plugins || []).find((p) => p.name === manifest.name);
if (!marketPlugin) fail(`marketplace.json has no plugin named "${manifest.name}"`);
else {
  if (marketPlugin.version !== manifest.version) fail(`version mismatch: marketplace ${marketPlugin.version} vs plugin ${manifest.version}`);
  const src = path.resolve(repoRoot, '.claude-plugin', marketPlugin.source || '');
  // source is relative to repo root (e.g. ./argus-plugin-v2)
  const srcAbs = path.resolve(repoRoot, marketPlugin.source.replace(/^\.\//, ''));
  if (!fs.existsSync(srcAbs)) fail(`plugin source path does not resolve: ${marketPlugin.source}`);
}

// 2. every skill dir has a SKILL.md with name+description frontmatter
const skillsDir = path.join(pluginRoot, 'skills');
// `_`-prefixed dirs (e.g. _generated, holding auto-generated reference fragments)
// are NOT skills — skip them.
const skills = fs.readdirSync(skillsDir).filter((d) => !d.startsWith('_') && fs.statSync(path.join(skillsDir, d)).isDirectory());
if (skills.length === 0) fail('no skills found');
for (const s of skills) {
  const md = path.join(skillsDir, s, 'SKILL.md');
  if (!fs.existsSync(md)) { fail(`skill "${s}" missing SKILL.md`); continue; }
  const head = fs.readFileSync(md, 'utf8').slice(0, 600);
  if (!/^---[\s\S]*\bname:\s*\S/m.test(head)) fail(`skill "${s}" SKILL.md missing frontmatter name`);
  if (!/^---[\s\S]*\bdescription:\s*\S/m.test(head)) fail(`skill "${s}" SKILL.md missing frontmatter description`);
}

// 3. the bounded reviewer set is complete and contains no legacy personas
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

// 4. hooks.json + every schema parse cleanly, and hook commands reference real scripts
const hooksPath = path.join(pluginRoot, 'hooks', 'hooks.json');
if (fs.existsSync(hooksPath)) {
  try {
    const hooks = readJson(hooksPath);
    const cmds = JSON.stringify(hooks).match(/scripts\/[A-Za-z0-9_.-]+\.(?:js|mjs)/g) || [];
    for (const c of cmds) if (!fs.existsSync(path.join(pluginRoot, c))) fail(`hooks.json references missing ${c}`);
  } catch (e) { fail(`hooks.json invalid JSON: ${e.message}`); }
}
const schemaDir = path.join(pluginRoot, 'data', 'schemas');
if (fs.existsSync(schemaDir)) {
  for (const f of fs.readdirSync(schemaDir).filter((f) => f.endsWith('.json'))) {
    try { readJson(path.join(schemaDir, f)); } catch (e) { fail(`schema ${f} invalid JSON: ${e.message}`); }
  }
}

// 5. README documents the install path users actually run
const readme = fs.readFileSync(path.join(pluginRoot, 'README.md'), 'utf8');
if (!/plugin marketplace add commet\/Argus/i.test(readme)) fail('README missing "/plugin marketplace add commet/Argus"');
if (!/plugin install argus@argus/i.test(readme)) fail('README missing "/plugin install argus@argus"');

if (errors.length) {
  console.error('Install smoke FAILED:\n  - ' + errors.join('\n  - '));
  process.exit(1);
}
console.log(`Install smoke passed (${skills.length} skills, manifests in parity at v${manifest.version}).`);
