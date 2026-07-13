/**
 * 도그푸딩 하네스 — Argus를 실제로 "써본다" (42 시나리오).
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
  transcript.push({ scenario, tool: toolName, ok: sc?.ok, surface: sc?.surface, code: sc?.error_code, message: sc?.message, recovery: sc?.recovery });
  // 오류에는 surface가 없다(설계: 오류는 모델에게 message+recovery로 말한다).
  // 그 텍스트도 결국 사용자에게 전해지므로 스파인 위반·적대적 어조를 검사한다.
  if (sc?.ok === false && (sc?.message || sc?.recovery)) inspectSurface(scenario, `${toolName}[err]`, `${sc?.message ?? ''} ${sc?.recovery ?? ''}`);
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
  async 'S27 한 세션 5연속 봉인 → 공정 큐 순서'() {
    const S = 'S27 multi-seal', d = ws(); await init(d, S);
    for (let i = 1; i <= 5; i++) {
      await seal(d, { id: `m${i}`, predicate: `연속 결정 ${i}번은 확실히 충분히 긴 예측 문장이다`, check_by: '2026-07-15', today_override: `2026-07-0${i}` }, S);
    }
    const ci = await call('argus_check_in', { argus_dir: d, today_override: '2026-07-20' }, { scenario: S });
    const due = ci?.data?.due_count ?? ci?.data?.due?.length ?? 0;
    if (due < 5) note('A', S, '5건 봉인인데 check_in due가 5 미만', JSON.stringify(ci?.data?.due ?? []).slice(0, 200));
  },
  async 'S28 전제 재확인 drifted'() {
    const S = 'S28 recheck-drift', d = ws(); await init(d, S);
    await seal(d, { id: 'rate', predicate: '기준금리가 연내 동결되면 대출 수요가 유지된다', check_by: '2026-12-31', today_override: '2026-07-12' }, S);
    await call('argus_premises', { argus_dir: d, id: 'rate', op: 'add', premises: [{ text: '기준금리 3.5% 동결', kind: 'premise', source: 'user_stated' }], today_override: '2026-07-12' }, { scenario: S });
    // 첫 recheck = 기준선(무알림)
    await call('argus_recheck', { argus_dir: d, id: 'rate', ref: 'P1', finding: '기준금리 3.5% 유지', source: 'user_stated', today_override: '2026-07-20' }, { scenario: S });
    // 두 번째 = drifted
    const r = await call('argus_recheck', { argus_dir: d, id: 'rate', ref: 'P1', finding: '기준금리 3.75%로 인상', changed: true, source: 'user_stated', today_override: '2026-08-20' }, { scenario: S });
    if (/(권장|해야|틀렸|재검토하세요|revisit now|you should)/i.test(String(r?.surface))) note('A', S, 'recheck drifted가 지시/평결 톤 (손잡이만이어야)', String(r?.surface).slice(0, 200));
  },
  async 'S29 매우 긴 what_happened (600자 경계)'() {
    const S = 'S29 long-what', d = ws(); await init(d, S);
    await seal(d, { id: 'lw', predicate: '이 결정은 정산할 때 긴 서술을 받을 것이다 확실히', check_by: '2026-07-20', today_override: '2026-07-12' }, S);
    await call('argus_settle', { argus_dir: d, id: 'lw', outcome: 'held', outcome_source: 'user_stated', what_happened: '가'.repeat(601), today_override: '2026-07-20' }, { scenario: S, expectOk: false });
  },
  async 'S30 한글·영어 혼용 predicate'() {
    const S = 'S30 mixed-lang', d = ws(); await init(d, S);
    await seal(d, { id: 'mix', predicate: 'queue를 SQLite로 옮기면 throughput이 10% 오른다 by Q3', check_by: '2026-09-30', today_override: '2026-07-12' }, S);
  },
  async 'S31 snooze 2회 → dismiss 제안 플래그'() {
    const S = 'S31 snooze-flag', d = ws(); await init(d, S);
    // v2 브리지로 seal + snooze 2회 후 brief 파생 확인
    const { contextFor, sealV2, snoozeV2 } = await import(new URL('../dist/v2/bridge.js', import.meta.url));
    const { gitCommonDirOf } = await import(new URL('../dist/v2/git-discovery.js', import.meta.url));
    const { loadState } = await import(new URL('../dist/v2/reducer.js', import.meta.url));
    const { deriveBrief } = await import(new URL('../dist/v2/brief.js', import.meta.url));
    try {
      const ctx = contextFor({ home: HOME, gitCommonDir: gitCommonDirOf(d), workspaceArgusDir: d, sessionId: 's', producerVersion: 't', today: '2026-07-12' });
      sealV2(ctx, { decisionId: 'sn', predicate: { value: '두 번 미룰 결정이다 확실히', provenance: 'elicited_user' }, checkBy: { value: '2026-07-15', provenance: 'elicited_user' } });
      snoozeV2(ctx, { decisionId: 'sn', until: '2026-07-18' });
      snoozeV2(ctx, { decisionId: 'sn', until: '2026-07-25' });
      const b = deriveBrief(loadState(HOME, ctx.repository_id), '2026-07-26');
      const item = b.due.find((x) => x.decision_id === 'sn');
      if (item && !item.suggest_dismiss) note('B', S, 'snooze 2회 후 suggest_dismiss 플래그가 안 섬', JSON.stringify(item).slice(0, 160));
    } catch (e) { note('B', S, 'snooze 흐름 구동 실패', e?.message ?? e); }
  },
  async 'S32 candidate promote 후 재행동 거절'() {
    const S = 'S32 cand-terminal', d = ws(); await init(d, S);
    const { contextFor, candidateCreatedV2 } = await import(new URL('../dist/v2/bridge.js', import.meta.url));
    const { gitCommonDirOf } = await import(new URL('../dist/v2/git-discovery.js', import.meta.url));
    try {
      const ctx = contextFor({ home: HOME, gitCommonDir: gitCommonDirOf(d), workspaceArgusDir: d, sessionId: 's', producerVersion: 't', today: '2026-07-12' });
      candidateCreatedV2(ctx, { candidateId: 'ct', kind: 'decision', quote: '이건 승격 후 재행동 거절 테스트', quoteSpeaker: 'user', source: 'debrief' });
      await seal(d, { id: 'ct-dec', predicate: '이 후보를 봉인해 연결할 결정이다 확실히', check_by: '2026-08-01', today_override: '2026-07-12' }, S);
      await call('argus_candidates', { argus_dir: d, action: 'promote', candidate_id: 'ct', decision_id: 'ct-dec', today_override: '2026-07-12' }, { scenario: S });
      // 승격은 terminal — 다시 drop은 거절돼야
      await call('argus_candidates', { argus_dir: d, action: 'drop', candidate_id: 'ct', today_override: '2026-07-12' }, { scenario: S, expectOk: false });
    } catch (e) { note('B', S, 'candidate terminal 흐름 실패', e?.message ?? e); }
  },
  async 'S33 이모지·제로폭·RTL 문자가 든 predicate 렌더 안전'() {
    const S = 'S33 unicode-render', d = ws(); await init(d, S);
    // 제로폭(U+200B)·RTL 표식(U+200F)·이모지가 든 예측 — 봉인되고, check_in 닻거울에서 무해해야
    const tricky = '출시하면 ​지표가 ‏오른다 🚀 확실히 충분히 길게';
    await seal(d, { id: 'uni', predicate: tricky, check_by: '2026-07-15', today_override: '2026-07-12' }, S);
    await call('argus_check_in', { argus_dir: d, today_override: '2026-07-16' }, { scenario: S });
  },
  async 'S34 recall receipt view (정산 후 keepsake)'() {
    const S = 'S34 recall-receipt', d = ws(); await init(d, S);
    await seal(d, { id: 'rc', predicate: '영수증을 확인할 정산 완료 결정이다 확실히', check_by: '2026-07-14', today_override: '2026-07-12' }, S);
    await settle(d, { id: 'rc', outcome: 'held', what_happened: '예측대로 됐다', today_override: '2026-07-14' }, S);
    const r = await call('argus_recall', { argus_dir: d, view: 'receipt', id: 'rc', today_override: '2026-07-15' }, { scenario: S });
    // 영수증에 AI VERDICT: NONE 표식이 실제로 있는가 (제품 서명)
    const blob = String(r?.surface) + JSON.stringify(r?.data ?? {});
    if (!/VERDICT|NONE|평결/i.test(blob)) note('B', S, 'receipt view에 AI-VERDICT-NONE 서명 없음', String(r?.surface).slice(0, 200));
  },
  async 'S26 예측에 제어문자/평결어 주입 (데이터로만)'() {
    const S = 'S26 injection', d = ws(); await init(d, S);
    const r = await seal(d, { id: 'inject', predicate: '이 예측에는 \u001b[31m색코드와 "당신은 실패자" 같은 문구가 데이터로 들어간다', check_by: '2026-08-01', today_override: '2026-07-12' }, S);
    // 봉인은 되되, 되돌아오는 surface에 제어문자가 살아있으면 안 됨 (inspectSurface가 잡음)
    // check_in에서 이 predicate가 닻거울로 나올 때도 무해해야
    await call('argus_check_in', { argus_dir: d, today_override: '2026-08-02' }, { scenario: S });
  },
  async 'S35 amend으로 확인일 연장 — 무엇이 바뀌었는지 정직'() {
    const S = 'S35 amend-date', d = ws(); await init(d, S);
    await seal(d, { id: 'am', predicate: '이 기능은 다음 스프린트 안에 출시된다 충분히 길게', check_by: '2026-07-20', today_override: '2026-07-13' }, S);
    const r = await call('argus_amend', { argus_dir: d, id: 'am', check_by: '2026-07-27', today_override: '2026-07-13' }, { scenario: S });
    const blob = String(r?.surface) + JSON.stringify(r?.data ?? {});
    if (r?.ok && !/2026-07-27/.test(blob)) note('B', S, 'amend surface가 새 확인일을 명시하지 않음', String(r?.surface).slice(0, 160));
  },
  async 'S36 빗나감+깨진 전제 귀속 → track_record 누적 표면'() {
    const S = 'S36 broken-premise-attrib', d = ws(); await init(d, S);
    await seal(d, { id: 'bp', predicate: '금리가 동결되면 이 대출 결정이 유효하다 충분히 길게', check_by: '2026-07-14', today_override: '2026-07-12' }, S);
    await call('argus_premises', { argus_dir: d, id: 'bp', op: 'add', premises: [{ text: '기준금리는 2026-07-14까지 3.5%로 동결된다', kind: 'premise', external: true, load_bearing: true, source: 'user_stated' }], today_override: '2026-07-12' }, { scenario: S });
    await settle(d, { id: 'bp', outcome: 'missed', what_happened: '금리가 올라 전제가 깨졌다', broken_premise_ref: 'P1', today_override: '2026-07-14' }, S);
    const r = await call('argus_recall', { argus_dir: d, view: 'track_record', today_override: '2026-07-15' }, { scenario: S });
    const blob = String(r?.surface) + JSON.stringify(r?.data ?? {});
    if (!/전제|premise/i.test(blob)) note('B', S, 'track_record가 사용자 지목 깨진 전제 귀속을 표면화하지 않음', blob.slice(0, 200));
    if (/당신은 .{0,8}(형|타입|사람)|경향이 있습니다/.test(String(r?.surface))) note('A', S, 'track_record surface가 사람에 대한 진단으로 읽힘', String(r?.surface).slice(0, 160));
  },
  async 'S37 recheck 드리프트(전제 깨짐) — 비평결 유지'() {
    const S = 'S37 recheck-drift', d = ws(); await init(d, S);
    await seal(d, { id: 'rk', predicate: '공급이 유지되면 이 가격 결정이 옳다 충분히 길게 확실히', check_by: '2026-09-01', today_override: '2026-07-12' }, S);
    await call('argus_premises', { argus_dir: d, id: 'rk', op: 'add', premises: [{ text: '핵심 부품 단가는 개당 3.0달러다', kind: 'premise', external: true, load_bearing: true, source: 'user_stated' }], today_override: '2026-07-12' }, { scenario: S });
    await call('argus_recheck', { argus_dir: d, id: 'rk', ref: 'P1', finding: '핵심 부품 단가가 개당 4.2달러로 올랐다', numeric_value: 4.2, source: 'user_stated', today_override: '2026-07-20' }, { scenario: S });
  },
  async 'S38 정산 10건 — 표본 주의문 사라지고 대규모 빈도 표면'() {
    const S = 'S38 sample-10', d = ws(); await init(d, S);
    const outs = ['held', 'avoided', 'partial', 'held', 'avoided', 'held', 'partial', 'avoided', 'held', 'held'];
    for (let i = 0; i < 10; i++) {
      const id = `s${i}`;
      await seal(d, { id, predicate: `${i}번째 결정은 예정대로 처리된다 충분히 길게 확실히`, check_by: '2026-07-14', today_override: '2026-07-12' }, S);
      await settle(d, { id, outcome: outs[i], what_happened: '기록된 결과대로', today_override: '2026-07-14' }, S);
    }
    const r = await call('argus_recall', { argus_dir: d, view: 'track_record', today_override: '2026-07-15' }, { scenario: S });
    if (r?.data?.sample_size_caveat) note('B', S, '표본 10건인데 sample_size_caveat가 아직 붙음(작은 표본 문구)', String(r.data.sample_size_caveat).slice(0, 160));
  },
  async 'S39 config locale 왕복(ko→en) — 바뀐 키 명시 (F4 회귀)'() {
    const S = 'S39 config-roundtrip', d = ws(); await init(d, S);
    const a1 = await call('argus_config', { argus_dir: d, locale: 'ko' }, { scenario: S });
    if (a1?.ok && !/locale/.test(String(a1?.surface))) note('B', S, 'config surface가 바뀐 키(locale)를 명시하지 않음', String(a1?.surface).slice(0, 160));
    const a2 = await call('argus_config', { argus_dir: d, locale: 'en' }, { scenario: S });
    if (a2?.ok && !/locale/.test(String(a2?.surface))) note('B', S, 'config surface가 바뀐 키(locale)를 명시하지 않음(2차)', String(a2?.surface).slice(0, 160));
  },
  async 'S40 dismiss 후 그 결정 settle 시도 — 정직한 거절'() {
    const S = 'S40 dismiss-then-settle', d = ws(); await init(d, S);
    await seal(d, { id: 'dm', predicate: '이 실험은 다음 주에 결론이 난다 충분히 길게 확실히', check_by: '2026-07-20', today_override: '2026-07-12' }, S);
    await call('argus_dismiss', { argus_dir: d, id: 'dm', dismiss_reason: 'changed_mind', today_override: '2026-07-13' }, { scenario: S });
    await settle(d, { id: 'dm', outcome: 'held', what_happened: '되돌아와 정산 시도', today_override: '2026-07-21' }, S, { expectOk: false });
  },
  async 'S41 open만 하고 seal 전 recall bearing — 첫인상'() {
    const S = 'S41 open-no-seal', d = ws(); await init(d, S);
    await call('argus_open_decision', { argus_dir: d, id: 'op', decision: '새 채용을 이번 분기에 할지 말지', stakes: 'moderate', reversibility: 'costly_to_reverse', status_quo: '아무도 뽑지 않고 현 인원으로 간다', today_override: '2026-07-12' }, { scenario: S });
    const r = await call('argus_recall', { argus_dir: d, view: 'bearing', today_override: '2026-07-12' }, { scenario: S });
    const s = String(r?.surface);
    if (/^0 open bearing|봉인 중인 판단 0건/.test(s)) note('info', S, 'open만 한 뒤 bearing이 "0건"으로 보임 — 봉인 손잡이 안내 여부 읽기', s.slice(0, 160));
  },
  async 'S42 premises 여러 건 add 후 recall premises — staleness 정직'() {
    const S = 'S42 premises-staleness', d = ws(); await init(d, S);
    await seal(d, { id: 'pm', predicate: '이 로드맵은 3분기에 완료된다 충분히 길게 확실히', check_by: '2026-10-01', today_override: '2026-07-12' }, S);
    await call('argus_premises', { argus_dir: d, id: 'pm', op: 'add', premises: [
      { text: '핵심 엔지니어 2명이 계속 근무한다', kind: 'premise', external: true, load_bearing: true, source: 'user_stated' },
      { text: '외부 API가 3분기까지 안정적이다', kind: 'premise', external: true, load_bearing: false, source: 'user_stated' },
      { text: '경쟁사가 먼저 출시할까', kind: 'open_question', external: false, load_bearing: false, source: 'user_stated' },
    ], today_override: '2026-07-12' }, { scenario: S });
    const r = await call('argus_recall', { argus_dir: d, view: 'premises', id: 'pm', today_override: '2026-07-20' }, { scenario: S });
    const blob = JSON.stringify(r?.data ?? {});
    if (r?.ok && !/never re-checked|staleness/.test(blob)) note('B', S, 'recall premises가 재확인 이력 없음을 정직히 표기하지 않음', blob.slice(0, 200));
  },
  async 'S43 review — 짧은 LLM 답변 검수 (평결/은유 없이)'() {
    const S = 'S43 review', d = ws(); await init(d, S);
    const doc = '우리 팀은 신규 시장에 즉시 진출해야 합니다. 경쟁사는 아직 준비가 안 됐고, 우리 제품이 확실히 우위입니다. 3개월이면 점유율 1위가 됩니다.';
    await call('argus_review', { argus_dir: d, text: doc, source_kind: 'llm_answer', title: '시장 진출 제안', concerns: ['evidence', 'strategic_fit'], stakes: 'high' }, { scenario: S });
  },
  async 'S44 watch capture → 전제로 승격(from_capture)'() {
    const S = 'S44 watch-promote', d = ws(); await init(d, S);
    await seal(d, { id: 'wp', predicate: '이 파트너십은 6개월 안에 수익을 낸다 충분히 길게 확실히', check_by: '2026-12-01', today_override: '2026-07-12' }, S);
    const cap = await call('argus_watch', { argus_dir: d, op: 'capture', text: '파트너사가 API를 연말까지 무료로 연다고 구두로 약속했다', kind: 'premise', source: 'user_stated', today_override: '2026-07-12' }, { scenario: S });
    const cid = cap?.data?.capture_id;
    if (!cid) { note('B', S, 'watch capture가 capture_id를 안 돌려줌', JSON.stringify(cap?.data ?? {}).slice(0, 160)); return; }
    const r = await call('argus_premises', { argus_dir: d, id: 'wp', op: 'add', premises: [{ from_capture: cid, external: true, load_bearing: true }], today_override: '2026-07-12' }, { scenario: S });
    // 승격은 참조여야 — 캡처의 원문/출처가 그대로 넘어오는지
    const blob = JSON.stringify(r?.data ?? {});
    if (r?.ok && !/파트너사가 API/.test(blob)) note('B', S, 'from_capture 승격이 캡처 원문을 전제로 옮기지 않음', blob.slice(0, 200));
  },
  async 'S45 still_pending(defer) 후 실제 정산까지 — 유예 수명주기'() {
    const S = 'S45 pending-lifecycle', d = ws(); await init(d, S);
    await seal(d, { id: 'pl', predicate: '이번 협상은 다음 분기에 타결된다 충분히 길게 확실히', check_by: '2026-07-14', today_override: '2026-07-12' }, S);
    // 확인일에 현실이 아직 답 안 함 → still_pending, 새 확인일로 재무장
    await settle(d, { id: 'pl', outcome: 'still_pending', defer_to: '2026-08-14', today_override: '2026-07-14' }, S);
    // 새 확인일에 다시 떠야 함
    const ci = await call('argus_check_in', { argus_dir: d, today_override: '2026-08-15' }, { scenario: S });
    const due = (ci?.data?.due ?? []).length;
    if (due < 1) note('A', S, 'still_pending 재무장 후 새 확인일에 check_in에 다시 안 뜸', JSON.stringify(ci?.data?.due ?? []).slice(0, 200));
    // 이번엔 실제로 타결 → held
    const st = await settle(d, { id: 'pl', outcome: 'held', what_happened: '협상이 타결됐다', today_override: '2026-08-15' }, S);
    if (st?.ok && !/그렇게 됨|held/.test(String(st?.surface))) note('B', S, '유예 후 최종 정산 표면이 outcome을 명명하지 않음', String(st?.surface).slice(0, 160));
  },
  async 'S46 premises resolve — 열린 질문을 사용자 말로 닫음'() {
    const S = 'S46 resolve-question', d = ws(); await init(d, S);
    await seal(d, { id: 'rq', predicate: '이 아키텍처 선택은 확장에 유리하다 충분히 길게 확실히', check_by: '2026-11-01', today_override: '2026-07-12' }, S);
    await call('argus_premises', { argus_dir: d, id: 'rq', op: 'add', premises: [{ text: '트래픽이 3배로 늘어날까', kind: 'open_question', external: false, load_bearing: false, source: 'user_stated' }], today_override: '2026-07-12' }, { scenario: S });
    const r = await call('argus_premises', { argus_dir: d, id: 'rq', op: 'resolve', ref: 'P1', decision: '실측해보니 2배 수준에서 안정됐다, 3배는 아니었다', today_override: '2026-07-30' }, { scenario: S });
    // 닫는 말은 사용자 것이어야 — Argus가 대신 결론 내면 스파인 위반
    if (r?.ok && !/2배 수준에서 안정/.test(JSON.stringify(r?.data ?? {}))) note('B', S, 'resolve가 사용자의 닫는 말을 그대로 담지 않음', JSON.stringify(r?.data ?? {}).slice(0, 200));
  },
  async 'S47 premises still_open — 열린 채로 둠(재고 넛지 유예)'() {
    const S = 'S47 still-open', d = ws(); await init(d, S);
    await seal(d, { id: 'so', predicate: '이 채용 계획은 예산 안에 맞는다 충분히 길게 확실히', check_by: '2026-10-01', today_override: '2026-07-12' }, S);
    await call('argus_premises', { argus_dir: d, id: 'so', op: 'add', premises: [{ text: '내년 예산이 삭감될까', kind: 'open_question', external: false, load_bearing: false, source: 'user_stated' }], today_override: '2026-07-12' }, { scenario: S });
    const r = await call('argus_premises', { argus_dir: d, id: 'so', op: 'still_open', ref: 'P1', today_override: '2026-07-30' }, { scenario: S });
    // "열어둔 채로 두는 것도 유효한 답" — 평결/압박 어휘 없어야 (inspectSurface도 검사)
  },
  async 'S48 amend으로 예측 문구 다듬기 (확인일 전) — 변경 반영'() {
    const S = 'S48 amend-predicate', d = ws(); await init(d, S);
    await seal(d, { id: 'ap', predicate: '신규 기능이 사용자 만족도를 올린다 충분히 길게', check_by: '2026-09-01', today_override: '2026-07-12' }, S);
    const r = await call('argus_amend', { argus_dir: d, id: 'ap', predicate: '신규 기능이 주간 재방문율을 10퍼센트 이상 올린다', today_override: '2026-07-13' }, { scenario: S });
    if (r?.ok && !/재방문율/.test(JSON.stringify(r?.data ?? {}))) note('B', S, 'amend가 새 예측 문구를 반영하지 않음', JSON.stringify(r?.data ?? {}).slice(0, 200));
  },
  async 'S49 settle partial — 부분 결과 표면'() {
    const S = 'S49 partial', d = ws(); await init(d, S);
    await seal(d, { id: 'pt', predicate: '캠페인이 목표 가입자를 달성한다 충분히 길게 확실히', check_by: '2026-07-14', today_override: '2026-07-12' }, S);
    const r = await settle(d, { id: 'pt', outcome: 'partial', what_happened: '목표의 60퍼센트만 달성했다', today_override: '2026-07-14' }, S);
    if (r?.ok && !/부분|partial/.test(String(r?.surface))) note('B', S, 'partial 정산 표면이 outcome을 명명하지 않음', String(r?.surface).slice(0, 160));
  },
  async 'S50 혼합 정산 track_record — 버킷 합=정산수, pending 제외'() {
    const S = 'S50 mixed-integrity', d = ws(); await init(d, S);
    const plan = [['m0', 'held'], ['m1', 'avoided'], ['m2', 'partial'], ['m3', 'missed']];
    for (const [id, oc] of plan) {
      await seal(d, { id, predicate: `${id} 결정은 확인일에 판가름 난다 충분히 길게 확실히`, check_by: '2026-07-14', today_override: '2026-07-12' }, S);
      await settle(d, { id, outcome: oc, what_happened: '기록된 결과대로', today_override: '2026-07-14' }, S);
    }
    // 1건은 still_pending — 정산 카운트에 들면 안 됨
    await seal(d, { id: 'm4', predicate: 'm4 결정은 아직 현실이 답하지 않았다 충분히 길게 확실히', check_by: '2026-07-14', today_override: '2026-07-12' }, S);
    await settle(d, { id: 'm4', outcome: 'still_pending', defer_to: '2026-09-14', today_override: '2026-07-14' }, S);
    const r = await call('argus_recall', { argus_dir: d, view: 'track_record', today_override: '2026-07-15' }, { scenario: S });
    const st = r?.data?.stats ?? {};
    const n = r?.data?.sample_size;
    const bucketSum = (st.held ?? 0) + (st.avoided ?? 0) + (st.partial ?? 0) + (st.missed ?? 0);
    if (n !== 4) note('A', S, `정산 표본이 4가 아님(still_pending이 새는 듯): n=${n}`, JSON.stringify(st).slice(0, 200));
    if (bucketSum !== n) note('A', S, `버킷 합(${bucketSum})≠정산수(${n}) — 어떤 outcome이 카운트에서 샘/이중`, JSON.stringify(st).slice(0, 200));
  },
  // ── 회차 4: 오류·복구 표면 읽기 (제품이 적대적으로 느껴지는 곳) ──
  async 'S51 GOALPOST_MOVED — 확인일 지난 뒤 날짜 옮기기 거절'() {
    const S = 'S51 goalpost', d = ws(); await init(d, S);
    await seal(d, { id: 'gp', predicate: '이 결정은 확인일에 판가름 난다 충분히 길게 확실히', check_by: '2026-07-14', today_override: '2026-07-12' }, S);
    // 확인일이 지난 뒤 확인일을 미루려 함 — 골대 옮기기, 거절돼야
    await call('argus_amend', { argus_dir: d, id: 'gp', check_by: '2026-08-01', today_override: '2026-07-20' }, { scenario: S, expectOk: false, expectCode: 'GOALPOST_MOVED' });
  },
  async 'S52 NO_SUCH_PREMISE — 없는 전제를 깨졌다고 지목'() {
    const S = 'S52 no-premise', d = ws(); await init(d, S);
    await seal(d, { id: 'np', predicate: '이 예측은 확인일에 결과가 나온다 충분히 길게 확실히', check_by: '2026-07-14', today_override: '2026-07-12' }, S);
    await settle(d, { id: 'np', outcome: 'missed', what_happened: '빗나갔다', broken_premise_ref: 'P9', today_override: '2026-07-14' }, S, { expectOk: false, expectCode: 'NO_SUCH_PREMISE' });
  },
  async 'S53 init 없이 봉인 — v1 정본 성공, v2 미기록은 정직히 표기'() {
    const S = 'S53 seal-no-init', d = ws();
    // init 생략: v1(워크스페이스 원장)이 아직 정본이라 봉인은 성공한다.
    // 관건은 v2 내구 원장 미기록이 조용히 넘어가지 않고 이유가 남는가다
    // (F11: 내구성은 init에서 옴 — 성공 표면은 그 사실을 숨기지 않아야).
    const r = await call('argus_seal', { argus_dir: d, predicate_owner: 'user', id: 'ni', predicate: '초기화 없이 봉인해본다 충분히 길게 확실히', check_by: '2026-07-14', today_override: '2026-07-12' }, { scenario: S });
    const v2 = r?.data?.v2_write;
    if (r?.ok && v2 && v2.written === false && !/(bound|init|durable|repository_id)/i.test(String(v2.reason))) {
      note('B', S, 'v2 내구 원장 미기록인데 이유가 정직히 남지 않음(조용한 소실 위험)', JSON.stringify(v2).slice(0, 200));
    }
  },
  async 'S54 중복 봉인 — 같은 id 두 번(정직한 거절)'() {
    const S = 'S54 dup-seal', d = ws(); await init(d, S);
    await seal(d, { id: 'dup', predicate: '한 번만 봉인돼야 하는 예측이다 충분히 길게 확실히', check_by: '2026-07-14', today_override: '2026-07-12' }, S);
    // 두 번째 봉인은 ILLEGAL_TRANSITION으로 거절돼야 (봉인된 예측을 조용히
    // 덮어쓸 수 없음) — 오류 어조를 errors 덤프로 읽는다.
    await call('argus_seal', { argus_dir: d, predicate_owner: 'user', id: 'dup', predicate: '같은 id로 다시 봉인 시도 충분히 길게 확실히', check_by: '2026-07-20', today_override: '2026-07-12' }, { scenario: S, expectOk: false, expectCode: 'ILLEGAL_TRANSITION' });
  },
  async 'S55 recall receipt — dismiss된 결정의 영수증'() {
    const S = 'S55 dismissed-receipt', d = ws(); await init(d, S);
    await seal(d, { id: 'dr', predicate: '접기 전에 봉인된 예측이다 충분히 길게 확실히', check_by: '2026-09-01', today_override: '2026-07-12' }, S);
    await call('argus_dismiss', { argus_dir: d, id: 'dr', dismiss_reason: 'became_irrelevant', today_override: '2026-07-13' }, { scenario: S });
    const r = await call('argus_recall', { argus_dir: d, view: 'receipt', id: 'dr', today_override: '2026-07-14' }, { scenario: S });
    // dismiss된 결정의 영수증이 정직하게 "접힘"을 말하는지 (조용한 소실 금지)
    const blob = String(r?.surface) + JSON.stringify(r?.data ?? {});
    if (r?.ok && !/접|dismiss|irrelevant|무관|필요 없/i.test(blob)) note('B', S, 'dismiss된 결정 영수증이 접힘 사실을 표면화하지 않음', blob.slice(0, 200));
  },
  async 'S56 watch anchor + list — 관찰 표면 읽기'() {
    const S = 'S56 watch-list', d = ws(); await init(d, S);
    await call('argus_watch', { argus_dir: d, op: 'anchor', text: '이번 주 핵심 관찰: 신규 가입 추세', today_override: '2026-07-12' }, { scenario: S });
    await call('argus_watch', { argus_dir: d, op: 'capture', text: '경쟁사가 가격을 20퍼센트 내렸다', kind: 'claim', source: 'user_stated', today_override: '2026-07-12' }, { scenario: S });
    await call('argus_watch', { argus_dir: d, op: 'list', days: 3, today_override: '2026-07-12' }, { scenario: S });
  },
  async 'S57 premises amend retire — 전제 은퇴 표면(em-dash 금지 확인)'() {
    const S = 'S57 premise-retire', d = ws(); await init(d, S);
    await seal(d, { id: 'pr', predicate: '이 계획은 세 전제 위에 선다 충분히 길게 확실히', check_by: '2026-10-01', today_override: '2026-07-12' }, S);
    await call('argus_premises', { argus_dir: d, id: 'pr', op: 'add', premises: [{ text: '핵심 인력이 유지된다', kind: 'premise', external: true, load_bearing: false, source: 'user_stated' }], today_override: '2026-07-12' }, { scenario: S });
    const r = await call('argus_premises', { argus_dir: d, id: 'pr', op: 'amend', ref: 'P1', action: 'retire', note: '더 이상 유효하지 않음', today_override: '2026-07-20' }, { scenario: S });
    // 은퇴 표면은 "기록엔 남는다"를 정직히, em-dash cadence 없이 (inspectSurface + 아래)
    if (r?.ok && !/기록|record|남/.test(String(r?.surface))) note('B', S, 'retire 표면이 "기록엔 남는다"를 말하지 않음', String(r?.surface).slice(0, 160));
  },
  async 'S58 ambient due-line — 세션 중 "그런데 N건" 꼬리 어조'() {
    const S = 'S58 ambient', d = ws(); await init(d, S);
    await seal(d, { id: 'a1', predicate: '첫 예측은 확인일에 결과가 나온다 충분히 길게 확실히', check_by: '2026-07-14', today_override: '2026-07-12' }, S);
    await seal(d, { id: 'a2', predicate: '둘째 예측도 확인일에 결과가 나온다 충분히 길게 확실히', check_by: '2026-07-14', today_override: '2026-07-12' }, S);
    // 확인일 이후 아무 읽기나 하면 ambient 꼬리("그런데 정산할 N건")가 붙을 수 있음
    const r = await call('argus_recall', { argus_dir: d, view: 'bearing', today_override: '2026-07-16' }, { scenario: S });
    const blob = String(r?.surface) + JSON.stringify(r?.data ?? {});
    // 긴급·압박 어휘 금지 (사실+손잡이만) — inspectSurface가 평결어를 잡고, 여기선 재촉 어휘
    if (/지금 당장|서둘러|늦기 전에|놓치면|hurry|right now|don't miss/i.test(blob)) note('A', S, 'ambient 꼬리가 재촉/압박 어휘 사용', blob.slice(0, 200));
  },
  async 'S59 LOGBOOK.md 실파일 읽기 — 사용자가 여는 projection'() {
    const S = 'S59 logbook-file', d = ws(); await init(d, S);
    await seal(d, { id: 'lb1', predicate: '이 결정은 확인일에 판가름 난다 충분히 길게 확실히', check_by: '2026-07-14', today_override: '2026-07-12' }, S);
    await call('argus_check_in', { argus_dir: d, today_override: '2026-07-16' }, { scenario: S });
    // 미러 관문이 워크스페이스 .argus/LOGBOOK.md를 썼는지 + 그 산문을 읽는다
    const lbPath = path.join(d, 'LOGBOOK.md');
    let md = '';
    try { md = fs.readFileSync(lbPath, 'utf8'); } catch { note('B', S, 'check_in 후에도 LOGBOOK.md가 안 써짐', lbPath); return; }
    // 사용자가 여는 파일이므로 surface와 동일 기준으로 검사
    inspectSurface(S, 'LOGBOOK.md', md);
    if (md.includes('—')) note('B', S, 'LOGBOOK.md에 em-dash cadence 잔존', md.split('\n').filter((l) => l.includes('—')).join(' | ').slice(0, 200));
  },
  async 'S60 sync 미연결 — 흔한 설치 직후 상태의 어조'() {
    const S = 'S60 sync-not-connected', d = ws(); await init(d, S);
    // 토큰 없는 흔한 상태: NOT_CONNECTED가 적대적이지 않고 지역 데이터 안전을
    // 암시하는지(패닉 유발 금지). errors 덤프로 어조를 읽는다.
    delete process.env.ARGUS_TOKEN;
    await call('argus_sync', { argus_dir: d }, { scenario: S, expectOk: false, expectCode: 'NOT_CONNECTED' });
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
  // 오류 텍스트(message+recovery)도 따로 덤프 — 제품이 적대적으로 느껴지는 곳.
  errors: transcript.filter((t) => t.ok === false && (t.message || t.recovery)).map((t) => ({ scenario: t.scenario, tool: t.tool, code: t.code, message: t.message, recovery: t.recovery })),
};
process.stdout.write(JSON.stringify(out, null, 2) + '\n');
