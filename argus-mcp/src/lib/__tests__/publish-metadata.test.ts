import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Publish-metadata drift guard (loud gate).
 *
 * argus-mcp is published to BOTH npm (package.json) and the MCP registry
 * (server.json), and its release is described in CHANGELOG.md. These three drift
 * silently: the code reached 1.3.0 (premises) and then 1.4.0 (document review)
 * while package.json + server.json still said 1.0.0 — so a publish would have
 * shipped the wrong version, and 1.0.0 was already taken on npm. Nothing turned
 * red because a version string is just data no consumer re-derives.
 *
 * This pins the invariant so a feature that advances the code must ALSO bump the
 * version in every manifest AND add a CHANGELOG entry — or CI fails here. The
 * CHANGELOG-top === package.version check is the load-bearing one: it forces the
 * changelog to keep pace with the shipped version (the exact gap that hid).
 */

const root = new URL('../../../', import.meta.url); // src/lib/__tests__ → package root
const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
const server = JSON.parse(readFileSync(new URL('server.json', root), 'utf8'));
const changelog = readFileSync(new URL('CHANGELOG.md', root), 'utf8');

describe('publish metadata is internally consistent', () => {
  it('version matches across package.json and server.json (top-level + npm package entry)', () => {
    expect(server.version).toBe(pkg.version);
    expect(server.packages[0].version).toBe(pkg.version);
  });

  it('the CHANGELOG top entry names the shipped version (forces a changelog per release)', () => {
    const firstHeader = changelog.match(/^##\s+(\d+\.\d+\.\d+)\b/m);
    expect(firstHeader, 'CHANGELOG.md must have a "## X.Y.Z" entry').not.toBeNull();
    expect(firstHeader![1]).toBe(pkg.version);
  });

  it('npm namespace ownership + identity line up (mcpName ↔ server name ↔ npm identifier)', () => {
    expect(pkg.mcpName).toBe(server.name);
    expect(server.packages[0].identifier).toBe(pkg.name);
    expect(server.packages[0].registryType).toBe('npm');
    expect(server.packages[0].transport.type).toBe('stdio');
  });

  it('version is a clean semver and past the already-published 1.0.0', () => {
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(pkg.version).not.toBe('1.0.0'); // 1.0.0 is taken on npm — never re-publish it
  });
});
