type BadgeVariant = 'ai' | 'human' | 'both' | 'default' | 'checkpoint' | 'gold' | 'risk-critical' | 'risk-manageable' | 'risk-unspoken';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, string> = {
  ai: 'bg-[var(--ai)] text-[#2d4a7c] ring-1 ring-[#2d4a7c]/10 shadow-[0_1px_3px_rgba(0,0,0,0.04)]',
  human: 'bg-[var(--human)] text-[#8b6914] ring-1 ring-[#8b6914]/10 shadow-[0_1px_3px_rgba(0,0,0,0.04)]',
  both: 'bg-[var(--collab)] text-[#2d6b2d] ring-1 ring-[#2d6b2d]/10 shadow-[0_1px_3px_rgba(0,0,0,0.04)]',
  checkpoint: 'bg-[var(--checkpoint)] text-[#8b7114] ring-1 ring-[#8b7114]/10 shadow-[0_1px_3px_rgba(0,0,0,0.04)]',
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
      // Dimensional rebuild: an inset top highlight + micro drop shadow give the
      // engraved-into-the-surface feel (ArgusV2 foundry direction). Overrides the
      // flat variant shadow; theme-safe (the white highlight stays subtle in dark).
      style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,.55), 0 1px 2px rgba(0,0,0,.06)' }}
    >
      {children}
    </span>
  );
}
