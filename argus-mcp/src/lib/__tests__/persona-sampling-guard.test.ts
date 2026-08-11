import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// @ts-expect-error — evals stay plain .mjs (they run under bare node, no build step)
import { AXES, LANGUAGES, SEED, samplePersonas } from '../../../evals/persona-sampling.mjs';

/**
 * 페르소나 표본의 두 성질이 무너지면 persona-overfire 실험 전체가 헛돈다.
 *
 * 1. **커버리지** — 모든 축의 모든 수준이 실제로 등장해야 한다. N=10 무작위
 *    추출은 수준 하나를 통째로 빠뜨릴 수 있고, 하필 빠지는 게 Evasive처럼
 *    흥미로운 극단일 수 있다.
 * 2. **비교락(非交絡)** — 축들이 서로 잠겨 움직이면 안 된다. 첫 구현이 실제로
 *    이 결함을 가졌다: 공유 순열 하나를 `i % 5`로 돌려서 P01~P05와 P06~P10이
 *    쌍둥이가 됐고, Evasive는 모든 행에서 Very formal과 함께만 나타났다.
 *    커버리지 출력은 완벽해 보였다 — 그러나 축들이 한 몸으로 움직이면 관찰된
 *    실패를 어느 축 탓으로도 돌릴 수 없어, 축별 분해가 통째로 무의미해진다.
 *
 * 셋째 성질은 재현성이다: 같은 시드 → 같은 표본. 이것이 깨지면 리시트의
 * "시드 20260811"이 아무것도 고정하지 않는다.
 */
describe('persona sampling guard', () => {
  const personas = samplePersonas();

  it('모든 축의 모든 수준이 표본에 등장한다', () => {
    for (const axis of AXES) {
      const seen = new Set(personas.map((p: any) => p.traits[axis.id]));
      expect([...seen].sort(), `${axis.id}의 수준 커버리지`).toEqual([...axis.values].sort());
    }
    const langs = new Set(personas.map((p: any) => p.language));
    expect([...langs].sort()).toEqual([...LANGUAGES].sort());
  });

  it('트레이트 벡터가 전부 서로 다르다 — 쌍둥이 없음', () => {
    const keys = personas.map((p: any) => JSON.stringify(p.traits) + p.language);
    expect(new Set(keys).size, '동일 페르소나 쌍이 존재하면 표본 폭이 절반이 된다').toBe(personas.length);
  });

  it('어떤 축 쌍도 완전 교락(bijection)이 아니다', () => {
    // 잠금 결함의 서명: 축 A의 수준을 알면 축 B의 수준이 결정된다. 즉 관찰된
    // (a,b) 쌍의 종류 수가 수준 수(5)와 같다. 독립 셔플이면 5보다 커야 한다.
    for (let a = 0; a < AXES.length; a++) {
      for (let b = a + 1; b < AXES.length; b++) {
        const pairs = new Set(personas.map((p: any) => p.traits[AXES[a].id] + '⇢' + p.traits[AXES[b].id]));
        expect(pairs.size, `${AXES[a].id} ↔ ${AXES[b].id}가 한 몸으로 움직인다`).toBeGreaterThan(AXES[a].values.length);
      }
    }
  });

  it('같은 시드는 같은 표본을 만든다 — 리시트의 시드가 실제로 고정력을 가진다', () => {
    expect(samplePersonas(10, SEED)).toEqual(samplePersonas(10, SEED));
    expect(samplePersonas(10, SEED + 1)).not.toEqual(samplePersonas(10, SEED));
  });

  it('축 어휘가 MatrAIx 스키마 발췌본과 어긋나지 않는다 (전사의 기계 검증)', () => {
    // fixtures의 발췌본(6컬럼, ~2KB — 원본 1290컬럼 325KB에서 추출, MIT)과
    // 대조한다. 이 대조가 없으면 "MatrAIx 스키마에서 전사했다"는 주석은 검증
    // 불가능한 주장으로 남는다 — 어휘를 지어내고 출처를 붙이는 실수와 구분이
    // 안 된다. 발췌본이 지워지면 검사도 조용히 사라지므로 실존을 단언한다.
    const schemaPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)), '../../../evals/fixtures/persona_codes.schema.json',
    );
    expect(fs.existsSync(schemaPath), '스키마 발췌본 fixture가 사라지면 이 검사가 헛돈다').toBe(true);
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    const byId = new Map<string, any>(schema.columns.map((c: any) => [c.id, c]));
    for (const axis of AXES) {
      const col = byId.get(axis.id);
      expect(col, `${axis.id}가 스키마에 존재`).toBeTruthy();
      expect(col.values, `${axis.id}의 값 어휘 일치`).toEqual(axis.values);
      expect(col.category, `${axis.id}의 카테고리 일치`).toBe(axis.category);
    }
  });
});
