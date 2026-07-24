#!/usr/bin/env node
/**
 * Argus UserPromptSubmit hook — 매 턴 대화 진단 (2026-07-20 원점 재설계).
 *
 * WHAT CHANGED AND WHY (근원 분석 §3 — "규칙은 감지기가 될 수 없다").
 * 첫 판은 정규식(detectSignals)이 감지기였고 사용자 메시지만 봤다. 그 구조는
 * 두 곳에서 원리적으로 진다: (1) 숨은 전제는 표지가 없어 규칙이 못 잡는다 —
 * 그런데 그게 Argus 가치의 90%다. (2) 전제와 예측은 어시스턴트의 답변에서도
 * 드러나는데 사용자 발화만 봤다. 이 판의 구조:
 *
 *   방아쇠  = 이 훅 (호스트가 매 턴 결정론적으로 실행 — 잊을 수 없다)
 *   감지    = 호스트 모델의 의미 판단 (대화 전체가 이미 그 컨텍스트에 있다)
 *   규칙    = (a) 사전필터: 주입할 가치가 있는 턴인지 비용 게이트
 *             (b) 최저선: 규칙이 잡은 스팬은 "후보"로 동봉 — AI가 못 놓치게
 *
 * 훅이 모델에게 주는 것은 대화가 아니라 (모델이 스스로 가질 수 없는) 세 가지다:
 *   1. 진단 명령 자체 — 매 턴 재주입되므로 "모델이 알아채 주길 바라는" 선의
 *      의존이 아니라 구조가 된다.
 *   2. 원장 상태 — 열린 예측 목록. "그거 결국 잘 됐어" 같은 대명사 참조는
 *      토큰 대조로는 원리적으로 안 잡힌다. 목록을 눈앞에 놓아주면 모델이
 *      맥락으로 잇는다 (§3.3 — 대조는 AI의 일, 코드의 일은 목록을 놓아주기).
 *   3. 규칙 후보 스팬 — 사용자의 말 그대로(verbatim), 지어내지 않는다.
 *
 * 스캔 창 = 직전 어시스턴트 발화(transcript_path에서 추출) + 이번 사용자 메시지.
 * Stop 훅 별도 진단은 짓지 않는다 — 개입은 어차피 다음 턴에만 가능하므로,
 * UserPromptSubmit에서 직전 턴까지 창에 넣는 것과 시점이 등가이고 더 단순하다.
 *
 * SPINE — max detect, min fire (mirror clause):
 *  - 주입은 사용자에게 안 보인다. 사용자-대면 발화 절제는 지시문 자체가 진다:
 *    세션당 제안 1회, 스킵 최종, flat이면 침묵, 평결·포크·기울기 금지.
 *  - 진단 주입은 세션당 DIAG_CAP회 (토큰 비용 게이트 — 발화 게이트가 아니다).
 *  - 정산(outcome)은 부기(bookkeeping)라 진단 캡과 별도로 열려 있다: 열린
 *    예측이 있고 창에 종결 단서가 보이면 캡 소진 후에도 목록을 재주입한다.
 *    (첫 판의 "세션당 1회" 단일 게이트는 정산까지 막았다 — 정산을 놓치면
 *    루프 전체가 죽으므로 그건 감지 상한이 아니라 결함이었다.)
 *  - MCP 부재 시 조용히 무시하라는 가드 유지 (지시만 있고 도구가 없으면
 *    주입 공격처럼 읽힌다 — ambient-nudge와 같은 방어).
 *  - Never throws, never exits non-zero — a broken hook must not tax the session.
 *
 * Input(stdin): UserPromptSubmit payload { user_message|prompt, session_id, cwd, transcript_path }
 * Output(stdout): { hookSpecificOutput: { hookEventName, additionalContext } } — or nothing.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const {
  configDir, detectSignals, prefilterTurn, readTail, lastAssistantText,
} = require('./lib/decision-signals');

// 캡 재설계 (2026-07-21 창업자: "세션당 3회는 긴 세션엔 적다").
// 고정 세션 캡 → 슬라이딩 윈도: 2시간 창 안에서 최대 3회 진단 주입, 세션 전체
// 상한 12 (하루 종일 이어지는 세션도 굶지 않되 비용은 유계). 정산은 부기이므로
// 더 관대(8). 사용자-대면 절제는 지시문이 결정당 1회·스킵 최종으로 따로 진다.
const DIAG_WINDOW_MS = 2 * 60 * 60 * 1000;
// 감도(sensitivity) 다이얼 (2026-07-22 창업자: "질문 빈도를 사용자가 조절").
// 진단 주입 캡을 단계 스케일 — 사용자가 자기 경험을 조율하는 것이라 스파인
// 위반이 아니다(zero-judgment은 사용자를 심판 안 함이지, 사용자가 자기 다이얼을
// 못 쥔다가 아니다). 'off'/opt_out은 완전 침묵. 기본 normal(기존 3/12).
// ★정산(OUTCOME_CAP)은 감도와 무관 — 부기라 조이면 놓친 정산이 루프를 죽인다.
const SENSITIVITY = {
  low: { perWindow: 1, sessionMax: 4 },
  normal: { perWindow: 3, sessionMax: 12 },
  high: { perWindow: 5, sessionMax: 20 },
};
const OUTCOME_CAP = 8; // 세션당 정산-전용 재주입 상한 (감도 무관)
const PRED_LIST_MAX = 5;    // 주입하는 열린 예측 개수 상한
const PRED_CLIP = 140;      // 예측 한 줄 길이 상한
const ASSISTANT_WINDOW = 4000; // 직전 어시스턴트 발화에서 스캔할 꼬리 길이

// ~/.argus/config.json의 ambient 선호를 읽어 {optOut, caps}로 정규화한다.
// opt_out:true 또는 sensitivity:'off' → 완전 침묵. sensitivity low|normal|high →
// 캡 스케일. 없거나 손상되면 기본 normal(조용한 실패 = 켜짐 기본).
function ambientPrefs() {
  try {
    const home = process.env.ARGUS_HOME || path.join(require('os').homedir(), '.argus');
    const cfg = JSON.parse(fs.readFileSync(path.join(home, 'config.json'), 'utf8'));
    const amb = (cfg && cfg.ambient) || {};
    if (amb.opt_out === true || amb.sensitivity === 'off') return { optOut: true, caps: SENSITIVITY.normal };
    const level = ['low', 'normal', 'high'].includes(amb.sensitivity) ? amb.sensitivity : 'normal';
    return { optOut: false, caps: SENSITIVITY[level] };
  } catch { return { optOut: false, caps: SENSITIVITY.normal }; } // no config = default on
}

function stateFile(sessionId) {
  return path.join(configDir(), 'argus-sensed', String(sessionId));
}

// 세션 상태 { diag, out } — 구판(빈 파일)은 "이미 다 쓴 세션"으로 읽는다
// (구판 의미가 once-per-session이었으므로 이어지는 세션에 소급 과발화하지 않는다).
// 상태: { diagTimes: number[](주입 시각들), out: number }. 구판 호환:
// 빈 파일/손상 = 보수적 소진, {diag:n} 숫자 = n개의 '지금' 타임스탬프로 이주.
function exhaustedState(caps) {
  const now = Date.now();
  return { diagTimes: Array.from({ length: caps.perWindow }, () => now), out: OUTCOME_CAP, total: caps.sessionMax };
}
function readState(sessionId, caps) {
  let raw;
  try { raw = fs.readFileSync(stateFile(sessionId), 'utf8'); }
  catch { return { diagTimes: [], out: 0, total: 0 }; } // 파일 없음 = 새 세션
  if (!raw.trim()) return exhaustedState(caps); // 구판 마커 = 소진
  try {
    const s = JSON.parse(raw);
    if (Array.isArray(s.diagTimes)) {
      return {
        diagTimes: s.diagTimes.filter((t) => typeof t === 'number'),
        out: typeof s.out === 'number' ? s.out : 0,
        total: typeof s.total === 'number' ? s.total : s.diagTimes.length,
      };
    }
    if (typeof s.diag === 'number') { // 구판 숫자 카운트 → 보수적 이주
      const now = Date.now();
      return { diagTimes: Array.from({ length: Math.min(s.diag, caps.perWindow) }, () => now), out: typeof s.out === 'number' ? s.out : 0, total: s.diag };
    }
    return exhaustedState(caps);
  } catch { return exhaustedState(caps); } // 손상 = 보수적 소진
}
// 슬라이딩 윈도 판정: 최근 2시간 내 주입이 caps.perWindow 미만이고 세션 누적이
// caps.sessionMax 미만 (둘 다 감도 단계에 따라 스케일).
function diagAllowed(state, caps) {
  const cutoff = Date.now() - DIAG_WINDOW_MS;
  const recent = state.diagTimes.filter((t) => t > cutoff);
  return recent.length < caps.perWindow && (state.total || 0) < caps.sessionMax;
}
function writeState(sessionId, s) {
  const f = stateFile(sessionId);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(s));
}

// Open (sealed, unsettled) predicate texts from the LOCAL ledger — the ledger
// state the model cannot see on its own. This is the hook's real cargo.
function openPredicates(cwd) {
  let raw;
  try { raw = fs.readFileSync(path.join(cwd, '.argus', 'ledger', 'ledger.jsonl'), 'utf8'); }
  catch { return []; }
  const pred = new Map();
  const closed = new Set();
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    if (!e || !e.id) continue;
    if (e.event === 'seal' && typeof e.predicate === 'string') pred.set(e.id, e.predicate);
    else if (e.event === 'settle' || e.event === 'dismiss') closed.add(e.id);
  }
  const out = [];
  for (const [id, p] of pred.entries()) if (!closed.has(id)) out.push(p);
  return out;
}

const SRC = '[Argus sense — a deterministic every-turn hook. The judgment below is YOURS: diagnose meaning, not keywords. Speak to the user in their language. Mirror, never verdict.]';
// Honest-gap surface (LLM-glue invariant): a broken wire must not fail silent.
// If the MCP tools are missing the model says so ONCE — the user can then fix
// the connection (/mcp) instead of reading weeks of silence as "restraint".
const MCP_GUARD = 'If the Argus tools (argus_predict / argus_resolve / argus_capture) are NOT in your tool list right now, the Argus wire is broken — do not silently skip: tell the user ONCE, in one brief line in their language, that the Argus plugin is active but its MCP server is not connected (run /mcp to check, /doctor to diagnose). If you have already said this once this session, stay completely silent about it and ignore the rest of this instruction.';

function predList(preds) {
  return preds.slice(0, PRED_LIST_MAX)
    .map((p) => `  - "${String(p).slice(0, PRED_CLIP)}"`)
    .join('\n');
}

/** 전체 진단 지시 — 3감각을 의미 기준으로 묻는다 (패턴이 아니라 판단). */
function buildDiagnosis(preds, candidates) {
  const lines = [
    SRC,
    'Diagnose THIS turn — the user\'s message AND your own previous reply, both already in your context — with three questions:',
    '1. PREDICTION: Does anything imply a future state reality will prove true or false — and roughly when? Judge falsifiability by MEANING ("이 방향이면 나중에 무리가 올 것 같은데" qualifies; a vibe with no checkable state does not). It must be a claim the user COMMITS TO as their own — a question they put to YOU (which option is better, will this work, "can you draft/build X") is soliciting your help, not their prediction, however weighty the topic; answer it and stay out. If yes and the call is consequential (real stakes or hard to reverse), you MAY — after fully handling the request — offer ONCE to save it via argus_predict in the user\'s own words (predicate_owner:"user" if they worded it; else confirm_draft:true for a one-tap confirm — Accept keeps it, or the user rewords / adjusts the date, Decline skips). Record exactly ONE falsifiable claim per predicate — if the turn carries two (a ship date AND closing deals, or two numbers), keep only the single most load-bearing one; never conjoin them with "and"/"so" (that stacks two predictions that cannot settle cleanly). Notice it ONLY as spoken this turn — if the claim surfaced turns ago and the user has moved to a different topic, the moment has passed; never resurface a past turn\'s claim mid-new-topic (a stale offer reads as not listening).',
  ];
  if (preds.length) {
    lines.push(
      '2. OUTCOME: These predictions are open on record:',
      predList(preds),
      'Does this turn reveal what reality did to any of them — including an implicit or pronoun reference ("그거 결국 잘 됐어")? You resolve the reference from context; the list above is why you can. If reality has spoken, record it NOW with argus_resolve in the user\'s words — do not wait for the check-by date. Never infer an outcome the user did not state.',
    );
  } else {
    lines.push('2. OUTCOME: No predictions are open on record — skip this sense.');
  }
  lines.push(
    '3. LOAD-BEARING ASSUMPTION (the core sense): What single premise must be true for the reasoning in this turn to hold — the one that flips the call if it breaks? A marked conditional ("as long as", "~니까") is the easy 10%; the valuable ones are UNSTATED. A decision counts even when the user hands it to you as work to execute ("here is the plan, start with X" is still a plan whose load-bearing premise you notice while doing the task) — a task wrapper does not cancel the call under it. The load-bearing premise is usually NOT the reason they said out loud (that stated reason is the surface) — it is the specific, often-unstated fact the decision REVERSES on if it turns out false ("drop the free tier because it is too generous" rests on the unstated bet that squeezed free users convert to paid, not that free drives signups). Name THAT specific mechanism in concrete terms, not a generic restatement of their rationale or a paraphrase of the clause they already spoke. If the decision is consequential you MAY name at most ONE, as a bare neutral question in their language, offered as your draft (source "ai_surfaced" via argus_capture) — never a directional statement, never a two-pole fork, never a disclaimed lean. Exactly ONE premise — the tells of stacking to avoid: an "and", a "so"/"therefore", or a second fact/date/number; split and keep the ONE the decision most rests on. Draft it only for the decision in the user\'s CURRENT message — never reach back to an earlier turn\'s decision the user has already moved past.',
  );
  for (const c of candidates.slice(0, 2)) {
    lines.push(`[Deterministic scan flagged a candidate ${c.kind}: "${String(c.span).slice(0, 220)}" — confirm or reject it by meaning; it is a floor, not the detector.]`);
  }
  lines.push(
    'Restraint (spine): offer at most ONCE per distinct decision — a skip on that decision is FINAL for it. Space offers out: never two replies in a row, and if the user has skipped two offers this session, stay silent for the rest of it. (Recording an outcome the user themselves stated is neutral bookkeeping and always allowed.) If another Argus instruction in this turn already has you ask the user something (e.g. an anchor lean question), fold into it — never two asks in one reply. Record on the turn where the signal APPEARS — once the user has moved on to another topic, the moment has passed: stay silent rather than firing late. Flat / trivial / easily-reversible / already-closed → total silence. Never grade the decision.',
    MCP_GUARD,
  );
  return lines.join('\n');
}

/** 정산-전용 재주입 — 진단 캡 소진 후에도 열린 예측의 정산은 놓치지 않는다. */
function buildOutcomeNudge(preds) {
  return [
    SRC,
    'A settlement may have just surfaced. These predictions are open on record:',
    predList(preds),
    'If THIS turn reveals what reality did to one of them — even by an implicit or pronoun reference — record it with argus_resolve in the user\'s own words now; do not wait for the check-by date. Never infer an outcome the user did not state. If nothing here settles one, stay completely silent. Recording is neutral bookkeeping, never praise or a grade.',
    MCP_GUARD,
  ].join('\n');
}

function main(input) {
  let payload = {};
  try { payload = JSON.parse(input || '{}'); } catch { return null; }
  const cwd = typeof payload.cwd === 'string' && payload.cwd ? payload.cwd : process.cwd();
  const sessionId = payload && payload.session_id;
  const prompt = (payload && (payload.user_message || payload.prompt)) || '';
  if (!sessionId || typeof prompt !== 'string') return null;
  if (prompt.trim().startsWith('/')) return null; // slash command — not conversation

  // ambient 선호 — opt_out/'off'는 완전 침묵, 아니면 감도 단계별 캡을 얻는다.
  const prefs = ambientPrefs();
  if (prefs.optOut) return null;
  const caps = prefs.caps;

  // 스캔 창 = 직전 어시스턴트 발화 + 이번 사용자 메시지 (양쪽 다 — §3.3).
  let assistant = '';
  if (typeof payload.transcript_path === 'string' && payload.transcript_path) {
    const { text, partial } = readTail(payload.transcript_path, 64 * 1024);
    if (text) assistant = lastAssistantText(text, partial).slice(-ASSISTANT_WINDOW);
  }
  const window = assistant ? assistant + '\n' + prompt : prompt;

  const pre = prefilterTurn(window);
  if (!pre.pass) return null; // 명백한 비후보 — 주입 없음 (비용 절약, 침묵)

  const state = readState(sessionId, caps);
  const preds = openPredicates(cwd);

  // 경로 1 — 전체 진단 (예측·정산·숨은 전제). 슬라이딩 윈도 안에서만.
  if (diagAllowed(state, caps)) {
    // 규칙 후보는 최저선으로 동봉 — 없어도 진단은 주입된다 (규칙은 감지기가 아니다).
    const candidates = detectSignals(window, { openPredicates: preds, max: 2 });
    // Claim the slot BEFORE printing: a write failure means silence, not a repeat.
    const cutoff = Date.now() - DIAG_WINDOW_MS;
    try {
      writeState(sessionId, {
        ...state,
        diagTimes: [...state.diagTimes.filter((t) => t > cutoff), Date.now()],
        total: (state.total || 0) + 1,
      });
    } catch { return null; }
    return buildDiagnosis(preds, candidates);
  }

  // 경로 2 — 정산-전용: 열린 예측이 있고 창에 종결 단서가 보일 때. 진단 캡과
  // 별도인 이유: 정산은 제안이 아니라 부기이고, 놓치면 루프가 죽는다.
  if (preds.length && pre.cues.includes('resolved') && state.out < OUTCOME_CAP) {
    try { writeState(sessionId, { ...state, out: state.out + 1 }); } catch { return null; }
    return buildOutcomeNudge(preds);
  }

  return null;
}

let stdin = '';
try { stdin = fs.readFileSync(0, 'utf8'); } catch { /* no stdin */ }
let context = null;
try { context = main(stdin); } catch { /* a broken hook must never tax the session */ }
if (context) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: context },
  }));
}
process.exit(0);
