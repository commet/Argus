/**
 * 검증 루프 러너 — "오류 나도 끝까지 다시 돌린다"(창업자 지시).
 *
 * capture.mjs를 감싸 전체 여정(complete-full 표면)이 잡힐 때까지 자동 재시도한다.
 * LLM 타임아웃/스트림 abort/HMR 순간오류 등 우리 쪽이 아닌 흔들림에 굴하지 않고
 * goal(끝까지 완주 캡처)을 달성할 때까지 K회 재시도. 서버가 죽었으면 되살린다.
 *
 * 사용: node scripts/uiux-loop/run.mjs [--scenario N] [--tries 5] [--base URL]
 * 종료코드: 0 = 완주 캡처 성공, 1 = K회 모두 실패(정직한 실패).
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const val = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const scenario = val('--scenario', '0');
const base = val('--base', 'http://localhost:3000');
const TRIES = Number(val('--tries', '5'));
const GALLERY = join(__dir, 'gallery', 'surfaces.json');

function serverUp() {
  const r = spawnSync('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', `${base}/ko/workspace`], { encoding: 'utf8' });
  return (r.stdout || '').trim() === '200';
}

function reachedGoal() {
  if (!existsSync(GALLERY)) return false;
  try {
    const d = JSON.parse(readFileSync(GALLERY, 'utf8'));
    return d.surfaces.some(s => s.name === 'complete-full' || s.name === 'complete-bearing');
  } catch { return false; }
}

function run() {
  for (let t = 1; t <= TRIES; t++) {
    if (!serverUp()) {
      console.log(`[run] 서버 응답 없음 — 60초 대기 후 재확인 (try ${t}/${TRIES})`);
      // 서버는 preview_start로 띄우므로 여기선 기다리기만. 죽었으면 사람이 살려야.
      spawnSync('node', ['-e', 'setTimeout(()=>{},60000)']);
      if (!serverUp()) { console.log('[run] 여전히 다운 — 다음 시도로'); continue; }
    }
    console.log(`\n[run] ===== 캡처 시도 ${t}/${TRIES} (scenario ${scenario}) =====`);
    const r = spawnSync('node', [join(__dir, 'capture.mjs'), '--scenario', scenario, '--base', base],
      { stdio: 'inherit', timeout: 8 * 60 * 1000 });
    if (r.error) console.log('[run] capture 프로세스 오류:', r.error.message);
    if (reachedGoal()) {
      console.log(`[run] ✅ GOAL 달성 — 완주 캡처 성공 (try ${t})`);
      process.exit(0);
    }
    console.log(`[run] 완주 실패 — 재시도 (${t}/${TRIES})`);
  }
  console.log(`[run] ❌ ${TRIES}회 모두 완주 실패 (정직한 실패)`);
  process.exit(1);
}

run();
