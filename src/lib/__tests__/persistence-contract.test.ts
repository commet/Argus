/**
 * 영속성 계약 (persistence contract) — 2026-06-13 근원 분석의 예방 장치.
 *
 * 발견된 구멍의 공통 근원: "이 사용자 입력은 어디에 남는가"를 선언하는 곳이
 * 없었다. localStorage-first 아키텍처에서 UI는 로컬만 읽으므로, 서버에 안
 * 가는 데이터도 모든 화면·모든 테스트(경계를 mock)·모든 UX 감사에서 멀쩡해
 * 보인다 — 침묵이 기본값인 시스템은 제3의 눈 없이는 반드시 벌어진다.
 *
 * 이 테스트가 그 제3의 눈이다. 규칙:
 *  1. STORAGE_KEYS의 모든 키는 아래 CONTRACT에 선언돼야 한다 —
 *     synced(어느 테이블로) 또는 localOnly(왜). 무선언 새 키 = CI 실패.
 *  2. synced로 선언된 테이블은 db.ts TableName 유니온에 실재해야 한다.
 *  3. 등록부 우회 금지: src 전체에서 'sot_*'/'argus_*' 문자열 리터럴 키는
 *     STORAGE_KEYS 값이거나 ROGUE_ALLOWLIST(사유 포함)에 있어야 한다.
 *     (hit-rate.ts의 사설 키 'sot_hit_records'가 정확히 이 구멍으로 두 달
 *     숨어 있었다 — 새 우회 키는 이제 빌드가 막는다.)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { STORAGE_KEYS } from '@/lib/storage';

type Decl = { table: string } | { localOnly: string };

/** 키별 영속성 선언 — 새 키를 추가하면 여기서 결정을 내려야 한다. */
const CONTRACT: Record<keyof typeof STORAGE_KEYS, Decl> = {
  METHOD_PILOT_LEDGER: { localOnly: 'R3-B pilot 채널 (BLUEPRINT §9.12 단일 예외) — 초대 전용·폐기 전제 pilot ledger. pilot 종료 시 반출·삭제 계약이므로 서버 동기화 금지' },
  REFRAME_LIST: { table: 'reframe_items' },
  SYNTHESIZE_LIST: { table: 'synthesize_items' },
  RECAST_LIST: { table: 'recast_items' },
  PERSONAS: { table: 'personas' },
  FEEDBACK_HISTORY: { table: 'feedback_records' },
  // PROJECTS → projects 테이블에 동기화. DecisionContract.origin('retro',
  // 베팅③ 회고 봉인)은 단일 decision_contract jsonb 컬럼 안에 실려 이 계약에
  // 동승한다 — 새 STORAGE_KEYS 키·마이그레이션 없음, PROJECTS 동기화의 일부.
  PROJECTS: { table: 'projects' },
  JUDGMENTS: { table: 'judgment_records' },
  ACCURACY_RATINGS: { table: 'accuracy_ratings' },
  QUALITY_SIGNALS: { table: 'quality_signals' },
  OUTCOME_RECORDS: { table: 'outcome_records' },
  RETROSPECTIVE_ANSWERS: { table: 'retrospective_answers' },
  DQ_SCORES: { table: 'decision_quality_scores' },
  PROGRESSIVE_SESSIONS: { table: 'progressive_sessions' },
  AGENTS: { table: 'agents' },
  AGENT_CHAINS: { table: 'agent_chains' },
  AGENT_ACTIVITIES: { table: 'agent_activities' },
  DECISION_ITEMS: { table: 'decision_items' },

  // E2는 사용자 표면이 없는 shadow control plane이다. 이 네 기록은 E3에서
  // 서버 스키마·계정 이동성·삭제 정책을 함께 설계하기 전까지 로컬에서만
  // 검증한다. 사용자에게 노출하기 전에 synced 계약으로 승격해야 한다.
  SELF_KNOWLEDGE_CLAIMS: { localOnly: 'E2 shadow 검증 전용 — E3 사용자 표면 전에 서버 동기화·계정 이동성·삭제 정책을 함께 설계' },
  INFLUENCE_GRANTS: { localOnly: 'E2 shadow 검증 전용 — E3 사용자 표면 전에 서버 동기화·계정 이동성·삭제 정책을 함께 설계' },
  INFLUENCE_TRACES: { localOnly: 'E2 shadow 검증 전용 — E3 사용자 표면 전에 서버 동기화·감사 보존·삭제 정책을 함께 설계' },
  CLAIM_REVIEW_EVENTS: { localOnly: 'E2 shadow 검증 전용 — E3 사용자 표면 전에 서버 동기화·검토 이력·삭제 정책을 함께 설계' },
  SETTINGS: { localOnly: 'API 키 포함 — 서버 전송 금지 (보안)' },
  EVAL_RECAST: { localOnly: '로컬 평가 픽스처 — 개인 데이터, 동기화 대상 아님' },
  EVAL_REHEARSAL: { localOnly: '로컬 평가 픽스처 — 개인 데이터, 동기화 대상 아님' },
  VITALITY_ASSESSMENTS: { localOnly: '파생 지표 — 원본(세션)에서 재계산 가능' },
  WORKER_PERSONAS: { localOnly: '세션 내 파생 캐시 — 세션 data에 동승' },
  EXECUTION_TRANSCRIPTS: { localOnly: '대용량 실행 로그 — 로컬 전용 (용량)' },
  BOSS_COLLECTION: { localOnly: '코스메틱 수집 상태 — 유실 무해' },
  BOSS_DRAFT: { localOnly: '작성 중인 보스 대화 초안 — 민감한 기기 전용 데이터로 30일 뒤 자동 만료' },
  REVIEW_RECEIPTS: { table: 'review_receipts' },
  REVIEW_FREE_USED: { localOnly: '문서 검수 무료 1회 소진 플래그(부울 1개, 개인정보 없음) — 기기별 상태, 유실 시 무료 1회가 복원될 뿐 무해(실비용 상한은 서버측 일일 레이트리밋이 지킴)' },
  LANTERN_SNOOZE: { localOnly: '워크스페이스 등불 당일 스누즈 날짜 — 기기별 UI 상태, 유실 무해(다음날 재렌더)' },
  KNEW_YOU: { localOnly: '세션 만료 인식용 부울 1개(개인정보 없음) — 기기별 상태, 유실 무해(다음 로그인 때 재설정)' },
  THIRD_LOOP_SEEN: { localOnly: '3고리 의식 평생 1회 플래그(부울 1개) — 기기별 UI 상태, 유실 시 의식이 한 번 더 보일 뿐 무해' },
  RETRO_SETTLED: { localOnly: '회고→실봉인 전환 계측 플래그(부울 1개, 베팅③ 항목10) — 기기별 상태, 유실 시 first_real_seal_after_retro가 한 번 덜 잡힐 뿐 무해(사용자 데이터 아님)' },
  DATA_OWNER: { localOnly: '이 기기 데이터의 주인 {userId,email} — 기기 상태이지 사용자 데이터가 아니다. 서버로 보낼 이유가 없고(계정별 행 소유자는 이미 user_id 컬럼이 정본), 유실되면 도장 없는 브라우저로 돌아갈 뿐 — 그때는 서버가 42501로 확정한 격리(FOREIGN_ROWS)가 대신 잡는다' },
  FOREIGN_ROWS: { localOnly: '서버가 42501로 "다른 계정 것"이라 확정한 행 id 목록(table→ids) — 무한 재시도를 끊는 파생 캐시. 유실되면 다음 거부 때 다시 채워진다(사용자 데이터 아님)' },
};

/** 등록부 밖에서 발견됐지만 사유와 함께 허용된 키. 새 항목 추가는 곧
 *  "동기화 결정을 또 미뤘다"는 뜻이다 — 가능하면 STORAGE_KEYS로 승격하라.
 *  (이 5개가 2026-06-13 첫 가동에서 잡힌 실존 우회 키 전부다 — 그중 셋은
 *  학습 데이터인데 기기에 갇혀 있다: 같은 부류의 구멍 3·4·5번.) */
const ROGUE_ALLOWLIST: Record<string, string> = {
  sot_hit_records: 'P2 백로그: 평가 칩 반응(선원 학습) — 서버 동기화 미결 (hit-rate.ts)',
  sot_capability_adjustments: 'P2 백로그: 에이전트 능력 자기조정 학습 — 서버 동기화 미결 (capability-tuner.ts)',
  sot_context_strategy_records: 'P2 백로그: 컨텍스트 전략 자기개선 기록 — 서버 동기화 미결 (context-strategy.ts)',
  argus_eval_results: '로컬 평가 데이터 — 개인 픽스처, 동기화 대상 아님 (eval-engine.ts)',
  argus_eval_refine: '로컬 평가 데이터 — 개인 픽스처, 동기화 대상 아님 (eval-engine.ts)',
  argus_metrics: '스토리지 키 아님 — 운영자 계기판 집계용 Postgres RPC 이름 (admin/page.tsx, supabase.rpc)',
  argus_pat_: '스토리지 키 아님 — 플러그인 푸시 개인 액세스 토큰(PAT)의 접두사. 원문은 어디에도 저장 안 함, sha256 해시만 plugin_tokens 테이블에 (api/plugin/ingest·token)',
  argus_anon_transfer: 'localStorage가 아닌 HttpOnly·SameSite 일회용 계정 이전 쿠키. 브라우저 JS가 읽을 수 없고 서버 DB 트랜잭션 성공 후 즉시 삭제',
  // 원격 MCP 도구 이름 6개 (2026-08-05). 스토리지 키가 아니라 **MCP 프로토콜의
  // 도구 식별자**다 — 모델이 tools/call로 부르는 이름이며 어디에도 저장되지
  // 않는다. 이름을 바꾸면 이미 연결한 클라이언트가 깨지므로 값은 고정이다.
  // (기획서: ARGUS-REMOTE-MCP-PLAN-2026-08-05 §4 — 도구는 여섯 개로 고정)
  argus_open: '스토리지 키 아님 — 원격 MCP 도구 이름 (api/mcp/v2/tools.ts)',
  argus_sharpen: '스토리지 키 아님 — 원격 MCP 도구 이름 (api/mcp/v2/tools.ts)',
  argus_plan: '스토리지 키 아님 — 원격 MCP 도구 이름 (api/mcp/v2/tools.ts)',
  argus_adopt: '스토리지 키 아님 — 원격 MCP 도구 이름 (api/mcp/v2/tools.ts)',
  argus_return: '스토리지 키 아님 — 원격 MCP 도구 이름 (api/mcp/v2/tools.ts)',
  argus_recall: '스토리지 키 아님 — 원격 MCP 도구 이름 (api/mcp/v2/tools.ts)',
  // 원격 MCP 서버 원장 테이블 이름 3개 (2026-08-05). 브라우저 스토리지 키가
  // 아니라 **Supabase 테이블 이름**이다 — 서버에만 존재하고 localStorage에는
  // 아무것도 쓰지 않는다. 계정 삭제·내보내기 등록은 별도로 되어 있다
  // (user-data-tables.ts + erasure-coverage.test.ts, 같은 커밋).
  // 귀환 크론의 분석 이벤트 이름 (2026-08-05). 스토리지 키가 아니라 user_events
  // 의 event_name 이다. H-B("기한이 오면 돌아와 적는가")의 분모가 이 이벤트로
  // 생기므로, 이름이 바뀌면 측정이 끊긴다 — 값은 고정이다.
  argus_return_sent: '스토리지 키 아님 — 귀환 발송 분석 이벤트 (cron/argus-returns). H-B의 분모',
  argus_return_cron_run: '스토리지 키 아님 — 귀환 크론 실행 요약 이벤트 (동)',
  argus_cases: '스토리지 키 아님 — 원격 MCP 파일럿 서버 테이블 (마이그레이션 20260805100000)',
  argus_events: '스토리지 키 아님 — 원격 MCP 파일럿 append-only 원장 테이블 (동)',
  argus_returns: '스토리지 키 아님 — 원격 MCP 파일럿 귀환 계약 테이블, 크론이 읽는다 (동)',
  argus_oauth_clients: '스토리지 키 아님 — 원격 커넥터 동적 등록 클라이언트 테이블 (마이그레이션 20260805170000)',
  argus_oauth_grants: '스토리지 키 아님 — 원격 커넥터 1회용 인가 코드 테이블 (동). 해시만 저장',
  argus_client_: '스토리지 키 아님 — 동적 등록 client_id 접두사 (api/mcp/v2/oauth/lib.ts). 비밀이 아니며 공개 식별자다',
  argus_code_: '스토리지 키 아님 — 인가 코드 접두사. 원문은 어디에도 저장 안 함, sha256 해시만 argus_oauth_grants 에 (동)',
  // 만들지 **않기로** 한 도구(tools.ts DELIBERATELY_ABSENT)는 여기 넣지 않는다:
  // 객체 키라 리터럴이 아니고, 이 스캐너는 테스트 파일을 훑지 않으므로 등재하면
  // "유령 면제"로 잡힌다. 그 가드가 옳다 — 죽은 면제는 남기지 않는다.
};

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '__tests__' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx)$/.test(name)) acc.push(p);
  }
  return acc;
}

describe('영속성 계약: 모든 사용자 데이터는 거취가 선언된다', () => {
  it('STORAGE_KEYS의 모든 키가 CONTRACT에 선언돼 있다 (무선언 키 = 새 구멍)', () => {
    for (const key of Object.keys(STORAGE_KEYS)) {
      expect(CONTRACT, `STORAGE_KEYS.${key}: synced(table)인지 localOnly(사유)인지 선언하라`).toHaveProperty(key);
    }
    // 역방향: 죽은 선언도 금지 (키가 사라지면 계약도 정리)
    for (const key of Object.keys(CONTRACT)) {
      expect(STORAGE_KEYS, `CONTRACT.${key}: 등록부에 없는 키의 유령 선언`).toHaveProperty(key);
    }
  });

  it('synced 선언의 테이블은 db.ts TableName 유니온에 실재한다', () => {
    const dbSrc = readFileSync(join(process.cwd(), 'src/lib/db.ts'), 'utf8');
    for (const [key, decl] of Object.entries(CONTRACT)) {
      if ('table' in decl) {
        expect(dbSrc, `${key} → '${decl.table}': db.ts TableName에 없음 — 동기화 선언이 거짓`).toContain(`'${decl.table}'`);
      }
    }
  });

  it('localOnly 선언에는 빈 사유가 없다 (이유 없는 로컬 전용 = 미룬 결정)', () => {
    for (const [key, decl] of Object.entries(CONTRACT)) {
      if ('localOnly' in decl) {
        expect(decl.localOnly.trim().length, `${key}: localOnly 사유를 적어라`).toBeGreaterThan(4);
      }
    }
  });

  it("등록부 우회 키 금지: src의 모든 'sot_*'/'argus_*' 리터럴은 등록부 또는 allowlist에 있다", () => {
    const registryValues = new Set<string>(Object.values(STORAGE_KEYS));
    const files = walk(join(process.cwd(), 'src'));
    const found = new Map<string, string>(); // key → first file
    const re = /'((?:sot|argus)_[a-z0-9_]+)'/g;
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(re)) {
        if (!found.has(m[1])) found.set(m[1], f.replace(process.cwd() + '/', ''));
      }
    }
    for (const [literal, file] of found) {
      const ok = registryValues.has(literal) || literal in ROGUE_ALLOWLIST;
      expect(
        ok,
        `우회 스토리지 키 '${literal}' (${file}) — STORAGE_KEYS로 승격하고 CONTRACT에 선언하거나, 사유와 함께 ROGUE_ALLOWLIST에 추가하라`,
      ).toBe(true);
    }
    // 유령 허용 금지: allowlist 항목은 실제로 존재해야 한다 (허구 면제 방지).
    for (const allowed of Object.keys(ROGUE_ALLOWLIST)) {
      expect(found.has(allowed), `ROGUE_ALLOWLIST의 '${allowed}'가 src 어디에도 없음 — 죽은 면제는 삭제하라`).toBe(true);
    }
  });
});
