import { HTMLAttributes, forwardRef } from 'react';

type CardVariant = 'default' | 'ai' | 'human' | 'checkpoint' | 'success' | 'danger' | 'muted' | 'elevated' | 'premium' | 'musical';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  variant?: CardVariant;
}

const variantStyles: Record<CardVariant, string> = {
  default: 'bg-[var(--surface)] border-[var(--border-subtle)] shadow-[var(--shadow-sm)]',
  ai: 'bg-[var(--ai)] border-[var(--accent-light)]/15 shadow-[var(--shadow-sm)]',
  human: 'bg-[var(--human)] border-[#8b6914]/10 shadow-[var(--shadow-sm)]',
  checkpoint: 'bg-[var(--checkpoint)] border-amber-200 shadow-[var(--shadow-sm)]',
  success: 'bg-[var(--collab)] border-green-200 shadow-[var(--shadow-sm)]',
  danger: 'bg-red-50/50 border-red-200/50 shadow-[var(--shadow-sm)]',
  muted: 'bg-[var(--bg)] border-[var(--border-subtle)]',
  elevated: 'bg-[var(--surface)] border-[var(--border-subtle)] shadow-[var(--shadow-md)]',
  premium: 'bg-[var(--surface)] border-[var(--border-subtle)] shadow-[var(--shadow-md)] relative overflow-hidden',
  musical: 'bg-[var(--surface)] border-[var(--border-subtle)] shadow-[var(--shadow-sm)] relative overflow-hidden',
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ hoverable = false, variant = 'default', className = '', children, style, ...props }, ref) => {
    const isElevated = variant === 'elevated';
    return (
      <div
        ref={ref}
        className={`
          border rounded-2xl p-4 md:p-6
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
