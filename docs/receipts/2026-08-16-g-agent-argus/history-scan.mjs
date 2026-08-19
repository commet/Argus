#!/usr/bin/env node
/**
 * G 보강 — 봉인된 가정을 저장소 **과거**에 소급 적용한다.
 *
 * 왜: G의 첫 측정(n=1)은 사후 설계 편향이 가장 큰 한계였다 — 실패를 알고 나서
 * 그 실패를 잡는 검사기를 만들었기 때문이다. 이 스크립트는 그 편향이 없는
 * 검사기(zone_purity: CLAUDE.md에 이미 적힌 규약을 그대로 옮긴 것)를 최근
 * 커밋 N개에 소급해, "이 검사기가 켜져 있었다면 몇 번 울렸을까"를 실측한다.
 *
 * 실행: node history-scan.mjs [N]   (기본 60)
 */
import { execSync } from 'node:child_process';

const N = Number(process.argv[2] || 60);
const sh = (c) => { try { return execSync(c, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim(); } catch { return ''; } };

// CLAUDE.md 규약 그대로: MIT 존(argus-mcp·argus-plugin-v2)과 앱 존(src)을 한
// PR에 섞지 않는다. docs는 어느 존에도 속하지 않으므로 판정에서 제외한다.
const zoneOf = (f) =>
  f.startsWith('argus-mcp/') || f.startsWith('argus-plugin-v2/') ? 'MIT'
    : f.startsWith('src/') ? 'app'
      : f.startsWith('method-harness/') ? 'harness'
        : 'docs';

const log = sh(`git log origin/main -${N} --format=%H%x09%s`);
const rows = [];
let total = 0;
for (const line of log.split('\n')) {
  if (!line.trim()) continue;
  const [h, subj] = line.split('\t');
  const files = sh(`git diff --name-only ${h}^ ${h}`).split('\n').filter(Boolean);
  if (!files.length) continue;
  total += 1;
  const zones = [...new Set(files.map(zoneOf))].filter((z) => z !== 'docs').sort();
  if (zones.length > 1) rows.push({ h: h.slice(0, 8), zones: zones.join('+'), subj: (subj || '').slice(0, 62), n: files.length });
}

const L = [];
L.push('G 보강 — 봉인 가정의 과거 소급 적용 (사후 편향 없는 표본)');
L.push('='.repeat(64));
L.push('');
L.push(`검사한 가정: S3/A3 한-PR-한-존 (CLAUDE.md 규약을 그대로 옮긴 검사기)`);
L.push(`대상: origin/main 최근 커밋 ${total}건`);
L.push('');
L.push(`위반: ${rows.length}건 (${total ? ((rows.length / total) * 100).toFixed(1) : 0}%)`);
L.push('');
for (const r of rows) L.push(`  ${r.h} · ${r.zones.padEnd(16)} · ${String(r.n).padStart(3)}파일 · ${r.subj}`);
L.push('');
L.push('-'.repeat(64));
L.push('중요: 이 커밋들은 전부 CI를 통과해 머지됐다. 저장소의 워크플로와 가드');
L.push('테스트 어디에도 존 혼합 검사가 없다 — 규약은 PR 템플릿의 체크박스로만');
L.push('존재하고, 체크박스는 사람이 켠다. 기계가 검사하지 않는 규약의 준수율이');
L.push('이 숫자다.');
console.log(L.join('\n'));
