#!/usr/bin/env node
/**
 * Argus driver — doctor (P2-6). 설치·배선 자가진단.
 *
 * 설계 원칙:
 *  - **검사는 전부 이 스크립트가 결정론적으로 수행**하고, Claude는 출력을
 *    전달만 한다 (LLM을 진단 루프의 라우터로 쓰지 않는다 — 정직한 구조 원칙).
 *  - 읽기 전용: 어떤 파일도 만들거나 고치지 않는다. 수리는 각 담당 두뇌
 *    (argus_settings 복구, argus_check_in 재생성)가 한다 — doctor는 사실과
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
  say(`    registry 없음 (${registryFile}) — 아직 어떤 리포도 등록 전. argus_settings의 status가 필요할 때 만든다.`);
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
  say('    바인딩 없음 — 이 워크스페이스는 v2 미사용. `argus_settings` status가 바인딩을 복구한다.');
} else {
  try {
    const binding = JSON.parse(fs.readFileSync(bindingFile, 'utf8'));
    repositoryId = typeof binding.repository_id === 'string' ? binding.repository_id : null;
    if (!repositoryId) say('    ⚠ 바인딩 파일에 repository_id가 없다 — 파손. argus_settings status로 재생성.');
    else {
      const registered = registry && registry.repositories &&
        Object.values(registry.repositories).some((id) => id === repositoryId);
      say(`    바인딩 OK — repository_id ${repositoryId}${registered ? ' (registry에 등록됨)' : registry ? ' — ⚠ registry에 없음 (홈이 바뀌었나? ARGUS_HOME 확인)' : ''}`);
    }
  } catch {
    say('    ⚠ 바인딩 파일 JSON 파손 — argus_settings status로 재생성.');
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
    say('    marker 없음 — 아직 v1 이전 전 (다음 argus_settings status 때 1회 확인).');
  }
}

// 7. 레거시 v1 원장 잔재 (참고 — 원본 보존이 계약이라 삭제 안내는 하지 않는다)
say('[7] 레거시 v1 원장 (참고):');
for (const p of [path.join(cwd, '.argus', 'ledger', 'ledger.jsonl'), path.join(home, 'ledger', 'ledger.jsonl')]) {
  say(`    ${fs.existsSync(p) ? '있음' : '없음'} — ${p}`);
}

// 8. 자동 포착 큐 (내부 설정명은 harvest, opt-in·임시 상태 — 규칙 3·4)
{
  let optIn = false;
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(home, 'config.json'), 'utf8'));
    optIn = cfg && cfg.harvest && cfg.harvest.opt_in === true;
  } catch { /* 설정 없음 = opt-out */ }
  const dataDir = process.env.CLAUDE_PLUGIN_DATA;
  say(`[8] 자동 포착: opt-in ${optIn ? 'ON' : 'OFF'} (${path.join(home, 'config.json')} harvest.opt_in)`);
  if (!dataDir) {
    say('    CLAUDE_PLUGIN_DATA 없음 — 플러그인 데이터 영역 밖에서 실행됨. 큐 검사 생략.');
  } else {
    const qPath = path.join(dataDir, 'harvest-queue.json');
    if (!fs.existsSync(qPath)) {
      say(`    큐 없음 — ${optIn ? '아직 인입 전 (정상)' : 'opt-in 전 흔적 0 (정상)'} (${qPath})`);
    } else {
      try {
        const items = (JSON.parse(fs.readFileSync(qPath, 'utf8')).items) || [];
        const exhausted = items.filter((i) => i.exhausted).length;
        say(`    큐 ${items.length}건 대기${exhausted > 0 ? ` — ⚠ 그중 ${exhausted}건은 3회 실패로 자동 재시도 제외 (수동 재개 대상)` : ''} (${qPath})`);
      } catch {
        say(`    ⚠ 큐 파일 파손 — 임시 상태라 다음 인입 때 새로 시작된다 (${qPath})`);
      }
    }
    try {
      const marker = JSON.parse(fs.readFileSync(path.join(dataDir, 'harvest-last-run.json'), 'utf8'));
      say(`    마지막 자동 포착 실행일: ${marker.date} (1일 1회 marker)`);
    } catch { say('    마지막 자동 포착 실행일: 기록 없음'); }
  }
}
// 9. 감지 발사 사슬 — "침묵이 절제인지 고장인지"를 구별 가능하게 (honest-gap).
//    이 스크립트가 결정론적으로 볼 수 있는 건 감도 설정까지다. MCP 연결과
//    픽커(elicitation) 지원은 호스트 세션 안에서만 보이므로 doctor.md가 모델에게
//    딱 그 두 가지만 추가 확인시킨다 (argus_check_in의 data.picker가 정본).
{
  say('[9] 감지 감도 (ambient sensitivity):');
  let amb = null;
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(home, 'config.json'), 'utf8'));
    amb = cfg && typeof cfg.ambient === 'object' ? cfg.ambient : null;
  } catch { /* 설정 없음 = 기본 */ }
  if (amb && amb.opt_out === true) {
    say('    ⚠ ambient.opt_out=true — 감지가 의도적으로 꺼져 있다. 질문이 안 오는 게 이 설정 때문일 수 있다. 켜려면 /configure 또는 config.json에서 opt_out 제거.');
  } else {
    const lv = amb && typeof amb.sensitivity === 'string' ? amb.sensitivity : 'normal(기본)';
    say(`    감도 ${lv} — (${path.join(home, 'config.json')} ambient.sensitivity: low/normal/high)`);
  }
}

// 10. MCP 배선 버전 — "무엇이 실제로 돌고 있나" (2026-07-26 신설).
//
//     근원 사건: 플러그인이 MCP를 `npx -y argus-decision-mcp@^1`로 띄웠고, npx는
//     스펙이 RANGE면 캐시에 조건을 만족하는 설치본이 있는 한 그걸 재사용한다.
//     그래서 창업자 기기의 캐시에 1.2.0이 앉은 뒤 1.3.0~1.9.0이 npm에 올라가는
//     12일간 배선이 얼어 있었고 — 픽커 재설계를 포함한 모든 개선이 도그푸딩
//     세션에 한 번도 닿지 않았다. 레포 CI는 초록, npm은 최신, 정작 사용자가
//     만지던 숫자만 아무도 볼 수 없었다.
//
//     이 절이 그 숫자를 표면에 올린다. 결정론적으로 볼 수 있는 것: 핀한 버전과
//     npx 캐시에 실제로 놓인 설치본들. 볼 수 없는 것: 지금 이 세션이 물고 있는
//     프로세스 — 그건 argus_check_in의 data.server_version이 정본이라 doctor.md가
//     모델에게 그 한 가지를 추가 확인시킨다 (honest gap: 모르는 건 모른다고).
{
  say('[10] MCP 배선 버전:');
  const mcpJson = path.join(__dirname, '..', '.mcp.json');
  let pinned = null;
  try {
    const wired = JSON.parse(fs.readFileSync(mcpJson, 'utf8')).mcpServers || {};
    for (const s of Object.values(wired)) {
      const spec = (s && Array.isArray(s.args) ? s.args : []).find((a) => typeof a === 'string' && a.startsWith('argus-decision-mcp@'));
      if (spec) { pinned = spec.slice('argus-decision-mcp@'.length); break; }
    }
  } catch { /* 배선 파일 없음/파손 — 아래에서 정직하게 보고 */ }

  if (!pinned) {
    say(`    ⚠ 배선 스펙을 읽지 못함 (${mcpJson}) — 플러그인 번들이 불완전하다. 플러그인 재설치 대상.`);
  } else if (!/^\d+\.\d+\.\d+$/.test(pinned)) {
    say(`    ⚠ 핀이 범위 스펙이다 (${pinned}) — npx가 캐시된 옛 설치본을 계속 재사용해 배선이 조용히 얼어붙는다. 정확 버전으로 핀할 것.`);
  } else {
    say(`    핀한 버전 ${pinned} (${mcpJson})`);
  }

  // npx 캐시 실사 — 핀이 캐시에 없으면 첫 호출에 내려받고, 옛 버전이 남아 있으면
  // 그 사실 자체가 "예전 세션이 무엇을 물고 있었나"의 증거다.
  const roots = [
    process.env.npm_config_cache && path.join(process.env.npm_config_cache, '_npx'),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'npm-cache', '_npx'),
    path.join(os.homedir(), '.npm', '_npx'),
  ].filter(Boolean);
  const found = [];
  for (const root of roots) {
    let entries = [];
    try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const pj = path.join(root, e.name, 'node_modules', 'argus-decision-mcp', 'package.json');
      try {
        const v = JSON.parse(fs.readFileSync(pj, 'utf8')).version;
        if (typeof v === 'string') found.push({ version: v, dir: path.join(root, e.name) });
      } catch { /* 이 캐시 항목엔 없음 */ }
    }
  }
  if (found.length === 0) {
    say('    npx 캐시에 설치본 없음 — 다음 도구 호출에서 핀한 버전을 내려받는다 (정상).');
  } else {
    // 경고의 전제는 "범위 스펙이면 npx가 낡은 캐시를 재사용한다"였다. 핀이 정확
    // 버전인 지금은 낡은 사본이 선택될 수 없으므로 무해하다 — 그런데도 사본 하나당
    // ⚠ 한 줄을 뿜어 창업자 화면에 겁주는 6줄이 떴다(2026-07-27 도그푸딩).
    // 핀이 캐시에 있으면 낡은 것들은 한 줄로 접고, 없을 때만 크게 경고한다.
    const exactPin = Boolean(pinned) && /^\d+\.\d+\.\d+$/.test(pinned);
    const pinPresent = found.some((f) => f.version === pinned);
    const stale = found.filter((f) => f.version !== pinned);
    if (exactPin && pinPresent) {
      for (const f of found.filter((x) => x.version === pinned)) say(`    캐시 ${f.version} (핀과 일치) — ${f.dir}`);
      if (stale.length) {
        const vs = [...new Set(stale.map((f) => f.version))].sort().join(', ');
        say(`    낡은 사본 ${stale.length}개 (${vs}) — 무해: 정확 핀이라 npx가 이걸 고르지 않는다. 지우려면 위 캐시 폴더 삭제.`);
      }
    } else {
      for (const f of found) {
        const isStale = exactPin && f.version !== pinned;
        say(`    캐시 ${f.version}${isStale ? ` — ⚠ 핀(${pinned})과 다르다. 이 세션이 이걸 물고 있으면 낡은 배선이다` : ' (핀과 일치)'} — ${f.dir}`);
      }
    }
    if (pinned && found.every((f) => f.version !== pinned)) {
      say(`    ⚠ 핀한 ${pinned}이 캐시에 없다 — 아직 npm에 발행되지 않았거나 첫 호출 전이다. 발행 전이면 배선이 실패하므로 publish 여부를 먼저 확인할 것.`);
    }
  }
  say('    실제로 돌고 있는 버전의 정본 = argus_check_in의 data.server_version (세션 안에서만 보인다).');
}
say('');
say('진단 끝. 이 스크립트는 아무것도 고치지 않았다 — 수리 손잡이는 각 줄에 적힌 도구다.');

process.stdout.write(out.join('\n') + '\n');
process.exit(0);
