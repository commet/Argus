'use client';

import { useState } from 'react';
import { Button } from './Button';
import { AnimatedPlaceholder } from './AnimatedPlaceholder';
import { Sparkles } from 'lucide-react';
import { t } from '@/lib/i18n';
import { useT } from '@/contexts/LocaleProvider';

interface ChipOption {
  value: string;
  label: string;
  emoji?: string;
}

interface ChipGroup {
  key: string;
  label: string;
  options: ChipOption[];
}

interface GuidedInputProps {
  chipGroups: ChipGroup[];
  textLabel: string;
  textPlaceholder: string;
  textHint?: string;
  /** When provided, cycles through these texts as an animated placeholder */
  animatedPlaceholders?: string[];
  submitLabel?: string;
  onSubmit: (context: Record<string, string>, text: string) => void;
  disabled?: boolean;
}

export function GuidedInput({
  chipGroups,
  textLabel,
  textPlaceholder,
  textHint,
  animatedPlaceholders,
  submitLabel,
  onSubmit,
  disabled,
}: GuidedInputProps) {
  const t = useT();
  const effectiveSubmitLabel = submitLabel ?? t('ui.submitAnalysis');
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [text, setText] = useState('');

  const handleSelect = (groupKey: string, value: string) => {
    setSelections((prev) => ({
      ...prev,
      [groupKey]: prev[groupKey] === value ? '' : value,
    }));
  };

  const handleSubmit = () => {
    if (!text.trim()) return;
    onSubmit(selections, text);
  };

  const buildPrompt = () => {
    const contextParts = chipGroups
      .filter((g) => selections[g.key])
      .map((g) => {
        const option = g.options.find((o) => o.value === selections[g.key]);
        return `${g.label}: ${option?.label || selections[g.key]}`;
      });
    const context = contextParts.length > 0 ? contextParts.join('\n') + '\n\n' : '';
    return context + text;
  };

  return (
    <div className="space-y-5">
      {/* Chip groups */}
      <div className="space-y-3">
        {chipGroups.map((group) => (
          <div key={group.key}>
            <label className="text-[13px] font-semibold text-[var(--text-primary)] mb-1.5 block">
              {group.label}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {group.options.map((option) => {
                const isSelected = selections[group.key] === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => handleSelect(group.key, option.value)}
                    className={`px-3 py-1.5 rounded-lg text-[13px] font-medium border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[var(--accent)] bg-[var(--ai)] text-[var(--text-primary)] shadow-sm'
                        : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {option.emoji && <span className="mr-1">{option.emoji}</span>}
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="border-t border-[var(--border)]" />

      {/* Text input */}
      <div>
        <label className="text-[13px] font-semibold text-[var(--text-primary)] mb-1 block">
          {textLabel}
        </label>
        {textHint && (
          <p className="text-[12.5px] text-[var(--text-secondary)] mb-2">{textHint}</p>
        )}
        <div className="relative">
          {animatedPlaceholders && animatedPlaceholders.length > 0 && (
            <AnimatedPlaceholder
              texts={animatedPlaceholders}
              visible={!text.trim()}
              className="absolute left-4 top-3 text-[14px] text-[var(--text-secondary)] leading-[1.7] max-w-[calc(100%-2rem)] truncate"
            />
          )}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={animatedPlaceholders ? undefined : textPlaceholder}
            maxLength={5000}
            className="w-full bg-[var(--bg)] border-[1.5px] border-[var(--border)] rounded-[10px] px-4 py-3 text-[15px] leading-[1.7] placeholder:text-[var(--text-secondary)] placeholder:text-[14px] focus:outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_rgba(74,111,165,0.08)] resize-none transition-all"
            rows={3}
          />
        </div>
      </div>

      {/* Submit */}
      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={!text.trim() || disabled}>
          <Sparkles size={14} /> {effectiveSubmitLabel}
        </Button>
      </div>
    </div>
  );
}

// Helper: combine chip selections + text into a rich prompt for the AI
export function buildContextPrompt(
  chipGroups: { key: string; label: string; options: { value: string; label: string }[] }[],
  selections: Record<string, string>,
  text: string
): string {
  const contextParts = chipGroups
    .filter((g) => selections[g.key])
    .map((g) => {
      const option = g.options.find((o) => o.value === selections[g.key]);
      return `- ${g.label}: ${option?.label || selections[g.key]}`;
    });

  if (contextParts.length > 0) {
    return `[${t('ui.contextLabel')}]\n${contextParts.join('\n')}\n\n[${t('ui.taskLabel')}]\n${text}`;
  }
  return text;
}
