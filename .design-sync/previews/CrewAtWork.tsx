import { CrewAtWork } from 'argus';

// CrewAtWork — the "팀 작업 극장": instead of a progress bar, each auto-deployed
// crew member shows who's on what, their live stream tail while running (the
// honest typing theater), their takeaway line when done, or an "didn't land" +
// retry line on error. The headline counts done/failed honestly. Korean locale.

if (typeof window !== 'undefined') {
  try { window.localStorage.setItem('sot_settings', JSON.stringify({ language: 'ko' })); } catch {}
}

// The capture freezes the clock, stalling framer-motion's JS-driven entrance
// animations at their `opacity:0` start frame (cards render blank). framer writes
// those start values as INLINE styles; `!important` beats inline, so force the
// end-state on exactly the elements framer touched.
if (typeof document !== 'undefined') {
  const s = document.createElement('style');
  s.textContent =
    '[style*="opacity"]{opacity:1!important}' +
    '[style*="transform"]{transform:none!important}' +
    '[style*="height: 0"]{height:auto!important}';
  document.head.appendChild(s);
}

const persona = (name: string, role: string, emoji: string, color: string) => ({
  id: name, name, role, emoji, expertise: role, tone: '', color,
});

const base = {
  who: 'ai', expected_output: '', level: 'senior', result: null, human_input: null,
  error: null, approved: null, completion_note: null, started_at: null, completed_at: null,
  stream_text: '', agent_type: 'ai',
};

// Mid-run: one finished, one streaming live (cursor + mono tail), one queued.
const inProgress = [
  { ...base, id: 'w1', step_index: 0, task: '시장 공백 검증', status: 'done',
    persona: persona('다은', '리서치 애널리스트', '🔭', '#3b82f6'),
    completion_note: '경쟁사 3곳 모두 세팅 2주 이상·월 70만 원 이상 — SMB 셀러 구간은 비어 있다는 가설이 데이터로 확인됨.' },
  { ...base, id: 'w2', step_index: 1, task: '단가·손익 모델링', status: 'running',
    persona: persona('규민', '숫자 분석가', '📊', '#c79a3a'),
    stream_text: '월 29만 원 기준 손익분기는 셀러 25곳. 전담 2명 인건비를 4주로 환산하면 첫 분기 고정비가 ... 고객당 확보비를 9.4만 원으로 잡으면 회수 기간은' },
  { ...base, id: 'w3', step_index: 2, task: '베타 시연 시나리오', status: 'pending',
    persona: persona('마야', 'UX 디자이너', '✍️', '#8b5cf6') },
];

export const Working = () => <CrewAtWork workers={inProgress} />;

// All landed — the success headline ("전부 초안에 들어갑니다") + a report toggle.
const allDone = [
  { ...base, id: 'w1', step_index: 0, task: '시장 공백 검증', status: 'done',
    persona: persona('다은', '리서치 애널리스트', '🔭', '#3b82f6'),
    completion_note: 'SMB 셀러 구간이 비어 있다는 가설 확인 — 6개월 내 누군가 메울 공백.' },
  { ...base, id: 'w2', step_index: 1, task: '단가·손익 모델링', status: 'done',
    persona: persona('규민', '숫자 분석가', '📊', '#c79a3a'),
    completion_note: '월 29만 원·손익분기 25곳·회수 4.2개월. 가격은 방어 가능하나 확보 경로가 변수.' },
  { ...base, id: 'w3', step_index: 2, task: '법무·약관 리스크', status: 'done',
    persona: persona('윤석', '법무·컴플라이언스', '⚖️', '#10b981'),
    completion_note: '상담 로그의 개인정보 보관 기간만 명시하면 출시 차단 이슈 없음.' },
];

export const AllFinished = () => (
  <CrewAtWork workers={allDone} reportsOpen={false} onToggleReports={() => {}} />
);

// One member's work didn't land — honest headline + inline retry on that row.
const withError = [
  { ...base, id: 'w1', step_index: 0, task: '시장 공백 검증', status: 'done',
    persona: persona('다은', '리서치 애널리스트', '🔭', '#3b82f6'),
    completion_note: 'SMB 셀러 구간 공백 확인.' },
  { ...base, id: 'w2', step_index: 1, task: '단가·손익 모델링', status: 'error',
    persona: persona('규민', '숫자 분석가', '📊', '#c79a3a') },
];

export const WithFailure = () => (
  <CrewAtWork workers={withError} onRetry={() => {}} reportsOpen={false} onToggleReports={() => {}} />
);
