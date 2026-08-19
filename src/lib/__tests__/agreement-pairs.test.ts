import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 「두 곳이 같아야 하는데 한 곳만 고쳐졌다」 — 이 리포의 결함 등록부.
 *
 * 2026-07-28~29 이틀 동안 나온 결함 9건을 늘어놓으니 **전부 같은 모양**이었다.
 * 종류가 다른 버그가 아니라, 한 가지 구조적 원인이 아홉 번 다른 옷을 입은 것이다:
 *
 *   판단 원장 미이관   이관 표 목록 ↔ db.ts 동기화 목록
 *   익명 지우기        useAuth().user ↔ session
 *   규칙 crash         TS 타입 ↔ jsonb 현실
 *   캐시 오염          캐시 키 ↔ 함수의 실제 입력
 *   음소거 무시        전제 ↔ 미결질문
 *   closed_at 오독     의식 스탬프 ↔ 생애주기
 *   글씨 역방향        기본 크기 ↔ sm 크기
 *   공유 전면 사망     마이그레이션 파일 ↔ 실DB (18일)
 *   커버리지 누락      db.ts TableName ↔ schema-drift 목록
 *
 * 이 파일은 그 쌍들의 **등록부**다. 여기 적힌 쌍은 반드시 가드를 갖는다. 가드 없는
 * 쌍을 등록하면 이 테스트가 막고, 가드 파일이 사라지면 이 테스트가 막는다.
 *
 * 이 파일이 하지 못하는 것(정직하게): **아직 아무도 이름 붙이지 않은 쌍**은 못 잡는다.
 * 그건 자동화가 아니라 사람이 새 쌍을 발견해 여기 적는 일이다. 이 파일의 값어치는
 * "발견된 쌍이 다시 조용해지지 않는다"이지 "모든 쌍을 안다"가 아니다.
 */

type Kind =
  /** CI가 매 PR마다 돌린다. 리포 안의 두 곳을 대조한다. */
  | 'ci'
  /** 실DB/실환경이 한쪽이라 CI가 구조적으로 볼 수 없다. 사람이 돌린다. */
  | 'ondemand';

interface Pair {
  /** 같아야 하는 두 곳. */
  a: string;
  b: string;
  /** 어긋나면 사용자에게 무슨 일이 일어나는가. 추상적으로 쓰지 말 것. */
  breaks: string;
  guard: string;
  kind: Kind;
}

const PAIRS: Pair[] = [
  // ── 리포 ↔ 리포 (CI가 볼 수 있는 것) ──────────────────────────────────────
  {
    a: 'src/lib/premises-core.ts', b: 'argus-mcp/src/lib/premises-core.ts',
    breaks: '같은 전제가 브라우저와 터미널에서 다른 날 만료된다',
    guard: 'src/lib/__tests__/premises-core-drift.test.ts', kind: 'ci',
  },
  {
    a: 'src/lib/premise-shape.ts', b: 'argus-mcp/src/lib/premise-shape.ts',
    breaks: '같은 문장이 웹에서는 전제, 터미널에서는 미결 질문으로 앉는다 — 확인일에 한쪽만 답할 수 있게 된다',
    guard: 'src/lib/__tests__/premises-core-drift.test.ts', kind: 'ci',
  },
  {
    a: 'src/lib/premise-shape.ts (판별 규칙)', b: 'argus-plugin-v2/scripts/decision-ledger.js (isQuestionShaped)',
    breaks: '플러그인만 물음을 전제로 계속 저장해, 같은 결정이 표면마다 다른 모양으로 남는다',
    guard: 'src/lib/__tests__/premise-shape.test.ts', kind: 'ci',
  },
  {
    a: 'src/lib/numeric-drift.ts', b: 'argus-mcp/src/lib/numeric-drift.ts',
    breaks: '같은 수치 변화가 한쪽에서만 material로 판정된다',
    guard: 'src/lib/__tests__/premises-core-drift.test.ts', kind: 'ci',
  },
  {
    a: '동기화 인터페이스 필드 (types.ts)', b: '실DB 컬럼 매니페스트 (TABLE_COLUMNS)',
    breaks: 'PGRST204로 행 전체가 거부되어 그 사용자의 데이터가 조용히 서버에 안 닿는다',
    guard: 'src/lib/__tests__/schema-drift.test.ts', kind: 'ci',
  },
  {
    a: 'db.ts TableName (동기화하는 표)', b: 'schema-drift 커버리지 목록',
    breaks: '새 동기화 표가 필드 대조 없이 흘러가 위 PGRST204를 아무도 못 본다',
    guard: 'src/lib/__tests__/schema-drift.test.ts', kind: 'ci',
  },
  {
    a: '마이그레이션이 선언한 user-scoped 표', b: 'USER_DATA_TABLES',
    breaks: '계정 삭제·내보내기가 그 표를 영영 건너뛴다',
    guard: 'src/lib/__tests__/erasure-coverage.test.ts', kind: 'ci',
  },
  {
    a: 'db.ts가 동기화하는 표', b: '익명→계정 이관 RPC가 옮기는 표',
    breaks: '가입하는 순간 그 표의 작업물이 익명 신원 아래 좌초된다',
    guard: 'src/lib/__tests__/anonymous-account-transfer-contract.test.ts', kind: 'ci',
  },
  {
    a: 'useAuth().user (익명은 null)', b: '실제 세션 (익명 포함)',
    breaks: '익명 항해의 서버 사본이 지워지지 않은 채 열쇠만 버려진다',
    guard: 'src/lib/__tests__/anonymous-account-transfer-contract.test.ts', kind: 'ci',
  },
  {
    a: 'MaterialityRule TS 타입', b: '실제로 저장되는 jsonb',
    breaks: '재확인이 브라우저에서 죽고, 감시는 매일 밤 API를 태우고 그 전제를 잃는다',
    guard: 'src/lib/__tests__/materiality-rule-totality.test.ts', kind: 'ci',
  },
  {
    a: '기본 글씨 크기', b: '브레이크포인트 글씨 크기',
    breaks: '넓은 화면에서 글씨가 작아진다 (일괄 치환의 산물)',
    guard: 'src/lib/__tests__/responsive-type-scale.test.ts', kind: 'ci',
  },
  {
    a: '저장하는 localStorage 키', b: 'persistence CONTRACT (synced/localOnly)',
    breaks: '사용자 행동 데이터가 서버에 안 닿는 채로 몇 달이 지난다',
    guard: 'src/lib/__tests__/persistence-contract.test.ts', kind: 'ci',
  },
  {
    a: 'ProgressiveFlow.tsx', b: 'flow-parts/* (E-1로 분리된 표시 조각)',
    breaks: '흐름을 읽는 소스 가드가 코드 이동만으로 조용히 눈을 감는다',
    guard: 'src/components/workspace/progressive/__tests__/no-machinery-leak.test.ts', kind: 'ci',
  },
  {
    a: 'UUID 검사 패턴 (lib/uuid.ts)', b: '라우트들이 손으로 다시 쓴 사본',
    breaks: '사본 셋 중 하나가 넷 묶음이라 팀 초대·멤버·프로젝트 공유·리뷰가 10일간 전부 400이었다',
    guard: 'src/lib/__tests__/uuid-pattern.test.ts', kind: 'ci',
  },
  {
    a: 'attribution.authority (누가 썼는가)', b: 'authored / source (옛 신호)',
    breaks: 'AI가 초안한 문장이 "사용자가 소유한 판단"으로 계산되어 귀환 루프를 닫을 자격을 얻는다',
    guard: 'src/lib/__tests__/decision-contract-spine-mutations.test.ts', kind: 'ci',
  },

  // ── 리포 ↔ 실DB (CI가 구조적으로 볼 수 없는 것) ──────────────────────────
  {
    a: 'supabase/migrations/*.sql', b: '프로덕션 DB의 실제 객체',
    breaks: '공유·이메일·텔레그램·팀초대가 전부 죽어 있는데 코드도 테스트도 초록이다 (실제로 18일)',
    guard: 'scripts/check-migration-drift.mjs', kind: 'ondemand',
  },
  {
    a: 'USER_DATA_TABLES', b: '프로덕션 DB의 실제 표',
    breaks: '목록의 거짓 항목 하나가 계정 삭제 전체를 500으로 멈춘다',
    guard: 'scripts/check-erasure-coverage.mjs', kind: 'ondemand',
  },
  {
    a: 'TABLE_COLUMNS 매니페스트', b: '프로덕션 DB의 실제 컬럼',
    breaks: '매니페스트가 유령 컬럼을 약속해 동기화가 조용히 실패한다',
    guard: 'scripts/check-schema-drift.mjs', kind: 'ondemand',
  },
];

describe('「같아야 하는 두 곳」 등록부', () => {
  it('등록된 모든 쌍에 가드 파일이 실재한다', () => {
    const missing = PAIRS.filter((p) => !existsSync(join(process.cwd(), p.guard)));
    expect(
      missing.map((p) => `${p.a} ↔ ${p.b} → ${p.guard}`),
      '가드 파일이 사라졌다. 파일을 옮겼다면 이 등록부도 같이 옮겨라 — 안 그러면 이 파일이 '
      + '스스로 막으려는 바로 그 부류가 된다',
    ).toEqual([]);
  });

  it('CI 가드는 실제로 CI가 돌리는 테스트 파일이다', () => {
    const notTests = PAIRS.filter((p) => p.kind === 'ci' && !/\.test\.tsx?$/.test(p.guard));
    expect(notTests.map((p) => p.guard), 'ci로 등록됐는데 테스트 파일이 아니다').toEqual([]);
  });

  it('온디맨드 가드는 사용법이 파일 안에 적혀 있다 (아무도 못 돌리는 스크립트 금지)', () => {
    const undocumented = PAIRS.filter((p) => p.kind === 'ondemand').filter((p) => {
      const src = readFileSync(join(process.cwd(), p.guard), 'utf8');
      return !src.includes('사용법');
    });
    expect(undocumented.map((p) => p.guard)).toEqual([]);
  });

  it('모든 쌍이 "어긋나면 사용자에게 무슨 일이 나는가"를 구체적으로 적었다', () => {
    // 추상적인 사유("동기화가 깨진다")는 사유가 아니다 — 다음 사람이 우선순위를
    // 못 정하고, 그러면 이 등록부는 읽히지 않는 목록이 된다.
    const vague = PAIRS.filter((p) => p.breaks.trim().length < 15);
    expect(vague.map((p) => `${p.a} ↔ ${p.b}`)).toEqual([]);
  });

  it('중복 등록이 없다', () => {
    const keys = PAIRS.map((p) => `${p.a}|${p.b}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('등록부가 비어 있지 않다 (빈손으로 통과하지 않는다)', () => {
    expect(PAIRS.length).toBeGreaterThan(10);
    expect(PAIRS.some((p) => p.kind === 'ondemand')).toBe(true);
  });
});
