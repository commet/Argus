#!/usr/bin/env node
/**
 * The plugin must name every confirm surface the server can report.
 *
 * `argus_check_in` returns `data.picker` as one of three values, and the plugin
 * is the only place that turns that value into a sentence a human reads. When
 * 1.15.0 added the MCP Apps `card`; the doctor workflow still knew only `one_tap`
 * and `text_fallback` — so a Claude Desktop user, the one host where the card
 * actually renders, got NO line at all for it. The item did not read as broken;
 * it simply was not there, which is the silent-drift class this repo keeps
 * catching in exactly this shape (a producer gains a case, the consumer does
 * not, nothing turns red).
 *
 * This gate derives the values from the MCP source and fails if any surface
 * that has to speak them cannot. Do NOT hard-code the list here; that would
 * recreate the drift one layer up.
 *
 * 무엇이 이걸 빨간불로 만드나: wireFacts()에 네 번째 값을 더하고 doctor.md는
 * 그대로 두면 이 게이트가 그 값을 이름으로 지목하며 실패한다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const CHECK_IN = path.join(ROOT, 'argus-mcp', 'src', 'tools', 'check-in.ts');

// The producer: `picker: 'card' | 'one_tap' | 'text_fallback'` in wireFacts().
const src = fs.readFileSync(CHECK_IN, 'utf8');
const decl = src.match(/picker:\s*((?:'[a-z_]+'\s*\|\s*)*'[a-z_]+')/);
if (!decl) {
  console.error('FAIL: could not read the picker union from check-in.ts — this gate is blind, fix it before merging.');
  process.exit(1);
}
const values = decl[1].split('|').map((v) => v.trim().replace(/'/g, '')).filter(Boolean);
if (values.length < 2) {
  console.error(`FAIL: parsed an implausible picker union (${values.join(', ')}) — the gate is misreading the source.`);
  process.exit(1);
}

// The consumers: every plugin surface that has to explain the value to a human.
const CONSUMERS = [
  path.join(ROOT, 'argus-plugin-v2', 'lib', 'workflows', 'doctor.md'),
  path.join(ROOT, 'argus-plugin-v2', 'lib', 'workflows', 'resolve.md'),
];

let failures = 0;
for (const file of CONSUMERS) {
  const text = fs.readFileSync(file, 'utf8');
  const missing = values.filter((v) => !text.includes(`\`${v}\``));
  const rel = path.relative(ROOT, file);
  if (missing.length) {
    failures++;
    console.error(`FAIL ${rel}: never names ${missing.map((m) => `\`${m}\``).join(', ')} — a user on that host is told nothing about what they will see.`);
  } else {
    console.log(`ok   ${rel} names all ${values.length}: ${values.join(', ')}`);
  }
}

if (failures) {
  console.error('\n확인 표면이 늘었는데 그걸 설명하는 문장이 안 늘면, 사용자는 자기 호스트가 무엇을 보여줄지 영영 모른다.');
  process.exit(1);
}
console.log(`\n확인 표면 ${values.length}종을 플러그인의 모든 설명 지점이 이름으로 부른다.`);
