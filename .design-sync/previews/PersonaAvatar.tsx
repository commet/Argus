import { PersonaAvatar } from 'argus';

// PersonaAvatar — the initial-on-a-color disc used everywhere a persona appears
// (feedback messages, discussion threads, roster stacks). The color is a stable
// hash of personaId (same person → same color across surfaces), and an optional
// influence ring (high=3px, medium=2px, none=low) signals weight.
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

// Same person, growing sizes — the hash keeps the color identical.
export const Sizes = () => (
  <div style={panel}>
    <div style={cell}><PersonaAvatar name="김도현" personaId="p-cfo" size={28} /><span>28</span></div>
    <div style={cell}><PersonaAvatar name="김도현" personaId="p-cfo" size={36} /><span>36</span></div>
    <div style={cell}><PersonaAvatar name="김도현" personaId="p-cfo" size={48} /><span>48</span></div>
  </div>
);

// The influence ring — high gets the thickest ring, low gets none.
export const InfluenceRings = () => (
  <div style={panel}>
    <div style={cell}><PersonaAvatar name="김도현" personaId="p-cfo" size={44} influence="high" /><span>높음</span></div>
    <div style={cell}><PersonaAvatar name="박서연" personaId="p-pm" size={44} influence="medium" /><span>중간</span></div>
    <div style={cell}><PersonaAvatar name="이준호" personaId="p-eng" size={44} influence="low" /><span>낮음</span></div>
  </div>
);

// A distinct cast — each personaId hashes to its own color across the palette.
export const Cast = () => (
  <div style={panel}>
    <PersonaAvatar name="김도현" personaId="p-cfo" size={40} />
    <PersonaAvatar name="박서연" personaId="p-pm" size={40} />
    <PersonaAvatar name="이준호" personaId="p-eng" size={40} />
    <PersonaAvatar name="Grace" personaId="p-pm-grace" size={40} />
    <PersonaAvatar name="Leo" personaId="p-arch-leo" size={40} />
  </div>
);
