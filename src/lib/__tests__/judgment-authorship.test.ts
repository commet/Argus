import { describe, expect, it } from 'vitest';
import { closingJudgmentAuthorship } from '../judgment-authorship';
import { deriveReceiptFields } from '@/components/projects/JudgmentReceipt';

/**
 * 봉인 문장의 저작자 판정 (2026-07-29 신설).
 *
 * 배경: 봉인 화면의 "검토 뒤 내가 확정하는 판단" 칸이 **빈칸**이었고, 비워두면
 * 검토 전 기준점이 그대로 봉인됐다. 빈칸은 채워지지 않으므로 30분 검토가 끝나도
 * 남는 건 시작 전 한 줄이었다 — 실제 기록에 "일단" 두 글자가 봉인된 것이 있다.
 *
 * 고침: 초안 흐름이 이미 만든 한 줄(`decision_read`)을 **연한 초안**으로 미리 넣는다.
 * 빈칸에는 반응할 수 없지만 틀린 문장에는 반응할 수 있다.
 *
 * 그 대가로 새 위험이 생긴다: **기계가 쓴 문장이 사람 판단으로 둔갑하는 것.**
 * 확인일에 "당신이 이렇게 판단했죠"라고 물었는데 그게 AI가 쓴 문장이면, 하지도
 * 않은 판단을 그 사람 이름으로 현실과 맞추는 셈이다. 이 파일이 그걸 막는다.
 *
 * 이 가드가 빨간불이 되는 조건:
 *   · 손대지 않은 초안이 'user' 로 기록되는 것 (세탁 — 더 무거운 쪽)
 *   · 사람이 직접 쓴 문장이 'ai_surfaced' 로 기록되는 것 (반대쪽 거짓말)
 */

const NOW = Date.parse('2026-07-29T04:00:00.000Z');
const DRAFT = '채용 여부보다 먼저, 지금 5명이 번아웃 없이 돌아가고 있는지 확인하세요.';

describe('손대지 않은 AI 초안은 사람 문장이 아니다', () => {
  it('초안 그대로 확정하면 ai_surfaced · user_adopted 로 남는다', () => {
    const a = closingJudgmentAuthorship({ text: DRAFT, aiDraft: DRAFT, touched: false, now: NOW });
    expect(a.authored, '이게 user 면 기계 문장이 사람 판단으로 세탁된다').toBe('ai_surfaced');
    expect(a.attribution.wording_source).toBe('ai_surfaced');
    // 사용자가 고르긴 했다 — 무효가 아니라 '채택'이다. 그 사실도 지우면 안 된다.
    expect(a.attribution.authority).toBe('user_adopted');
  });

  it('지웠다가 똑같이 다시 쳐도 여전히 기계 문장이다', () => {
    // 판정 기준은 '고생했는가'가 아니라 '누구 문장인가'다.
    const a = closingJudgmentAuthorship({ text: DRAFT, aiDraft: DRAFT, touched: true, now: NOW });
    expect(a.authored).toBe('ai_surfaced');
  });

  it('공백·줄바꿈만 다른 것도 같은 문장으로 본다', () => {
    const a = closingJudgmentAuthorship({
      text: `  ${DRAFT.replace('먼저,', ' 먼저, ')}  `, aiDraft: DRAFT, touched: true, now: NOW,
    });
    expect(a.authored).toBe('ai_surfaced');
  });
});

describe('사람이 쓴 문장은 사람 것이다', () => {
  it('초안을 고쳐 쓰면 user · user_reworded (출발점이 AI였다는 사실은 남는다)', () => {
    const a = closingJudgmentAuthorship({
      text: '역할 재분배를 먼저 하고, 안 되면 그때 채용한다.', aiDraft: DRAFT, touched: true, now: NOW,
    });
    expect(a.authored).toBe('user');
    expect(a.attribution.wording_source).toBe('user_reworded');
    expect(a.attribution.authority).toBe('user_asserted');
  });

  it('초안이 아예 없던 자리에 직접 쓰면 user_direct', () => {
    const a = closingJudgmentAuthorship({
      text: '전환하되 3개월 관찰 구조를 먼저 설계한다.', aiDraft: '', touched: true, now: NOW,
    });
    expect(a.attribution.wording_source).toBe('user_direct');
  });

  it('초안이 없으면 손대지 않았어도 user_direct (기준점이 그대로 온 경우)', () => {
    // 이 경로는 초안이 없어 기준점이 폴백으로 오는 경우다. 기준점은 사용자가
    // 직접 쓴 문장이므로 사람 것이 맞다.
    const a = closingJudgmentAuthorship({
      text: '지금은 채용을 미루는 쪽으로 기운다.', aiDraft: '', touched: false, now: NOW,
    });
    expect(a.authored).toBe('user');
    expect(a.attribution.wording_source).toBe('user_direct');
  });

  it('모든 경우에 언제·어디서 받았는지가 남는다', () => {
    for (const c of [
      { text: DRAFT, aiDraft: DRAFT, touched: false },
      { text: '내 문장', aiDraft: DRAFT, touched: true },
      { text: '내 문장', aiDraft: '', touched: true },
    ]) {
      const a = closingJudgmentAuthorship({ ...c, now: NOW });
      expect(a.attribution.surface).toBe('web');
      expect(a.attribution.source_ref).toBe('workspace:closing_judgment');
      expect(a.attribution.recorded_at).toBe('2026-07-29T04:00:00.000Z');
    }
  });
});

describe('영수증 칸에 아무거나 들어가지 않는다', () => {
  // 실제 봉인 기록에서 "아직 확인되지 않은 가정" 칸에 검토자가 남긴 문단이
  // 통째로 들어가 있었다 — 끝이 물음표인. 확인일에 "이 가정이 맞았나요?"라고
  // 물으면 답할 수가 없다. 이름표와 내용이 다르면 화면 전체를 못 믿게 된다.
  const p = (source: string, text: string) => ({ source, text });

  it('문단 길이의 검토 코멘트는 "확인하지 않은 것"으로 올리지 않는다', () => {
    const long = '\'다음 단계\' 섹션에서 Day 3에 개발자 면담과 동시에 충돌 정의·리뷰 기준 확정을 같이 하라고 되어 있는데, 이게 현실적으로 가능한 타임라인이에요? 팀 온도 파악을 이틀 만에 끝내고 바로 개발자 면담에서 기준까지 확정하는 건 너무 촉박하고, 윗선에서 답하기 어려워져요.';
    expect(deriveReceiptFields([p('risk', long)], '프로젝트').unverified_assumption).toBe('');
  });

  it('물음표로 끝나는 것도 올리지 않는다 (물음은 가정이 아니다)', () => {
    expect(deriveReceiptFields([p('risk', '이 일정이 현실적으로 가능한가요?')], '프로젝트').unverified_assumption).toBe('');
  });

  it('물음표가 없어도 문단 길이면 올리지 않는다', () => {
    // 이 케이스가 없으면 길이 규칙을 지워도 테스트가 통과한다 — 실제로 뮤테이션
    // 프로브에서 그렇게 나왔다. 위의 긴 예시는 물음표를 품고 있어 다른 규칙에
    // 먼저 걸렸고, 그래서 길이 규칙은 **아무것도 재지 않는 상태**였다.
    const longNoQuestion = '팀장이 직접 팀원들 개별 인터뷰하는 구조인데, 팀장이 이 결정의 당사자기도 하잖아요. '
      + '팀원들이 팀장 눈치 보면서 답할 수 있다는 편향을 HR이나 다른 시니어가 짚을 가능성이 높아요. '
      + '이 문서는 그 부분을 아직 다루고 있지 않아요. 확인 없이 넘어가면 나중에 되짚기 어려워집니다. '
      + '특히 인터뷰 순서를 팀장이 정하는 구조라면, 먼저 답한 사람의 말이 뒤 사람에게 전해질 여지도 남습니다. '
      + '그래서 이 절차는 기록으로 남기고 제삼자가 한 번 훑는 편이 안전합니다.';
    // 이 자기점검이 없으면 문자열이 짧아진 날 규칙을 안 재면서 초록이 된다
    // (실제로 처음 쓴 문자열은 155자였고, 이 줄이 그걸 잡았다).
    expect(longNoQuestion.length).toBeGreaterThan(220);
    expect(deriveReceiptFields([p('risk', longNoQuestion)], '프로젝트').unverified_assumption).toBe('');
  });

  it('"일단" 같은 토막은 올리지 않는다', () => {
    expect(deriveReceiptFields([p('risk', '일단')], '프로젝트').unverified_assumption).toBe('');
  });

  it('모양이 맞는 한 줄은 그대로 올린다 (전부 막아버리면 그것도 고장이다)', () => {
    const ok = '경쟁사가 같은 분기에 가격을 내리지 않는다고 가정하고 있어요.';
    expect(deriveReceiptFields([p('risk', ok)], '프로젝트').unverified_assumption).toBe(ok);
  });

  it('못 미더운 것이 앞에 있어도 뒤의 멀쩡한 것을 찾는다', () => {
    const ok = '경쟁사가 같은 분기에 가격을 내리지 않는다고 가정하고 있어요.';
    expect(
      deriveReceiptFields([p('risk', '일단'), p('risk', ok)], '프로젝트').unverified_assumption,
    ).toBe(ok);
  });
});
