/**
 * 도그푸딩 하네스 — Argus를 실제로 "써본다" (26 시나리오).
 *
 * 창업자 지시(2026-07-12 밤): "다양한 사용 예시 진짜로 만들어서 해보고
 * 피드백 만들고... 기록 싹 다 저장. 20번 이상 시뮬레이션. 미친놈처럼
 * 문제 찾아내고 다 고쳐."
 *
 * 실제 툴 핸들러(dist)를 realistic 결정 흐름으로 끝에서 끝까지 태우고
 * 사용자가 보는 surface·receipt를 전량 캡처, 마찰/깨진배선/스파인위반을
 * findings로 남긴다. 사람의 감정 반응은 못 만든다(P5 몫) — 드라이버로서의
 * 관찰이다. 정직성: 발견은 driver-observed이지 human-observed가 아니다.
 *
 * 실행: npm run build && node dogfood/run.mjs
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const { TOOL_MAP } = await import(new URL('../dist/tools/index.js', import.meta.url));

const findings = [];
const transcript = [];
const note = (severity, scenario, what, detail = '') => findings.push({ severity, scenario, what, detail: String(detail).slice(0, 400) });

async function call(toolName, args, { scenario, expectOk = true, expectCode = null } = {}) {
  const tool = TOOL_MAP.get(toolName);
  if (!tool) { note('A', scenario, `툴 ${toolName} 미등록`); return null; }
  // 실서버 충실도: MCP SDK가 하는 inputSchema 검증을 먼저 통과시킨다.
  // (handler 직접 호출은 이 관문을 건너뛰므로, 여기서 재현하지 않으면
  //  maxLength·enum 같은 경계가 검증 안 된 채 handler에 도달한다.)
  const parsed = tool.inputSchema.safeParse(args);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    transcript.push({ scenario, tool: toolName, ok: false, schemaRejected: msg });
    if (expectOk) note('A', scenario, `${toolName} 스키마 거절 (성공 기대)`, msg);
    return { ok: false, schemaRejected: msg };
  }
  let res;
  try { res = await tool.handler(parsed.data); }
  catch (e) { note('A', scenario, `${toolName} 핸들러 예외(잡히지 않음)`, e?.message ?? e); return null; }
  const sc = res?.structuredContent;
  transcript.push({ scenario, tool: toolName, ok: sc?.ok, surface: sc?.surface, code: sc?.error_code });
  if (expectOk && sc?.ok !== true) note('A', scenario, `${toolName} ok=false (성공 기대)`, `${sc?.error_code}: ${sc?.message}`);
  if (!expectOk && sc?.ok === true) note('A', scenario, `${toolName} ok=true (거절 기대)`, String(sc?.surface).slice(0, 160));
  if (expectCode && sc?.error_code !== expectCode) note('B', scenario, `${toolName} 오류코드 불일치`, `기대 ${expectCode} vs 실제 ${sc?.error_code}`);
  if (sc?.surface != null) inspectSurface(scenario, toolName, sc.surface);
  return sc;
}

function inspectSurface(scenario, tool, surface) {
  const s = String(surface);
  const VERDICT = /(잘했|못했|훌륭|형편없|점수|[ABCDF]등급|당신은 .{0,6}형이|반드시 해야|틀렸습니다|실패했습니다)/;
  if (VERDICT.test(s)) note('A', scenario, `${tool} surface 평결/조언 어휘`, s.slice(0, 160));
  if (/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/.test(s)) note('A', scenario, `${tool} surface 제어문자 누출`, JSON.stringify(s).slice(0, 120));
  if (/(항해|항적|닻 내림|용골|voyage|Current Heading|Fog \/ reef|Next helm)/.test(s)) note('B', scenario, `${tool} surface 은유 잔재`, s.slice(0, 160));
  if (/[가-힣]/.test(s) && /(^|[^a-zA-Z])(held|avoided|partial|contract|judgment|prediction)([^a-zA-Z]|$)/.test(s)) note('B', scenario, `${tool} 한글 surface 미번역 토큰`, s.slice(0, 160));
  if (s.length > 1200) note('B', scenario, `${tool} surface 과다 길이(${s.length})`, s.slice(0, 100));
}

const HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-df-home-'));
process.env.ARGUS_HOME = HOME;
let wsSeq = 0;
function ws() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), `argus-df-${wsSeq++}-`));
  fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
  return path.join(repo, '.argus');
}
const seal = (dir, o, S) => call('argus_seal', { argus_dir: dir, predicate_owner: 'user', ...o }, { scenario: S });
const settle = (dir, o, S, opt = {}) => call('argus_settle', { argus_dir: dir, outcome_source: 'user_stated', ...o }, { scenario: S, ...opt });
const init = (dir, S, extra = {}) => call('argus_init', { argus_dir: dir, ...extra }, { scenario: S });

// ── 시나리오 (풍부한 현실 결정) ─────────────────────────────
const SCENARIOS = {
  async 'S01 기술결정→held'() {
    const S = 'S01 기술결정→held', d = ws(); await init(d, S);
    await seal(d, { id: 'pg-latency', predicate: '세션 저장을 Postgres로 옮기면 p99 지연이 8월 1일까지 200ms 밑으로 내려간다', check_by: '2026-08-01', basis: 'judgment', real_question: '지연의 진짜 병목이 저장소인가', today_override: '2026-07-12' }, S);
    const r = await settle(d, { id: 'pg-latency', outcome: 'held', what_happened: 'p99가 180ms로 내려갔다', today_override: '2026-08-01' }, S);
    const blob = String(r?.surface) + JSON.stringify(r?.data ?? {});
    if (!/VERDICT|NONE|평결/.test(blob)) note('B', S, '정산 영수증에 AI-VERDICT-NONE 표식 없음', String(r?.surface).slice(0, 160));
  },
  async 'S02 예측 빗나감→missed'() {
    const S = 'S02 missed', d = ws(); await init(d, S);
    await seal(d, { id: 'retention', predicate: '온보딩 리디자인 출시 후 2일차 리텐션이 5%p 오른다', check_by: '2026-07-30', today_override: '2026-07-12' }, S);
    const r = await settle(d, { id: 'retention', outcome: 'missed', what_happened: '리텐션이 1%p 떨어졌다', today_override: '2026-07-30' }, S);
    if (/(안타|아쉽|다음엔|반성|실패)/.test(String(r?.surface))) note('A', S, 'missed 정산이 위로/훈계 톤', String(r?.surface).slice(0, 200));
  },
  async 'S03 still_pending 재무장'() {
    const S = 'S03 still_pending', d = ws(); await init(d, S);
    await seal(d, { id: 'ramp', predicate: '신규 입사자가 30일 안에 온전히 적응한다', check_by: '2026-08-11', today_override: '2026-07-12' }, S);
    await settle(d, { id: 'ramp', outcome: 'still_pending', defer_to: '2026-08-25', today_override: '2026-08-11' }, S);
    const ci = await call('argus_check_in', { argus_dir: d, today_override: '2026-08-26' }, { scenario: S });
    const due = ci?.data?.due_count ?? ci?.data?.due?.length ?? 0;
    if (due < 1) note('A', S, 'still_pending 후 재무장 실패 — check_in에 다시 안 뜸', JSON.stringify(ci?.data?.due ?? []).slice(0, 200));
  },
  async 'S04 평평한 비결정 (over-fire 금지)'() {
    const S = 'S04 flat', d = ws(); await init(d, S);
    const od = await call('argus_open_decision', { argus_dir: d, id: 'lunch', decision: '점심에 김밥과 국수 중 무엇을 먹을까', stakes: 'trivial', reversibility: 'easily_reversible', status_quo: '아무거나 먹는다', today_override: '2026-07-12' }, { scenario: S });
    const blob = String(od?.surface) + JSON.stringify(od?.data ?? {});
    if (/(선택지 A|option a|두 갈래로|이쪽이 나|추천|weighted)/i.test(blob)) note('A', S, 'trivial 결정에 포크/기울기 생성 (over-fire, 스파인 미러 절)', blob.slice(0, 200));
  },
  async 'S05 amend + 확인일후 amend 거절'() {
    const S = 'S05 amend', d = ws(); await init(d, S);
    await seal(d, { id: 'api-cut', predicate: 'API v2 전환 후 오류율이 0.1% 밑', check_by: '2026-07-20', today_override: '2026-07-12' }, S);
    await call('argus_amend', { argus_dir: d, id: 'api-cut', check_by: '2026-07-27', today_override: '2026-07-13' }, { scenario: S });
    await call('argus_amend', { argus_dir: d, id: 'api-cut', check_by: '2026-08-30', today_override: '2026-07-28' }, { scenario: S, expectOk: false });
  },
  async 'S06 dismiss'() {
    const S = 'S06 dismiss', d = ws(); await init(d, S);
    await seal(d, { id: 'feat-x', predicate: '기능 X를 켜면 전환율이 오른다', check_by: '2026-09-01', today_override: '2026-07-12' }, S);
    await call('argus_dismiss', { argus_dir: d, id: 'feat-x', dismiss_reason: 'became_irrelevant', note: '기능 X를 로드맵에서 뺐다', today_override: '2026-07-14' }, { scenario: S });
  },
  async 'S07 한글 로케일 전체'() {
    const S = 'S07 ko', d = ws(); await init(d, S); await call('argus_config', { argus_dir: d, locale: 'ko' }, { scenario: S });
    await seal(d, { id: 'price', predicate: '가격을 20% 올려도 이탈률은 5% 밑으로 유지된다', check_by: '2026-08-15', today_override: '2026-07-12' }, S);
    await call('argus_check_in', { argus_dir: d, today_override: '2026-08-16' }, { scenario: S });
  },
  async 'S08 후보 빈 목록'() {
    const S = 'S08 candidates-empty', d = ws(); await init(d, S);
    const r = await call('argus_candidates', { argus_dir: d, action: 'list', today_override: '2026-07-12' }, { scenario: S });
    if (!/없|no captured/i.test(String(r?.surface))) note('B', S, '빈 후보 목록이 "없음"을 명확히 말하지 않음', String(r?.surface).slice(0, 160));
  },
  async 'S09 갓 설치 check_in'() {
    const S = 'S09 empty-checkin', d = ws(); await init(d, S);
    const ci = await call('argus_check_in', { argus_dir: d, today_override: '2026-07-12' }, { scenario: S });
    const s = String(ci?.surface ?? '');
    if (s.trim().length < 3) note('B', S, '빈 check_in surface가 사실상 비어 있음 — 설치 직후 다음 손잡이 부재', JSON.stringify(ci?.data ?? {}).slice(0, 160));
  },
  async 'S10 전제 등록'() {
    const S = 'S10 premises', d = ws(); await init(d, S);
    await seal(d, { id: 'infra', predicate: '인프라 비용이 분기 안에 20% 준다', check_by: '2026-09-30', today_override: '2026-07-12' }, S);
    await call('argus_premises', { argus_dir: d, id: 'infra', op: 'add', premises: [{ text: '현재 트래픽 증가율이 유지된다', kind: 'premise', source: 'user_stated', recheck_cadence_days: 14 }], today_override: '2026-07-12' }, { scenario: S });
  },
  async 'S11 ai_surfaced 예측 (위조 금지)'() {
    const S = 'S11 ai-provenance', d = ws(); await init(d, S);
    const r = await seal(d, { id: 'ai-pred', predicate: '이 리팩터링이 빌드 시간을 30% 줄인다', check_by: '2026-08-01', predicate_owner: 'ai_surfaced', today_override: '2026-07-12' }, S);
    // predicate_owner=ai_surfaced인데 surface가 사용자 소유처럼 말하면 위반 (authorship 정직)
    if (r?.ok) { const blob = JSON.stringify(r?.data ?? {}); if (!/ai_surfaced|ai-surfaced|초안|미확인/.test(blob + String(r?.surface))) note('B', S, 'ai_surfaced 예측의 출처 표식이 응답에 드러나지 않음', String(r?.surface).slice(0, 160)); }
  },
  async 'S12 settle avoided'() {
    const S = 'S12 avoided', d = ws(); await init(d, S);
    await seal(d, { id: 'risk', predicate: '배포 후 심각 장애가 난다', check_by: '2026-07-25', today_override: '2026-07-12' }, S);
    await settle(d, { id: 'risk', outcome: 'avoided', what_happened: '롤아웃을 단계화해서 장애를 피했다', today_override: '2026-07-25' }, S);
  },
  async 'S13 settle partial'() {
    const S = 'S13 partial', d = ws(); await init(d, S);
    await seal(d, { id: 'perf', predicate: '캐시 도입으로 응답이 절반으로 준다', check_by: '2026-07-22', today_override: '2026-07-12' }, S);
    await settle(d, { id: 'perf', outcome: 'partial', what_happened: '30% 줄었다. 절반까지는 아니었다', today_override: '2026-07-22' }, S);
  },
  async 'S14 중복 봉인 거절'() {
    const S = 'S14 double-seal', d = ws(); await init(d, S);
    await seal(d, { id: 'dup', predicate: '첫 봉인이다 이건 확실히 길다', check_by: '2026-08-01', today_override: '2026-07-12' }, S);
    await call('argus_seal', { argus_dir: d, id: 'dup', predicate: '같은 id로 두 번째 봉인 시도한다', check_by: '2026-08-02', predicate_owner: 'user', today_override: '2026-07-12' }, { scenario: S, expectOk: false });
  },
  async 'S15 봉인 전 정산 거절'() {
    const S = 'S15 settle-before-seal', d = ws(); await init(d, S);
    await settle(d, { id: 'ghost', outcome: 'held', what_happened: '없는 결정을 정산 시도', today_override: '2026-07-12' }, S, { expectOk: false });
  },
  async 'S16 정산 후 재정산 거절 (terminal)'() {
    const S = 'S16 double-settle', d = ws(); await init(d, S);
    await seal(d, { id: 'term', predicate: '이건 봉인하고 정산할 결정이다 확실히', check_by: '2026-07-20', today_override: '2026-07-12' }, S);
    await settle(d, { id: 'term', outcome: 'held', what_happened: '됐다', today_override: '2026-07-20' }, S);
    await settle(d, { id: 'term', outcome: 'missed', what_happened: '다시 정산 시도', today_override: '2026-07-21' }, S, { expectOk: false });
  },
  async 'S17 과거 확인일 봉인 거절'() {
    const S = 'S17 past-checkby', d = ws(); await init(d, S);
    await call('argus_seal', { argus_dir: d, id: 'past', predicate: '이미 지난 날짜로 봉인 시도한다 이건', check_by: '2026-07-01', predicate_owner: 'user', today_override: '2026-07-12' }, { scenario: S, expectOk: false });
  },
  async 'S18 빈 예측 거절'() {
    const S = 'S18 empty-pred', d = ws(); await init(d, S);
    await call('argus_seal', { argus_dir: d, id: 'empty', predicate: '', check_by: '2026-08-01', predicate_owner: 'user', today_override: '2026-07-12' }, { scenario: S, expectOk: false });
  },
  async 'S19 watch anchor→capture→list'() {
    const S = 'S19 watch', d = ws(); await init(d, S);
    await call('argus_watch', { argus_dir: d, op: 'anchor', text: '오늘은 결제 버그부터 잡는다', today_override: '2026-07-12' }, { scenario: S });
    await call('argus_watch', { argus_dir: d, op: 'capture', text: '캐시 TTL이 5분이라고 가정하고 있다', kind: 'premise', source: 'user_stated', today_override: '2026-07-12' }, { scenario: S });
    await call('argus_watch', { argus_dir: d, op: 'list', days: 2, today_override: '2026-07-12' }, { scenario: S });
  },
  async 'S20 due 있는 check_in (닻거울)'() {
    const S = 'S20 checkin-due', d = ws(); await init(d, S);
    await seal(d, { id: 'due1', predicate: '광고 예산을 늘리면 CAC가 내려간다', check_by: '2026-07-15', today_override: '2026-07-12' }, S);
    const ci = await call('argus_check_in', { argus_dir: d, today_override: '2026-07-16' }, { scenario: S });
    const due = ci?.data?.due_count ?? ci?.data?.due?.length ?? 0;
    if (due < 1) note('A', S, '확인일 지난 봉인이 check_in due에 없음', JSON.stringify(ci?.data ?? {}).slice(0, 200));
  },
  async 'S21 두 결정 공정 큐'() {
    const S = 'S21 fairness', d = ws(); await init(d, S);
    await seal(d, { id: 'f-old', predicate: '오래된 결정이다 이것은 먼저 봉인됐다', check_by: '2026-07-10', today_override: '2026-07-01' }, S);
    await seal(d, { id: 'f-new', predicate: '새 결정이다 이것은 나중에 봉인됐다', check_by: '2026-07-11', today_override: '2026-07-05' }, S);
    const ci = await call('argus_check_in', { argus_dir: d, today_override: '2026-07-20' }, { scenario: S });
    const due = ci?.data?.due_count ?? ci?.data?.due?.length ?? 0;
    if (due < 2) note('A', S, 'due 2건인데 check_in이 다 반영 안 함', JSON.stringify(ci?.data ?? {}).slice(0, 200));
  },
  async 'S22 토큰 없이 sync (우아한 실패)'() {
    const S = 'S22 sync-no-token', d = ws(); await init(d, S);
    const before = process.env.ARGUS_TOKEN; delete process.env.ARGUS_TOKEN;
    const r = await call('argus_sync', { argus_dir: d, today_override: '2026-07-12' }, { scenario: S, expectOk: false });
    if (before) process.env.ARGUS_TOKEN = before;
    // UX 질문(B): "연결 안 됨"이 에러 봉투로 오면 뭔가 깨진 것처럼 느껴질 수 있다.
    if (r?.error_code === 'NOT_CONNECTED' && !/local|로컬|그대로|괜찮/.test(String(r?.message) + String(r?.surface))) {
      note('B', S, 'sync 미연결이 순수 에러로 표기 — "로컬만 쓰는 중, 문제 아님" 톤 부재', String(r?.message).slice(0, 160));
    }
  },
  async 'S23 recall track_record (빈도만)'() {
    const S = 'S23 recall', d = ws(); await init(d, S);
    await seal(d, { id: 'r1', predicate: '이것은 정산해서 기록을 만들 결정이다', check_by: '2026-07-14', today_override: '2026-07-12' }, S);
    await settle(d, { id: 'r1', outcome: 'held', what_happened: '맞았다', today_override: '2026-07-14' }, S);
    const r = await call('argus_recall', { argus_dir: d, view: 'track_record', today_override: '2026-07-15' }, { scenario: S });
    if (/(점수|등급|당신은|정확도.*%.*형|tier|score)/.test(String(r?.surface))) note('A', S, 'track_record가 점수/등급/정체성 판정을 노출 (스파인)', String(r?.surface).slice(0, 200));
  },
  async 'S24 후보 promote→seal 연결'() {
    const S = 'S24 candidate-promote', d = ws(); await init(d, S);
    // v2 후보를 직접 심고(브리지) promote→seal 흐름
    const { contextFor, candidateCreatedV2 } = await import(new URL('../dist/v2/bridge.js', import.meta.url));
    const { gitCommonDirOf } = await import(new URL('../dist/v2/git-discovery.js', import.meta.url));
    try {
      const ctx = contextFor({ home: HOME, gitCommonDir: gitCommonDirOf(d), workspaceArgusDir: d, sessionId: 's', producerVersion: 't', today: '2026-07-12' });
      candidateCreatedV2(ctx, { candidateId: 'cand-x', kind: 'decision', quote: '큐는 SQLite로 가기로 했다', quoteSpeaker: 'user', source: 'debrief' });
      const list = await call('argus_candidates', { argus_dir: d, action: 'list', today_override: '2026-07-12' }, { scenario: S });
      if (!/cand-x/.test(String(list?.surface))) note('B', S, '심은 후보가 목록에 안 보임', String(list?.surface).slice(0, 160));
      await seal(d, { id: 'from-cand', predicate: '큐를 SQLite로 옮겨도 처리량이 유지된다', check_by: '2026-08-01', today_override: '2026-07-12' }, S);
      await call('argus_candidates', { argus_dir: d, action: 'promote', candidate_id: 'cand-x', decision_id: 'from-cand', today_override: '2026-07-12' }, { scenario: S });
    } catch (e) { note('B', S, 'promote 흐름 구동 실패(하네스/배선)', e?.message ?? e); }
  },
  async 'S25 초장문 예측 (maxLength)'() {
    const S = 'S25 long-pred', d = ws(); await init(d, S);
    // 스키마 관문(SDK)이 400자 초과를 거절해야 한다 (실서버 재현).
    await call('argus_seal', { argus_dir: d, id: 'long', predicate: '가'.repeat(500), check_by: '2026-08-01', predicate_owner: 'user', today_override: '2026-07-12' }, { scenario: S, expectOk: false });
  },
  async 'S26 예측에 제어문자/평결어 주입 (데이터로만)'() {
    const S = 'S26 injection', d = ws(); await init(d, S);
    const r = await seal(d, { id: 'inject', predicate: '이 예측에는 \u001b[31m색코드와 "당신은 실패자" 같은 문구가 데이터로 들어간다', check_by: '2026-08-01', today_override: '2026-07-12' }, S);
    // 봉인은 되되, 되돌아오는 surface에 제어문자가 살아있으면 안 됨 (inspectSurface가 잡음)
    // check_in에서 이 predicate가 닻거울로 나올 때도 무해해야
    await call('argus_check_in', { argus_dir: d, today_override: '2026-08-02' }, { scenario: S });
  },
};

const names = Object.keys(SCENARIOS);
for (const n of names) {
  try { await SCENARIOS[n](); }
  catch (e) { note('A', n, '시나리오 자체 크래시', String(e?.stack ?? e).slice(0, 400)); }
}

fs.rmSync(HOME, { recursive: true, force: true });

const bySev = { A: 0, B: 0, info: 0 };
for (const f of findings) bySev[f.severity] = (bySev[f.severity] ?? 0) + 1;
const out = {
  scenarios: names.length, surfaces_captured: transcript.length,
  findings_total: findings.length, A_blocking: bySev.A, B_friction: bySev.B, info: bySev.info,
  findings,
  // 사람이 실제로 읽을 수 있게 모든 surface를 덤프 — 진짜 마찰은 여기 있다.
  surfaces: transcript.filter((t) => t.surface != null).map((t) => ({ scenario: t.scenario, tool: t.tool, ok: t.ok, surface: t.surface })),
};
process.stdout.write(JSON.stringify(out, null, 2) + '\n');
