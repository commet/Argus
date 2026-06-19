import { PersonaCard } from 'argus';

// PersonaCard — a stakeholder/persona tile shown in the rehearsal roster. The
// avatar tints by influence (Crown=높음 / Shield=중간 / User=낮음), traits render
// as chips, and a feedback-count pill appears top-right once the persona has
// logged reactions. `selectable` swaps the pill for a checkbox; `selected`
// lifts the card with the gold ring.
// Korean labels come from the locale setting — seed it before the store reads.
if (typeof window !== 'undefined') {
  window.localStorage.setItem('sot_settings', JSON.stringify({ language: 'ko' }));
}

const now = '2026-06-15T09:00:00.000Z';

const cfo = {
  id: 'p-cfo',
  name: '김도현',
  role: 'CFO',
  organization: '재무본부',
  priorities: '런웨이를 18개월 아래로 떨어뜨리지 않는 것 — 모든 신규 지출은 회수 시점이 보여야 통과.',
  communication_style: '숫자 먼저, 수사는 나중. 결론을 한 줄로.',
  known_concerns: '월 29만 원 구독이 셀러 시장에서 실제로 팔릴지 검증되지 않음.',
  relationship_notes: '대표 신임이 두텁고 예산 결재의 마지막 관문.',
  influence: 'high' as const,
  extracted_traits: ['보수적', '회수율 집착', '결론 우선', '근거 요구'],
  feedback_logs: [
    { id: 'f1', date: now, context: '가격 단계', feedback: '회수 가정이 약하다.', created_at: now },
    { id: 'f2', date: now, context: '인력 재배치', feedback: '기존 제품 장애 리스크.', created_at: now },
  ],
  created_at: now,
  updated_at: now,
};

const pm = {
  id: 'p-pm',
  name: '박서연',
  role: '프로덕트 리드',
  organization: '신사업팀',
  priorities: '4주 안에 결정 가능한 한 장 — 완벽한 50장 기획서가 아니라.',
  communication_style: '사용자 시나리오로 설명, 합의를 끌어냄.',
  known_concerns: '온보딩 이탈률이 40%를 넘는 구간.',
  relationship_notes: '실무 추진의 중심. 엔지니어링과 가교.',
  influence: 'medium' as const,
  extracted_traits: ['사용자 관점', '추진력', '합의형'],
  feedback_logs: [],
  created_at: now,
  updated_at: now,
};

const eng = {
  id: 'p-eng',
  name: '이준호',
  role: '시니어 백엔드 엔지니어',
  organization: '플랫폼팀',
  priorities: '마이그레이션을 멈추지 않고 신사업 트래픽을 받는 것.',
  communication_style: '트레이드오프를 명확히, 과장 없이.',
  known_concerns: '3명으로는 기존 제품 유지보수가 빠듯하다.',
  relationship_notes: '기술 실현 가능성의 최종 판단자.',
  influence: 'low' as const,
  extracted_traits: ['실현가능성', '냉정함'],
  feedback_logs: [{ id: 'f3', date: now, context: '아키텍처', feedback: '캐시 레이어가 병목.', created_at: now }],
  created_at: now,
  updated_at: now,
};

const noop = () => {};
const wrap: React.CSSProperties = { display: 'grid', gap: 16, maxWidth: 380, padding: 24 };

// The three influence tiers side by side — note the avatar tint + badge icon.
export const InfluenceTiers = () => (
  <div style={wrap}>
    <PersonaCard persona={cfo} onClick={noop} />
    <PersonaCard persona={pm} onClick={noop} />
    <PersonaCard persona={eng} onClick={noop} />
  </div>
);

// Selected — gold ring, white avatar on the gold gradient, lifted.
export const Selected = () => (
  <div style={wrap}>
    <PersonaCard persona={cfo} onClick={noop} selected />
  </div>
);

// Selectable roster mode — the feedback pill is replaced by a checkbox.
export const Selectable = () => (
  <div style={wrap}>
    <PersonaCard persona={pm} onClick={noop} selectable selected onSelect={noop} />
    <PersonaCard persona={eng} onClick={noop} selectable onSelect={noop} />
  </div>
);
