'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from './Button';
import { AnimatedPlaceholder } from './AnimatedPlaceholder';
import { Sparkles, ArrowRight, ArrowLeft, Check, SkipForward } from 'lucide-react';
import { t } from '@/lib/i18n';
import { useT } from '@/contexts/LocaleProvider';

interface ChipOption {
  value: string;
  label: string;
  emoji?: string;
}

export interface InterviewStep {
  key: string;
  question: string;
  label: string;
  hint?: string;
  type: 'chips' | 'textarea';
  options?: ChipOption[];
  placeholder?: string;
  /** When provided, cycles through these texts as an animated placeholder */
  animatedPlaceholders?: string[];
  required?: boolean;
  rows?: number;
}

interface InterviewInputProps {
  steps: InterviewStep[];
  submitLabel?: string;
  onSubmit: (answers: Record<string, string>) => void;
  disabled?: boolean;
}

export function InterviewInput({
  steps,
  submitLabel,
  onSubmit,
  disabled,
}: InterviewInputProps) {
  const t = useT();
  const effectiveSubmitLabel = submitLabel ?? t('ui.submitAnalysis');
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showSummary, setShowSummary] = useState(false);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;
  const progress = ((currentStep + (showSummary ? 1 : 0)) / steps.length) * 100;

  const canProceed = useCallback(() => {
    if (!step?.required) return true;
    return !!answers[step.key]?.trim();
  }, [step, answers]);

  const goNext = useCallback(() => {
    setDirection('forward');
    if (isLast) {
      setShowSummary(true);
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  }, [isLast]);

  const goBack = useCallback(() => {
    setDirection('back');
    if (showSummary) {
      setShowSummary(false);
    } else if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [showSummary, currentStep]);

  const handleChipSelect = (key: string, value: string) => {
    const isDeselect = answers[key] === value;
    setAnswers((prev) => ({
      ...prev,
      [key]: isDeselect ? '' : value,
    }));

    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);

    if (!isDeselect) {
      autoAdvanceRef.current = setTimeout(() => {
        goNext();
      }, 500);
    }
  };

  const handleTextChange = (key: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (canProceed()) goNext();
    }
  };

  const handleSubmit = () => {
    onSubmit(answers);
  };

  const goToStep = (index: number) => {
    setDirection('back');
    setShowSummary(false);
    setCurrentStep(index);
  };

  // ─── Summary View ───
  if (showSummary) {
    const answeredSteps = steps.filter((s) => answers[s.key]?.trim());
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="space-y-1">
          <h3 className="text-[15px] font-bold text-[var(--text-primary)]">
            {t('ui.reviewInput')}
          </h3>
          <p className="text-[12px] text-[var(--text-secondary)]">
            {t('ui.reviewInputHint')}
          </p>
        </div>

        <div className="space-y-2">
          {steps.map((s, i) => {
            const answer = answers[s.key];
            if (!answer?.trim()) return null;
            const chipLabel = s.options?.find((o) => o.value === answer);
            return (
              <div
                key={s.key}
                className="flex items-start gap-3 p-3 rounded-lg bg-[var(--bg)] border border-[var(--border)]"
              >
                <span className="text-[12.5px] font-bold text-[var(--accent)] bg-[var(--ai)] px-1.5 py-0.5 rounded mt-0.5 shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] text-[var(--text-secondary)]">
                    {s.label}
                  </p>
                  <p className="text-[14px] text-[var(--text-primary)] mt-0.5 whitespace-pre-wrap">
                    {chipLabel
                      ? `${chipLabel.emoji ? chipLabel.emoji + ' ' : ''}${chipLabel.label}`
                      : answer.length > 100
                        ? answer.slice(0, 100) + '...'
                        : answer}
                  </p>
                </div>
                <button
                  onClick={() => goToStep(i)}
                  className="text-[12px] text-[var(--accent)] hover:underline cursor-pointer shrink-0"
                >
                  {t('ui.edit')}
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex justify-between pt-2">
          <Button variant="secondary" size="sm" onClick={goBack}>
            <ArrowLeft size={14} /> {t('ui.previous')}
          </Button>
          <Button onClick={handleSubmit} disabled={disabled}>
            <Sparkles size={14} /> {effectiveSubmitLabel}
          </Button>
        </div>
      </div>
    );
  }

  // ─── Step View ───
  return (
    <div className="space-y-5">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-[12.5px] font-medium text-[var(--text-secondary)]">
            {currentStep + 1} / {steps.length}
          </span>
          {!step.required && (
            <span className="text-[12.5px] text-[var(--text-secondary)]">
              {t('ui.optional')}
            </span>
          )}
        </div>
        <div className="h-1 bg-[var(--border)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--accent)] rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div
        key={currentStep}
        className={direction === 'forward' ? 'animate-slide-in-right' : 'animate-slide-in-left'}
      >
        <h3 className="text-[16px] font-bold text-[var(--text-primary)]">
          {step.question}
        </h3>
        {step.hint && (
          <p className="text-[12px] text-[var(--text-secondary)] mt-1">
            {step.hint}
          </p>
        )}

        {/* Chips */}
        {step.type === 'chips' && step.options && (
          <div className="flex flex-wrap gap-2 mt-4">
            {step.options.map((option) => {
              const isSelected = answers[step.key] === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => handleChipSelect(step.key, option.value)}
                  className={`px-4 py-2.5 rounded-xl text-[14px] font-medium border-[1.5px] transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[var(--accent)] bg-[var(--ai)] text-[var(--text-primary)] shadow-sm scale-[1.02]'
                      : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--text-primary)] hover:bg-[var(--bg)]'
                  }`}
                >
                  {option.emoji && (
                    <span className="mr-1.5">{option.emoji}</span>
                  )}
                  {option.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Textarea */}
        {step.type === 'textarea' && (
          <div className="relative mt-4">
            {step.animatedPlaceholders && step.animatedPlaceholders.length > 0 && (
              <AnimatedPlaceholder
                texts={step.animatedPlaceholders}
                visible={!answers[step.key]?.trim()}
                className="absolute left-4 top-3 text-[14px] text-[var(--text-secondary)] leading-[1.7] max-w-[calc(100%-2rem)] truncate"
              />
            )}
            <textarea
              value={answers[step.key] || ''}
              onChange={(e) => handleTextChange(step.key, e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={step.animatedPlaceholders ? undefined : step.placeholder}
              className="w-full bg-[var(--bg)] border-[1.5px] border-[var(--border)] rounded-[10px] px-4 py-3 text-[15px] leading-[1.7] placeholder:text-[var(--text-secondary)] placeholder:text-[14px] focus:outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_rgba(74,111,165,0.08)] resize-none transition-all"
              rows={step.rows || 3}
              maxLength={5000}
              autoFocus
            />
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-2">
        <div>
          {currentStep > 0 && (
            <Button variant="secondary" size="sm" onClick={goBack}>
              <ArrowLeft size={14} /> {t('ui.previous')}
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          {!step.required && (
            <Button variant="ghost" size="sm" onClick={goNext}>
              {t('ui.skip')} <SkipForward size={12} />
            </Button>
          )}
          <Button
            onClick={goNext}
            disabled={step.required && !canProceed()}
            size="sm"
          >
            {isLast ? (
              <>
                {t('ui.confirm')} <Check size={14} />
              </>
            ) : (
              <>
                {t('ui.next')} <ArrowRight size={14} />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Build a rich prompt from interview answers */
export function buildInterviewPrompt(
  steps: InterviewStep[],
  answers: Record<string, string>
): string {
  const contextParts: string[] = [];
  let mainText = '';

  steps.forEach((step) => {
    const answer = answers[step.key]?.trim();
    if (!answer) return;

    if (step.type === 'textarea') {
      if (step.required && !mainText) {
        mainText = answer;
      } else {
        contextParts.push(`- ${step.label}: ${answer}`);
      }
    } else if (step.type === 'chips' && step.options) {
      const option = step.options.find((o) => o.value === answer);
      if (option) {
        contextParts.push(`- ${step.label}: ${option.label}`);
      }
    }
  });

  if (contextParts.length > 0 && mainText) {
    return `[${t('ui.contextLabel')}]\n${contextParts.join('\n')}\n\n[${t('ui.taskLabel')}]\n${mainText}`;
  }
  return mainText;
}
