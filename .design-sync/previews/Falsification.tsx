import { Falsification } from 'argus';

// Falsification — the "시험한다"/flinch step. It acknowledges one genuine
// strength (earning the right to push), then lays out a DELIBERATELY inflated
// ladder of success-claims (plausible → grandiose) and asks the user to tap the
// first line they stop believing. The flinch isolates the load-bearing
// assumption; "전부 믿겨요" routes to the single riskiest one instead. Korean.

if (typeof window !== 'undefined') {
  try { window.localStorage.setItem('sot_settings', JSON.stringify({ language: 'ko' })); } catch {}
}

// The capture freezes the clock, stalling framer-motion's JS-driven entrance
// animation at its `opacity:0` start frame (the card renders blank). framer writes
// that start value as an INLINE style; `!important` beats inline, so force the
// end-state on exactly the elements framer touched.
if (typeof document !== 'undefined') {
  const s = document.createElement('style');
  s.textContent =
    '[style*="opacity"]{opacity:1!important}' +
    '[style*="transform"]{transform:none!important}' +
    '[style*="height: 0"]{height:auto!important}';
  document.head.appendChild(s);
}

const strength = '경쟁사를 직접 써보고 약점(세팅 2주·고가)을 짚은 다음, 1일 세팅으로 그 자리를 노린다는 진입 논리는 분명하고 검증 가능합니다.';

const claims = [
  { id: 'c1', text: '4주 안에 셀러 1명 앞에서 작동하는 베타를 시연할 수 있다.', assumption: '사전학습 모델이 한 업종에 1일 안에 적용된다.', overreached: true },
  { id: 'c2', text: '베타를 본 셀러 대부분이 "이거 쓸래요"라고 말한다.', assumption: '셀러가 느끼는 가치가 월 29만 원을 넘는다.', overreached: true },
  { id: 'c3', text: '3개월 안에 손익분기 25곳을 유료 전환시킨다.', assumption: '고객당 확보비 9.4만 원으로 25곳을 데려올 수 있다.', overreached: true },
  { id: 'c4', text: '6개월 안에 이 시장의 기본값이 되어 경쟁사가 가격을 따라 내린다.', assumption: '우리가 먼저 잡으면 후발 주자가 가격으로도 못 흔든다.', overreached: true },
  { id: 'c5', text: '1년 안에 이 신사업이 기존 본업 매출을 넘어선다.', assumption: '같은 셀러풀에서 본업보다 큰 수요가 나온다.', overreached: true },
];

// The initial, unresolved state — the strength line, the framing instruction,
// the escalating ladder with down-arrows, and the "전부 믿겨요" escape.
export const TheLadder = () => (
  <Falsification
    strength={strength}
    claims={claims}
    onResolve={() => {}}
    onRequestHighestLoad={async () => claims[2]}
  />
);
