import { WorkerAvatar } from 'argus';

const researcher = {
  id: 'researcher',
  name: '다은',
  nameEn: 'Daeun',
  role: '리서치 애널리스트',
  roleEn: 'Research Analyst',
  emoji: '🔍',
  expertise: '자료 조사, 시장 분석, 데이터 수집에 강합니다.',
  tone: '팩트 중심으로 간결하게.',
  color: '#3B82F6',
};
const strategist = {
  id: 'strategist',
  name: '현우',
  nameEn: 'Hyunwoo',
  role: '전략 구루',
  roleEn: 'Strategy Lead',
  emoji: '🎯',
  expertise: '전략 수립, 포지셔닝, 경쟁 분석.',
  tone: '핵심만 짚되 한 줄로 설득력 있게.',
  color: '#8B5CF6',
};
const numbers = {
  id: 'numbers',
  name: '규민',
  nameEn: 'Gyumin',
  role: '숫자 분석가',
  roleEn: 'Numbers Analyst',
  emoji: '📊',
  expertise: '수치 분석, 재무 모델링, ROI 계산.',
  tone: '정량적 근거를 먼저.',
  color: '#10B981',
};

const panel: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 28,
  padding: 24,
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
};

const cell: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
  fontSize: 11,
  color: 'var(--text-secondary)',
};

export const Sizes = () => (
  <div style={panel}>
    <div style={cell}>
      <WorkerAvatar persona={strategist} size="sm" />
      <span>sm</span>
    </div>
    <div style={cell}>
      <WorkerAvatar persona={strategist} size="md" />
      <span>md</span>
    </div>
    <div style={cell}>
      <WorkerAvatar persona={strategist} size="lg" />
      <span>lg</span>
    </div>
  </div>
);

export const Roster = () => (
  <div style={panel}>
    <WorkerAvatar persona={researcher} size="lg" />
    <WorkerAvatar persona={strategist} size="lg" />
    <WorkerAvatar persona={numbers} size="lg" />
  </div>
);

export const Pulsing = () => (
  <div style={panel}>
    <div style={cell}>
      <WorkerAvatar persona={numbers} size="lg" pulse />
      <span>분석 중</span>
    </div>
  </div>
);

export const Empty = () => (
  <div style={panel}>
    <div style={cell}>
      <WorkerAvatar persona={null} size="lg" />
      <span>미배정</span>
    </div>
  </div>
);
