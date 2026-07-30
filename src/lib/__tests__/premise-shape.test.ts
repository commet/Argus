import { describe, expect, it } from 'vitest';
import { isQuestionShaped, premiseShapeOf } from '../premise-shape';
import { buildAutoTrackedPremiseItems } from '../auto-track-premises';
import type { ProgressiveSession } from '@/stores/types';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 전제 자리에 물음이 앉지 않는다 (2026-07-29 신설).
 *
 * 창업자 관찰: "중간 과정에서 전제가 물음표로 뜨는 경우를 종종 봤다 — 웹앱,
 * 플러그인, MCP 모두. 전제인데 의문형인 건 좀 이상하잖아."
 *
 * 맞다. 확인일에 "이 전제가 맞았나요?"라고 물었는데 그 자리에 "이 일정이
 * 현실적으로 가능한가요?"가 들어 있으면 답할 수가 없다. 물음에는 참/거짓이 없다.
 *
 * 자료 구조는 처음부터 `premise` 와 `open_question` 을 구분해 왔는데, **만드는
 * 쪽이 그 구분을 안 썼다** — 웹 자동 추적이 나오는 문장을 전부 premise 로 못 박았다.
 * 그래서 버리는 게 아니라 **옮긴다.**
 *
 * 이 가드가 빨간불이 되는 조건:
 *   · 물음이 다시 premise 로 저장되는 것
 *   · 멀쩡한 서술 전제가 질문으로 잘못 옮겨지는 것 (조용한 손실 — 이쪽도 본다)
 */

describe('물음으로 판정하는 것', () => {
  it.each([
    '이 일정이 현실적으로 가능한가요?',
    '지금 인원으로 버틸 수 있을까?',
    '경쟁사가 같은 분기에 가격을 내릴까요',
    'Is the timeline realistic?',
    '팀 온도 파악을 이틀 만에 끝내는 게 맞습니까?',
    // 물음표 없는 격식 의문형 — 낱자모 `ㅂ니까` 규칙은 조합형 텍스트에 맞을 수
    // 없어서 이게 전제로 저장되고 있었다 (2026-07-30 실측, 죽은 규칙).
    '이게 사실입니까',
    '내년에도 이 인원으로 됩니까',
  ])('%s', (t) => {
    expect(isQuestionShaped(t)).toBe(true);
    expect(premiseShapeOf(t)).toBe('open_question');
  });

  it('앞이 길게 서술이어도 끝이 물음이면 물음이다', () => {
    // LLM 이 실제로 쓰는 꼴 — 지적을 길게 쓰고 마지막에 묻는다.
    const t = '\'다음 단계\' 섹션에서 Day 3에 개발자 면담과 동시에 충돌 정의를 확정하라고 되어 있어요. '
      + '팀 온도 파악을 이틀 만에 끝내는 건 너무 촉박합니다. 이게 현실적으로 가능한 타임라인이에요?';
    expect(isQuestionShaped(t)).toBe(true);
  });
});

describe('전제로 남겨야 하는 것 (조용한 손실 방지)', () => {
  it.each([
    '다음 분기 매출이 지금 수준을 유지한다.',
    '경쟁사가 같은 분기에 가격을 내리지 않는다고 가정하고 있어요.',
    // '~인지/~할지'는 서술문 한가운데서 흔하다. 여기 걸리면 멀쩡한 전제가 사라진다.
    '지금 팀이 못 하는 일이 사람 부족 때문인지 확인해야 한다.',
    '계약직 전환을 할지 말지는 다음 달 안에 정한다.',
    'Week-two retention is measured on a cohort large enough to be meaningful.',
    '투자 목적은 시세차익 실현이며, 실거주 계획 없음',
    // `~(으)니까`는 이유이지 물음이 아니다 — 플러그인 사본이 `니까`로 깨져
    // 이런 문장을 질문으로 강등시키고 있었다 (2026-07-30 실측 드리프트).
    '지금은 예산이 없으니까.',
    '어차피 서두를 이유가 없으니까!',
  ])('%s', (t) => {
    expect(isQuestionShaped(t)).toBe(false);
    expect(premiseShapeOf(t)).toBe('premise');
  });

  it('빈 문자열은 물음이 아니다', () => {
    expect(isQuestionShaped('')).toBe(false);
    expect(isQuestionShaped(null)).toBe(false);
    expect(isQuestionShaped(undefined)).toBe(false);
  });
});

describe('플러그인 사본이 같은 규칙을 쓴다', () => {
  // 웹·MCP 는 파일이 바이트까지 같은지 대조한다(premises-core-drift). 플러그인은
  // 언어가 달라(JS) 그렇게 못 하므로 **같은 문장을 넣어 같은 답이 나오는지** 본다.
  // 이 대조가 없으면 셋 중 하나만 고쳐지는 날이 오고, 같은 결정이 표면마다 다른
  // 모양으로 남는다 — 이 리포가 이미 여러 번 겪은 결함의 모양이다.
  const pluginIsQuestionShaped = (() => {
    const src = readFileSync(join(process.cwd(), 'argus-plugin-v2/scripts/decision-ledger.js'), 'utf8');
    const consts = src.match(/const TRAILING_QUESTION_MARK[\s\S]*?\n}\n/);
    if (!consts) throw new Error('플러그인에서 판별기를 못 찾았다 — 이름이 바뀌었거나 사라졌다');
    return new Function(`${consts[0]}; return isQuestionShaped;`)() as (t: string) => boolean;
  })();

  const SAME = [
    '이 일정이 현실적으로 가능한가요?',
    '지금 인원으로 버틸 수 있을까',
    'Is the timeline realistic?',
    '다음 분기 매출이 지금 수준을 유지한다.',
    '계약직 전환을 할지 말지는 다음 달 안에 정한다.',
    '긴 지적을 씁니다. 그런데 이게 현실적으로 가능한가요?',
    '지금 팀이 못 하는 일이 사람 부족 때문인지 확인해야 한다.',
    // 아래 두 샘플이 없으면 이 대조는 아무것도 못 잡는다 (2026-07-30 실측):
    // 플러그인 정규식이 `니까`/`다까`로 깨져 있었는데 위 샘플들로는 전부
    // 같은 답이 나와 초록이었다. 드리프트를 가르는 문장이어야 대조다.
    '지금은 예산이 없으니까.', // 이유 종결 — 질문 아님 (깨진 `니까`는 질문이라 함)
    '이게 사실입니까',          // 격식 의문 — 질문 (죽은 `ㅂ니까`는 못 잡음)
  ];

  it.each(SAME)('웹과 플러그인이 같은 답을 낸다: %s', (t) => {
    expect(pluginIsQuestionShaped(t)).toBe(isQuestionShaped(t));
  });
});

describe('자동 추적이 물음을 전제로 저장하지 않는다', () => {
  const session = (assumptions: string[]): ProgressiveSession => ({
    id: 's1', project_id: 'p1',
    mix: { title: 't', executive_summary: 'e', sections: [], key_assumptions: assumptions, next_steps: [] },
  } as unknown as ProgressiveSession);

  it('물음표로 끝나는 가정은 open_question 으로 간다 (버리지 않는다)', () => {
    const items = buildAutoTrackedPremiseItems('d1', session(['이 일정이 현실적으로 가능한가요?']), Date.now());
    expect(items, '버리면 사용자가 남긴 물음이 사라진다 — 옮기는 게 맞다').toHaveLength(1);
    expect(items[0].type).toBe('open_question');
  });

  it('서술 가정은 그대로 premise 다', () => {
    const items = buildAutoTrackedPremiseItems('d1', session(['다음 분기 매출이 지금 수준을 유지한다.']), Date.now());
    expect(items[0].type).toBe('premise');
  });

  it('섞여 있으면 각각 제자리로 간다', () => {
    const items = buildAutoTrackedPremiseItems('d1', session([
      '다음 분기 매출이 지금 수준을 유지한다.',
      '이 일정이 현실적으로 가능한가요?',
      '온보딩 기간은 3~6개월로 잡는다.',
    ]), Date.now());
    expect(items.map((i) => i.type)).toEqual(['premise', 'open_question', 'premise']);
  });

  it('분석이 화면에 보여준 가정(hidden_assumptions)도 풀에 들어간다', () => {
    // 2026-07-30까지 여기서 버려졌다 — 화면은 "확인할 가정 3개"라고 말해놓고
    // 추적 목록에는 안 넣는, 말과 행동이 갈라진 상태였다 (기획 1단계).
    const s = {
      id: 's1', project_id: 'p1',
      snapshots: [{ hidden_assumptions: ['핵심 인력 이탈은 이번 분기에 없다.'] }],
    } as unknown as ProgressiveSession;
    const items = buildAutoTrackedPremiseItems('d1', s, Date.now());
    expect(items.map((i) => i.text)).toContain('핵심 인력 이탈은 이번 분기에 없다.');
  });

  it('사용자가 자기 말로 적은 베팅(real_bet)이 기계 가정보다 먼저 산다', () => {
    // 캡(5)에 잘릴 때 사람 문장이 살아남는 순서 보장.
    const s = {
      id: 's1', project_id: 'p1',
      falsification: { real_bet: '다음 분기 매출이 지금 수준을 유지한다.' },
      mix: { title: 't', executive_summary: 'e', sections: [], key_assumptions: ['a1 가정 문장.', 'a2 가정 문장.', 'a3 가정 문장.', 'a4 가정 문장.', 'a5 가정 문장.'], next_steps: [] },
    } as unknown as ProgressiveSession;
    const items = buildAutoTrackedPremiseItems('d1', s, Date.now());
    expect(items).toHaveLength(5);
    expect(items[0].text).toBe('다음 분기 매출이 지금 수준을 유지한다.');
  });

  it('표기만 다른 같은 주장은 하나만 저장된다 (같은 웹 조사를 두 번 안 한다)', () => {
    const s = {
      id: 's1', project_id: 'p1',
      mix: { title: 't', executive_summary: 'e', sections: [], key_assumptions: ['다음 분기 매출이 지금 수준을 유지한다.'], next_steps: [] },
      snapshots: [{ hidden_assumptions: ['다음 분기 매출은 확정 계약 기준으로 현재와 유사한 수준을 유지한다.'] }],
    } as unknown as ProgressiveSession;
    const items = buildAutoTrackedPremiseItems('d1', s, Date.now());
    expect(items.map((i) => i.text)).toEqual(['다음 분기 매출이 지금 수준을 유지한다.']);
  });

  it('봉인 화면에서 ×로 뺀 문장은 저장되지 않는다 (deny → 저장 안 함)', () => {
    // 2026-07-30 발견: 이 배선이 없어서, 사용자가 봉인 카드에서 뺀 전제가
    // 추적 목록에 그대로 active 로 저장됐다. 사람이 아니라고 말한 것을
    // 시스템이 계속 믿고 있었다.
    const items = buildAutoTrackedPremiseItems('d1', session([
      '다음 분기 매출이 지금 수준을 유지한다.',
      '온보딩 기간은 3~6개월로 잡는다.',
    ]), Date.now(), { excludeTexts: ['다음 분기 매출이 지금 수준을 유지한다.'] });
    expect(items.map((i) => i.text)).toEqual(['온보딩 기간은 3~6개월로 잡는다.']);
  });

  it('표기만 다르게 뺀 것도 빠진다 (deny 가 조사 차이로 살아남지 않는다)', () => {
    const items = buildAutoTrackedPremiseItems('d1', session([
      '다음 분기 매출은 확정 계약 기준으로 현재와 유사한 수준을 유지한다.',
      '온보딩 기간은 3~6개월로 잡는다.',
    ]), Date.now(), { excludeTexts: ['다음 분기 매출이 지금 수준을 유지한다.'] });
    expect(items.map((i) => i.text)).toEqual(['온보딩 기간은 3~6개월로 잡는다.']);
  });

  it('id 는 type 을 포함하므로 옮겨진 항목이 전제와 충돌하지 않는다', () => {
    // stableItemId 가 type 을 키에 넣는다. 안 그러면 같은 문장의 전제/질문이
    // 같은 행을 덮어써 하나가 조용히 사라진다.
    const items = buildAutoTrackedPremiseItems('d1', session([
      '이 일정이 현실적으로 가능한가요?',
      '온보딩 기간은 3~6개월로 잡는다.',
    ]), Date.now());
    expect(new Set(items.map((i) => i.id)).size).toBe(2);
  });
});
