/**
 * 공정 3 exit — 해석 어휘 validator (BLUEPRINT §4.1 금지 목록).
 *
 * 알림 문안에 권고/평결/재촉/re-engagement 표현이 들어가면 테스트가 실패한다.
 * 검사는 단일 소스(notification-copy.ts)이며 여기서 네 알림 유형의 순수 빌더
 * 출력 전체에 적용된다 — 문안을 고치면 이 테스트가 자동으로 새 문안을 검사한다.
 * (T3는 단독 문안이 없다: T5 브리프의 섹션으로만 실리므로 T5 검사가 커버.)
 */

import { describe, expect, it } from 'vitest';
import { findForbiddenNotificationVocabulary } from '../notification-copy';
import { buildReturnEmail } from '../return-email';
import { buildFirstSettlementEmail } from '../first-settlement';
import { buildCompanionBrief, buildPremiseDriftEmail } from '../companion-brief';

function expectClean(name: string, text: string) {
  expect(findForbiddenNotificationVocabulary(text), `${name} 문안에 §4.1 금지 어휘`).toEqual([]);
}

describe('해석 어휘 validator — 알림 문안 전수', () => {
  it('T1 귀환 이메일 (ko/en)이 깨끗하다', () => {
    for (const locale of ['ko', 'en'] as const) {
      const draft = buildReturnEmail(
        { id: 'd1', decision: '이번 분기엔 조달하지 않는다', predicate: '기준금리가 3.5%를 유지한다', check_by: '2026-08-01' },
        'https://argus.voyage',
        locale,
      );
      expectClean(`T1(${locale})`, `${draft.subject}\n${draft.body}`);
    }
  });

  it('T2 전제 드리프트 이메일이 수치/사실 두 변형 모두 깨끗하다', () => {
    const base = {
      decision_title: '조달 시점 판단',
      receipt_id: 'r1',
      baseUrl: 'https://argus.voyage',
    };
    const numeric = buildPremiseDriftEmail({
      ...base,
      change: {
        ordinal: 2, premise_id: 'p1', text: '기준금리가 3.5% 근처에 머문다',
        baseline_numeric_value: 3.5, fact: '기준금리 4.0%', current_value: 4,
        source_url: 'https://bok.example/current', source_date: '2026-07-07',
        checked_at: '2026-07-07T09:00:00.000Z', confidence: 'high',
      },
    });
    const fact = buildPremiseDriftEmail({
      ...base,
      change: {
        ordinal: 1, premise_id: 'p2', text: '경쟁사는 아직 공개 출시하지 않았다',
        baseline: '경쟁사 미출시', fact: '경쟁사가 공개 출시를 발표',
        source_url: 'https://competitor.example/launch', source_date: '2026-07-07',
        confidence: 'medium',
      },
    });
    expectClean('T2(수치)', `${numeric.subject}\n${numeric.markdown}`);
    expectClean('T2(사실)', `${fact.subject}\n${fact.markdown}`);
  });

  it('T4 1차 정산 초대 (ko/en)가 깨끗하다', () => {
    for (const locale of ['ko', 'en'] as const) {
      const email = buildFirstSettlementEmail({
        anchor: '이번 분기엔 조달하지 않는다',
        projectId: 'proj1',
        baseUrl: 'https://argus.voyage',
        locale,
      });
      expectClean(`T4(${locale})`, `${email.subject}\n${email.html}`);
    }
  });

  it('T5 주간 브리프가 전 섹션(예측·변화·미결·재확인·delta) 포함 상태로 깨끗하다', () => {
    const brief = buildCompanionBrief([
      {
        source_title: '조달 시점 판단',
        core_question: '지금 조달할까?',
        predicates: [{
          predicate: '기준금리가 3.5%를 유지한다',
          pass_condition: '한국은행 기준금리 ≤ 3.5%',
          fail_condition: '기준금리 > 3.5%',
          check_by: '2026-08-01',
        }],
        changes: [{
          ordinal: 2, premise_id: 'p1', text: '기준금리가 3.5% 근처에 머문다',
          baseline_numeric_value: 3.5, fact: '기준금리 3.51%', current_value: 3.51,
          source_url: 'https://bok.example/current', source_date: '2026-07-07', confidence: 'high',
        }],
        open_questions: [{ ordinal: 3, text: '내년 규제 완화 여부' }],
        premise_nudges: [{ ordinal: 4, text: '핵심 고객사가 계약을 유지한다', last_finding: '계약 유지 중' }],
        delta: '문서가 v2로 갱신됨',
      },
    ]);
    expectClean('T5', `${brief.subject}\n${brief.markdown}`);
  });

  it('금지 어휘가 실제로 걸린다 — validator 자체의 자기 검증', () => {
    expect(findForbiddenNotificationVocabulary('이 결정은 재검토를 권해요.')).toHaveLength(1);
    expect(findForbiddenNotificationVocabulary('벌써 7일 지났어요! 놓치지 마세요.')).not.toEqual([]);
    expect(findForbiddenNotificationVocabulary('당신의 판단 점수가 올랐어요.')).not.toEqual([]);
    expect(findForbiddenNotificationVocabulary('보고 싶어요 — 다시 와주세요.')).not.toEqual([]);
    expect(findForbiddenNotificationVocabulary('We recommend revisiting this decision.')).not.toEqual([]);
    expect(findForbiddenNotificationVocabulary("Don't miss your streak!")).not.toEqual([]);
    // 정직한 부정형 disclaimer는 통과한다 (문안의 스파인 문장들).
    expect(findForbiddenNotificationVocabulary('맞았는지 틀렸는지는 제가 정하지 않아요.')).toEqual([]);
    expect(findForbiddenNotificationVocabulary('결과를 채점하는 게 아니에요.')).toEqual([]);
    expect(findForbiddenNotificationVocabulary('AI VERDICT ── NONE')).toEqual([]);
  });
});
