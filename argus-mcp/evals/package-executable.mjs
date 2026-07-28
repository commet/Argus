#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entry = path.join(root, 'dist', 'index.js');

if (process.platform === 'win32') {
  console.log('Windows uses npm .cmd shims; POSIX executable-mode checks run in CI.');
  process.exit(0);
}

const failures = [];
if ((fs.statSync(entry).mode & 0o111) === 0) {
  failures.push('dist/index.js has no executable bit');
}

const packed = JSON.parse(execFileSync(
  'npm',
  ['pack', '--dry-run', '--json', '--ignore-scripts'],
  { cwd: root, encoding: 'utf8' },
));
// npm <=11 returns an array; npm 12 returns an object keyed by package name.
// The artifact data is the same, so normalize both current wire shapes.
const packRecord = Array.isArray(packed) ? packed[0] : Object.values(packed)[0];
const packedEntry = packRecord?.files?.find((file) => file.path === 'dist/index.js');
if (!packedEntry || (Number(packedEntry.mode) & 0o111) === 0) {
  failures.push(`packed dist/index.js is not executable (mode=${packedEntry?.mode ?? 'missing'})`);
}

if (failures.length) {
  console.error(`Package executable gate FAILED:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('2 checks · dist/index.js is executable before and inside npm pack.');
