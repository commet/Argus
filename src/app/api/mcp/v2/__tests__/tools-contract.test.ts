// 선언과 소비를 기계로 맞대 본다 (CLAUDE.md LLM-glue 불변식 2: "명사만이
// 아니라 동사를 타입한다").
//
// 도구 스키마는 모델이 읽는 **유일한** 사양이다. 두 방향 다 조용히 틀릴 수 있다:
//  · 핸들러가 읽는데 스키마에 없으면 → 모델은 보낼 줄 모르고, 그 자리는 영원히 빈다
//    (실제로 argus_plan.steps 가 그랬다: 핸들러의 필수 입력인데 선언이 없었다)
//  · 스키마에 있는데 핸들러가 안 읽으면 → 모델은 반영됐다고 믿는다
//    (실제로 argus_recall.query 가 그랬다: 선언돼 있고 조용히 버려졌다)
// 둘 다 "그럴듯함이 맞음으로 위장"하는 형태이므로 컴파일러 대신 이 테스트가 막는다.
//
// 정직한 한계: 이 검사는 도구별이 아니라 **합집합** 대조다 (핸들러 소스에서
// `args.X` 를 긁으므로 어느 도구의 것인지 구분하지 못한다). 오타와 통째 누락은
// 잡고, "A 도구에 선언된 것을 B 도구만 읽는" 어긋남은 못 잡는다.

import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { TOOLS } from '../tools';

const handlersSrc = readFileSync(join(__dirname, '..', 'handlers.ts'), 'utf8');

function declaredTopLevel(): Set<string> {
  const out = new Set<string>();
  for (const t of TOOLS) for (const k of Object.keys(t.inputSchema.properties)) out.add(k);
  return out;
}

function consumedFromHandlers(): Set<string> {
  const out = new Set<string>();
  for (const m of handlersSrc.matchAll(/\bargs\.([A-Za-z_][A-Za-z0-9_]*)/g)) out.add(m[1]);
  return out;
}

describe('도구 스키마 ↔ 핸들러 소비', () => {
  it('핸들러가 읽는 인자는 전부 선언돼 있다 (모델이 보낼 줄 알아야 한다)', () => {
    const declared = declaredTopLevel();
    const undeclared = [...consumedFromHandlers()].filter((k) => !declared.has(k));
    expect(undeclared, `핸들러는 읽지만 스키마에 없는 인자: ${undeclared.join(', ')}`).toEqual([]);
  });

  it('선언된 인자는 전부 소비된다 (유령 파라미터 금지)', () => {
    const consumed = consumedFromHandlers();
    const unconsumed = [...declaredTopLevel()].filter((k) => !consumed.has(k));
    expect(unconsumed, `선언만 되고 버려지는 인자: ${unconsumed.join(', ')}`).toEqual([]);
  });

  it('계획 단계의 하위 필드도 핸들러가 실제로 읽는다', () => {
    const plan = TOOLS.find((t) => t.name === 'argus_plan')!;
    const stepSchema = (plan.inputSchema.properties.steps as { items: { properties: Record<string, unknown> } }).items;
    for (const key of Object.keys(stepSchema.properties)) {
      expect(handlersSrc, `steps[].${key} 가 소비되지 않는다`).toContain(`o.${key}`);
    }
  });

  it('enum 을 선언한 인자는 핸들러도 같은 목록으로 거른다 (모르는 값을 조용히 통과시키지 않는다)', () => {
    // 스키마의 enum 은 힌트일 뿐 강제가 아니다 — 호스트가 검증한다는 보장이 없으므로
    // 서버가 다시 걸러야 한다. 각 enum 값이 핸들러 소스에 문자열로 존재하는지 본다.
    const enums: string[] = [];
    const walk = (node: unknown) => {
      if (!node || typeof node !== 'object') return;
      const o = node as Record<string, unknown>;
      if (Array.isArray(o.enum)) enums.push(...(o.enum as string[]));
      for (const v of Object.values(o)) walk(v);
    };
    for (const t of TOOLS) walk(t.inputSchema);
    expect(enums.length).toBeGreaterThan(10);
    for (const value of new Set(enums)) {
      expect(handlersSrc, `enum 값 "${value}" 를 핸들러가 모른다`).toContain(`'${value}'`);
    }
  });
});

describe('필수 인자 선언', () => {
  it('required 에 적힌 것은 properties 에도 있다', () => {
    for (const t of TOOLS) {
      for (const r of t.inputSchema.required ?? []) {
        expect(Object.keys(t.inputSchema.properties), `${t.name}.${r}`).toContain(r);
      }
    }
  });

  it('argus_plan 은 steps 를 선언한다 — 없으면 계획을 만들 방법 자체가 없다', () => {
    const plan = TOOLS.find((t) => t.name === 'argus_plan')!;
    expect(Object.keys(plan.inputSchema.properties)).toContain('steps');
  });

  it('argus_open 의 userInvoked 설명이 "모델이 부른 것은 해당 없음"을 못박는다', () => {
    const open = TOOLS.find((t) => t.name === 'argus_open')!;
    const desc = (open.inputSchema.properties.userInvoked as { description: string }).description;
    expect(desc).toMatch(/판단한 것은 여기에 해당하지 않는다|해당하지 않는다/);
  });
});
