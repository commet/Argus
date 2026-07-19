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

/**
 * 수확 큐 인입·확인 (P3-4, 정본 규칙 4) — 훅의 몫은 여기까지다:
 *  - opt-in(~/.argus/config.json → harvest.opt_in === true)이 아니면 **완전
 *    침묵**. 큐 파일도 만들지 않는다 (opt-in 전에는 어떤 흔적도 없어야 한다).
 *  - opt-in이면 현재 세션의 transcript **경로**를 멱등 인입(item_id =
 *    세션 id). 추출은 절대 여기서 안 한다 — lease 클레임조차 안 한다
 *    (클레임은 처리 단계 직전의 몫; 훅이 잡은 lease는 처리 없는 잠금이다).
 *  - 큐 파일 형식은 argus-mcp src/v2/queue.ts와의 **파일 계약**이다 —
 *    driver-hook.test.ts가 교차 구현(훅이 쓴 큐를 queue.ts가 클레임)으로
 *    드리프트를 막는다. 필드를 바꾸려면 양쪽+테스트를 함께.
 *  - 저장처는 ${CLAUDE_PLUGIN_DATA} (임시 상태, 규칙 3) — env가 없으면 침묵.
 */
function harvestQueueStep(payload, home) {
  const dataDir = process.env.CLAUDE_PLUGIN_DATA;
  if (!dataDir) return null;
  let optIn = false;
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(home, 'config.json'), 'utf8'));
    optIn = cfg && cfg.harvest && cfg.harvest.opt_in === true;
  } catch { /* 설정 없음 = opt-out */ }
  if (!optIn) return null;

  const qPath = path.join(dataDir, 'harvest-queue.json');
  let items = [];
  try {
    const parsed = JSON.parse(fs.readFileSync(qPath, 'utf8'));
    if (Array.isArray(parsed.items)) items = parsed.items;
  } catch { /* 부재·파손 = 빈 큐 (queue.ts readQueue와 동일 자세) */ }

  const sessionId = typeof payload.session_id === 'string' ? payload.session_id : null;
  const transcriptPath = typeof payload.transcript_path === 'string' ? payload.transcript_path : null;
  if (sessionId && transcriptPath && !items.some((i) => i.item_id === `harvest-${sessionId}`)) {
    items.push({
      item_id: `harvest-${sessionId}`, kind: 'harvest', transcript_path: transcriptPath,
      session_id: sessionId, enqueued_at: new Date().toISOString(), attempts: 0, status: 'pending',
    });
    fs.mkdirSync(dataDir, { recursive: true });
    const tmp = `${qPath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ items }, null, 1), 'utf8');
    fs.renameSync(tmp, qPath);
  }

  // 확인만: 클레임 가능 항목 수 (자기 세션 제외 — 방금 넣은 건 아직 처리감이 아니다).
  const nowIso = new Date().toISOString();
  const claimable = items.filter((i) =>
    i.item_id !== `harvest-${sessionId}` && ['pending', 'retryable_failed', 'leased'].includes(i.status || 'pending') &&
    !i.exhausted && i.attempts < 3 &&
    !(i.lease && i.lease.expires_at > nowIso)).length;
  if (claimable > 0) {
    return `Argus: 이전 세션에서 자동 포착할 기록 ${claimable}건이 대기 중입니다. 다음 Argus check-in이 제한된 수만 처리합니다.`;
  }
  return null;
}

/**
 * 첫 실행 안내 (온보딩) — 설치 직후 "그래서 이제 뭘 하지?"의 다리.
 *
 * 설계:
 *  - **딱 한 번만.** 마커(${CLAUDE_PLUGIN_DATA}/welcome-shown)로 평생 1회.
 *    설치는 조용한 게 정상이지만, 첫 세션에 길을 잃게 두는 건 다른 문제다.
 *  - **판단 없음, 안내만.** "이걸 하세요"가 아니라 "여기 있습니다 / 원하면".
 *    스파인: 최대 생성, 제로 판단 — 온보딩도 예외가 아니다.
 *  - **사용자 언어로.** additionalContext는 Claude에게 가는 컨텍스트이므로,
 *    문구를 박지 않고 "이렇게 인사하라"고 지시한다 — Claude가 사용자
 *    언어로 자연스럽게 전달한다 (한/영 분기 코드 불필요).
 *  - 마커를 둘 곳(플러그인 데이터 영역)이 없으면 침묵 — 매 세션 반복되는
 *    잔소리가 흔적 0 원칙보다 나쁘다.
 */
function firstRunWelcome() {
  const dataDir = process.env.CLAUDE_PLUGIN_DATA;
  if (!dataDir) return null;
  const marker = path.join(dataDir, 'welcome-shown');
  try { fs.accessSync(marker); return null; } catch { /* 아직 안 봄 */ }
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(marker, 'shown\n');
  } catch { /* 마커 기록 실패해도 안내는 한 번 낸다 (최악=한 번 더 뜸) */ }

  return [
    '[Argus 첫 실행: 아래 내용을 사용자에게 그의 언어로, 짧고 담백하게 전하라. 과장·이모지·평가 금지.]',
    'Argus가 연결되었습니다. 중요한 결정을 말하면 확인할 수 있는 예측과 그 판단이 기대는 전제를 남기고,',
    '확인일이 오면 실제로 무엇이 일어났는지 다시 봅니다. 모델은 당신을 채점하지 않습니다.',
    '지금 할 수 있는 것:',
    '· 고민 중인 결정을 평소처럼 설명하면 됩니다.',
    '· "지금 확인할 것이 있어?"라고 물으면 필요한 항목만 보여줍니다.',
    '· 확인일이 오면 실제 결과를 말해 기록을 마무리할 수 있습니다.',
    '· 별도 초기화 명령은 필요하지 않습니다.',
    '이 안내는 이번 한 번만 나타납니다.',
  ].join('\n');
}

function main(input) {
  let payload = {};
  try { payload = JSON.parse(input || '{}'); } catch { /* 형식 불명 — 조용히 */ }
  const cwd = typeof payload.cwd === 'string' && payload.cwd ? payload.cwd : process.cwd();
  const home = process.env.ARGUS_HOME || path.join(os.homedir(), '.argus');
  const lines = [];

  const welcome = firstRunWelcome();
  if (welcome) lines.push(welcome);

  const harvestLine = harvestQueueStep(payload, home);
  if (harvestLine) lines.push(harvestLine);

  // 1) v2 바인딩 — 없으면 이 워크스페이스는 v2 미사용, LOGBOOK 단계는 침묵.
  let repositoryId = null;
  try {
    const binding = JSON.parse(fs.readFileSync(path.join(cwd, '.argus', 'project.json'), 'utf8'));
    if (typeof binding.repository_id === 'string') repositoryId = binding.repository_id;
  } catch { return lines.length ? lines.join('\n') : null; }
  if (!repositoryId) return lines.length ? lines.join('\n') : null;

  // 2) 내구 원장의 마지막 event_id (JSONL append 순서가 정본 순서 — II-E).
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
    lines.push('Argus: 이 워크스페이스의 LOGBOOK이 최신 판단 기록보다 뒤처져 있거나 없습니다. ' +
      '`argus_check_in`을 호출하면 자동 재생성됩니다 (판단 기록은 보존되고, LOGBOOK은 언제든 다시 만들 수 있습니다).');
  }
  // fresh일 때 due 건수는 여기서 발화하지 않는다 (O3 방2): SessionStart의 due
  // 발화 소유자는 check-contracts.js 하나다 — 그쪽이 두 평면(프로젝트 v1 UNION
  // 내구 원장)을 전부 접으므로, 여기서도 세면 같은 due가 두 줄로 도착한다.
  // 이 훅의 몫은 projection 신선도·첫 안내·수확 큐까지다.
  return lines.length ? lines.join('\n') : null;
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
