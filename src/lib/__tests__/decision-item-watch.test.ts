import { describe, expect, it } from 'vitest';
import { dueDecisionItems, applyItemRecheck, buildItemAlertEmail } from '../decision-item-watch';
import { isItemDueForRecheck, createItem, DECISION_ITEM_RECHECK_CADENCE_DAYS, type DecisionItem } from '../decision-items';

/**
 * 본선 전제 → 서버 감시 배선 가드 (2026-07-30 신설).
 *
 * 왜: premise-watch 크론이 review_receipts 만 읽어서, 본선이 봉인 때 저장하는
 * decision_items 는 종을 켜도 push 알림이 영영 안 갔다 — 기획 3단계가 본선에서
 * 반쪽. 이 파일은 그 배선의 순수 부품을 잰다.
 *
 * 빨간불 조건:
 *   · 감시 판정이 UI(isItemDueForRecheck)와 갈라지는 것 — 배지는 떴는데 알림이
 *     안 오거나 그 반대
 *   · 조사 후 시계가 리셋되지 않는 것 — 같은 웹 검색 비용을 매일 낸다
 *   · 못 알아낸 조사(no_recent_source)가 알아냈던 사실(last_value)을 지우는 것
 *   · 이메일에 평결이 끼는 것 — 변화를 가져다 놓을 뿐, 판정은 사용자 몫
 */

const NOW = Date.parse('2026-07-30T04:00:00.000Z');
const DAY = 86_400_000;

function item(over: Partial<DecisionItem> = {}): DecisionItem {
  const base = createItem({
    decision_id: 'd1',
    type: 'premise',
    text: '다음 분기 매출이 지금 수준을 유지한다.',
    source: 'ai',
    external: true,
    load_bearing: false,
    ai_original: '다음 분기 매출이 지금 수준을 유지한다.',
  }, NOW - (DECISION_ITEM_RECHECK_CADENCE_DAYS + 1) * DAY);
  return { ...base, alert: { mode: 'on_change' }, ...over };
}

describe('감시 대상 판정 — UI 와 한 두뇌', () => {
  it('종이 켜진(external+on_change) 오래된 전제는 감시 대상이다', () => {
    const due = dueDecisionItems([item()], NOW);
    expect(due).toHaveLength(1);
    // 기준일 = 생성일 (한 번도 재확인 안 함)
    expect(due[0].baselineYMD).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('판정은 isItemDueForRecheck 그 함수다 — 표본이 갈라지면 실패한다', () => {
    const samples = [
      item(),
      item({ alert: { mode: 'off' } }),
      item({ external: false }),
      item({ status: 'retired' }),
      item({ type: 'open_question' }),
      item({ alert: { mode: 'on_change', last_checked: new Date(NOW - DAY).toISOString() } }),
    ];
    for (const s of samples) {
      const watchSaysDue = dueDecisionItems([s], NOW).length === 1;
      expect(watchSaysDue, `UI due=${isItemDueForRecheck(s, NOW)} 인데 감시 판정이 다르다`).toBe(isItemDueForRecheck(s, NOW));
    }
  });

  it('방금 확인한 전제는 대상이 아니다 (매일 같은 검색을 사지 않는다)', () => {
    const fresh = item({ alert: { mode: 'on_change', last_checked: new Date(NOW - DAY).toISOString() } });
    expect(dueDecisionItems([fresh], NOW)).toHaveLength(0);
  });
});

describe('조사 결과 되새김', () => {
  it('verdict 와 무관하게 시계가 리셋된다', () => {
    for (const verdict of ['material', 'quiet', 'no_recent_source'] as const) {
      const next = applyItemRecheck(item(), { verdict }, new Date(NOW).toISOString());
      expect(next.alert.last_checked).toBe(new Date(NOW).toISOString());
      expect(isItemDueForRecheck(next, NOW), `${verdict} 후에도 due 면 내일 또 조사한다`).toBe(false);
    }
  });

  it('조사된 사실이 last_value 로 남는다 (다음 비교의 기준)', () => {
    const next = applyItemRecheck(item(), { verdict: 'quiet', fact: '확정 계약 기준 매출 전분기 대비 +1%' }, new Date(NOW).toISOString());
    expect(next.alert.last_value).toBe('확정 계약 기준 매출 전분기 대비 +1%');
  });

  it('못 알아낸 조사는 알아냈던 사실을 지우지 않는다', () => {
    const prior = item({ alert: { mode: 'on_change', last_value: '전분기 +1%' } });
    const next = applyItemRecheck(prior, { verdict: 'no_recent_source' }, new Date(NOW).toISOString());
    expect(next.alert.last_value).toBe('전분기 +1%');
  });

  it('종 모드는 건드리지 않는다 (재확인이 설정을 바꾸면 안 된다)', () => {
    const next = applyItemRecheck(item(), { verdict: 'quiet' }, new Date(NOW).toISOString());
    expect(next.alert.mode).toBe('on_change');
  });
});

describe('알림 이메일 — 변화를 가져다 놓을 뿐, 판정하지 않는다', () => {
  const email = buildItemAlertEmail({
    item: item(),
    projectName: '다음 분기 채용 결정',
    result: { verdict: 'material', fact: '확정 계약 기준 매출 전분기 대비 -12%', source_url: 'https://example.com/r', source_date: '2026-07-29' },
    baseUrl: 'https://argus.voyage',
  });

  it('저장된 전제 원문과 조사된 사실이 그대로 실린다', () => {
    expect(email.markdown).toContain('다음 분기 매출이 지금 수준을 유지한다.');
    expect(email.markdown).toContain('확정 계약 기준 매출 전분기 대비 -12%');
    expect(email.markdown).toContain('https://example.com/r');
  });

  it('평결 어휘가 없다 — 판정은 사용자 몫', () => {
    // "깨졌"/"틀렸"/"무너졌" 류가 끼는 순간 mirror 가 아니라 verdict 다.
    expect(email.subject + email.markdown).not.toMatch(/깨졌|틀렸|무너|잘못됐|broke|wrong|failed/i);
    expect(email.markdown).toContain('직접 판단해 주세요');
  });

  it('돌아올 문이 그 결정으로 바로 열린다 (?open= 딥링크, 2026-07-30)', () => {
    // 목록에 떨궈놓으면 어느 결정 얘기였는지 한 단계 더 찾아야 한다 —
    // 알림은 자기가 말하는 그 결정으로 열려야 한다.
    expect(email.url).toBe('https://argus.voyage/ko/project?open=d1');
    expect(email.markdown).toContain('https://argus.voyage/ko/project?open=d1');
  });
});
