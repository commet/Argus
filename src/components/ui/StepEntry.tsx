'use client';

import { useState, useEffect } from 'react';
import { Button } from './Button';
import { AnimatedPlaceholder } from './AnimatedPlaceholder';
import { Sparkles, ChevronLeft } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';

interface EntryOption {
  value: string;
  label: string;
  emoji: string;
  description?: string;
}

export interface EntryStep {
  key: string;
  question: string;
  options: EntryOption[];
  locked?: boolean;
  unlockMessage?: string;
  adaptive?: boolean;
}

interface StepEntryProps {
  steps: EntryStep[];
  textLabel: string;
  textPlaceholder: string;
  textHint?: string;
  /** When provided, cycles through these texts as an animated placeholder */
  animatedPlaceholders?: string[];
  /** Dynamic animated placeholders based on selections (overrides animatedPlaceholders) */
  dynamicAnimatedPlaceholdersFn?: (selections: Record<string, string>) => string[];
  submitLabel?: string;
  onSubmit: (selections: Record<string, string>, text: string) => void;
  onSelectionChange?: (selections: Record<string, string>) => void;
  dynamicPlaceholderFn?: (selections: Record<string, string>) => string;
  disabled?: boolean;
  initialText?: string;
  contextPanel?: React.ReactNode;
}

export function StepEntry({
  steps,
  textLabel,
  textPlaceholder,
  textHint,
  submitLabel,
  onSubmit,
  onSelectionChange,
  animatedPlaceholders,
  dynamicAnimatedPlaceholdersFn,
  dynamicPlaceholderFn,
  disabled,
  initialText,
  contextPanel,
}: StepEntryProps) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const resolvedSubmitLabel = submitLabel ?? L('AI 분석 시작', 'Start AI analysis');
  const [currentStep, setCurrentStep] = useState(initialText ? steps.length : 0);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [text, setText] = useState(initialText || '');

  // Clamp currentStep when steps array shrinks (adaptive branching)
  useEffect(() => {
    if (currentStep > steps.length) {
      setCurrentStep(steps.length);
    }
  }, [steps.length, currentStep]);

  const isLastStep = currentStep >= steps.length;
  const currentEntryStep = steps[currentStep];

  const handleSelect = (stepKey: string, value: string) => {
    const newSelections = { ...selections, [stepKey]: value };
    setSelections(newSelections);
    onSelectionChange?.(newSelections);
    // Auto-advance to next step
    setTimeout(() => setCurrentStep((prev) => prev + 1), 200);
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSubmit = () => {
    // Text is optional if card selections provide enough context
    if (!text.trim() && Object.keys(selections).length === 0) return;
    onSubmit(selections, text);
  };

  const finalPlaceholder = dynamicPlaceholderFn
    ? dynamicPlaceholderFn(selections)
    : textPlaceholder;

  const finalAnimatedPlaceholders = dynamicAnimatedPlaceholdersFn
    ? dynamicAnimatedPlaceholdersFn(selections)
    : animatedPlaceholders;

  return (
    <div className="space-y-4">
      {/* Progress indicator — dots + a stable "n / total" readout. `total`
         counts every card step plus the final text step (the trailing bar). */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all ${
                i < currentStep ? 'w-6 bg-[var(--accent)]' : i === currentStep ? 'w-6 bg-[var(--accent)]/50' : 'w-3 bg-[var(--border)]'
              }`}
            />
          ))}
          <div className={`h-1 rounded-full transition-all ${isLastStep ? 'w-6 bg-[var(--accent)]/50' : 'w-3 bg-[var(--border)]'}`} />
        </div>
        <span className="shrink-0 text-[11px] font-medium text-[var(--text-tertiary)] tabular-nums">
          {Math.min(currentStep + 1, steps.length + 1)} / {steps.length + 1}
        </span>
      </div>

      {/* Card selection steps */}
      {!isLastStep && currentEntryStep && (
        <div className="animate-fade-in" key={`${currentStep}-${currentEntryStep.key}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-[15px] font-bold text-[var(--text-primary)]">
                {currentEntryStep.question}
              </h3>
              {currentEntryStep.adaptive && (
                <span className="text-[10px] text-[var(--accent)] bg-[var(--ai)] px-2 py-0.5 rounded-full font-medium animate-fade-in">
                  {L('맞춤 질문', 'Tailored question')}
                </span>
              )}
            </div>
            {currentStep > 0 && (
              <button onClick={handleBack} className="flex items-center gap-1 text-[12px] text-[var(--accent)] cursor-pointer hover:underline">
                <ChevronLeft size={12} /> {L('이전', 'Back')}
              </button>
            )}
          </div>

          {/* Locked step */}
          {currentEntryStep.locked ? (
            <div className="text-center py-10 rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg)]">
              <span className="text-[32px]">🔒</span>
              <p className="text-[15px] text-[var(--text-secondary)] mt-3 font-medium">
                {currentEntryStep.unlockMessage || L('아직 열리지 않은 질문입니다', "This question isn't unlocked yet")}
              </p>
              <button
                onClick={() => setCurrentStep(prev => prev + 1)}
                className="mt-4 text-[14px] font-semibold text-[var(--accent)] hover:underline cursor-pointer"
              >
                {L('건너뛰기 →', 'Skip →')}
              </button>
            </div>
          ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {currentEntryStep.options.map((option) => {
              const isSelected = selections[currentEntryStep.key] === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => handleSelect(currentEntryStep.key, option.value)}
                  className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[var(--accent)] bg-[var(--ai)] shadow-sm'
                      : 'border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--ai)]/30'
                  }`}
                >
                  <span className="text-[20px] mt-0.5">{option.emoji}</span>
                  <div>
                    <p className="text-[13px] font-semibold text-[var(--text-primary)]">{option.label}</p>
                    {option.description && (
                      <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{option.description}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          )}

          {/* Selected chips summary */}
          {Object.keys(selections).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {steps.map((step) => {
                const val = selections[step.key];
                if (!val) return null;
                const opt = step.options.find((o) => o.value === val);
                return (
                  <span
                    key={step.key}
                    className="px-2 py-0.5 rounded-full bg-[var(--ai)] text-[var(--ai-fg)] text-[10px] font-semibold"
                  >
                    {opt?.emoji} {opt?.label}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Text input (final step) */}
      {isLastStep && (
        <div className="animate-fade-in space-y-3">
          {contextPanel}
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] font-bold text-[var(--text-primary)]">{textLabel}</h3>
            <button onClick={handleBack} className="flex items-center gap-1 text-[12px] text-[var(--accent)] cursor-pointer hover:underline">
              <ChevronLeft size={12} /> {L('이전', 'Back')}
            </button>
          </div>

          {/* Selected context — compact inline pills + note */}
          {Object.keys(selections).length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-[var(--text-tertiary)] font-medium mr-0.5">{L('자동 반영:', 'Applied:')}</span>
              {steps.map((step) => {
                const val = selections[step.key];
                if (!val || step.locked) return null;
                const opt = step.options.find((o) => o.value === val);
                if (!opt) return null;
                return (
                  <span key={step.key} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--ai)] text-[11px] text-[var(--ai-fg)] font-medium">
                    {opt.emoji} {opt.label}
                  </span>
                );
              })}
            </div>
          )}

          <div className="relative">
            {finalAnimatedPlaceholders && finalAnimatedPlaceholders.length > 0 && (
              <AnimatedPlaceholder
                texts={finalAnimatedPlaceholders}
                visible={!text.trim()}
                className="absolute left-4 top-3 text-[14px] text-[var(--text-secondary)] leading-normal max-w-[calc(100%-2rem)] truncate"
              />
            )}
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleSubmit(); }}
              placeholder={finalAnimatedPlaceholders ? undefined : finalPlaceholder}
              className="w-full bg-[var(--bg)] border-[1.5px] border-[var(--border)] rounded-xl px-4 py-3 text-[15px] placeholder:text-[var(--text-secondary)] placeholder:text-[14px] focus:outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--gold-muted),var(--glow-accent)]"
            />
          </div>

          <div className="flex items-center justify-between">
            {!text.trim() && Object.keys(selections).length > 0 && (
              <p className="text-[11px] text-[var(--text-tertiary)]">{L('위 선택만으로도 시작할 수 있습니다', 'The selections above are enough to start')}</p>
            )}
            {(text.trim() || Object.keys(selections).length === 0) && <div />}
            <Button onClick={handleSubmit} disabled={(!text.trim() && Object.keys(selections).length === 0) || disabled}>
              <Sparkles size={14} /> {resolvedSubmitLabel}
            </Button>
          </div>
        </div>
      )}

      {/* Skip to text option */}
      {!isLastStep && (
        <button
          onClick={() => setCurrentStep(steps.length)}
          className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--accent)] cursor-pointer transition-colors"
        >
          {L('질문 건너뛰고 바로 쓰기 →', 'Skip the questions →')}
        </button>
      )}
    </div>
  );
}
