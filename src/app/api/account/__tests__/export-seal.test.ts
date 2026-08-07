import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * 반출이 봉인을 깨지 못한다 — 소스 수준 계약 가드.
 *
 * 사용자는 자기 데이터를 전부 반출할 권리가 있고, 분신의 예측은 정산 전에
 * 보이면 안 된다. 이 둘이 충돌하는 유일한 지점이 export 라우트다: service
 * role 로 `select('*')` 를 하므로 **RLS 로 막아 둔 문을 여기서 열어 줄 수
 * 있다.** 실제로 2026-08-06 감사에서 그 상태였다.
 *
 * 런타임 테스트로 잡기 어려운 이유: 라우트가 Supabase 세션·service key 를
 * 요구해서 통째로 목킹해야 하는데, 그러면 정작 검사하려는 것(진짜 쿼리 결과에
 * 편집이 적용되는가)이 목의 모양에 좌우된다. 계약을 소스로 고정한다.
 */
const EXPORT = readFileSync(join(process.cwd(), 'src/app/api/account/export/route.ts'), 'utf-8');

describe('account export — 봉인 계약', () => {
  it('shadow 예측에 편집 함수를 통과시킨다', () => {
    expect(EXPORT).toContain('redactUnsettledSeals');
    // 편집 없이 원본을 그대로 싣는 옛 형태가 되돌아오면 빨간불.
    expect(EXPORT).not.toMatch(/tables\[table\]\s*=\s*error \? \{ error: error\.message \} : rows;/);
  });

  it('편집 대상이 shadow 테이블이고, 기준이 revealed_at 이다', () => {
    expect(EXPORT).toContain("table !== 'argus_shadow_predictions'");
    expect(EXPORT).toContain('r.revealed_at');
  });

  it('미정산 행에서 예측 본문 세 필드를 뺀다', () => {
    // expectation·reasoning 이 나가면 봉인이 깨지고, verdict_quote 는 아직
    // 존재할 수 없지만 방어적으로 함께 뺀다.
    expect(EXPORT).toMatch(/const \{ expectation, reasoning, verdict_quote, \.\.\.meta \} = r;/);
  });

  it('뺐다는 사실과 이유를 반출물에 남긴다 — 조용한 누락이 아니다', () => {
    expect(EXPORT).toContain('sealed_until_settlement');
    expect(EXPORT).toContain('content_hash');
  });
});

/**
 * 분신 상태 계기판이 봉인을 깨지 못한다 — 같은 부류의 두 번째 문.
 *
 * `/api/twin/status` 는 service role 로 shadow 테이블을 만진다. export 와
 * 정확히 같은 위험이 있고(RLS 를 우회할 수 있는 자리), 다른 점은 여기서는
 * **애초에 본문 컬럼을 select 하지 않는다**는 것이다. "흘리지 않도록 조심한다"
 * 보다 "흘릴 코드가 존재하지 않는다"가 강하므로, 그 부재를 소스로 고정한다.
 */
const TWIN_STATUS = readFileSync(join(process.cwd(), 'src/app/api/twin/status/route.ts'), 'utf-8');

/**
 * 이 라우트를 절대 통과할 수 없는 컬럼 — **계약의 정본은 여기다.**
 * (schema-drift 의 TABLE_COLUMNS 와 같은 방식: 계약은 그것을 강제하는 테스트가
 *  갖는다. 라우트 파일에 상수로 두면 Next 가 빌드에서 거절한다.)
 */
const NEVER_EXPOSED = ['expectation', 'reasoning', 'verdict_quote'] as const;

describe('twin status — 봉인 계약', () => {
  it('예측 본문 컬럼을 select 하지 않는다', () => {
    for (const forbidden of NEVER_EXPOSED) {
      expect(TWIN_STATUS).not.toMatch(new RegExp(`select\\([^)]*${forbidden}`));
    }
  });

  it('라우트가 이 계약을 가리키고 있다 — 목록이 여기 있다는 사실이 코드에 남는다', () => {
    for (const forbidden of NEVER_EXPOSED) expect(TWIN_STATUS).toContain(forbidden);
    expect(TWIN_STATUS).toContain('export-seal.test.ts');
  });

  it('route 파일이 허용되지 않은 이름을 export 하지 않는다', () => {
    // Next 의 route 파일은 정해진 이름만 export 하도록 되어 있다. 이 파일도
    // 한 번 그 규칙을 어긴 상태였고 **그때 next build 는 통과했다** — 현재
    // 버전이 관대한 것이지 규칙이 없는 것이 아니다.
    //
    // 이 가드가 필요한 이유는 검사 순서에 있다: tsc·vitest 는 route export
    // 규칙을 보지 않고, CI 의 check 잡도 next build 를 돌리지 않는다. 실제로
    // 이것을 잡는 것은 푸시 뒤의 Vercel 프리뷰 빌드뿐이다 — 즉 **로컬 관문이
    // 전부 초록인 채로 배포 단계에서만 죽는다.** 그 왕복을 여기서 없앤다.
    const ALLOWED = new Set([
      'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS',
      'dynamic', 'dynamicParams', 'revalidate', 'fetchCache', 'runtime',
      'preferredRegion', 'maxDuration', 'generateStaticParams',
    ]);
    // 주석을 먼저 걷어낸다. 안 걷으면 "여기에 export 하지 말라"고 **설명하는
    // 주석**이 실제 export 로 읽혀 가드가 자기 문서에 걸린다 (실제로 걸렸다).
    const code = TWIN_STATUS.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    const exported = [...code.matchAll(/export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z0-9_]+)/g)]
      .map((m) => m[1]);
    expect(exported).toContain('GET'); // 정규식이 조용히 0건이 되는 것을 막는다
    const bad = exported.filter((name) => !ALLOWED.has(name));
    expect(bad, `Next route 가 export 할 수 없는 이름입니다: ${bad.join(', ')}`).toEqual([]);
  });

  it('셀 때도 head 모드다 — 행 자체를 가져오지 않는다', () => {
    expect(TWIN_STATUS).toContain("head: true");
    expect(TWIN_STATUS).toContain("count: 'exact'");
  });

  it('본인 것만 센다 — user_id 필터 없는 집계가 없다', () => {
    const counts = TWIN_STATUS.match(/countOrNull\([\s\S]*?\)\),/g) ?? [];
    expect(counts.length).toBeGreaterThan(8);
    for (const c of counts) expect(c).toContain('user_id');
  });

  it('로그인 없이는 아무것도 돌려주지 않는다', () => {
    expect(TWIN_STATUS).toContain('Unauthorized');
    expect(TWIN_STATUS).toContain('auth.getUser');
  });

  it('표가 없으면 0 으로 위장하지 않는다 — null 로 남긴다', () => {
    // 0 과 "아직 준비 안 됨"을 같은 숫자로 칠하면 미적용이 정상으로 보인다.
    expect(TWIN_STATUS).toMatch(/return error \? null : count \?\? 0;/);
  });
});

/**
 * 분신의 집 라우트가 봉인을 깨지 못한다 — 세 번째 문.
 *
 * status·export 와 다른 점: 이 라우트는 **공개된 예측의 전문을 일부러 낸다**
 * (정산이 끝났으므로 그것이 봉인의 목적이다). 그래서 "본문을 안 낸다"로는
 * 검사할 수 없고, **봉인 행과 공개 행이 서로 다른 쿼리인지**를 검사한다.
 *
 * 한 쿼리로 전부 읽고 코드에서 골라 내보내는 형태였다면 필드 하나 빠뜨리는
 * 실수가 곧 봉인 파기가 된다. 두 쿼리로 나누면 봉인 쪽에는 그 컬럼 이름이
 * 아예 등장하지 않는다 — 흘릴 코드가 존재하지 않는다.
 */
const TWIN_HOME = readFileSync(join(process.cwd(), 'src/app/api/twin/home/route.ts'), 'utf-8');

describe('twin home — 봉인 계약', () => {
  it('봉인 행과 공개 행을 서로 다른 쿼리로 읽는다', () => {
    const selects = [...TWIN_HOME.matchAll(/\.select\('([^']*)'\)/g)].map((m) => m[1]);
    const sealedSelect = selects.find((s) => s.includes('sealed_at') && !s.includes('expectation'));
    const revealedSelect = selects.find((s) => s.includes('expectation'));
    expect(sealedSelect, '봉인 전용 쿼리가 없습니다').toBeTruthy();
    expect(revealedSelect, '공개 전용 쿼리가 없습니다').toBeTruthy();
    expect(sealedSelect).not.toBe(revealedSelect);
  });

  it('봉인 쿼리에는 본문 컬럼 이름이 아예 없다', () => {
    const selects = [...TWIN_HOME.matchAll(/\.select\('([^']*)'\)/g)].map((m) => m[1]);
    const sealedSelect = selects.find((s) => s.includes('sealed_at'))!;
    for (const forbidden of NEVER_EXPOSED) expect(sealedSelect).not.toContain(forbidden);
    // 확신도도 봉인 내용의 일부다 (해시에 들어간다) — 미리 보이면 예측이 샌다.
    expect(sealedSelect).not.toContain('confidence');
  });

  it('공개 행만 전문을 낸다 — status=revealed 로 좁힌다', () => {
    expect(TWIN_HOME).toMatch(/\.eq\('status',\s*'revealed'\)/);
  });

  it('두 쿼리 모두 본인 것만 읽는다', () => {
    const userFilters = [...TWIN_HOME.matchAll(/\.eq\('user_id',\s*user\.id\)/g)];
    expect(userFilters.length).toBeGreaterThanOrEqual(2);
  });

  it('로그인 없이는 아무것도 돌려주지 않는다', () => {
    expect(TWIN_HOME).toContain('Unauthorized');
    expect(TWIN_HOME).toContain('auth.getUser');
  });
});
