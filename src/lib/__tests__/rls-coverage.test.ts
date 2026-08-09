/**
 * RLS 적용 범위 — `user_id` 를 가진 테이블은 전부 행 수준 보안 아래 있어야 한다.
 *
 * Supabase 에서 `public` 스키마의 테이블은 PostgREST 로 노출되고, 기본 GRANT 가
 * `anon`·`authenticated` 에 걸려 있다. 즉 **RLS 를 안 켜면 남의 행이 그대로
 * 읽힌다.** 새 테이블을 만들 때 `enable row level security` 한 줄을 빠뜨리는 것은
 * 문법 오류도 타입 오류도 아니고, 로컬에서는 아무 증상도 없다 — service role 로
 * 도는 서버 코드는 어차피 RLS 를 우회하므로 화면이 멀쩡하다.
 *
 * ## 이 파일이 생긴 계기 (2026-08-09)
 *
 * 임시 스캐너로 RLS 를 훑다가 `epistemic_*` 여섯 테이블이 "RLS 없음"으로 나왔다.
 * 심각한 취약점처럼 보였지만 **오탐이었다.** 그 마이그레이션은 RLS 를 이렇게 켠다:
 *
 *     DO $$ ... FOREACH table_name IN ARRAY ARRAY['a','b',...] LOOP
 *       EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
 *
 * 정적으로 읽는 어떤 도구도 `EXECUTE format()` 안을 못 본다. 그래서 이 가드는
 * **동적 SQL 을 이해한다** — 안 그러면 여섯 건이 영구 오탐으로 남고, 영구 오탐은
 * 곧 무시되며, 무시되는 검사 옆에서 진짜 누락이 지나간다.
 *
 * ## 정책 0건은 결함이 아니라 **선언돼야 할 설계**다
 *
 * RLS 를 켜고 정책을 하나도 안 만들면 그 테이블은 service role 전용이 된다.
 * 이 리포에는 그런 테이블이 여럿 있고 전부 의도된 것이다 — 특히
 * `argus_shadow_predictions` 는 **사용자 본인조차 정산 전에 못 읽는 것**이
 * 제품의 핵심이다. 문제는 "의도한 0건"과 "깜빡한 0건"이 똑같이 생겼다는 것.
 * 그래서 아래에 사유와 함께 등재하게 한다.
 *
 * 이 가드가 못 보는 것도 적어 둔다: 정책의 **내용**은 검사하지 않는다
 * (`USING (true)` 도 정책 1건으로 센다). 존재의 필요조건이지 충분조건이 아니다.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS = 'supabase/migrations';

/**
 * RLS 는 켜져 있으나 정책이 0건인 테이블 — **service role 전용**이라는 선언.
 * 각 항목은 "왜 사용자가 직접 읽으면 안 되는가"에 답해야 한다.
 */
const SERVICE_ROLE_ONLY: Record<string, string> = {
  argus_shadow_predictions:
    '분신의 봉인 예측. 사용자 본인도 정산 전에는 읽을 수 없어야 한다 — 미리 보면 ' +
    '시험이 시험이 아니게 되고, 그것이 이 제품에서 유일하게 다른 곳에 없는 물건이다. ' +
    '읽기 정책을 만드는 순간 봉인은 장식이 된다.',
  argus_oauth_grants:
    'OAuth 인가 코드. 수명이 짧은 자격증명이고 교환은 서버가 한다 — 브라우저가 ' +
    '읽을 이유가 없고, 읽히면 그 자체가 탈취 경로다.',
  mcp_account_authorizations:
    'MCP 계정 연결 자격. 위와 같은 이유 — 토큰류를 클라이언트에 노출하지 않는다.',
  telegram_sessions:
    '봇 대화 세션 상태. 웹 클라이언트가 아니라 웹훅 핸들러(service role)만 만진다.',
  anonymous_account_transfer_tickets:
    '익명 → 계정 이관 티켓. 발급·소각 모두 서버가 하고, 티켓을 읽을 수 있으면 ' +
    '다른 사람의 익명 작업을 가로챌 수 있다.',
  deep_judgment_usage:
    '사용량 한도 계수. 사용자가 읽고 쓸 수 있으면 한도 자체가 무의미해진다.',
};

// ── 마이그레이션 파싱 ───────────────────────────────────────────────────────

interface Schema {
  userTables: Set<string>;
  rlsEnabled: Set<string>;
  policyCount: Map<string, number>;
}

function parseMigrations(): Schema {
  const userTables = new Set<string>();
  const rlsEnabled = new Set<string>();
  const policyCount = new Map<string, number>();
  const bumpPolicy = (t: string) => policyCount.set(t, (policyCount.get(t) ?? 0) + 1);

  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    // 줄 주석을 먼저 걷는다 — 주석으로 적어 둔 DDL 예시가 실재 테이블로
    // 등록되면 가드가 유령을 감시하게 된다. `erasure-coverage.test.ts` 가
    // 이미 같은 이유로 같은 처리를 한다 (이 리포가 배운 것을 다시 배우지 않는다).
    const sql = readFileSync(join(MIGRATIONS, file), 'utf8').replace(/--[^\n]*/g, '');

    for (const m of sql.matchAll(
      /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z_][a-z0-9_]*)\s*\(([\s\S]*?)\n\)\s*;/gi,
    )) {
      // `user_id` 뿐 아니라 `source_user_id`·`target_user_id` 같은 소유 컬럼도
      // 센다. 초안은 `\buser_id\b` 만 봤고, 그래서
      // `anonymous_account_transfer_tickets`(소유 컬럼이 `source_user_id`) 가
      // 감시 밖으로 통째로 빠져나갔다 — 이 가드가 막으려는 바로 그 형태다.
      if (/\b[a-z_]*user_id\b/.test(m[2])) userTables.add(m[1].toLowerCase());
    }

    // 정적 형태
    for (const m of sql.matchAll(
      /alter\s+table\s+(?:only\s+)?(?:public\.)?([a-z_][a-z0-9_]*)\s+enable\s+row\s+level\s+security/gi,
    )) {
      rlsEnabled.add(m[1].toLowerCase());
    }
    // `\s+` 이어야 한다 — 이 리포의 정책은 대부분 이름 뒤에서 줄을 바꾸고
    // **들여쓴 뒤** `ON` 이 온다. 초안은 `\son` 이었고, 그래서 정책 네 개가
    // 멀쩡히 있는 `decision_items` 를 "정책 0건"으로 고발했다.
    for (const m of sql.matchAll(/create\s+policy\s+[^\n]*?\s+on\s+(?:public\.)?([a-z_][a-z0-9_]*)/gi)) {
      bumpPolicy(m[1].toLowerCase());
    }

    // 동적 형태 — `DO $$ … FOREACH … ARRAY[…] … EXECUTE format(…) … END $$;`
    // 배열 리터럴의 문자열들을 대상 테이블로 본다. 근사이지만, 이 패턴을 아예
    // 못 보는 것보다 훨씬 낫다 (그 경우 여섯 건이 영구 오탐이 된다).
    for (const block of sql.matchAll(/DO\s+\$\$([\s\S]*?)\$\$\s*;/gi)) {
      const body = block[1];
      const tables = [...body.matchAll(/ARRAY\s*\[([\s\S]*?)\]/gi)].flatMap((a) =>
        [...a[1].matchAll(/'([a-z_][a-z0-9_]*)'/gi)].map((s) => s[1].toLowerCase()),
      );
      if (tables.length === 0) continue;
      if (/enable\s+row\s+level\s+security/i.test(body)) for (const t of tables) rlsEnabled.add(t);
      if (/create\s+policy/i.test(body)) for (const t of tables) bumpPolicy(t);
    }
  }
  return { userTables, rlsEnabled, policyCount };
}

const { userTables, rlsEnabled, policyCount } = parseMigrations();

describe('RLS 적용 범위', () => {
  it('스캐너가 실제로 스키마를 읽었다 (경로·형식이 바뀌면 조용히 무력해지는 것을 막는다)', () => {
    expect(userTables.size).toBeGreaterThan(25);
    expect(userTables.has('argus_cases')).toBe(true);
    expect(rlsEnabled.has('argus_cases')).toBe(true);
  });

  it('동적 SQL(DO 블록)로 켠 RLS 도 읽는다 — 여기서 실패하면 여섯 건이 오탐이 된다', () => {
    // epistemic_* 는 `EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY')`
    // 로만 RLS 를 켠다. 정적으로만 보는 스캐너는 이들을 "무방비"로 고발한다.
    for (const t of [
      'epistemic_account_policies',
      'epistemic_authority_events',
      'epistemic_command_receipts',
      'epistemic_use_receipts',
      'epistemic_artifact_descriptors',
      'epistemic_projection_outbox',
    ]) {
      expect(rlsEnabled.has(t), `${t} 의 동적 RLS 를 못 읽었습니다`).toBe(true);
      expect((policyCount.get(t) ?? 0) > 0, `${t} 의 동적 정책을 못 읽었습니다`).toBe(true);
    }
  });

  it('user_id 를 가진 모든 테이블에 RLS 가 켜져 있다', () => {
    const naked = [...userTables].filter((t) => !rlsEnabled.has(t)).sort();
    expect(
      naked,
      'RLS 없이 user_id 를 가진 테이블입니다. Supabase 의 기본 GRANT 아래에서는\n' +
        '남의 행이 그대로 읽힙니다. 같은 마이그레이션에서 RLS 를 켜십시오:\n' +
        naked.join('\n'),
    ).toEqual([]);
  });

  it('정책이 0건인 테이블은 service-role 전용이라고 사유와 함께 등재돼 있다', () => {
    const undeclared = [...userTables]
      .filter((t) => rlsEnabled.has(t) && (policyCount.get(t) ?? 0) === 0)
      .filter((t) => !SERVICE_ROLE_ONLY[t])
      .sort();
    expect(
      undeclared,
      'RLS 는 켰지만 정책이 하나도 없습니다 — 사용자는 자기 행도 못 읽습니다.\n' +
        '의도한 것이면 SERVICE_ROLE_ONLY 에 "왜 본인도 읽으면 안 되는가"를 적고,\n' +
        `아니면 본인 읽기 정책을 추가하십시오:\n${undeclared.join('\n')}`,
    ).toEqual([]);
  });

  it('죽은 면제가 없다 — 등재된 테이블은 실존하고 여전히 정책 0건이어야 한다', () => {
    const stale = Object.keys(SERVICE_ROLE_ONLY)
      .filter((t) => !userTables.has(t) || (policyCount.get(t) ?? 0) > 0)
      .sort();
    expect(
      stale,
      '더 이상 맞지 않는 면제입니다 (테이블이 사라졌거나 정책이 생겼습니다).\n' +
        `면제 목록이 낡으면 다음 사람이 그것을 믿습니다:\n${stale.join('\n')}`,
    ).toEqual([]);
  });

  it('면제 사유가 실질적이다 (한 줄 변명 금지)', () => {
    for (const [t, reason] of Object.entries(SERVICE_ROLE_ONLY)) {
      expect(reason.length, `${t} 의 사유가 너무 짧습니다`).toBeGreaterThan(40);
    }
  });
});
