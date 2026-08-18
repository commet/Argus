import { describe, it, expect } from 'vitest';
import {
  SOURCES,
  DEFAULT_SOURCE,
  sourceSpec,
  sourceReport,
  turnsFromPluginCandidates,
  turnsFromPastedWriting,
  turnsFromTranscriptFile,
} from '../sources';
import { extractCandidates } from '../extract';

describe('소스 목록 — 마찰이 낮은 것이 먼저다', () => {
  it('클릭 수 오름차순으로 정렬돼 있다', () => {
    const clicks = SOURCES.map((s) => s.clicks);
    expect([...clicks].sort((a, b) => a - b)).toEqual(clicks);
  });

  it('기본값은 목록 첫째이자 0클릭이다 — 화면에 하드코딩하지 않는다', () => {
    expect(DEFAULT_SOURCE).toBe(SOURCES[0].id);
    expect(sourceSpec(DEFAULT_SOURCE).clicks).toBe(0);
  });

  it('파일 직접 고르기는 맨 마지막이다 (최후 수단)', () => {
    expect(SOURCES[SOURCES.length - 1].id).toBe('file');
  });

  it('모든 소스가 비었을 때 할 말을 갖고 있다', () => {
    for (const s of SOURCES) expect(s.whenEmpty.length).toBeGreaterThan(0);
  });

  it('모르는 소스는 조용히 넘어가지 않고 던진다', () => {
    // @ts-expect-error 일부러 잘못된 id
    expect(() => sourceSpec('made_up')).toThrow();
  });
});

describe('플러그인이 가져다 둔 것 → 턴', () => {
  const rows = [
    { id: 'b', quote: '나는 지금 가격을 올릴 때라고 생각해', harvested_at: '2026-08-02T00:00:00Z', status: 'candidate' },
    { id: 'a', quote: '채용은 한 분기 미루기로 했다 정말로', harvested_at: '2026-08-01T00:00:00Z', status: 'candidate' },
  ];

  it('전부 사람 말이다 — 수집기가 사람 턴만 읽으므로 사실이다', () => {
    expect(turnsFromPluginCandidates(rows).every((t) => t.who === 'user')).toBe(true);
  });

  it('시간 오름차순으로 준다 — 추출기가 최근을 더 세기 때문', () => {
    expect(turnsFromPluginCandidates(rows).map((t) => t.id)).toEqual(['plugin:a', 'plugin:b']);
  });

  it('시각 없는 행은 버린다 — 언제인지 모르는 문장은 기록이 될 수 없다', () => {
    expect(turnsFromPluginCandidates([{ id: 'x', quote: '언제인지 모르는 말입니다' }])).toHaveLength(0);
  });

  it('빈 인용은 버린다', () => {
    expect(turnsFromPluginCandidates([{ id: 'x', quote: '  ', harvested_at: '2026-08-01T00:00:00Z' }])).toHaveLength(0);
  });

  it('quote 가 없거나 null 이어도 죽지 않는다', () => {
    expect(turnsFromPluginCandidates([{ id: 'x', quote: null, harvested_at: '2026-08-01T00:00:00Z' }, { id: 'y' }])).toEqual([]);
  });

  it('AI 턴이 없으므로 인용 대조는 unknown 이다 — false 로 적지 않는다', () => {
    const r = extractCandidates(turnsFromPluginCandidates(rows));
    expect(r.aiComparisonPossible).toBe(false);
    for (const c of Object.values(r.byAxis).flat()) expect(c.quoted_from_ai).toBe('unknown');
  });
});

describe('붙여넣기 → 턴', () => {
  it('화자를 추측해 쪼개지 않는다 — 통째로 그 사람 글이다', () => {
    const t = turnsFromPastedWriting('> AI가 말하길\n나는 이게 전제라고 생각해', '2026-08-01T00:00:00Z');
    expect(t).toHaveLength(1);
    expect(t[0].who).toBe('user');
  });

  it('빈 글이나 시각 없음은 턴을 만들지 않는다', () => {
    expect(turnsFromPastedWriting('   ', '2026-08-01T00:00:00Z')).toEqual([]);
    expect(turnsFromPastedWriting('무언가 쓴 글입니다', '')).toEqual([]);
  });
});

describe('세션 파일 → 턴', () => {
  it('사람·AI 턴이 다 와서 인용 대조가 된다', () => {
    const line = (type: string, origin: unknown, text: string, at: string, uuid: string) =>
      JSON.stringify({
        type,
        ...(origin ? { origin } : {}),
        message: { role: type === 'user' ? 'user' : 'assistant', content: type === 'user' ? text : [{ type: 'text', text }] },
        timestamp: at,
        uuid,
      });
    const turns = turnsFromTranscriptFile(
      [
        line('assistant', null, '이건 전제라고 볼 수 있는 문장입니다', '2026-08-01T00:00:00Z', 'a1'),
        line('user', { kind: 'human' }, '나는 이게 전제라고 생각해 정말로', '2026-08-01T00:01:00Z', 'u1'),
      ].join('\n'),
    );
    expect(turns.map((t) => t.who)).toEqual(['ai', 'user']);
    expect(extractCandidates(turns).aiComparisonPossible).toBe(true);
  });
});

describe('정직한 보고 — 0건도 한 줄을 받는다', () => {
  it('빈 결과에 반드시 말이 붙는다', () => {
    for (const s of SOURCES) {
      expect(sourceReport(s.id, []).join(' ').length).toBeGreaterThan(0);
    }
  });

  it('설치가 필요한 소스는 비었을 때 그 방법도 알려준다', () => {
    expect(sourceReport('plugin_auto', []).length).toBe(2);
  });

  it('AI 대조가 불가능한 경로는 그 사실을 말한다', () => {
    const lines = sourceReport('plugin_auto', [
      { who: 'user', text: '한 말', at: '2026-08-01T00:00:00Z', id: 'plugin:a' },
    ]).join(' ');
    expect(lines).toContain('확인할 수 없었습니다');
  });

  it('파일 경로는 대조가 되므로 그 면책을 붙이지 않는다', () => {
    const lines = sourceReport('file', [
      { who: 'user', text: '한 말', at: '2026-08-01T00:00:00Z', id: 'u1' },
      { who: 'ai', text: 'AI 말', at: '2026-08-01T00:01:00Z', id: 'a1' },
    ]).join(' ');
    expect(lines).not.toContain('확인할 수 없었습니다');
  });
});
