'use client';

import { ButtonHTMLAttributes, forwardRef } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Dimensional rebuild (ArgusV2 foundry direction): each variant keeps its
 * colour identity but gains the logbook depth language — a top-to-base
 * gradient, a hairline border, a layered drop shadow + an inset top highlight,
 * and (on solid fills) a text shadow. All built from CSS vars + color-mix so
 * it adapts to light/dark instead of hardcoding parchment hexes. Hover/active
 * are transform + brightness (kept in className) so they don't fight the inline
 * resting shadow.
 *
 * ROLE SEPARATION (A3 / gold rule): `primary` = ink, the everyday action.
 * `accent` = gold — reserved for the USER's commit moments (확정·봉인·최종
 * 커밋), never for the machine spotlighting its own output. `secondary` =
 * quiet outline support, `ghost` = tertiary, `danger` = isolated destructive
 * hue. Press feedback is the unified tactile `active:scale-[0.96]`.
 */
const variantDepth: Record<Variant, React.CSSProperties> = {
  primary: {
    background: 'linear-gradient(180deg, color-mix(in oklab, var(--primary) 86%, #fff 14%), var(--primary))',
    border: '1px solid color-mix(in oklab, var(--primary) 55%, #000 45%)',
    color: 'var(--bg)',
    boxShadow:
      '0 1px 2px rgba(0,0,0,.28), 0 6px 15px color-mix(in oklab, var(--primary) 22%, transparent), inset 0 1px 0 rgba(255,255,255,.16)',
    textShadow: '0 1px 0 rgba(0,0,0,.22)',
  },
  accent: {
    background: 'var(--gradient-gold)',
    border: '1px solid color-mix(in oklab, var(--accent) 55%, #000 45%)',
    color: '#3a2a10',
    boxShadow:
      '0 1px 2px rgba(0,0,0,.18), 0 6px 15px color-mix(in oklab, var(--accent) 34%, transparent), inset 0 1px 0 rgba(255,255,255,.45)',
    textShadow: '0 1px 0 rgba(255,255,255,.3)',
  },
  secondary: {
    background: 'linear-gradient(180deg, color-mix(in oklab, var(--surface) 90%, #fff 10%), var(--surface))',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    boxShadow:
      '0 1px 2px color-mix(in oklab, var(--text-primary) 8%, transparent), inset 0 1px 0 color-mix(in oklab, #fff 55%, transparent)',
  },
  ghost: {
    background: 'transparent',
    border: '1px dashed var(--border)',
    color: 'var(--text-secondary)',
  },
  danger: {
    background:
      'linear-gradient(180deg, color-mix(in oklab, var(--risk-critical) 13%, var(--surface)), color-mix(in oklab, var(--risk-critical) 8%, var(--surface)))',
    border: '1px solid color-mix(in oklab, var(--risk-critical) 34%, transparent)',
    color: 'var(--risk-critical)',
    boxShadow: 'inset 0 1px 0 color-mix(in oklab, #fff 45%, transparent)',
  },
};

/**
 * Disabled = solid desaturation, NOT transparency (Argus 2.0 H1-C3). The old
 * `opacity-40` made a disabled primary CTA vanish into the page — users read
 * "no next action" instead of "this action, once you type". The button keeps
 * its full shape, padding, and hit area; only the affect drains out.
 * Acceptance bar: a disabled button still reads as a button in under a second.
 */
const disabledDepth: React.CSSProperties = {
  background: 'var(--bg-hover)',
  border: '1px solid var(--border)',
  color: 'var(--text-tertiary)',
  boxShadow: 'none',
  textShadow: 'none',
};

const sizeStyles: Record<string, string> = {
  sm: 'min-h-[44px] lg:min-h-[36px] px-3.5 py-1.5 text-[13px] rounded-lg',
  md: 'min-h-[44px] px-5 py-2.5 text-[14px] rounded-xl',
  lg: 'min-h-[44px] px-7 py-3 text-[15px] rounded-xl',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className = '', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`
          inline-flex items-center justify-center gap-2 font-semibold
          transition-[transform,filter] duration-150
          hover:-translate-y-[1px] hover:brightness-[1.04]
          active:scale-[0.96] active:translate-y-0 active:brightness-[0.98]
          disabled:pointer-events-none disabled:translate-y-0 disabled:scale-100
          cursor-pointer
          ${sizeStyles[size]}
          ${className}
        `}
        style={{ ...(props.disabled ? disabledDepth : variantDepth[variant]), ...props.style }}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
