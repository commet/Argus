import { AvatarRow } from 'argus';

const team = [
  { id: 'researcher', name: '다은', role: '리서치 애널리스트', emoji: '🔍', expertise: '', tone: '', color: '#3B82F6' },
  { id: 'strategist', name: '현우', role: '전략 구루', emoji: '🎯', expertise: '', tone: '', color: '#8B5CF6' },
  { id: 'numbers', name: '규민', role: '숫자 분석가', emoji: '📊', expertise: '', tone: '', color: '#10B981' },
  { id: 'copywriter', name: '서연', role: '카피라이터', emoji: '✍️', expertise: '', tone: '', color: '#F59E0B' },
  { id: 'critic', name: '동혁', role: '리스크 검토자', emoji: '⚠️', expertise: '', tone: '', color: '#EF4444' },
  { id: 'ux', name: '지은', role: 'UX 설계자', emoji: '🎨', expertise: '', tone: '', color: '#EC4899' },
  { id: 'legal', name: '윤석', role: '법률·규정 검토자', emoji: '⚖️', expertise: '', tone: '', color: '#6B7280' },
];

const panel: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '18px 22px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  fontSize: 13,
  color: 'var(--text-secondary)',
};

export const Default = () => (
  <div style={panel}>
    <AvatarRow personas={team.slice(0, 4)} />
    <span>4명의 크루가 배치됨</span>
  </div>
);

export const WithOverflow = () => (
  <div style={panel}>
    <AvatarRow personas={team} maxShow={5} />
    <span>전체 크루</span>
  </div>
);

export const Compact = () => (
  <div style={panel}>
    <AvatarRow personas={team} maxShow={3} />
    <span>maxShow 3</span>
  </div>
);
