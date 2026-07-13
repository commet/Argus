'use client';

import { TextareaHTMLAttributes, forwardRef, useId } from 'react';
import { AnimatedPlaceholder } from './AnimatedPlaceholder';

interface FieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
  /** When provided, cycles through these texts as an animated placeholder instead of the static one */
  animatedPlaceholders?: string[];
}

export const Field = forwardRef<HTMLTextAreaElement, FieldProps>(
  ({ label, hint, error, className = '', animatedPlaceholders, id, 'aria-describedby': ariaDescribedBy, 'aria-invalid': ariaInvalid, ...props }, ref) => {
    const generatedId = useId();
    const fieldId = id ?? generatedId;
    const messageId = hint || error ? `${fieldId}-message` : undefined;
    const describedBy = [ariaDescribedBy, messageId].filter(Boolean).join(' ') || undefined;
    const hasValue = !!(props.value && String(props.value).length > 0);

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={fieldId} className="text-[14px] font-semibold text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-display)' }}>
            {label}
          </label>
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
            id={fieldId}
            className={`
              w-full bg-[var(--bg)]/50 border border-[var(--border)] rounded-xl
              px-4 py-3 text-[15px] leading-[1.7] text-[var(--text-primary)]
              placeholder:text-[var(--text-tertiary)] placeholder:text-[14px]
              shadow-[inset_0_1px_3px_rgba(0,0,0,0.06)]
              focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--gold-muted),var(--glow-accent)]
              focus:bg-[var(--surface)]
              aria-invalid:border-[var(--danger)] aria-invalid:shadow-[0_0_0_3px_color-mix(in_oklab,var(--danger)_12%,transparent)]
              resize-none transition-all duration-200
              ${className}
            `}
            rows={3}
            maxLength={5000}
            {...props}
            aria-describedby={describedBy}
            aria-invalid={error ? true : ariaInvalid}
            placeholder={animatedPlaceholders ? undefined : props.placeholder}
          />
        </div>
        {(error || hint) && (
          <p id={messageId} role={error ? 'alert' : undefined} className={`text-[12px] ${error ? 'font-medium text-[var(--danger)]' : 'text-[var(--text-secondary)]'}`}>
            {error ?? hint}
          </p>
        )}
      </div>
    );
  }
);

Field.displayName = 'Field';
