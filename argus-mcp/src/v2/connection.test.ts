/**
 * 연결 읽기 테스트 (정본 §8-§11) — 기계식 공유-전제 연결의 수용 기준.
 *  - 같은 말(정규화 일치) + 상대가 열린 결정일 때만 연결.
 *  - 자기 자신·닫힌 결정·resolved 전제·fact/question은 제외 (오연결 0).
 *  - 임베딩 없음 — 순수 텍스트 매칭. 평결 아님: 사실 + 손잡이만.
 */
import { describe, expect, it } from 'vitest';
import type { DecisionRecord, LedgerState, PremiseRecord } from './reducer.js';
import { emptyState } from './reducer.js';
import { decisionsSharingPremise, extractTargets, normalizePremiseText, relatedOpenDecisions } from './connection.js';

function decision(id: string, state: DecisionRecord['state']): DecisionRecord {
  return { id, state, snooze_count: 0 };
}
function premise(id: string, decision_id: string, text: string, over: Partial<PremiseRecord> = {}): PremiseRecord {
  return { id, decision_id, kind: 'premise', text: { value: text, provenance: 'user_stated' }, load_bearing: true, resolved: false, ...over };
}
function stateOf(decisions: DecisionRecord[], premises: PremiseRecord[]): LedgerState {
  const s = emptyState();
  for (const d of decisions) s.decisions.set(d.id, d);
  for (const p of premises) s.premises.set(p.id, p);
  return s;
}

describe('normalizePremiseText — 같은 말 판정', () => {
  it('공백·대소문자·양끝 구두점을 접어 같은 문장으로 본다', () => {
    expect(normalizePremiseText('  TTL is UTC-based.  ')).toBe('ttl is utc-based');
    expect(normalizePremiseText('"TTL   is UTC-based"')).toBe('ttl is utc-based');
    expect(normalizePremiseText('TTL is UTC-based')).toBe(normalizePremiseText('  ttl is utc-based!  '));
  });
  it('빈 문자열/공백만은 빈 키', () => {
    expect(normalizePremiseText('   ')).toBe('');
    expect(normalizePremiseText('')).toBe('');
  });
});

describe('decisionsSharingPremise — 깨진 전제와 같은 전제에 선 열린 결정', () => {
  const broken = 'write volume stays under 200/sec';

  it('같은 전제를 봉인한 다른 열린 결정을 찾는다 (자기 자신 제외)', () => {
    const s = stateOf(
      [decision('events-db', 'settled'), decision('cache-ttl', 'sealed'), decision('rate-limit', 'sealed')],
      [
        premise('p-self', 'events-db', broken),
        premise('p-a', 'cache-ttl', 'Write Volume stays under 200/sec.'), // 같은 말, 표기만 다름
        premise('p-b', 'rate-limit', broken),
      ],
    );
    const links = decisionsSharingPremise(s, broken, 'events-db');
    expect(links.map((l) => l.decision_id)).toEqual(['cache-ttl', 'rate-limit']); // id 오름차순, 자기 제외
    expect(links[0]!.premise_text).toBe('Write Volume stays under 200/sec.'); // 상대 원문 보존
  });

  it('닫힌 결정(settled/dismissed/harvested)은 되살리지 않는다', () => {
    const s = stateOf(
      [decision('a', 'settled'), decision('b', 'dismissed'), decision('c', 'harvested'), decision('d', 'sealed')],
      [
        premise('pa', 'a', broken), premise('pb', 'b', broken),
        premise('pc', 'c', broken), premise('pd', 'd', broken),
      ],
    );
    expect(decisionsSharingPremise(s, broken, 'z').map((l) => l.decision_id)).toEqual(['d']);
  });

  it('resolved 전제와 fact/question kind는 제외 (살아있는 가정만)', () => {
    const s = stateOf(
      [decision('a', 'sealed'), decision('b', 'sealed'), decision('c', 'sealed')],
      [
        premise('pa', 'a', broken, { resolved: true }),
        premise('pb', 'b', broken, { kind: 'fact' }),
        premise('pc', 'c', broken),
      ],
    );
    expect(decisionsSharingPremise(s, broken, 'z').map((l) => l.decision_id)).toEqual(['c']);
  });

  it('다른 말은 연결하지 않는다 (의미 유사도 금지 — 표면적 같은 말만)', () => {
    const s = stateOf(
      [decision('a', 'sealed')],
      [premise('pa', 'a', 'traffic grows past 200/sec')], // 뜻은 비슷해도 다른 문장
    );
    expect(decisionsSharingPremise(s, broken, 'z')).toEqual([]);
  });

  it('한 결정에 같은 전제가 둘이어도 한 줄, 빈 깨진-전제 텍스트는 빈 결과', () => {
    const s = stateOf(
      [decision('a', 'sealed')],
      [premise('pa1', 'a', broken), premise('pa2', 'a', '  write volume stays under 200/sec  ')],
    );
    expect(decisionsSharingPremise(s, broken, 'z')).toHaveLength(1);
    expect(decisionsSharingPremise(s, '   ', 'z')).toEqual([]);
  });
});

describe('extractTargets — 위조 불가능한 근거만 (§9 1층·§10)', () => {
  it('URL을 정규화해 뽑는다 (호스트 소문자·fragment·끝슬래시 제거)', () => {
    expect(extractTargets('see https://Partner.com/pricing/#plans for the deal.')).toEqual(['url:https://partner.com/pricing']);
    expect(extractTargets('http://x.io/a and http://x.io/a/')).toEqual(['url:http://x.io/a']);
  });
  it('ISO 날짜를 뽑는다', () => {
    expect(extractTargets('free until 2026-12-31 per contract')).toEqual(['date:2026-12-31']);
  });
  it('맨숫자·금액·상대월은 뽑지 않는다 (오연결 함정 — P3로 유보)', () => {
    expect(extractTargets('write volume under 200/sec, budget $5000, ship by 12월')).toEqual([]);
  });
});

describe('relatedOpenDecisions — 같은 근거(shared_fact)로도 잇는다', () => {
  const dealUrl = 'the deal at https://partner.com/pricing runs out';
  it('표면 문장이 달라도 같은 URL을 가리키면 shared_fact로 잇는다', () => {
    const s = stateOf(
      [decision('launch', 'settled'), decision('cost-plan', 'sealed')],
      [
        premise('p1', 'launch', dealUrl),
        premise('p2', 'cost-plan', 'our margin depends on https://partner.com/pricing staying free'),
      ],
    );
    const r = relatedOpenDecisions(s, dealUrl, 'launch');
    expect(r).toHaveLength(1);
    expect(r[0]!.decision_id).toBe('cost-plan');
    expect(r[0]!.reason).toBe('shared_fact');
    expect(r[0]!.via).toBe('url:https://partner.com/pricing');
  });
  it('같은 전제(문장)면 same_premise가 shared_fact보다 우선', () => {
    const s = stateOf(
      [decision('a', 'sealed')],
      [premise('p1', 'a', dealUrl)], // 깨진 것과 같은 문장 + 같은 URL 둘 다 성립
    );
    expect(relatedOpenDecisions(s, dealUrl, 'z')[0]!.reason).toBe('same_premise');
  });
  it('깨진 전제에 근거 토큰이 없으면 shared_fact는 발동하지 않는다 (same_premise만)', () => {
    const s = stateOf(
      [decision('a', 'sealed')],
      [premise('p1', 'a', 'depends on https://partner.com/pricing')],
    );
    expect(relatedOpenDecisions(s, 'write volume under 200/sec', 'z')).toEqual([]);
  });
});
