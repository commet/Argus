import { HTMLAttributes, forwardRef } from 'react';

type CardVariant = 'default' | 'ai' | 'human' | 'checkpoint' | 'success' | 'danger' | 'muted' | 'elevated' | 'premium' | 'musical';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  variant?: CardVariant;
}

// Dimensional rebuild (ArgusV2 foundry direction): cards keep their tint but
// gain a layered drop shadow + an inset top highlight, so they read as paper
// lifted off the desk. Kept as Tailwind arbitrary shadows (not inline) so the
// hoverable `hover:shadow-[...]` can still override on hover. rgba layers are
// theme-safe; the white inset stays subtle in dark mode.
const DEPTH = 'shadow-[0_1px_2px_rgba(0,0,0,0.05),0_6px_16px_rgba(0,0,0,0.055),inset_0_1px_0_rgba(255,255,255,0.5)]';
const DEPTH_HI = 'shadow-[0_2px_6px_rgba(0,0,0,0.08),0_16px_36px_rgba(0,0,0,0.10),inset_0_1px_0_rgba(255,255,255,0.62)]';

const variantStyles: Record<CardVariant, string> = {
  default: `bg-[var(--surface)] border-[var(--border-subtle)] ${DEPTH}`,
  ai: `bg-[var(--ai)] border-[var(--accent-light)]/15 ${DEPTH}`,
  human: `bg-[var(--human)] border-[var(--human-fg)]/15 ${DEPTH}`,
  checkpoint: `bg-[var(--checkpoint)] border-[var(--warning)]/30 ${DEPTH}`,
  success: `bg-[var(--collab)] border-[var(--success)]/25 ${DEPTH}`,
  danger: `bg-[var(--danger)]/8 border-[var(--danger)]/25 ${DEPTH}`,
  muted: 'bg-[var(--bg)] border-[var(--border-subtle)] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]',
  elevated: `bg-[var(--surface)] border-[var(--border-subtle)] ${DEPTH_HI}`,
  premium: `bg-[var(--surface)] border-[var(--border-subtle)] ${DEPTH_HI} relative overflow-hidden`,
  musical: `bg-[var(--surface)] border-[var(--border-subtle)] ${DEPTH} relative overflow-hidden`,
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ hoverable = false, variant = 'default', className = '', children, style, ...props }, ref) => {
    const isElevated = variant === 'elevated';
    return (
      <div
        ref={ref}
        className={`
          border rounded-xl p-4 md:p-6
          ${variantStyles[variant]}
          ${hoverable ? 'transition-all duration-300 hover:shadow-[var(--shadow-lg)] hover:-translate-y-1.5 hover:border-[var(--accent-light)]/30 cursor-pointer' : ''}
          ${className}
        `}
        style={{
          ...(isElevated ? { borderTop: '2px solid transparent', borderImage: 'var(--gradient-gold) 1', borderImageSlice: '1 0 0 0' } : {}),
          ...style,
        }}
        {...props}
      >
        {variant === 'premium' && (
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'var(--gradient-concert-hall)' }} />
        )}
        {variant === 'musical' && (
          <div className="absolute inset-0 pointer-events-none chart-bg opacity-40" />
        )}
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
