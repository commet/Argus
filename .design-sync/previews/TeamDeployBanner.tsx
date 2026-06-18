import { TeamDeployBanner } from 'argus';

// TeamDeployBanner — the pre-launch "투입할 팀" confirmation. Workers are grouped
// by task: each group shows its task heading (click to edit), the assigned
// members (AI personas with avatar + role + the router's one-line "why this
// agent" rationale, plus 내 판단 / 사람에게 tracks), per-row swap/remove, an
// "다른 시각" add, a track toggle, "새 팀원 추가", and the gold 팀 투입 CTA. Korean.

if (typeof window !== 'undefined') {
  try { window.localStorage.setItem('sot_settings', JSON.stringify({ language: 'ko' })); } catch {}
}

// The capture freezes the clock, stalling framer-motion's JS-driven entrance
// animations at their `opacity:0` start frame (the banner renders blank). framer
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

const persona = (id: string, name: string, role: string, emoji: string, color: string, expertise: string) => ({
  id, name, role, emoji, color, expertise, tone: '',
});

const base = {
  who: 'ai', expected_output: '', level: 'senior', persona: null, stream_text: '',
  result: null, human_input: null, error: null, approved: null, completion_note: null,
  started_at: null, completed_at: null,
};

// Two task groups: an AI-staffed research task with two lenses (one user-added),
// a numbers task, plus a self-decision and an external human check.
const workers = [
  { ...base, id: 'w1', step_index: 0, task_group_id: 'g1', agent_type: 'ai',
    task: '경쟁사 3곳을 직접 써보고 SMB 셀러 공백을 검증한다',
    persona: persona('p1', '다은', '리서치 애널리스트', '🔭', '#3b82f6', '경쟁 분석·데스크 리서치'),
    assignment_reason: '"경쟁사 약점을 근거로 진입하라"는 재정의 질문에 가장 맞는 시각이라 배치했어요.' },
  { ...base, id: 'w2', step_index: 0, task_group_id: 'g1', agent_type: 'ai', added_manually: true,
    task: '경쟁사 3곳을 직접 써보고 SMB 셀러 공백을 검증한다',
    persona: persona('p2', '민서', '마케팅 전략가', '📣', '#ec4899', '포지셔닝·채널'),
    assignment_reason: '직접 지정' },

  { ...base, id: 'w3', step_index: 1, task_group_id: 'g2', agent_type: 'ai',
    task: '월 29만 원 기준 손익분기와 고객당 확보비를 모델링한다',
    persona: persona('p3', '규민', '숫자 분석가', '📊', '#c79a3a', 'ROI·손익 모델링'),
    ai_scope: '가격 시나리오별 손익분기 계산',
    self_scope: '확보비 가정치(9.4만 원) 채택 여부',
    assignment_reason: '단가·손익이 이 결정의 핵심 변수라 수치 전담을 한 명 세웠어요.' },

  { ...base, id: 'w4', step_index: 2, task_group_id: 'g3', agent_type: 'self',
    task: '2명을 신사업에 빼도 기존 제품이 굴러가는지는 내가 판단한다' },

  { ...base, id: 'w5', step_index: 3, task_group_id: 'g4', agent_type: 'human',
    task: '상담 로그 보관 기간이 약관상 문제없는지 사내 법무에 확인한다',
    question_to_human: '상담 로그를 12개월 보관해도 약관·개인정보 이슈가 없을까요?',
    contact: { name: '윤석', channel: 'email', address: 'legal@company.com' } },
];

export const ReadyTeam = () => (
  <TeamDeployBanner
    workers={workers}
    onDeploy={() => {}}
    onUpdateWorker={() => {}}
    onOpenPool={() => {}}
    onRemoveWorker={() => {}}
    onUpdateTask={() => {}}
    onOpenFreePool={() => {}}
    onReplaceWorker={() => {}}
    onSetGroupTrack={() => {}}
  />
);
