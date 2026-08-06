import { beforeEach, describe, expect, it, vi } from 'vitest';

// TWIN 잡음 거울 — 변장 재제시의 기계 검증.
//
// 이 기능의 실패 형태는 "틀리는 것"이 아니라 **"쉽게 맞히는 것"**이다.
// 변장이 허술해 원문 고유명사가 남아 있거나, 실제 선택이 늘 같은 자리에 있으면
// 분신은 구조가 아니라 표면을 맞히고, 그 성적은 그럴듯한 가짜가 된다.
// 그래서 테스트의 대부분이 **오염 경로**다.

const inserted: Array<Record<string, unknown>> = [];
let llmQueue: Array<Record<string, unknown> | null> = [];

vi.mock('@/lib/llm-server', () => ({
  // 이 파이프라인은 LLM 을 두 번 부른다 (변장 → 답). 하나의 고정 응답으로
  // mock 하면 두 단계가 구분되지 않으므로 큐로 순서를 준다.
  callAnthropicJson: vi.fn(async () => (llmQueue.length > 0 ? llmQueue.shift()! : null)),
}));

vi.mock('@/lib/share-guard', () => ({
  adminClient: () => ({
    from: () => ({
      insert: (row: Record<string, unknown>) => {
        inserted.push(row);
        return Promise.resolve({ error: null });
      },
    }),
  }),
}));

import { disguiseCase, playDisguisedCase } from '../noise';

const SRC = {
  caseId: 'case-aa', // 문자 합이 홀수 → flip=true → 실제 선택이 b 자리에 온다
  question: '넷플릭스 구독팀을 분리할 것인가',
  choice: '분리하지 않고 한 팀으로 간다',
  rejectedAlternative: '별도 브랜드로 분리한다',
};

const CLEAN_DISGUISE = {
  situation: '지역 빵집 체인이 배달 부문을 어떻게 둘지 정해야 한다. 성수기를 앞두고 있다.',
  option_a: '한 조직으로 묶어 둔다',
  option_b: '독립 브랜드로 떼어낸다',
};

beforeEach(() => {
  inserted.length = 0;
  llmQueue = [];
});

describe('disguiseCase — 변장이 답을 흘리면 버린다', () => {
  it('원문의 특징적 토큰이 남아 있으면 null (그 성적은 구조의 증거가 아니다)', async () => {
    llmQueue = [{ ...CLEAN_DISGUISE, situation: '넷플릭스 구독팀을 어떻게 둘지 정해야 한다' }];
    expect(await disguiseCase(SRC, false)).toBeNull();
  });

  it('깨끗한 변장이면 선택지 둘을 돌려준다', async () => {
    llmQueue = [CLEAN_DISGUISE];
    const d = await disguiseCase(SRC, false);
    expect(d?.options.map((o) => o.key)).toEqual(['a', 'b']);
    expect(d?.situation).not.toContain('넷플릭스');
  });

  it('필드가 비면 null — 반쪽 변장을 문제로 내지 않는다', async () => {
    llmQueue = [{ ...CLEAN_DISGUISE, option_b: '  ' }];
    expect(await disguiseCase(SRC, false)).toBeNull();
  });

  it('LLM 이 답을 못 내면 null', async () => {
    llmQueue = [null];
    expect(await disguiseCase(SRC, false)).toBeNull();
  });
});

describe('playDisguisedCase', () => {
  it('분신의 답이 실제 선택과 같으면 correct, source 는 distant 다', async () => {
    // flip=true 이므로 실제 선택은 b 자리다.
    llmQueue = [CLEAN_DISGUISE, { choice_key: 'b', reasoning: '구조가 같다' }];
    const item = await playDisguisedCase('user-1', SRC, []);
    expect(item?.correct).toBe(true);
    expect(item?.gradeLabel).toBe('graded');
    expect(inserted[0]).toMatchObject({ source: 'distant', grade_label: 'graded', correct: true });
  });

  it('다르면 correct=false — 틀린 것을 맞은 것으로 만들지 않는다', async () => {
    llmQueue = [CLEAN_DISGUISE, { choice_key: 'a', reasoning: '다르게 본다' }];
    const item = await playDisguisedCase('user-1', SRC, []);
    expect(item?.correct).toBe(false);
  });

  it('선택지 밖의 답은 저장되지 않는다', async () => {
    llmQueue = [CLEAN_DISGUISE, { choice_key: 'c', reasoning: '?' }];
    expect(await playDisguisedCase('user-1', SRC, [])).toBeNull();
    expect(inserted).toHaveLength(0);
  });

  it('변장이 실패하면 답을 묻지도 않는다 — 오염된 문제로 성적을 내지 않는다', async () => {
    llmQueue = [null, { choice_key: 'a', reasoning: '불려선 안 됨' }];
    expect(await playDisguisedCase('user-1', SRC, [])).toBeNull();
    expect(inserted).toHaveLength(0);
  });

  it('선택지 배치가 caseId 로 결정론적으로 갈린다 — 늘 정답이 앞이면 위치를 배운다', async () => {
    // 'case-ab' 는 합이 짝수 → flip=false → 같은 원본인데 실제 선택이 a 자리로 옮겨간다.
    const even = { ...SRC, caseId: 'case-ab' };
    llmQueue = [CLEAN_DISGUISE, { choice_key: 'a', reasoning: 'r' }];
    const item = await playDisguisedCase('user-1', even, []);
    expect(item?.correct).toBe(true);
  });

  it('채점 대상이 분신임을 문장에서 밝힌다 — 사용자를 시험한 것이 아니다', async () => {
    llmQueue = [CLEAN_DISGUISE, { choice_key: 'b', reasoning: 'r' }];
    const item = await playDisguisedCase('user-1', SRC, []);
    expect(item?.body).toContain('채점 대상은 분신의 예측입니다');
  });
});
