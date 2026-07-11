#!/usr/bin/env node
/**
 * Argus driver — SessionStart 훅 (P2-5).
 *
 * 정본 I-1: "각 projection은 커서(last_event_id)를 기록하고 SessionStart 시
 * 커서가 원장과 다르면 자동 재생성한다." 이 훅은 그 배선의 **감지 절반**이다:
 *
 *  - 훅은 감지·안내만 한다. 재생성(reduce→deriveBrief→renderLogbook)의 두뇌는
 *    MCP 서버의 미러 관문 하나뿐이고, 여기서 그 로직을 복제하지 않는다 —
 *    두 번째 두뇌는 드리프트하는 순간 조용히 다른 말을 하는 표면이 된다
 *    (LLM-glue invariant). stale이면 Claude에게 argus_check_in 호출을 안내해
 *    서버가 재생성하게 한다.
 *  - zero-dependency, 파일 2~3개 읽고 즉시 반환 (정본 규칙 4의 latency 원칙:
 *    SessionStart는 사용자 첫 작업을 절대 막지 않는다). 어떤 실패도 조용히
 *    exit 0 — 훅 오류가 세션 시작을 막으면 안 된다.
 *  - 주입하는 것은 건수와 절대 경로뿐 — predicate 본문(untrusted 사용자
 *    텍스트, 정본 규칙 19)은 훅이 컨텍스트로 넣지 않는다. 내용은 Claude가
 *    LOGBOOK을 직접 읽거나 check_in으로 받는다. 경로 평문은 정본 규칙 18
 *    (파일 경로도 1급 표면).
 *
 * 입력(stdin): Claude Code 훅 페이로드 { cwd, ... }
 * 출력(stdout): { hookSpecificOutput: { hookEventName, additionalContext } }
 *               — 알릴 것이 없으면 아무것도 출력하지 않는다 (조용한 기본,
 *               스파인 4항: 개입 여부 판단을 대신하지 않기 — 사실 전달만).
 */
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function main(input) {
  let payload = {};
  try { payload = JSON.parse(input || '{}'); } catch { /* 형식 불명 — 조용히 */ }
  const cwd = typeof payload.cwd === 'string' && payload.cwd ? payload.cwd : process.cwd();

  // 1) v2 바인딩 — 없으면 이 워크스페이스는 v2 미사용, 침묵.
  let repositoryId = null;
  try {
    const binding = JSON.parse(fs.readFileSync(path.join(cwd, '.argus', 'project.json'), 'utf8'));
    if (typeof binding.repository_id === 'string') repositoryId = binding.repository_id;
  } catch { return null; }
  if (!repositoryId) return null;

  // 2) 내구 원장의 마지막 event_id (JSONL append 순서가 정본 순서 — II-E).
  const home = process.env.ARGUS_HOME || path.join(os.homedir(), '.argus');
  let lastEventId = null; // null = 이벤트 0건 (LOGBOOK 커서 표기로는 'none')
  try {
    const raw = fs.readFileSync(path.join(home, 'projects', repositoryId, 'ledger.jsonl'), 'utf8');
    for (let i = raw.length - 1; i >= 0; ) {
      const nl = raw.lastIndexOf('\n', i);
      const lineText = raw.slice(nl + 1, i + 1).trim();
      if (lineText) {
        try {
          const ev = JSON.parse(lineText);
          if (typeof ev.event_id === 'string') lastEventId = ev.event_id;
        } catch { /* 마지막 줄 파손 — 서버가 dropped_corrupt로 계상할 사건. 훅은 커서 비교만 보수적으로 계속. */ }
        break;
      }
      if (nl < 0) break;
      i = nl - 1;
    }
  } catch { /* 원장 파일 없음 — lastEventId=null 그대로 (커서 'none'과 대조) */ }

  // 3) LOGBOOK 커서 대조 (logbook.ts의 CURSOR_RE와 같은 형식 — 문자열 계약).
  const logbookAbs = path.join(cwd, '.argus', 'LOGBOOK.md');
  let logbook = null;
  try { logbook = fs.readFileSync(logbookAbs, 'utf8'); } catch { /* 부재 = stale */ }
  const cursor = logbook && /<!-- argus:last_event_id=([0-9A-HJKMNP-TV-Z]{26}|none) -->/.exec(logbook);
  const fresh = cursor !== null && cursor[1] === (lastEventId ?? 'none');

  if (!fresh) {
    return 'Argus: 이 워크스페이스의 LOGBOOK projection이 원장보다 뒤처져 있거나 없습니다. ' +
      '`argus_check_in`을 호출하면 자동 재생성됩니다 (원장이 정본, LOGBOOK은 언제든 다시 태어납니다).';
  }

  // 4) fresh — due 건수만 한 줄 (본문 인용 없음). 0건이면 침묵.
  const due = /## 정산할 것 \((\d+)\)/.exec(logbook);
  if (due && Number(due[1]) > 0) {
    return `Argus: 정산할 결정 ${due[1]}건이 확인일에 도달했습니다 — ${logbookAbs} 참조, 정산은 \`argus_settle\`.`;
  }
  return null;
}

let stdin = '';
try { stdin = fs.readFileSync(0, 'utf8'); } catch { /* stdin 없음 */ }
let context = null;
try { context = main(stdin); } catch { /* 어떤 실패도 세션 시작을 막지 않는다 */ }
if (context) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: context },
  }));
}
process.exit(0);
