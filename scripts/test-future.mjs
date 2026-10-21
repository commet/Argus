#!/usr/bin/env node
/**
 * **달력을 밀어 놓고 같은 스위트를 돌린다** (앱 존).
 *
 * 기한(`due_at`·`check_by`·`expires_at` …)은 **실제 시계**와 대조된다. 그래서
 * 시험에 "미래"라고 적어 둔 날짜는 그 날이 지나는 순간 과거가 되고, 코드가
 * 한 줄도 안 바뀐 채로 빨간불이 된다.
 *
 * 2026-09-10 에 이 방식으로 앱 존에서 한 건을 찾았다 —
 * `epistemic-agency-e2-control-plane.test.ts` 의 승인 만기. 그 파일은 2026-08-01
 * 에 이미 같은 것으로 한 번 무너져 주석까지 달아 뒀는데, 고정 literal 인 `NOW`
 * 에서 만기를 파생시켜 **365일을 산 것뿐이었다.**
 *
 * 날짜 글자를 훑는 검사(`no-future-date-literals.test.ts`)도 함께 두지만 그것은
 * 근사치다 — 같은 날 실측에서 **이 건을 놓쳤다.** 글자만 봐서는 그 값이 실제
 * 시계와 대조되는지 알 수 없기 때문이다. 이쪽이 판정이고 저쪽은 조기경보다.
 *
 *   npm run test:future                  # 기본: 오늘 +400일
 *   node scripts/test-future.mjs 2030-01-01
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DAYS = 400;
const when = process.argv[2] || process.env.FAKE_TODAY
  || new Date(Date.now() + DEFAULT_DAYS * 86_400_000).toISOString();
const preload = pathToFileURL(path.join(HERE, 'future-clock.mjs')).href;

console.log(`달력을 ${when.slice(0, 10)} 로 밀고 같은 스위트를 돌립니다 (기본 +${DEFAULT_DAYS}일).`);
console.log('빨간불이 나면 그 시험은 그 날이 오면 터진다는 뜻입니다 (코드는 안 바뀌어도).\n');

const r = spawnSync('npx', ['vitest', 'run'], {
  cwd: path.join(HERE, '..'),
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    FAKE_TODAY: when,
    NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import ${preload}`.trim(),
  },
});

if (r.status !== 0) {
  console.error(`\n❌ ${when.slice(0, 10)} 에 터질 시험이 남아 있습니다.`);
  console.error('   고치는 법: 기한을 글자로 박지 말고 실제 시계에서 상대로 센다.');
}
process.exit(r.status ?? 1);
