#!/usr/bin/env node
/**
 * Argus driver — doctor (P2-6). 설치·배선 자가진단.
 *
 * 설계 원칙:
 *  - **검사는 전부 이 스크립트가 결정론적으로 수행**하고, Claude는 출력을
 *    전달만 한다 (LLM을 진단 루프의 라우터로 쓰지 않는다 — 정직한 구조 원칙).
 *  - 읽기 전용: 어떤 파일도 만들거나 고치지 않는다. 수리는 각 담당 두뇌
 *    (argus_init 재실행, argus_check_in 재생성)가 한다 — doctor는 사실과
 *    다음 손잡이만 말한다 (스파인: 평결 없음, 개입 판단 대행 없음).
 *  - 모든 대상은 **절대 경로 평문** (정본 규칙 18 — 경로도 1급 표면).
 *  - 사용자 predicate 본문 등 untrusted 텍스트는 출력하지 않는다 (규칙 19).
 *  - 어떤 파손을 만나도 그 사실을 보고할 뿐 절대 던지지 않는다. exit 0.
 *
 * 검사 항목 (각 줄: OK / 상태 서술 — 뭐가 이 줄을 빨간불로 만드는가가 기준):
 *  1. 내구 홈(~/.argus 또는 ARGUS_HOME)과 registry.json 파싱
 *  2. 워크스페이스 바인딩(.argus/project.json)과 registry 대조
 *  3. 내구 원장 실존·줄수·파손 줄수(dropped_corrupt에 해당할 것)·마지막 event_id
 *  4. LOGBOOK projection 커서 fresh/stale
 *  5. 쓰기 락 상태 (없음 / pid 생존 보유 중 / 죽은 pid 잔재)
 *  6. v1 이전 marker + v1 스냅샷(ledger.v1.jsonl)
 *  7. 레거시 v1 원장 잔재 (worktree/.argus/ledger, ~/.argus/ledger — 참고용)
 */
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const cwd = process.cwd();
const home = process.env.ARGUS_HOME || path.join(os.homedir(), '.argus');
const out = [];
const say = (s) => out.push(s);

function pidAlive(pid) {
  if (!Number.isInteger(pid)) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return e && e.code === 'EPERM'; }
}

say('# argus doctor — 설치·배선 자가진단 (읽기 전용)');
say(`기준 워크스페이스: ${cwd}`);
say('');

// 1. 내구 홈 + registry
say(`[1] 내구 홈: ${home}${process.env.ARGUS_HOME ? ' (ARGUS_HOME 지정)' : ''}`);
const registryFile = path.join(home, 'registry.json');
let registry = null;
if (!fs.existsSync(registryFile)) {
  say(`    registry 없음 (${registryFile}) — 아직 어떤 리포도 등록 전. argus_init이 만든다.`);
} else {
  try {
    registry = JSON.parse(fs.readFileSync(registryFile, 'utf8'));
    say(`    registry OK — 등록 리포 ${Object.keys(registry.repositories || {}).length}개 (${registryFile})`);
  } catch {
    say(`    ⚠ registry 파손 — JSON 파싱 실패 (${registryFile}). v2 쓰기는 명시 거절 상태다. 파일을 백업 후 확인할 것.`);
  }
}

// 2. 바인딩
const bindingFile = path.join(cwd, '.argus', 'project.json');
let repositoryId = null;
say(`[2] 워크스페이스 바인딩: ${bindingFile}`);
if (!fs.existsSync(bindingFile)) {
  say('    바인딩 없음 — 이 워크스페이스는 v2 미사용. `argus_init`이 바인딩을 만든다.');
} else {
  try {
    const binding = JSON.parse(fs.readFileSync(bindingFile, 'utf8'));
    repositoryId = typeof binding.repository_id === 'string' ? binding.repository_id : null;
    if (!repositoryId) say('    ⚠ 바인딩 파일에 repository_id가 없다 — 파손. argus_init 재실행으로 재생성.');
    else {
      const registered = registry && registry.repositories &&
        Object.values(registry.repositories).some((id) => id === repositoryId);
      say(`    바인딩 OK — repository_id ${repositoryId}${registered ? ' (registry에 등록됨)' : registry ? ' — ⚠ registry에 없음 (홈이 바뀌었나? ARGUS_HOME 확인)' : ''}`);
    }
  } catch {
    say('    ⚠ 바인딩 파일 JSON 파손 — argus_init 재실행으로 재생성.');
  }
}

if (repositoryId) {
  const projDir = path.join(home, 'projects', repositoryId);
  const ledgerFile = path.join(projDir, 'ledger.jsonl');

  // 3. 내구 원장
  say(`[3] 내구 원장: ${ledgerFile}`);
  let lastEventId = null;
  if (!fs.existsSync(ledgerFile)) {
    say('    원장 파일 없음 — 첫 v2 이벤트 때 태어난다 (미리 만들지 않는 게 정상).');
  } else {
    let total = 0, corrupt = 0;
    try {
      for (const lineText of fs.readFileSync(ledgerFile, 'utf8').split('\n')) {
        if (!lineText.trim()) continue;
        total += 1;
        try {
          const ev = JSON.parse(lineText);
          if (typeof ev.event_id === 'string') lastEventId = ev.event_id;
        } catch { corrupt += 1; }
      }
      say(`    이벤트 ${total}줄${corrupt > 0 ? ` — ⚠ 파손 ${corrupt}줄 (읽기 시 dropped_corrupt로 계상됨, 데이터는 그 줄만 소실)` : ''} · 마지막 event_id ${lastEventId ?? '없음'}`);
    } catch {
      say('    ⚠ 원장 읽기 실패 — 권한/디스크 확인.');
    }
  }

  // 4. LOGBOOK 커서
  const logbookFile = path.join(cwd, '.argus', 'LOGBOOK.md');
  say(`[4] LOGBOOK projection: ${logbookFile}`);
  if (!fs.existsSync(logbookFile)) {
    say('    없음 — 다음 argus_check_in 또는 v2 쓰기에서 태어난다 (원장이 정본이라 손실 아님).');
  } else {
    const m = /<!-- argus:last_event_id=([0-9A-HJKMNP-TV-Z]{26}|none) -->/.exec(fs.readFileSync(logbookFile, 'utf8'));
    if (!m) say('    ⚠ 커서 없음(손으로 고쳐졌거나 파손) — stale. argus_check_in이 재생성한다.');
    else if (m[1] === (lastEventId ?? 'none')) say('    fresh — 커서가 원장과 일치.');
    else say(`    stale — 커서 ${m[1]} ≠ 원장 ${lastEventId ?? 'none'}. argus_check_in이 재생성한다.`);
  }

  // 5. 쓰기 락
  const lockFile = ledgerFile + '.lock';
  say(`[5] 쓰기 락: ${lockFile}`);
  if (!fs.existsSync(lockFile)) {
    say('    없음 — 정상 (락은 쓰기 순간에만 존재).');
  } else {
    try {
      const holder = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
      if (pidAlive(holder.pid)) say(`    보유 중 — pid ${holder.pid}, ${holder.started_at}부터. 살아있는 프로세스면 정상(쓰기 중), 오래 지속되면 그 프로세스를 확인.`);
      else say(`    ⚠ 죽은 pid ${holder.pid}의 잔재 — 다음 쓰기가 자동 탈취한다 (수동 삭제 불필요).`);
    } catch {
      say('    ⚠ 락 파일 파손 — 다음 쓰기의 stale 판정 경로가 처리한다.');
    }
  }

  // 6. v1 이전 marker + 스냅샷
  const marker = path.join(projDir, 'v1-migration.json');
  const snapshot = path.join(projDir, 'ledger.v1.jsonl');
  say(`[6] v1 이전 경계: ${marker}`);
  if (fs.existsSync(marker)) {
    say(`    marker 있음 — v1 역사는 이전 완료(재이전 불필요, 성장분은 미러가 커버). 스냅샷: ${fs.existsSync(snapshot) ? snapshot : '없음(v1 원장이 없던 리포)'}`);
  } else {
    say('    marker 없음 — 아직 v1 이전 전 (다음 argus_init 바인딩 때 1회 수행).');
  }
}

// 7. 레거시 v1 원장 잔재 (참고 — 원본 보존이 계약이라 삭제 안내는 하지 않는다)
say('[7] 레거시 v1 원장 (참고):');
for (const p of [path.join(cwd, '.argus', 'ledger', 'ledger.jsonl'), path.join(home, 'ledger', 'ledger.jsonl')]) {
  say(`    ${fs.existsSync(p) ? '있음' : '없음'} — ${p}`);
}
say('');
say('진단 끝. 이 스크립트는 아무것도 고치지 않았다 — 수리 손잡이는 각 줄에 적힌 도구다.');

process.stdout.write(out.join('\n') + '\n');
process.exit(0);
