import type { JudgmentAttribution } from '@/stores/types';

/**
 * 봉인되는 한 줄을 **누가 썼는가**를 정하는 단 하나의 자리 (2026-07-29).
 *
 * 왜 컴포넌트에서 빼왔나: 이 판정은 이 제품이 절대 틀리면 안 되는 것인데
 * (기계 문장을 사람 문장으로 세탁하는 순간, 확인일에 "당신이 이렇게 판단했죠"라고
 * 하지 않은 판단을 그 사람 이름으로 현실과 맞추게 된다), SealMoment 안에 있으면
 * 순수 테스트가 닿지 않는다. 검사기가 못 읽는 곳에 규칙을 두면 그 규칙은 없는 것과
 * 같다 — 팀 기능 UUID 검사기가 server-only 파일에 있어 vitest가 못 읽었던 것과
 * 같은 실수다.
 *
 * 세 갈래뿐이다:
 *   1. AI 초안을 손대지 않고 확정   → 기계가 썼고 사람이 골랐다
 *   2. AI 초안을 고쳐 씀            → 사람 문장이되, AI 문장에서 출발했다
 *   3. 백지에서 직접 씀             → 온전히 사람 문장
 *
 * 1번을 'user' 로 적는 것이 세탁이고, 2·3번을 'ai_surfaced' 로 적는 것은
 * 사람의 판단을 기계에게 넘기는 반대쪽 거짓말이다. 둘 다 막는다.
 */
export interface ClosingJudgmentAuthorship {
  /** 술어의 레거시 호환 비트. */
  authored: 'user' | 'ai_surfaced';
  attribution: JudgmentAttribution;
}

export function closingJudgmentAuthorship(input: {
  /** 확정되는 문장. */
  text: string;
  /** Argus 가 미리 넣어둔 초안 (없으면 빈 문자열). */
  aiDraft: string;
  /** 사용자가 그 칸을 한 번이라도 건드렸는가. */
  touched: boolean;
  now: number;
  /** 기록 표면. 기본은 워크스페이스 봉인 — 리뷰 봉인 등 다른 표면은 자기 이름을 넘긴다. */
  sourceRef?: string;
}): ClosingJudgmentAuthorship {
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
  const text = norm(input.text);
  const draft = norm(input.aiDraft);
  const recorded_at = new Date(input.now).toISOString();
  const base = { surface: 'web' as const, recorded_at, source_ref: input.sourceRef ?? 'workspace:closing_judgment' };

  // 손댔더라도 결과가 초안과 **글자까지 같으면** 그건 여전히 기계 문장이다.
  // (지웠다가 똑같이 다시 친 경우까지 사람 것으로 쳐줄 이유가 없다 — 판정 기준은
  //  '고생했는가'가 아니라 '누구 문장인가'다.)
  if (draft && text === draft) {
    return {
      authored: 'ai_surfaced',
      attribution: { ...base, wording_source: 'ai_surfaced', authority: 'user_adopted' },
    };
  }
  if (draft && input.touched) {
    return {
      authored: 'user',
      attribution: { ...base, wording_source: 'user_reworded', authority: 'user_asserted' },
    };
  }
  return {
    authored: 'user',
    attribution: { ...base, wording_source: 'user_direct', authority: 'user_asserted' },
  };
}
