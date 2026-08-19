import { describe, it, expect } from 'vitest';
import { parseTranscript, splitSentences, extractCandidates, extractionSummary, isAiWorded, authorLine } from '../extract';

/** 실제 Claude Code 세션 로그 한 줄의 모양 (2026-08-18 실측 형식). */
const humanLine = (text: string, at: string, uuid = 'u1') =>
  JSON.stringify({
    type: 'user',
    origin: { kind: 'human' },
    message: { role: 'user', content: text },
    timestamp: at,
    uuid,
  });

const aiLine = (text: string, at: string, uuid = 'a1') =>
  JSON.stringify({
    type: 'assistant',
    message: { role: 'assistant', content: [{ type: 'thinking', text: '속으로 한 생각' }, { type: 'text', text }] },
    timestamp: at,
    uuid,
  });

/** 도구 결과 — type 은 user 지만 사람이 한 말이 아니다. */
const toolResultLine = (text: string, at: string) =>
  JSON.stringify({ type: 'user', message: { role: 'user', content: text }, timestamp: at, uuid: 't1' });

describe('로그 읽기 — 사람이 한 말만 사람 말로 센다', () => {
  it('사람 턴과 AI 턴을 구분해 읽는다', () => {
    const t = parseTranscript([humanLine('가격을 올릴까 말까 고민이야', '2026-08-17T00:00:00Z'), aiLine('이렇게 보입니다', '2026-08-17T00:01:00Z')].join('\n'));
    expect(t.map((x) => x.who)).toEqual(['user', 'ai']);
  });

  it('origin 이 human 이 아닌 user 턴은 사람 말이 아니다 (도구 결과·시스템 주입)', () => {
    const t = parseTranscript(toolResultLine('명령 실행 결과입니다', '2026-08-17T00:00:00Z'));
    expect(t).toHaveLength(0);
  });

  it('AI 의 thinking 블록은 버린다 — 사용자가 본 적 없는 말이다', () => {
    const t = parseTranscript(aiLine('보이는 말', '2026-08-17T00:00:00Z'));
    expect(t[0].text).toBe('보이는 말');
    expect(t[0].text).not.toContain('속으로');
  });

  it('깨진 줄은 건너뛰되 나머지는 읽는다', () => {
    const t = parseTranscript(['{깨진 줄', humanLine('멀쩡한 말이야 정말로', '2026-08-17T00:00:00Z')].join('\n'));
    expect(t).toHaveLength(1);
  });

  it('시각이 없으면 읽지 않는다 — 언제인지 모르는 문장은 기록이 될 수 없다', () => {
    const noTime = JSON.stringify({ type: 'user', origin: { kind: 'human' }, message: { content: '언제인지 모름' } });
    expect(parseTranscript(noTime)).toHaveLength(0);
  });
});

describe('문장 쪼개기 — 말이 아닌 것은 걸러낸다', () => {
  it('UI 라벨·표·목록·코드는 문장이 아니다', () => {
    expect(splitSentences('틀렸다는 건 [직접 쓰기] 눌러주세요')).toHaveLength(0);
    expect(splitSentences('| 항목 | 값 |')).toHaveLength(0);
    expect(splitSentences('- 목록 항목입니다 그렇습니다')).toHaveLength(0);
    expect(splitSentences('const x = { a: 1 };')).toHaveLength(0);
  });

  it('너무 짧거나 너무 긴 것은 버린다', () => {
    expect(splitSentences('짧다')).toHaveLength(0);
    expect(splitSentences('가'.repeat(300))).toHaveLength(0);
  });

  it('평범한 한국어 문장은 남는다', () => {
    expect(splitSentences('나는 지금 가격을 올릴 때라고 생각해.')).toHaveLength(1);
  });
});

describe('후보 뽑기 — 지어내지 않고, 사람 말을 앞세운다', () => {
  it('심부름 문장은 결정이 아니므로 뽑지 않는다', () => {
    const t = parseTranscript(humanLine('PR 머지해줘 그리고 테스트 돌려줘', '2026-08-17T00:00:00Z'));
    const r = extractCandidates(t);
    const all = Object.values(r.byAxis).flat();
    expect(all).toHaveLength(0);
  });

  it('못 찾은 칸은 빈 배열이고, 빈 칸 목록에 들어간다', () => {
    const t = parseTranscript(humanLine('오늘 날씨가 참 좋은 것 같은 하루네', '2026-08-17T00:00:00Z'));
    const r = extractCandidates(t);
    expect(r.emptyAxes).toContain('falsifier');
    expect(r.byAxis.falsifier).toEqual([]);
  });

  it('문장을 글자 그대로 가져온다 — 다듬지 않는다', () => {
    const said = '나는 지금 가격을 올릴 때라고 생각해';
    const t = parseTranscript(humanLine(said, '2026-08-17T00:00:00Z'));
    const r = extractCandidates(t);
    expect(Object.values(r.byAxis).flat().some((c) => c.text === said)).toBe(true);
  });

  it('사람 말이 AI 말보다 먼저 온다', () => {
    const t = parseTranscript(
      [
        aiLine('이건 전제라고 볼 수 있습니다 아마도 그렇습니다', '2026-08-17T00:00:00Z', 'a1'),
        humanLine('나는 이게 전제라고 생각해 정말로', '2026-08-17T00:01:00Z', 'u1'),
      ].join('\n'),
    );
    const r = extractCandidates(t, { perAxis: 1 });
    expect(r.byAxis.premises[0].who).toBe('user');
  });

  it('사람 턴이라도 앞서 AI가 한 말이면 인용으로 표시한다', () => {
    const sentence = '이건 전제라고 볼 수 있는 문장입니다';
    const t = parseTranscript(
      [
        aiLine(sentence, '2026-08-17T00:00:00Z', 'a1'),
        humanLine(sentence, '2026-08-17T00:01:00Z', 'u1'),
      ].join('\n'),
    );
    const r = extractCandidates(t, { perAxis: 5 });
    const quoted = r.byAxis.premises.find((c) => c.who === 'user');
    expect(quoted?.quoted_from_ai).toBe('yes');
  });

  it('AI 턴이 함께 있을 때, 사람이 처음 한 말은 인용이 아니다', () => {
    const t = parseTranscript(
      [
        aiLine('전혀 다른 이야기를 하고 있습니다 그렇습니다', '2026-08-17T00:00:00Z', 'a1'),
        humanLine('나는 이게 전제라고 생각해 정말로', '2026-08-17T00:01:00Z', 'u1'),
      ].join('\n'),
    );
    const r = extractCandidates(t);
    expect(r.aiComparisonPossible).toBe(true);
    expect(r.byAxis.premises.find((c) => c.who === 'user')?.quoted_from_ai).toBe('no');
  });

  it('AI 턴이 하나도 없으면 대조 불가이므로 unknown 이다 — no 로 적지 않는다', () => {
    const t = parseTranscript(humanLine('나는 이게 전제라고 생각해 정말로', '2026-08-17T00:00:00Z'));
    const r = extractCandidates(t);
    expect(r.aiComparisonPossible).toBe(false);
    expect(r.byAxis.premises[0].quoted_from_ai).toBe('unknown');
  });

  it('isAiWorded 는 unknown 을 AI 발원으로 몰지 않는다', () => {
    const t = parseTranscript(humanLine('나는 이게 전제라고 생각해 정말로', '2026-08-17T00:00:00Z'));
    const c = extractCandidates(t).byAxis.premises[0];
    expect(c.quoted_from_ai).toBe('unknown');
    expect(isAiWorded(c)).toBe(false);
    expect(authorLine(c)).toContain('확인 못 함');
  });

  it('같은 문장이 여러 번 나와도 후보는 하나다', () => {
    const said = '나는 이게 전제라고 생각해 정말로';
    const t = parseTranscript(
      [humanLine(said, '2026-08-17T00:00:00Z', 'u1'), humanLine(said, '2026-08-17T00:02:00Z', 'u2')].join('\n'),
    );
    const r = extractCandidates(t, { perAxis: 5 });
    expect(r.byAxis.premises.filter((c) => c.text === said)).toHaveLength(1);
  });

  it('왜 걸렸는지를 항상 함께 준다 — 납득하거나 반박할 수 있게', () => {
    const t = parseTranscript(humanLine('나는 이게 전제라고 생각해 정말로', '2026-08-17T00:00:00Z'));
    for (const c of Object.values(extractCandidates(t).byAxis).flat()) {
      expect(c.why.length).toBeGreaterThan(0);
      expect(c.turn_id.length).toBeGreaterThan(0);
      expect(c.at.length).toBeGreaterThan(0);
    }
  });

  it('같은 로그는 같은 후보를 낸다 (결정론)', () => {
    const log = [
      humanLine('나는 지금 올릴 때라고 생각해 정말로', '2026-08-17T00:00:00Z', 'u1'),
      aiLine('그렇게 보면 이렇게 됩니다 따라서 그렇습니다', '2026-08-17T00:01:00Z', 'a1'),
    ].join('\n');
    const a = extractCandidates(parseTranscript(log));
    const b = extractCandidates(parseTranscript(log));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('아무것도 못 찾으면 지어내지 말라고 말한다', () => {
    const r = extractCandidates(parseTranscript(humanLine('음 그렇구나 알겠어 고마워', '2026-08-17T00:00:00Z')));
    expect(extractionSummary(r).join(' ')).toContain('지어내지는 않습니다');
  });
});
