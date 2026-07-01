import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 토큰 상한 미러 가드.
 *
 * MAX_TOKENS_CAP은 두 곳에 있다: llm-validation.ts(서버측 검증)와 llm.ts의
 * STREAM_MAX_TOKENS_CAP(클라측). llm-validation.ts가 next/server를 import해서
 * 클라 번들로 끌려오면 안 되기 때문에 *합칠 수 없고*, 그래서 값이 복제돼 있다
 * (llm.ts:32-34 주석이 "Keep in sync"라고만 했지 강제는 없었다). 어긋나면
 * adaptive token budget 계산이 client/server에서 달라진다 — 조용히 깨지는 부류.
 *
 * 합칠 수 없는 미러는 가드로 묶는다: 두 숫자가 다르면 CI red.
 * (import이 아니라 소스 텍스트에서 숫자를 뽑는다 — next/server를 vitest로 끌고
 *  오지 않기 위해.)
 */

const grab = (rel: string, name: string): string | undefined => {
  const src = readFileSync(join(process.cwd(), rel), 'utf8');
  return src.match(new RegExp(`${name}\\s*=\\s*([\\d_]+)`))?.[1];
};

describe('토큰 상한 미러 패리티 (drift guard)', () => {
  it('llm.ts STREAM_MAX_TOKENS_CAP === llm-validation.ts MAX_TOKENS_CAP', () => {
    const client = grab('src/lib/llm.ts', 'STREAM_MAX_TOKENS_CAP');
    const server = grab('src/lib/llm-validation.ts', 'MAX_TOKENS_CAP');
    expect(client, 'STREAM_MAX_TOKENS_CAP not found in llm.ts').toBeDefined();
    expect(server, 'MAX_TOKENS_CAP not found in llm-validation.ts').toBeDefined();
    expect(client).toBe(server);
  });
});
