import { FinalCard } from 'argus';

// FinalCard — the triumphant final deliverable. Gold top rule + "완성된 문서 ·
// 바로 보낼 수 있어요" header with a ShareBar, then the structured document
// (display-font title, italic executive summary, attributed sections, next
// steps). When a structured `mix` is present it renders with attribution; it can
// also start collapsed behind one tap. No sessionId here, so the agent-growth
// footer stays off and no progressive session is required. Korean locale.

if (typeof window !== 'undefined') {
  try { window.localStorage.setItem('sot_settings', JSON.stringify({ language: 'ko' })); } catch {}
}

// The capture freezes the clock, stalling framer-motion's JS-driven entrance
// animation at its `opacity:0` / `scale:0.98` start frame (the card renders
// blank). framer writes those start values as INLINE styles; `!important` beats
// inline, so force the end-state on exactly the elements framer touched.
if (typeof document !== 'undefined') {
  const s = document.createElement('style');
  s.textContent =
    '[style*="opacity"]{opacity:1!important}' +
    '[style*="transform"]{transform:none!important}' +
    '[style*="height: 0"]{height:auto!important}';
  document.head.appendChild(s);
}

const mix = {
  title: '이커머스 셀러를 위한 AI 고객상담 — 4주 베타 진입안',
  executive_summary: '경쟁사가 대기업만 보는 사이, 세팅 2주·월 80만 원이 부담인 이커머스 셀러 시장은 비어 있다. **1일 세팅·월 29만 원**으로 그 자리를 열고, 4주 뒤 작동하는 베타를 셀러 1명 앞에서 시연하는 것을 이번 분기의 단일 목표로 잡는다.',
  sections: [
    { heading: '왜 지금인가', content: '경쟁사 출시로 시장은 검증됐지만, 그들의 세팅 비용과 가격이 SMB 셀러를 밀어내 6개월 내 누군가 메울 공백을 남겼다.' },
    { heading: '무엇을 만드나', content: '이커머스 용어로 사전학습한 상담 모델 + 업종 템플릿 + 간단 대시보드. 차별점은 단 하나, "1일 세팅".' },
    { heading: '어떻게 검증하나', content: '4주차 셀러 1명 앞 베타 시연, 8주차 Go/No-Go 게이트에서 유료 전환율로 계속/중단을 가른다.' },
  ],
  key_assumptions: ['사전학습 모델이 1일 안에 업종 적용 가능하다.', '셀러가 월 29만 원을 낼 의향이 있다.'],
  next_steps: ['상위 CS 문의 셀러 200곳 베타 명단 확정', '8주차 철수 기준 수치화', '대표 1장 보고서 작성'],
};

const flatContent = `# 이커머스 셀러를 위한 AI 고객상담 — 4주 베타 진입안

경쟁사가 대기업만 보는 사이, 세팅 2주·월 80만 원이 부담인 이커머스 셀러 시장은 비어 있다.

## 왜 지금인가
이 공백은 6개월 내 누군가 메운다.

## 다음 단계
- 상위 CS 문의 셀러 200곳 베타 명단 확정
- 8주차 철수 기준 수치화`;

// The full structured deliverable, expanded — title, summary, attributed
// sections, next steps, all under the gold header + ShareBar.
export const Deliverable = () => (
  <FinalCard content={flatContent} mix={mix} />
);

// Collapsed by default — title + "전체 문서 펼치기" tap; copy/share still work
// without expanding (the bearing card below carries the orientation).
export const Collapsed = () => (
  <FinalCard content={flatContent} mix={mix} defaultCollapsed />
);
