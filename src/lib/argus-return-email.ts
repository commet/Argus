// 귀환 이메일 — 이 제품의 심장.
//
// 계획의 마일스톤 날짜가 오면 **서버가 먼저 찾아간다.** 사용자가 기억해서
// 돌아오길 기대하지 않는다 — 그 기대가 저널링 앱 87%를 7일 안에 죽인다.
//
// 문안의 규칙은 하나: **기록을 보여주지 않는다.** §7.3의 관찰 우선 순서는
// 화면에서만이 아니라 이메일에서도 참이어야 한다. "그때 당신은 X라고
// 정했었죠, 어떻게 됐나요?"라고 물으면 그 순간 기억이 오염되고, 이 제품이
// 재는 유일한 것(기억 vs 기록의 차이)이 사라진다.
//
// 그래서 이메일이 담는 것: 결정의 **질문**과 기다리던 **신호**뿐이다.

export interface ReturnEmailInput {
  question: string; // 결정 질문 (선택·이유는 절대 넣지 않는다)
  awaitedSignal?: string;
  fromStep?: string; // 어느 계획 단계에서 온 약속인지
  kind: string; // commitment | outcome | ...
  returnUrl: string;
}

export interface ReturnEmail {
  subject: string;
  text: string;
  html: string;
}

// 기록 유출 방지 — 문안에 들어가면 안 되는 것들. 테스트가 이 목록으로 검사한다.
export const FORBIDDEN_IN_RETURN_EMAIL = ['choiceOrPolicy', 'rationale', 'materialBeliefs'] as const;

function opening(kind: string): string {
  return kind === 'commitment'
    ? '시작하기로 한 일이 있었습니다.'
    : '결과를 보기로 한 날입니다.';
}

export function buildReturnEmail(input: ReturnEmailInput): ReturnEmail {
  const ask =
    input.kind === 'commitment'
      ? '실제로 시작하셨나요? 있었던 일을 그대로 적어 주세요.'
      : '실제로 무슨 일이 있었나요? 해석 말고 사실을 그대로 적어 주세요.';

  const lines = [
    opening(input.kind),
    '',
    `"${input.question}"`,
    ...(input.fromStep ? [`약속했던 단계: ${input.fromStep}`] : []),
    ...(input.awaitedSignal ? [`기다리던 것: ${input.awaitedSignal}`] : []),
    '',
    ask,
    '',
    // 왜 기록을 지금 안 보여주는지 밝힌다 — 숨기는 것이 아니라 순서다.
    '그때 무엇을 정하고 왜 그랬는지는, 답을 주시면 그때 나란히 보여드립니다.',
    '(결과를 알고 나면 누구나 이유를 다시 쓰기 때문에, 순서를 지킵니다.)',
    '',
    input.returnUrl,
  ];

  const text = lines.join('\n');
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.7;color:#1c1917;max-width:520px">
<p style="margin:0 0 16px">${escapeHtml(opening(input.kind))}</p>
<p style="margin:0 0 8px;font-weight:600">${escapeHtml(input.question)}</p>
${input.fromStep ? `<p style="margin:0 0 4px;color:#57534e;font-size:13px">약속했던 단계: ${escapeHtml(input.fromStep)}</p>` : ''}
${input.awaitedSignal ? `<p style="margin:0 0 16px;color:#57534e;font-size:13px">기다리던 것: ${escapeHtml(input.awaitedSignal)}</p>` : ''}
<p style="margin:16px 0">${escapeHtml(ask)}</p>
<p style="margin:0 0 16px;color:#57534e;font-size:13px">그때 무엇을 정하고 왜 그랬는지는, 답을 주시면 그때 나란히 보여드립니다.<br>결과를 알고 나면 누구나 이유를 다시 쓰기 때문에, 순서를 지킵니다.</p>
<p style="margin:24px 0 0"><a href="${escapeHtml(input.returnUrl)}" style="background:#8b6f47;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">돌아보기</a></p>
</div>`;

  return {
    subject: `${input.question.slice(0, 40)}${input.question.length > 40 ? '…' : ''} — 그때 그 일, 어떻게 됐나요?`,
    text,
    html,
  };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// 하루에 보낼 수 있는 귀환의 상한 (봉인 계약 §1의 전역 예산 3건).
// 계획이 여러 개여도 사용자가 하루에 세 번 넘게 불려 나오지 않는다.
export const DAILY_RETURN_BUDGET = 3;
