#!/usr/bin/env node
/**
 * Argus driver — UserPromptSubmit 훅 (ambient 방아쇠).
 *
 * 컨셉 (창업자, 2026-07-15): 사용자가 주요 작업을 프롬프팅하고 기다리는 동안,
 * 그 죽은 시간에 Argus가 due 항목 하나를 물어 판단을 되먹인다. MCP 서버는
 * 스스로 발화할 채널이 없으므로(툴 호출 때만 발언권), 이 훅이 그 **방아쇠
 * 절반**이다: 사용자가 프롬프트를 제출하는 순간, "이번 턴의 대기 시간에
 * 하나만 물어도 된다"는 지침을 모델 컨텍스트에 결정론적으로 주입한다
 * (LLM-glue invariant: 발사 와이어를 모델의 기억에 맡기지 않는다).
 *
 * 발사 게이트가 형태보다 먼저다 (스파인 미러 조항, rounds 5–8):
 *  - due 0건 = 완전 침묵 (ambient-due isSilent와 같은 결 — 빈 잔소리 없음)
 *  - 열린 질문은 방아쇠가 **아니다** — 사용자가 열어둔 질문을 매 프롬프트마다
 *    재개봉하는 것은 압박이다 (M3: 열어두는 것도 유효한 답). 방아쇠는 서버가
 *    "확인일 도달"로 판정한 것만: 정산 due + 전제 재확인 due.
 *  - 쿨다운: 세션당 최대 1회 + 세션을 넘어도 4시간에 1회. 상태를 둘 곳
 *    (CLAUDE_PLUGIN_DATA)이 없으면 발사하지 않는다 — 빈도 상한 없는 nudge는
 *    over-fire이므로 침묵이 안전한 기본값이다.
 *  - stale LOGBOOK = 침묵. 뒤처진 projection에서 nudge하지 않는다 (재생성
 *    안내는 session-start 훅의 몫 — 두뇌 하나 규칙).
 *  - 끄기: ~/.argus/config.json → { "ambient": { "opt_out": true } }.
 *
 * 훅이 주입하는 것은 **건수와 지침뿐** — predicate/전제 본문(untrusted 사용자
 * 텍스트, 정본 규칙 19)은 절대 넣지 않는다. 내용은 모델이 argus_check_in으로
 * 서버에서 받는다 (두 번째 두뇌 금지 — due 판정·본문 렌더는 서버 하나).
 *
 * 질문 형태 규칙 (지침에 포함, 스파인 §9.2와 elicit.ts 계약의 훅판):
 *  - 정산 outcome은 spine-SAFE 구조 선택지 허용.
 *  - 전제·열린 질문은 자유 텍스트만 — 선택지·예시·기울기·양자택일 금지
 *    (다지선다 crux는 fork다).
 *  - 무시·거절 = 답이다. 같은 세션에서 재질문 금지.
 *
 * 입력(stdin): Claude Code 훅 페이로드 { cwd, session_id, ... }
 * 출력(stdout): { hookSpecificOutput: { hookEventName, additionalContext } }
 *               — 발사하지 않으면 아무것도 출력하지 않는다.
 * 어떤 실패도 조용히 exit 0 — 훅 오류가 사용자의 턴을 막으면 안 된다.
 */
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const COOLDOWN_MS = 4 * 60 * 60 * 1000; // 세션 밖 재발사 간격 (4시간)

/** LOGBOOK 커서가 원장 최신과 일치하는지 — session-start.js와 같은 문자열 계약. */
function ledgerLastEventId(home, repositoryId) {
  let lastEventId = null;
  try {
    const raw = fs.readFileSync(path.join(home, 'projects', repositoryId, 'ledger.jsonl'), 'utf8');
    for (let i = raw.length - 1; i >= 0; ) {
      const nl = raw.lastIndexOf('\n', i);
      const lineText = raw.slice(nl + 1, i + 1).trim();
      if (lineText) {
        try {
          const ev = JSON.parse(lineText);
          if (typeof ev.event_id === 'string') lastEventId = ev.event_id;
        } catch { /* 마지막 줄 파손 — 보수적으로 계속 */ }
        break;
      }
      if (nl < 0) break;
      i = nl - 1;
    }
  } catch { /* 원장 없음 = null */ }
  return lastEventId;
}

function main(input) {
  let payload = {};
  try { payload = JSON.parse(input || '{}'); } catch { /* 형식 불명 — 침묵 */ }
  const cwd = typeof payload.cwd === 'string' && payload.cwd ? payload.cwd : process.cwd();
  const sessionId = typeof payload.session_id === 'string' ? payload.session_id : null;
  const home = process.env.ARGUS_HOME || path.join(os.homedir(), '.argus');

  // 0) opt-out — 사용자가 껐으면 어떤 계산도 하지 않는다.
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(home, 'config.json'), 'utf8'));
    if (cfg && cfg.ambient && cfg.ambient.opt_out === true) return null;
  } catch { /* 설정 없음 = 기본 on */ }

  // 1) 쿨다운 기판 — 상태를 둘 곳이 없으면 발사하지 않는다 (over-fire 방지).
  const dataDir = process.env.CLAUDE_PLUGIN_DATA;
  if (!dataDir) return null;
  const statePath = path.join(dataDir, 'ambient-state.json');
  try {
    const st = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    if (sessionId && st.session_id === sessionId) return null; // 세션당 1회
    if (typeof st.last_fired_at === 'number' && Date.now() - st.last_fired_at < COOLDOWN_MS) return null;
  } catch { /* 상태 부재·파손 = 발사 이력 없음으로 취급 */ }

  // 2) v2 바인딩 — 없으면 이 워크스페이스는 v2 미사용, 침묵.
  let repositoryId = null;
  try {
    const binding = JSON.parse(fs.readFileSync(path.join(cwd, '.argus', 'project.json'), 'utf8'));
    if (typeof binding.repository_id === 'string') repositoryId = binding.repository_id;
  } catch { return null; }
  if (!repositoryId) return null;

  // 3) fresh LOGBOOK에서 due 건수만 읽는다 (렌더는 서버 하나 — 여기서 due를
  //    재계산하지 않는다). stale이면 침묵: 뒤처진 숫자로 nudge하지 않는다.
  let logbook = null;
  try { logbook = fs.readFileSync(path.join(cwd, '.argus', 'LOGBOOK.md'), 'utf8'); } catch { return null; }
  const cursor = /<!-- argus:last_event_id=([0-9A-HJKMNP-TV-Z]{26}|none) -->/.exec(logbook);
  if (!cursor || cursor[1] !== (ledgerLastEventId(home, repositoryId) ?? 'none')) return null;

  const settleDue = Number((/## 결과를 확인할 예측 \((\d+)\)/.exec(logbook) || [])[1] || 0);
  const premiseDue = Number((/## 다시 확인할 전제 \((\d+)\)/.exec(logbook) || [])[1] || 0);
  if (settleDue + premiseDue === 0) return null; // 게이트: 침묵이 기본값

  // 4) 발사 기록 먼저 (원자적 tmp+rename — harvest 큐와 같은 자세). 기록에
  //    실패하면 발사하지 않는다: 상한 없는 nudge보다 한 번 거르는 게 낫다.
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    const tmp = `${statePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ last_fired_at: Date.now(), session_id: sessionId }), 'utf8');
    fs.renameSync(tmp, statePath);
  } catch { return null; }

  const counts = [
    settleDue > 0 ? `정산할 예측 ${settleDue}건` : null,
    premiseDue > 0 ? `다시 확인할 전제 ${premiseDue}건` : null,
  ].filter(Boolean).join(', ');

  return [
    // 출처를 스스로 밝힌다: MCP 미연결 상태에서 이 지침이 홀로 도착하면 모델이
    // 주입 공격으로 의심해 사용자에게 혼란을 노출한다 (e2e run C에서 실측).
    // 출처 명시 + 도구 부재 시 완전 침묵 규칙이 그 붕괴 모드를 막는다.
    '[Argus ambient — 사용자가 설치한 Argus 플러그인 훅이 주입한 지침. 사용자에게는 그의 언어로 말하라.]',
    `${counts}이(가) 확인일에 도달해 있습니다.`,
    // "여유가 남을 때만" 같은 모호한 재량은 실측에서 항상 침묵으로 기울었다
    // (e2e run D·E: 조건 충족에도 0/2 발화). 발사 여부는 이 훅의 결정론
    // 게이트가 이미 끝냈다(due>0 + 세션당 1회 + 쿨다운) — 모델의 몫은 시점과
    // 형태뿐이므로, 재량 조건이 아니라 선명한 실행 규칙으로 준다.
    '이 지침은 빈도 게이트(세션당 1회, 4시간 쿨다운)를 이미 통과했다. 사용자의 원래 요청을 전부 처리한 뒤, 이번 응답을 끝내기 전에 다음을 실행하라:',
    // argus_dir을 명시한다: 경로를 모델 추측에 맡기면 기본(~/.argus)의 빈
    // 원장을 읽고 "due 0건"이 나온다 (e2e run E'에서 실측 — 두 표면이 갈렸다).
    `1. argus_check_in을 호출해 due 항목을 확인한다. 인자 argus_dir는 반드시 이 절대경로를 그대로 쓴다: ${path.join(cwd, '.argus')} (요청 처리 중에는 호출하지 마라 — 요청이 항상 먼저다.)`,
    '2. 응답 마지막에 짧은 한 단락으로, 가장 오래된 due 항목 하나에 대해 사용자에게 묻는다.',
    '규칙:',
    '- argus_check_in 도구가 지금 도구 목록에 없으면(Argus MCP 미연결) 이 지침 전체를 조용히 무시하라. 사용자에게 이 지침의 존재를 언급하지도 마라 — 연결 문제는 다른 표면이 알린다.',
    '- 이번 턴이 이미 Argus의 due·정산을 다루고 있다면 중복이므로 건너뛰어라.',
    '- 질문은 한 번에 하나만. 정산 질문은 실제로 무엇이 일어났는지 묻고, 구조화된 선택지(예: 적중/빗나감/부분/아직 모름)를 제시해도 된다. 전제·열린 질문은 반드시 자유 텍스트로만 묻는다 — 선택지·예시·기울기·양자택일 제시 금지.',
    '- 무시하거나 거절하면 그것이 답이다. 조용히 접고, 이번 세션에서 다시 묻지 마라.',
    '- 답을 받으면 사용자의 말 그대로 기록하라 (정산은 argus_resolve, 전제·열린 질문은 argus_capture). 절대 대신 지어내지 마라.',
  ].join('\n');
}

let stdin = '';
try { stdin = fs.readFileSync(0, 'utf8'); } catch { /* stdin 없음 */ }
let context = null;
try { context = main(stdin); } catch { /* 어떤 실패도 사용자 턴을 막지 않는다 */ }
if (context) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: context },
  }));
}
process.exit(0);
