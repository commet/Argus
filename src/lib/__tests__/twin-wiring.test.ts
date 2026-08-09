/**
 * 선언↔소비 대조 (함수 수준) — TWIN 기획서 부록 B가 남긴 숙제의 구현.
 *
 * 부록 B의 결론을 그대로 옮기면: M1–M4를 지은 뒤 사람이 grep으로 대조하니
 * **여섯 개가 열려 있었다.** 그중 #2(choice 예측이 채점 안 됨)와 #4(가지 않은
 * 길이 정의만 되고 아무도 안 부름)는 형태가 똑같다 — **함수가 선언됐는데
 * 모듈 밖에서 아무도 부르지 않는다.** 컴파일러는 이것을 에러로 보지 않고
 * (export 된 것은 "쓰일 예정"이므로), 테스트는 자기가 직접 부르므로 초록이며,
 * 화면에는 그 기능이 없다는 사실만 조용히 남는다. LLM 파이프라인에서는 더
 * 나쁘다 — 없는 기능 자리를 모델이 그럴듯한 문장으로 메우기 때문이다.
 *
 * `tools-contract.test.ts`가 도구 스키마에 대해 하는 일을 함수 수준으로 한다:
 *
 *  1. `src/lib/twin/`의 모든 값 export는 **정의 파일 밖의 비테스트 코드**에서
 *     소비돼야 한다. 아니면 INTERNAL_ONLY에 사유와 함께 등재한다.
 *  2. **죽은 면제 금지** — INTERNAL_ONLY 항목이 실제로는 소비되고 있거나 아예
 *     사라졌으면 그것도 실패다. (면제 목록이 낡으면 다음 사람이 그것을 믿는다.)
 *  3. `argus_*` 테이블은 쓰기만 있고 읽기가 없으면 실패한다. 쓰기 전용 테이블은
 *     "저장했다"는 착시만 만든다 — 실제로 그 데이터를 쓰는 경로가 없으므로.
 *
 * 감시 범위를 twin으로 한정한 것은 의도다. 같은 규칙을 `src/lib/epistemic/`에
 * 지금 켜면 50건이 한꺼번에 붉어지는데(E-트랙은 테스트에만 소비되는 코드가
 * 대부분이다), 그것은 이 트랙의 결함이 아니라 별도 공정의 현황이므로 여기서
 * 몰래 처리하지 않는다 — BLUEPRINT §8에 한 줄로 올려 둔다.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const WATCHED_DIR = 'src/lib/twin';

/**
 * 모듈 밖에서 소비되지 않는 export — 각 항목은 **왜 export 되어 있는가**에
 * 답해야 한다. "테스트가 부른다"는 그 자체로는 사유가 아니고, 어떤 불변식을
 * 테스트가 지키는지까지 적는다.
 */
const INTERNAL_ONLY: Record<string, string> = {
  'twin/store.ts:shadowContentHash':
    '봉인 해시의 정의 그 자체. store 내부(봉인·공개 대조)에서 쓰이고, 테스트가 ' +
    '"해시가 채점 조건까지 덮는가"를 이것으로 검증한다. 표면이 직접 부르면 안 된다.',
  'twin/divergence.ts:DIVERGENCE_MIN_EVIDENCE':
    '이탈 감지의 결정론 관문 임계. divergence 내부에서만 쓰이고, 테스트가 "임계 ' +
    '미달이면 침묵"을 이 상수로 검증한다 — 임계를 표면에서 조절하게 만들면 관문이 무의미해진다.',
  'twin/divergence.ts:qualifiedPatterns':
    'divergenceCrux 의 앞단 관문. 같은 파일에서만 호출된다. 테스트가 "LLM 호출 전에 ' +
    '결정론 관문이 먼저 돈다"를 직접 확인하기 위해 노출돼 있다.',
  'twin/beliefs.ts:CALIBRATION_MIN_SAMPLE':
    '보정 거울의 표본 임계. beliefs 내부에서만 쓰이고, 테스트가 "표본 미달 등급은 숫자를 ' +
    '보여주지 않는다"를 이 상수로 검증한다 — 표면에서 낮출 수 있으면 3건짜리 퍼센트가 성적표가 된다.',
  'twin/noise.ts:disguiseCase':
    '잡음 거울의 변장 단계 — playDisguisedCase 안에서만 호출된다. 테스트가 "원문 어구가 ' +
    '변장문에 남으면 그 케이스를 버린다"를 이것으로 직접 확인한다 (오염된 문제로 낸 성적은 가짜다).',
  'twin/delegation.ts:activeDelegations':
    'applyDelegation 의 결정론 사전 필터 — 같은 파일에서만 호출된다. 테스트가 "만료·정지된 ' +
    '위임은 후보에 들지 않는다"를 이것으로 직접 확인한다 (설정 화면은 RLS 로 직접 읽으므로 이 함수를 쓰지 않는다).',
  'twin/delegation.ts:DELEGATION_SUSPEND_CONTRADICTIONS':
    '위임이 스스로 멈추는 임계. delegation 내부에서만 쓰이고, 테스트가 "어긋남 1건으로는 ' +
    '멈추지 않고 임계를 넘어야 멈춘다"를 이 상수로 검증한다 — 표면에서 조절 가능하면 자동 정지가 무의미해진다.',
  'twin/profile.ts:deriveConfidence':
    '확신도의 정의 그 자체 — 프로필 내부에서만 쓰인다. 테스트가 "근거 1건짜리 항목이 ' +
    '1.0 을 갖지 못한다"와 "반례가 쌓이면 은퇴 임계 아래로 내려간다"를 이 함수로 직접 확인한다.',
  'twin/profile.ts:resolveIndexFeedback':
    '모델이 돌려준 번호를 유효 인덱스로 좁히는 결정론 단계. 테스트가 "보강과 반례에 같은 ' +
    '번호가 오면 양쪽에서 다 뺀다"를 이것으로 검증한다 — LLM 응답을 태우지 않고 규율만 본다.',
  'twin/profile.ts:violatesJudgmentLanguage':
    '프로필 추출의 판정 언어 린트. profile 내부 검증 단계에서만 쓰이고, 테스트가 ' +
    '금지 어휘 목록을 직접 대조한다.',
};

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      if (entry === 'node_modules') continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(entry)) out.push(p);
  }
  return out;
}

const ALL_SRC = walk('src');
const NON_TEST_SRC = ALL_SRC.filter((f) => !f.includes('__tests__') && !f.endsWith('.test.ts'));
const FILE_TEXT = new Map(NON_TEST_SRC.map((f) => [f, readFileSync(f, 'utf8')]));

const EXPORT_RE = /export\s+(?:async\s+)?(?:function|const|class)\s+([A-Za-z0-9_]+)/g;

interface Declared {
  key: string;
  file: string;
  name: string;
  consumers: string[];
}

function declarations(): Declared[] {
  const out: Declared[] = [];
  for (const file of walk(WATCHED_DIR).filter((f) => !f.includes('__tests__'))) {
    const text = readFileSync(file, 'utf8');
    let m: RegExpExecArray | null;
    EXPORT_RE.lastIndex = 0;
    while ((m = EXPORT_RE.exec(text))) {
      const name = m[1];
      const word = new RegExp(`\\b${name}\\b`);
      const consumers = NON_TEST_SRC.filter((g) => g !== file && word.test(FILE_TEXT.get(g) ?? ''));
      const portableFile = file.replaceAll('\\', '/');
      out.push({ key: `${portableFile.replace('src/lib/', '')}:${name}`, file, name, consumers });
    }
  }
  return out;
}

describe('TWIN 선언↔소비 대조', () => {
  const decls = declarations();

  it('감시 대상이 실재한다 (경로가 바뀌면 이 테스트가 조용히 무력해지는 것을 막는다)', () => {
    expect(decls.length).toBeGreaterThan(15);
  });

  it('모든 값 export 는 모듈 밖에서 소비되거나 사유와 함께 등재된다', () => {
    const orphans = decls
      .filter((d) => d.consumers.length === 0)
      .filter((d) => !INTERNAL_ONLY[d.key])
      .map((d) => d.key);
    expect(
      orphans,
      `모듈 밖에서 아무도 부르지 않는 export 입니다. 배선하거나 INTERNAL_ONLY 에 사유를 적으십시오:\n${orphans.join('\n')}`,
    ).toEqual([]);
  });

  it('죽은 면제가 없다 — 등재된 항목은 실존하고 여전히 미소비여야 한다', () => {
    const declared = new Map(decls.map((d) => [d.key, d]));
    const stale: string[] = [];
    for (const key of Object.keys(INTERNAL_ONLY)) {
      const d = declared.get(key);
      if (!d) stale.push(`${key} — 그런 export 가 없습니다 (이름이 바뀌었거나 삭제됨)`);
      else if (d.consumers.length > 0) stale.push(`${key} — 이제 소비됩니다. 면제를 지우십시오`);
    }
    expect(stale, stale.join('\n')).toEqual([]);
  });

  it('면제 사유가 실질적이다 (한 줄 변명 금지)', () => {
    for (const [key, reason] of Object.entries(INTERNAL_ONLY)) {
      expect(reason.length, `${key} 의 사유가 너무 짧습니다`).toBeGreaterThan(40);
    }
  });
});

/**
 * E-트랙 래칫 — 강제가 아니라 **더 나빠지지 않게** 하는 장치.
 *
 * 같은 규칙을 `src/lib/epistemic/`에 그냥 켜면 49건이 한꺼번에 붉어진다.
 * 그것은 이 트랙의 결함이 아니라 별도 공정의 현황이고, TWIN 작업 중에 몰래
 * 처리할 것도 아니다 (BLUEPRINT §8에 판정 과제로 올려 뒀다).
 *
 * 그렇다고 아무것도 안 하면 그 수는 조용히 는다. 그래서 **상한만 건다**:
 * 오늘의 수를 천장으로 두고, 새 미소비 export 가 하나라도 늘면 실패한다.
 * 줄이는 것은 언제나 환영이고, 줄었으면 이 상수를 내려 못을 박는다.
 *
 * (커버리지 ratchet 과 같은 정신이다 — 지금 다 고칠 수 없는 것을 인정하되
 *  더 나빠지는 것은 기계가 막는다.)
 */
const EPISTEMIC_UNCONSUMED_CEILING = 49;

describe('E-트랙 미소비 래칫', () => {
  it(`src/lib/epistemic 의 미소비 export 가 ${EPISTEMIC_UNCONSUMED_CEILING}건을 넘지 않는다`, () => {
    const dir = 'src/lib/epistemic';
    const orphans: string[] = [];
    for (const file of walk(dir).filter((f) => !f.includes('__tests__'))) {
      const text = readFileSync(file, 'utf8');
      let m: RegExpExecArray | null;
      EXPORT_RE.lastIndex = 0;
      while ((m = EXPORT_RE.exec(text))) {
        const word = new RegExp(`\\b${m[1]}\\b`);
        if (!NON_TEST_SRC.some((g) => g !== file && word.test(FILE_TEXT.get(g) ?? ''))) {
          orphans.push(`${file}:${m[1]}`);
        }
      }
    }
    expect(
      orphans.length,
      orphans.length > EPISTEMIC_UNCONSUMED_CEILING
        ? `미소비 export 가 늘었습니다. 배선하거나, 지우거나, 왜 늘었는지 설명하고 천장을 올리십시오:\n${orphans.join('\n')}`
        : '',
    ).toBeLessThanOrEqual(EPISTEMIC_UNCONSUMED_CEILING);
  });

  it('천장이 실제 수보다 크게 벌어져 있지 않다 (줄었으면 못을 다시 박는다)', () => {
    // 천장과 실제가 벌어지면 래칫이 헐거워져 다시 늘 자리가 생긴다.
    const dir = 'src/lib/epistemic';
    let count = 0;
    for (const file of walk(dir).filter((f) => !f.includes('__tests__'))) {
      const text = readFileSync(file, 'utf8');
      let m: RegExpExecArray | null;
      EXPORT_RE.lastIndex = 0;
      while ((m = EXPORT_RE.exec(text))) {
        const word = new RegExp(`\\b${m[1]}\\b`);
        if (!NON_TEST_SRC.some((g) => g !== file && word.test(FILE_TEXT.get(g) ?? ''))) count += 1;
      }
    }
    expect(
      EPISTEMIC_UNCONSUMED_CEILING - count,
      `실제 ${count}건인데 천장이 ${EPISTEMIC_UNCONSUMED_CEILING}건입니다 — 천장을 ${count}로 내리십시오.`,
    ).toBeLessThanOrEqual(3);
  });
});

describe('argus_* 테이블 쓰기 전용 금지', () => {
  // 쓰기만 있고 읽기가 없는 테이블은 "저장했다"는 착시를 만든다. 실제로 그
  // 데이터를 쓰는 경로가 없으므로, 그 기능은 존재하지 않는 것과 같다.
  // (argus_case_bank 가 정확히 이 상태였다 — 시드는 upsert 되는데 극장은
  //  코드 상수를 직접 읽어서, 테이블을 지워도 아무도 눈치채지 못했다.)
  const READ_EXEMPT: Record<string, string> = {};

  const refs = new Map<string, { read: boolean; write: boolean }>();
  for (const f of NON_TEST_SRC) {
    const text = FILE_TEXT.get(f) ?? '';
    // 꼬리를 **소비하지 않는다**: `[\s\S]{0,400}` 로 삼키면 그 창 안에 있는 다음
    // from() 이 통째로 사라진다 (같은 함수에서 테이블 둘을 잇달아 만지는 코드가
    // 정확히 그렇다). 정규식이 조용히 덜 보는 것이 이 테스트의 가장 큰 위험이다.
    for (const m of text.matchAll(/from\(\s*'(argus_[a-z_]+)'\s*\)/g)) {
      const table = m[1];
      const head = text.slice(m.index + m[0].length, m.index + m[0].length + 60);
      const cur = refs.get(table) ?? { read: false, write: false };
      if (/\.\s*select\(/.test(head)) cur.read = true;
      if (/\.\s*(insert|upsert|update|delete)\(/.test(head)) cur.write = true;
      refs.set(table, cur);
    }
  }

  it('쓰기가 있는 테이블은 읽기 경로도 있다', () => {
    const writeOnly = [...refs.entries()]
      .filter(([t, v]) => v.write && !v.read && !READ_EXEMPT[t])
      .map(([t]) => t);
    expect(
      writeOnly,
      `쓰기만 있고 읽는 곳이 없는 테이블입니다. 읽어서 쓰거나, 테이블을 지우거나, 사유를 등재하십시오:\n${writeOnly.join('\n')}`,
    ).toEqual([]);
  });

  it('테이블 참조가 실제로 수집됐다 (정규식이 조용히 0건이 되는 것을 막는다)', () => {
    expect(refs.size).toBeGreaterThan(5);
  });
});

/**
 * 준비 상태 패널의 목록이 마이그레이션과 어긋나지 않게 한다.
 *
 * 그 패널은 "마이그레이션이 실제로 들어갔는가"를 사람이 눈으로 확인하는
 * 유일한 자리다. 새 argus_* 테이블을 만들고 패널에 등재하지 않으면, 패널은
 * **초록인데 실제로는 빠진 상태**를 보여준다 — 없는 것보다 나쁜 계기판이다.
 * (같은 형태를 이 리포는 이미 여러 번 겪었다: 감시 장치 자신의 침묵.)
 */
describe('서버 준비 상태 패널 ↔ 마이그레이션 대조', () => {
  const SETTINGS = 'src/app/[locale]/settings/page.tsx';

  it('마이그레이션이 만든 모든 argus_* 테이블이 패널에 등재돼 있다', () => {
    const created = new Set<string>();
    for (const file of readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql'))) {
      const sql = readFileSync(join('supabase/migrations', file), 'utf8');
      for (const m of sql.matchAll(/create table if not exists public\.(argus_[a-z_]+)/g)) {
        created.add(m[1]);
      }
    }
    expect(created.size).toBeGreaterThan(5); // 정규식이 조용히 0건이 되는 것을 막는다

    const page = readFileSync(SETTINGS, 'utf8');
    const missing = [...created].filter((t) => !page.includes(`'${t}'`)).sort();
    expect(
      missing,
      `준비 상태 패널(SCHEMA_PROBES)에 빠진 테이블입니다 — 등재하지 않으면 패널이 초록인데 실제로는 빠진 상태가 됩니다:\n${missing.join('\n')}`,
    ).toEqual([]);
  });

  it('나중에 추가된 컬럼도 패널이 본다 (alter table … add column)', () => {
    // 테이블은 있는데 컬럼만 없는 경우가 실제로 가장 흔한 미적용 형태다
    // (마이그레이션 하나를 건너뛰었을 때). 컬럼 탐침이 최소 둘은 있어야 한다.
    const page = readFileSync(SETTINGS, 'utf8');
    const columnProbes = [...page.matchAll(/column:\s*'([a-z_]+)'/g)].map((m) => m[1]);
    expect(columnProbes.length).toBeGreaterThanOrEqual(2);
    expect(columnProbes).toContain('delegation_id');
    expect(columnProbes).toContain('profile_extracted_at');
  });
});
