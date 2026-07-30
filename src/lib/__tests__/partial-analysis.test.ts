/**
 * parsePartialAnalysis — the streaming reader under the analyzing screen.
 *
 * 2026-07-31: the initial-analysis JSON was reordered so the lines a person can
 * act on (request_type → real_question → insight) stream before the long
 * scaffolding arrays. Two things must hold or the reorder silently breaks the
 * first impression:
 *   1. The parser is ORDER-AGNOSTIC — both the old key order (insight after
 *      skeleton) and the new one parse identically, because a cached/retried
 *      response from either era can still arrive.
 *   2. request_type and insight are extracted MID-STREAM — the analyzing screen
 *      branches on them (a vent/info user sees the forming answer instead of
 *      staring at their own echoed sentence; an OPEN user must NOT see the
 *      model insight, which the engine later discards for neutrality).
 */

import { describe, it, expect } from 'vitest';
import { parsePartialAnalysis } from '@/lib/partial-analysis';

describe('스트리밍 순서 — 새 순서 (request_type → real_question → insight 먼저)', () => {
  it('request_type은 첫 몇 토큰 안에 읽힌다 (UI가 경로를 초반에 알아야 분기한다)', () => {
    const p = parsePartialAnalysis('{"request_type": "info", "real_qu');
    expect(p.request_type).toBe('info');
    expect(p.real_question).toBe('');
  });

  it('insight가 아직 쓰이는 중이면 미완성으로 표시된다 (커서 깜빡임용)', () => {
    const p = parsePartialAnalysis(
      '{"request_type": "info", "real_question": "OKR이 뭐예요?", "insight": "OKR은 목표와 핵심 결과를 묶',
    );
    expect(p.insight).toContain('OKR은 목표와');
    expect(p.insight_complete).toBe(false);
    expect(p.real_question_complete).toBe(true);
  });

  it('insight 완성 후에는 complete가 참이 된다', () => {
    const p = parsePartialAnalysis(
      '{"request_type": "vent", "real_question": "요즘 너무 지쳐요", "insight": "그런 시기를 지나고 계시는군요.", "framing_confidence": 60,',
    );
    expect(p.insight).toBe('그런 시기를 지나고 계시는군요.');
    expect(p.insight_complete).toBe(true);
    expect(p.request_type).toBe('vent');
  });

  it('insight가 흐르는 동안 stage는 question에 머문다 (없는 단계를 지어내지 않는다)', () => {
    const p = parsePartialAnalysis(
      '{"request_type": "open", "real_question": "무엇을 기준으로 정할까?", "insight": "기준을 먼저',
    );
    expect(p.stage).toBe('question');
  });
});

describe('순서 무관 — 옛 순서(skeleton 뒤 insight)도 그대로 읽힌다', () => {
  const OLD_ORDER =
    '{"request_type": "open", "real_question": "진짜 질문은?", "framing_confidence": 80, ' +
    '"hidden_assumptions": ["가정 하나"], "skeleton": ["첫째 — 한다", "둘째 — 본다"], ' +
    '"insight": "결론 먼저, 이유는 다음.", "next_question": {"text": "다음?"}}';

  it('모든 필드가 옛 순서에서도 추출된다', () => {
    const p = parsePartialAnalysis(OLD_ORDER);
    expect(p.real_question).toBe('진짜 질문은?');
    expect(p.hidden_assumptions).toEqual(['가정 하나']);
    expect(p.skeleton).toEqual(['첫째 — 한다', '둘째 — 본다']);
    expect(p.insight).toBe('결론 먼저, 이유는 다음.');
    expect(p.request_type).toBe('open');
  });

  it('stage는 가장 뒤 단계(skeleton)를 가리킨다', () => {
    expect(parsePartialAnalysis(OLD_ORDER).stage).toBe('skeleton');
  });
});

describe('기존 계약 유지 (회귀 방지)', () => {
  it('빈 텍스트는 reading 단계의 빈 결과다', () => {
    const p = parsePartialAnalysis('');
    expect(p.stage).toBe('reading');
    expect(p.real_question).toBe('');
    expect(p.insight).toBe('');
    expect(p.request_type).toBe('');
  });

  it('이스케이프된 따옴표·개행이 값 안에서 살아남는다', () => {
    const p = parsePartialAnalysis(
      '{"request_type": "info", "insight": "\\"인용\\"도\\n줄바꿈도 그대로."',
    );
    expect(p.insight).toBe('"인용"도\n줄바꿈도 그대로.');
  });
});
