import { VerificationGate } from 'argus';

// VerificationGate — the captain-stays-in-the-loop sheet shown before a draft is
// created. It surfaces every worker that finished but isn't yet accepted/excluded,
// so unverified analysis can't slip in unnoticed. A *soft* gate: an explicit
// "확인 없이 모두 반영하고 초안 만들기" override always exists. Reads locale from
// useLocale → seed sot_settings=ko. extractKeyFinding pulls the bold/heading line
// from each worker's result, so results carry a real **key finding**. It's a fixed
// overlay (backdrop + bottom/centered sheet); each cell captures the full overlay.

if (typeof window !== 'undefined') {
  try { window.localStorage.setItem('sot_settings', JSON.stringify({ language: 'ko' })); } catch {}
}

// The sheet + backdrop enter via framer-motion (initial opacity:0, scale/y). A
// static capture reports no reduced-motion, so the JS entrance stays at frame 0
// → blank. Force the rest state for the screenshot, scoped to .fm-static (the
// fixed overlay is still a DOM descendant, so the selector reaches it).
if (typeof document !== 'undefined' && !document.getElementById('fm-static-style')) {
  const s = document.createElement('style');
  s.id = 'fm-static-style';
  // Also flow the full-screen `position:fixed` overlay in-place so the whole
  // sheet (header included) is captured instead of being clipped by the cell
  // viewport. inset-0 under position:relative resolves to 0 offsets = no shift.
  s.textContent =
    '.fm-static, .fm-static *{opacity:1 !important;transform:none !important}' +
    '.fm-static .fixed{position:relative !important}';
  document.head.appendChild(s);
}

const persona = (over: Record<string, unknown>) => ({
  id: 'p', name: '?', role: '', nameEn: '', roleEn: '', emoji: '🔎',
  expertise: '', tone: '', color: '#3B82F6', ...over,
});

const worker = (over: Record<string, unknown>) => ({
  id: 'w', step_index: 0, task: '', task_group_id: undefined, who: 'ai' as const,
  expected_output: '', status: 'done' as const, persona: null, level: 'senior' as const,
  stream_text: '', result: null, human_input: null, error: null, approved: null,
  completion_note: null, started_at: null, completed_at: null, ...over,
});

const sophie = persona({ id: 'sophie', name: '다은', nameEn: 'Sophie', role: '리서치 애널리스트', roleEn: 'Research Analyst', emoji: '🔍', color: '#3B82F6' });
const ethan = persona({ id: 'ethan', name: '규민', nameEn: 'Ethan', role: '숫자 분석가', roleEn: 'Numbers Analyst', emoji: '📊', color: '#10B981' });
const blake = persona({ id: 'blake', name: '동혁', nameEn: 'Blake', role: '리스크 리뷰어', roleEn: 'Risk Reviewer', emoji: '🛡️', color: '#EF4444' });

const unreviewed = [
  worker({
    id: 'w-market', persona: sophie, task: '경쟁사 진입 구간 분석',
    result: '## 핵심 발견\n**경쟁사는 세팅 2주·월 80만 원이라 이커머스 셀러 구간이 통째로 비어 있다.** 상위 3개사 모두 대기업 대상으로만 출시했고, 중소 셀러용 1일 세팅 옵션은 어디에도 없다.',
  }),
  worker({
    id: 'w-numbers', persona: ethan, task: '고객 확보 단가 추정',
    result: '**고객당 확보 비용 12만 원 가정은 근거가 약하다** — 지난 분기 리텐션 캠페인 단가는 9.4만 원이었지만 신규 획득은 표본이 없다. 손익분기 25곳까지의 마케팅비는 300만 원으로 추산된다.',
  }),
  worker({
    id: 'w-risk', persona: blake, task: '실패 시나리오 점검',
    result: '## KEY FINDING: 전담 2명을 빼는 동안 기존 제품 장애 대응이 비는 구간이 생긴다\n온콜 백업을 주 4시간으로 지정하지 않으면, 4주 중 2주차에 공백이 발생할 위험이 있다.',
  }),
];

const noop = () => {};

// Some analyses unreviewed — the list + per-worker 반영/제외/다시 + the override.
export const SomeUnreviewed = () => (
  <div className="fm-static">
    <VerificationGate
      workers={unreviewed}
      anyRunning={false}
      onApprove={noop}
      onReject={noop}
      onRetry={noop}
      onSail={noop}
      onOverride={noop}
      onClose={noop}
    />
  </div>
);

// All reviewed — empty list, "모두 확인했어요", the 초안 만들기 button enabled.
export const AllReviewed = () => (
  <div className="fm-static">
    <VerificationGate
      workers={[]}
      anyRunning={false}
      onApprove={noop}
      onReject={noop}
      onRetry={noop}
      onSail={noop}
      onOverride={noop}
      onClose={noop}
    />
  </div>
);

// A re-run still in flight — nothing left to review but sailing must wait; the
// footer reads "실행 중…" (disabled), no override offered.
export const RerunInFlight = () => (
  <div className="fm-static">
    <VerificationGate
      workers={[]}
      anyRunning
      onApprove={noop}
      onReject={noop}
      onRetry={noop}
      onSail={noop}
      onOverride={noop}
      onClose={noop}
    />
  </div>
);
