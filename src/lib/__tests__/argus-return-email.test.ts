// 귀환 이메일 — 지켜야 할 것은 하나다: **기록을 보내지 않는다.**
//
// §7.3의 관찰 우선 순서는 화면에서만이 아니라 이메일에서도 참이어야 한다.
// "그때 당신은 X라고 정했었죠, 어떻게 됐나요?"라고 물으면 그 순간 기억이
// 오염되고, 이 제품이 재는 유일한 것(기억 vs 기록의 차이)이 사라진다.
// 이메일은 사용자가 화면을 열기 전에 읽으므로, 여기서 새면 되돌릴 수 없다.

import { describe, expect, it } from 'vitest';
import { buildReturnEmail, DAILY_RETURN_BUDGET } from '@/lib/argus-return-email';

const SECRET_CHOICE = 'SECRET-핵심-흐름만-20명에게-2주간-공개';
const SECRET_REASON = 'SECRET-빠른-현실-신호-확보';
const SECRET_BELIEF = 'SECRET-20명이-전체를-대표한다';

describe('귀환 이메일은 그때의 기록을 유출하지 않는다', () => {
  const mail = buildReturnEmail({
    question: '온보딩을 20명에게 먼저 열까',
    awaitedSignal: '2주간 재방문 수',
    fromStep: '제한 공개 시작',
    kind: 'outcome',
    returnUrl: 'https://argus.voyage/method-pilot?case=abc',
  });

  it('선택·이유·가정이 들어갈 자리 자체가 없다 (입력 스키마가 막는다)', () => {
    const body = `${mail.subject}\n${mail.text}\n${mail.html}`;
    expect(body).not.toContain(SECRET_CHOICE);
    expect(body).not.toContain(SECRET_REASON);
    expect(body).not.toContain(SECRET_BELIEF);
  });

  it('담는 것은 질문과 기다리던 신호뿐이다', () => {
    expect(mail.text).toContain('온보딩을 20명에게 먼저 열까');
    expect(mail.text).toContain('2주간 재방문 수');
    expect(mail.text).toContain('제한 공개 시작');
  });

  it('무엇을 먼저 묻는지가 분명하다 — 관찰이 먼저', () => {
    expect(mail.text).toMatch(/실제로 무슨 일이 있었나요/);
    expect(mail.text).toMatch(/해석 말고 사실/);
  });

  it('기록을 지금 안 보여주는 이유를 밝힌다 — 숨기는 것이 아니라 순서다', () => {
    expect(mail.text).toMatch(/답을 주시면 그때 나란히 보여드립니다/);
    expect(mail.text).toMatch(/결과를 알고 나면 누구나 이유를 다시 쓰기 때문/);
  });

  it('제목이 기록을 흘리지 않는다 — 알림 미리보기에서도 새면 안 된다', () => {
    expect(mail.subject).not.toContain(SECRET_CHOICE);
    expect(mail.subject).toContain('어떻게 됐나요');
  });
});

describe('첫 확인과 결과 확인은 다르게 묻는다', () => {
  const base = { question: 'Q', kind: 'commitment', returnUrl: 'https://x/y' };

  it('첫 귀환은 "시작했는가"를 묻는다 (결과가 아직 없을 때 결과를 묻지 않는다)', () => {
    const m = buildReturnEmail(base);
    expect(m.text).toMatch(/실제로 시작하셨나요/);
    expect(m.text).toMatch(/시작하기로 한 일/);
  });

  it('결과 귀환은 "무슨 일이 있었는가"를 묻는다', () => {
    const m = buildReturnEmail({ ...base, kind: 'outcome' });
    expect(m.text).toMatch(/결과를 보기로 한 날/);
  });
});

describe('HTML 이스케이프 — 사용자 문장이 그대로 들어간다', () => {
  it('결정 질문의 꺾쇠·따옴표가 escape 된다', () => {
    const m = buildReturnEmail({
      question: '<script>alert(1)</script> "A" & B',
      kind: 'outcome',
      returnUrl: 'https://x/y',
    });
    expect(m.html).not.toContain('<script>');
    expect(m.html).toContain('&lt;script&gt;');
    expect(m.html).toContain('&quot;A&quot;');
    expect(m.html).toContain('&amp;');
  });
});

describe('전역 예산', () => {
  it('하루에 세 번을 넘겨 부르지 않는다 (봉인 계약 §1)', () => {
    expect(DAILY_RETURN_BUDGET).toBe(3);
  });
});
