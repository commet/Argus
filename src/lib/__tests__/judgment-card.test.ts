import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildJudgmentCard, readAuthorship, CARD_STRINGS } from '../judgment-card';
import type { DecisionContract, Predicate } from '@/stores/types';

/**
 * 판단 카드가 **지어내지 못하게** 막는 가드 (2026-07-29 신설).
 *
 * 왜 이 파일이 필요한가: 공유 이미지는 서명 없이 남의 손에 들어간다. 카드에 AI가
 * 쓴 문장이 사용자 문장처럼 찍히면, 그 거짓말은 이 앱 밖에서 정정될 방법이 없다.
 * 그리고 LLM 파이프라인의 결함은 크래시가 아니라 **그럴듯한 결과물**로 나타나므로
 * (CLAUDE.md — LLM-glue invariant), 눈으로 봐서는 잘못된 카드와 옳은 카드가
 * 구별되지 않는다. 그래서 기계가 대신 본다.
 *
 * 이 가드가 빨간불이 되는 조건:
 *   · 봉인 문장이 없는데 카드가 만들어질 때 (= 무언가로 대신 채웠다는 뜻)
 *   · 출처가 불명인데 사용자 것으로 표시될 때
 *   · 렌더 경로에 네트워크/LLM 호출이 생길 때
 */

const BASE: DecisionContract = {
  id: 'c1',
  project_id: 'p1',
  predicates: [],
  created_at: '2026-07-29T04:00:00.000Z',
  sealed_statement: '다음 분기 매출이 지금 수준을 유지한다.',
  check_in_at: '2026-10-27T00:00:00.000Z',
};

function bet(over: Partial<Predicate>): Predicate {
  return { id: 'b1', text: '베팅', source: 'governing_idea', ...over } as Predicate;
}

describe('카드는 없는 것을 채우지 않는다', () => {
  it('봉인 문장이 없으면 카드를 만들지 않는다 (null)', () => {
    expect(buildJudgmentCard({ ...BASE, sealed_statement: undefined }, '채용 결정')).toBeNull();
  });

  it('봉인 문장이 공백뿐이어도 만들지 않는다', () => {
    expect(buildJudgmentCard({ ...BASE, sealed_statement: '   ' }, '채용 결정')).toBeNull();
  });

  it('계약 자체가 없으면 만들지 않는다', () => {
    expect(buildJudgmentCard(null, '채용 결정')).toBeNull();
    expect(buildJudgmentCard(undefined, '채용 결정')).toBeNull();
  });

  it('프로젝트 이름이 봉인 문장을 대신하지 못한다', () => {
    // 이게 제일 유혹적인 지름길이다 — 이름은 늘 있으니 카드가 늘 만들어진다.
    // 그러나 그 카드는 "내가 판단한 문장"이 아니라 "제목"을 판단인 척 유통시킨다.
    const card = buildJudgmentCard({ ...BASE, sealed_statement: '' }, '다음 분기 채용을 미룬다');
    expect(card).toBeNull();
  });

  it('확인일이 없으면 날짜를 지어내지 않고 "정하지 않았다"로 남긴다', () => {
    const card = buildJudgmentCard({ ...BASE, check_in_at: undefined }, '채용 결정');
    expect(card?.checkOn).toBeNull();
  });

  it('상황 줄이 봉인 문장과 같으면 두 번 찍지 않는다', () => {
    const card = buildJudgmentCard({ ...BASE, origin_utterance: BASE.sealed_statement }, '채용 결정');
    expect(card?.context).toBeNull();
  });
});

describe('출처는 흐려지지 않는다', () => {
  it('기록이 아예 없으면 unknown — 사람 것으로 승격하지 않는다', () => {
    expect(readAuthorship([])).toBe('unknown');
    expect(readAuthorship(undefined)).toBe('unknown');
  });

  it('legacy_unknown 은 unknown 이다 (옛 기록을 사람 것으로 읽지 않는다)', () => {
    expect(readAuthorship([bet({
      attribution: { wording_source: 'legacy_unknown', authority: 'legacy_unknown', surface: 'web', recorded_at: '2026-01-01T00:00:00.000Z' },
    })])).toBe('unknown');
  });

  it('AI가 짚은 문장을 그대로 둔 경우 ai_surfaced 로 남는다', () => {
    expect(readAuthorship([bet({ authored: 'ai_surfaced' })])).toBe('ai_surfaced');
    expect(readAuthorship([bet({
      attribution: { wording_source: 'ai_surfaced', authority: 'user_adopted', surface: 'web', recorded_at: '2026-07-29T00:00:00.000Z' },
    })])).toBe('ai_surfaced');
  });

  it('사용자가 직접 쓰거나 자기 말로 고친 경우만 user 다', () => {
    expect(readAuthorship([bet({
      attribution: { wording_source: 'user_direct', authority: 'user_asserted', surface: 'web', recorded_at: '2026-07-29T00:00:00.000Z' },
    })])).toBe('user');
    expect(readAuthorship([bet({
      attribution: { wording_source: 'user_reworded', authority: 'user_asserted', surface: 'web', recorded_at: '2026-07-29T00:00:00.000Z' },
    })])).toBe('user');
  });

  it('봉인 문장과 텍스트가 일치하는 술어의 출처를 읽는다 (옆 술어를 읽지 않는다)', () => {
    // 봉인 문장은 여러 곳에서 올 수 있다. 라벨이 다른 술어의 출처를 읽으면
    // "내가 쓴 문장"이 AI 문장 위에 붙는다 — 이 카드가 절대 하면 안 되는 거짓말.
    const card = buildJudgmentCard({
      ...BASE,
      sealed_statement: 'AI가 짚은 그 문장',
      predicates: [
        bet({ id: 'mine', text: '내가 쓴 다른 문장', authored: 'user' }),
        bet({ id: 'ai', text: 'AI가 짚은 그 문장', source: 'risk', authored: 'ai_surfaced' }),
      ],
    }, '채용 결정');
    expect(card?.authorship).toBe('ai_surfaced');
  });

  it('공백 차이는 같은 문장으로 본다 (줄바꿈 때문에 unknown 으로 떨어지지 않는다)', () => {
    const card = buildJudgmentCard({
      ...BASE,
      sealed_statement: '다음 분기  매출이\n유지된다.',
      predicates: [bet({ text: '다음 분기 매출이 유지된다.', authored: 'user' })],
    }, '채용 결정');
    expect(card?.authorship).toBe('user');
  });

  it('attribution 이 authored 보다 우선한다 (정본이 하나여야 한다)', () => {
    // 옛 호환 비트가 'user' 라도, 필드별 기록이 ai_surfaced 면 ai_surfaced 다.
    expect(readAuthorship([bet({
      authored: 'user',
      attribution: { wording_source: 'ai_surfaced', authority: 'user_adopted', surface: 'web', recorded_at: '2026-07-29T00:00:00.000Z' },
    })])).toBe('ai_surfaced');
  });

  it('세 가지 출처 모두 사람이 읽을 문구를 가진다 (침묵하는 출처가 없다)', () => {
    for (const loc of ['ko', 'en'] as const) {
      expect(CARD_STRINGS[loc].byUser.length).toBeGreaterThan(0);
      expect(CARD_STRINGS[loc].byAi.length).toBeGreaterThan(0);
      expect(CARD_STRINGS[loc].byUnknown.length).toBeGreaterThan(0);
    }
  });
});

describe('정상 경로', () => {
  it('봉인 문장 · 봉인일 · 확인일 · 출처를 그대로 옮긴다', () => {
    const card = buildJudgmentCard({
      ...BASE,
      provenance: { app_version: 'x', prompt_version: 'R34', sealed_at: '2026-07-29T04:00:00.000Z' },
      predicates: [bet({ authored: 'user' })],
      origin_utterance: '다음 분기에 신규 채용을 2명 더 할지 정해야 한다.',
    }, '채용 결정');
    expect(card).toEqual({
      statement: '다음 분기 매출이 지금 수준을 유지한다.',
      sealedOn: '2026-07-29',
      checkOn: '2026-10-27',
      authorship: 'user',
      context: '다음 분기에 신규 채용을 2명 더 할지 정해야 한다.',
    });
  });
});

describe('카드 경로에는 생성이 없다', () => {
  // 카드가 지어내지 않는다는 약속은, 그 경로에 생성기를 부를 수단이 아예 없을 때만
  // 지켜진다. 문구로 다짐하는 대신 파일을 읽어서 확인한다.
  const files = ['judgment-card.ts', 'judgment-card-render.ts'];

  it.each(files)('%s 는 네트워크·LLM 을 호출하지 않는다', (f) => {
    const src = readFileSync(join(process.cwd(), 'src/lib', f), 'utf8');
    const banned = [/\bfetch\s*\(/, /XMLHttpRequest/, /\/api\//, /callLLM/, /supabase/i];
    const hit = banned.filter((re) => re.test(src)).map((re) => re.source);
    expect(
      hit,
      `카드 경로에 외부 호출이 생겼다. 카드는 이미 저장된 필드만 옮겨야 한다 — `
      + `여기서 무언가를 불러오는 순간, 사용자가 확정하지 않은 문장이 카드에 실릴 수 있다: ${hit.join(', ')}`,
    ).toEqual([]);
  });

  it('카드에 점수·등급·평결을 실을 자리가 없다', () => {
    // 필드 목록 자체가 계약이다. 여기 없는 것은 그려질 수 없다.
    const card = buildJudgmentCard({ ...BASE, predicates: [bet({ authored: 'user' })] }, '채용 결정');
    expect(Object.keys(card!).sort()).toEqual(
      ['authorship', 'checkOn', 'context', 'sealedOn', 'statement'],
    );
  });
});
