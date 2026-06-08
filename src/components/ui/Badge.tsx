type BadgeVariant = 'ai' | 'human' | 'both' | 'default' | 'checkpoint' | 'gold' | 'risk-critical' | 'risk-manageable' | 'risk-unspoken';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, string> = {
  ai: 'bg-[var(--ai)] text-[var(--wf-ai)] ring-1 ring-[var(--wf-ai)]/10 shadow-[0_1px_3px_rgba(0,0,0,0.04)]',
  human: 'bg-[var(--human)] text-[var(--wf-human)] ring-1 ring-[var(--wf-human)]/10 shadow-[0_1px_3px_rgba(0,0,0,0.04)]',
  both: 'bg-[var(--collab)] text-[var(--wf-collab)] ring-1 ring-[var(--wf-collab)]/10 shadow-[0_1px_3px_rgba(0,0,0,0.04)]',
  checkpoint: 'bg-[var(--checkpoint)] text-[var(--wf-checkpoint)] ring-1 ring-[var(--wf-checkpoint)]/10 shadow-[0_1px_3px_rgba(0,0,0,0.04)]',
  default: 'bg-[var(--bg)] text-[var(--text-secondary)] ring-1 ring-[var(--border)] shadow-[0_1px_3px_rgba(0,0,0,0.04)]',
  gold: 'bg-[var(--gold-muted)] text-[var(--accent)] ring-1 ring-[var(--accent)]/20 shadow-[0_1px_3px_rgba(184,150,62,0.12)]',
  'risk-critical': 'bg-red-50 text-[var(--risk-critical)] ring-1 ring-[var(--risk-critical)]/20 shadow-[0_1px_3px_rgba(226,75,74,0.10)]',
  'risk-manageable': 'bg-amber-50 text-[var(--risk-manageable)] ring-1 ring-[var(--risk-manageable)]/20 shadow-[0_1px_3px_rgba(239,159,39,0.10)]',
  'risk-unspoken': 'bg-purple-50 text-[var(--risk-unspoken)] ring-1 ring-[var(--risk-unspoken)]/20 shadow-[0_1px_3px_rgba(127,119,221,0.10)]',
};

export function Badge({ variant = 'default', children }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full
        text-[12px] font-semibold tracking-[0.04em]
        ${variantStyles[variant]}
      `}
    >
      {children}
    </span>
  );
}
