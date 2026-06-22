'use client';

import { TextareaHTMLAttributes, forwardRef } from 'react';
import { AnimatedPlaceholder } from './AnimatedPlaceholder';

interface FieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  /** When provided, cycles through these texts as an animated placeholder instead of the static one */
  animatedPlaceholders?: string[];
}

export const Field = forwardRef<HTMLTextAreaElement, FieldProps>(
  ({ label, hint, className = '', animatedPlaceholders, ...props }, ref) => {
    const hasValue = !!(props.value && String(props.value).length > 0);

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-[14px] font-semibold text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-display)' }}>
            {label}
          </label>
        )}
        {hint && (
          <p className="text-[12px] text-[var(--text-secondary)]">{hint}</p>
        )}
        <div className="relative">
          {animatedPlaceholders && animatedPlaceholders.length > 0 && (
            <AnimatedPlaceholder
              texts={animatedPlaceholders}
              visible={!hasValue}
              className="absolute left-4 top-3 text-[14px] text-[var(--text-tertiary)] leading-[1.7] max-w-[calc(100%-2rem)] truncate"
            />
          )}
          <textarea
            ref={ref}
            className={`
              w-full bg-[var(--bg)]/50 border border-[var(--border)] rounded-xl
              px-4 py-3 text-[15px] leading-[1.7] text-[var(--text-primary)]
              placeholder:text-[var(--text-tertiary)] placeholder:text-[14px]
              shadow-[inset_0_1px_3px_rgba(0,0,0,0.06)]
              focus:outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--gold-muted),var(--glow-accent)]
              focus:bg-[var(--surface)]
              resize-none transition-all duration-200
              ${className}
            `}
            rows={3}
            maxLength={5000}
            {...props}
            placeholder={animatedPlaceholders ? undefined : props.placeholder}
          />
        </div>
      </div>
    );
  }
);

Field.displayName = 'Field';
