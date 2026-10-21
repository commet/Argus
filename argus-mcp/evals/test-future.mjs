#!/usr/bin/env node
/**
 * **달력을 밀어 놓고 같은 스위트를 돌린다.**
 *
 * `check_by` 같은 기한은 **실제 시계**와 대조된다. 그래서 시험에 "미래"라고
 * 적어 둔 날짜는 그 날이 지나는 순간 과거가 되고, 봉인이 **정당하게**
 * 거절하면서 시험이 빨간불이 된다 — 코드는 한 줄도 안 바뀐 채로.
 *
 * 2026-09 에 실제로 그랬다. `evals/e2e-picker.mjs` 의 `'2026-09-01'` 이
 * 09-02 에 과거가 됐고, 픽커가 안 떠서 게이트는 **"픽커 실발사 실패"라고
 * 틀린 곳을 가리켰다.** 18일 걸렸다.
 *
 * 처음엔 날짜 글자를 훑는 검사를 짰는데, 같은 날 실측으로 그것이 **놓치기도
 * 하고 헛짚기도 한다**는 것이 드러났다 (`loop.test.ts` 는 못 잡고
 * `schema-validation.test.ts` 는 헛짚었다 — 글자만 봐서는 그 값이 실제
 * 시계와 대조되는지 알 수 없기 때문이다). 그래서 그 검사를 MIT 존에
 * 넓히는 대신 **그냥 달력을 밀고 돌린다.** 손목록이 없으니 같이 늙지도
 * 않는다 (§6 함정 13).
 *
 *   npm run test:future                      # 기본: 2027-03-01
 *   node evals/test-future.mjs 2028-06-01    # 더 멀리 밀어 본다
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// 기본값은 날짜가 아니라 거리다 — 고정 날짜를 적으면 이 계측기 자신이 폭탄이 된다.
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
  console.error('   고치는 법: 글자로 박힌 날짜를 test-helpers.ts 의 inDays(n) 로 바꾼다.');
}
process.exit(r.status ?? 1);
