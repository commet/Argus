import { MixPreview } from 'argus';

// MixPreview — the synthesized first draft of the deliverable. Eyebrow ("초안"),
// display-font title, an italic executive-summary blockquote, then a 전문 보기
// accordion (collapsed by default so the forward CTA never hides below a full
// document). Two CTA layouts: primary='review' surfaces a decision-maker review
// card; primary='wrap' makes the believability/flinch step the gold CTA and
// demotes review to a quiet opt-in. Korean locale.

if (typeof window !== 'undefined') {
  try { window.localStorage.setItem('sot_settings', JSON.stringify({ language: 'ko' })); } catch {}
}

// The capture freezes the clock, stalling framer-motion's JS-driven entrance
// animations at their `opacity:0` start frame (the card renders blank). framer
// writes those start values as INLINE styles; `!important` beats inline, so force
// the end-state on exactly the elements framer touched.
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
    { heading: '왜 지금인가', content: '경쟁사 출시로 시장이 검증됐지만, 그들의 세팅 비용과 가격이 SMB 셀러를 밀어내고 있다. 이 공백은 6개월 내 누군가 메운다.' },
    { heading: '무엇을 만드나', content: '이커머스 용어로 사전학습한 상담 모델 + 업종 템플릿 + 간단 대시보드. 차별점은 "1일 세팅".' },
    { heading: '어떻게 검증하나', content: '4주차에 셀러 1명 앞 베타 시연. 8주차 Go/No-Go 게이트에서 전환율로 계속/중단을 가른다.' },
  ],
  key_assumptions: ['사전학습 모델이 1일 안에 업종 적용 가능하다.', '셀러가 월 29만 원을 낼 의향이 있다.'],
  next_steps: ['상위 CS 문의 셀러 200곳 베타 명단 확정', '8주차 철수 기준 수치화', '대표 1장 보고서 작성'],
};

// Default layout — the draft preview with a decision-maker review card as the
// primary path before finalizing. Body stays collapsed (the CTA is the point).
export const DraftWithReview = () => (
  <MixPreview mix={mix} dm="박 이사" onDM={() => {}} onSkip={() => {}} busy={false} />
);

// Forward-first layout (primary='wrap'): the gold CTA is the believability check
// that comes next; the stakeholder review drops to a quiet optional line.
export const ForwardPrimary = () => (
  <MixPreview mix={mix} dm="박 이사" onDM={() => {}} onSkip={() => {}} busy={false} primary="wrap" />
);

// With the navigator's integrated note and a team-dissent callout appended below
// the draft — the two cross-cutting reviews the synthesis can surface.
export const WithNavigatorAndDissent = () => (
  <MixPreview
    mix={mix}
    dm="박 이사"
    onDM={() => {}}
    onSkip={() => {}}
    busy={false}
    cmReview={{
      overall: '세 섹션이 한 방향을 보고 있어 읽기 쉽다. 다만 "왜 지금인가"와 "어떻게 검증하나"가 같은 가정(1일 세팅)에 동시에 기대고 있다.',
      contradictions: ['"월 29만 원"과 "전담 2명 4주"의 인건비가 손익에서 충돌한다 — 둘 다 참이긴 어렵다.'],
      blind_spots: ['경쟁사가 가격을 따라 내릴 때의 대응이 어디에도 없다.'],
      verdict: '진입 논리는 단단하다. 단가 가정 한 줄만 검증되면 임원회의로 가도 된다.',
    }}
    debateResult={{
      challenge: '"1일 세팅"이 차별점이자 동시에 가장 약한 고리다 — 여기가 무너지면 가격 논리까지 같이 무너진다.',
      targetAgent: '기술 검토',
      weakestClaim: '사전학습이 업종마다 1일 안에 끝난다는 보장은 PoC 전엔 없다.',
      alternativeView: '세팅 "3일"로 약속하고 그래도 경쟁사 대비 빠름을 강조하는 편이 더 방어 가능하다.',
      severity: 'important',
    }}
  />
);
