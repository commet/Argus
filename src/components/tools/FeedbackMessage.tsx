'use client';

const PERSONA_COLORS = [
  '#E24B4A', '#EF9F27', '#7F77DD', '#3b6dcc', '#2d6b2d', '#b8963e',
];

export function getPersonaColor(personaId: string): string {
  let hash = 0;
  for (let i = 0; i < personaId.length; i++) {
    hash = ((hash << 5) - hash + personaId.charCodeAt(i)) | 0;
  }
  return PERSONA_COLORS[Math.abs(hash) % PERSONA_COLORS.length];
}

interface PersonaAvatarProps {
  name: string;
  personaId: string;
  size?: number;
  influence?: 'high' | 'medium' | 'low';
}

export function PersonaAvatar({ name, personaId, size = 32, influence }: PersonaAvatarProps) {
  const color = getPersonaColor(personaId);
  const ringWidth = influence === 'high' ? 3 : influence === 'medium' ? 2 : 0;
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold shrink-0"
      style={{
        width: size, height: size, backgroundColor: color, fontSize: size * 0.4,
        ...(ringWidth > 0 ? { boxShadow: `0 0 0 ${ringWidth}px var(--accent-light)` } : {}),
      }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

interface FeedbackMessageProps {
  personaName: string;
  personaId: string;
  category: string;
  categoryIcon?: React.ReactNode;
  children: React.ReactNode;
  variant?: 'default' | 'praise' | 'concern' | 'risk-critical' | 'risk-manageable' | 'risk-unspoken' | 'approval' | 'reaction';
  delay?: number;
}

const VARIANT_STYLES: Record<string, string> = {
  default: 'bg-[var(--ai)] border-[var(--ai)]',
  praise: 'bg-[var(--collab)] border-[var(--collab)]',
  concern: 'bg-[var(--checkpoint)] border-[var(--checkpoint)]',
  'risk-critical': 'bg-[var(--danger)]/10 border-[var(--danger)]/20',
  'risk-manageable': 'bg-[var(--checkpoint)] border-[var(--checkpoint)]',
  'risk-unspoken': 'bg-[var(--risk-unspoken)]/10 border-[var(--risk-unspoken)]/20',
  approval: 'bg-[var(--collab)] border-[var(--collab)]',
  reaction: 'bg-[var(--bg)] border-[var(--border-subtle)]',
};

const CATEGORY_COLORS: Record<string, string> = {
  // Korean (original)
  '전반적 반응': 'text-[var(--accent)]',
  '실패 시나리오': 'text-[var(--danger)]',
  '검증 안 된 전제': 'text-[var(--warning)]',
  '핵심 위협': 'text-[#E24B4A]',
  '관리 가능': 'text-[#EF9F27]',
  '침묵의 리스크': 'text-[#7F77DD]',
  '질문': 'text-[var(--accent)]',
  '칭찬': 'text-[var(--success)]',
  '우려/지적': 'text-[var(--warning)]',
  '추가 요청': 'text-[var(--accent)]',
  '승인 조건': 'text-[var(--success)]',
  // English equivalents — caller may pass localized label
  'Overall reaction': 'text-[var(--accent)]',
  'Failure scenario': 'text-[var(--danger)]',
  'Unverified assumption': 'text-[var(--warning)]',
  'Core threat': 'text-[#E24B4A]',
  'Manageable': 'text-[#EF9F27]',
  'Unspoken risk': 'text-[#7F77DD]',
  'Question': 'text-[var(--accent)]',
  'Praise': 'text-[var(--success)]',
  'Concern': 'text-[var(--warning)]',
  'Request': 'text-[var(--accent)]',
  'Approval condition': 'text-[var(--success)]',
};

export function FeedbackMessage({
  personaName,
  personaId,
  category,
  categoryIcon,
  children,
  variant = 'default',
  delay = 0,
}: FeedbackMessageProps) {
  return (
    <div
      className="flex gap-2.5 md:gap-3 opacity-0 animate-fade-in"
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'forwards' }}
    >
      <PersonaAvatar name={personaName} personaId={personaId} size={32} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[13px] font-bold text-[var(--text-primary)]">{personaName}</span>
          <span className={`text-[12px] font-semibold ${CATEGORY_COLORS[category] || 'text-[var(--text-tertiary)]'}`}>
            {categoryIcon && <span className="inline-flex mr-0.5 align-middle">{categoryIcon}</span>}
            {category}
          </span>
        </div>
        <div className={`rounded-xl rounded-tl-sm px-3.5 py-2.5 border text-[13px] leading-relaxed text-[var(--text-primary)] ${VARIANT_STYLES[variant] || VARIANT_STYLES.default}`}>
          {children}
        </div>
      </div>
    </div>
  );
}
