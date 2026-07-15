'use client';

import type { Persona } from '@/stores/types';
import { MessageSquare, Crown, Shield, User } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';

interface PersonaCardProps {
  persona: Persona;
  onClick: () => void;
  selected?: boolean;
  selectable?: boolean;
  onSelect?: (selected: boolean) => void;
}

function getInfluenceConfig(locale: 'ko' | 'en') {
  const ko = locale === 'ko';
  return {
    high: { bg: 'bg-[var(--danger)]/10', border: 'border-[var(--danger)]/25', text: 'text-[var(--danger)]', label: ko ? '높음' : 'High', Icon: Crown },
    medium: { bg: 'bg-[var(--warning)]/10', border: 'border-[var(--warning)]/30', text: 'text-[var(--warning)]', label: ko ? '중간' : 'Med', Icon: Shield },
    low: { bg: 'bg-[var(--ai)]', border: 'border-[var(--ai-fg)]/20', text: 'text-[var(--ai-fg)]', label: ko ? '낮음' : 'Low', Icon: User },
  } as const;
}

export function PersonaCard({ persona, onClick, selected, selectable, onSelect }: PersonaCardProps) {
  const locale = useLocale();
  const inf = getInfluenceConfig(locale)[persona.influence || 'medium'];
  const InfIcon = inf.Icon;

  return (
    <div
      onClick={selectable ? () => onSelect?.(!selected) : onClick}
      className={`
        relative rounded-xl border p-4 cursor-pointer transition-all duration-300
        ${selected
          ? 'border-[var(--accent)] bg-[var(--ai)] shadow-[var(--shadow-md)] -translate-y-1'
          : 'border-[var(--border-subtle)] hover:border-[var(--border)] hover:shadow-[var(--shadow-md)] hover:-translate-y-1 bg-[var(--surface)] shadow-[var(--shadow-sm)]'
        }
      `}
    >
      <div className="flex items-start gap-3">
        {/* Avatar with influence ring */}
        <div
          className={`
            w-11 h-11 rounded-xl flex items-center justify-center text-[18px] font-bold shrink-0 transition-all duration-200
            ${selected ? 'text-[var(--accent-fg)] shadow-[var(--glow-gold)]' : `${inf.bg} ${inf.text}`}
          `}
          style={selected ? { background: 'var(--gradient-gold)' } : undefined}
        >
          {persona.name.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          {/* Name + influence badge */}
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-[14px] font-bold text-[var(--text-primary)] truncate">{persona.name}</h3>
            <span className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${inf.bg} ${inf.text}`}>
              <InfIcon size={8} /> {inf.label}
            </span>
          </div>

          {/* Role + org */}
          <p className="text-[12px] text-[var(--text-secondary)] truncate">
            {persona.role}{persona.organization ? ` · ${persona.organization}` : ''}
          </p>

          {/* Traits */}
          {persona.extracted_traits.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {persona.extracted_traits.slice(0, 4).map((trait, i) => (
                <span key={i} className="px-1.5 py-0.5 rounded bg-[var(--bg)] text-[10px] text-[var(--text-secondary)] font-medium">
                  {trait}
                </span>
              ))}
            </div>
          )}

          {/* Priorities preview */}
          {persona.priorities && (
            <p className="text-[11px] text-[var(--text-tertiary)] mt-1.5 line-clamp-1">
              {persona.priorities}
            </p>
          )}
        </div>
      </div>

      {/* Feedback log count */}
      {persona.feedback_logs.length > 0 && (
        <div className="absolute top-3 right-3 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[var(--bg)] text-[10px] text-[var(--text-tertiary)] font-medium">
          <MessageSquare size={9} /> {persona.feedback_logs.length}
        </div>
      )}

      {/* Selection checkbox for selectable mode */}
      {selectable && (
        <div className="absolute top-3 right-3">
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
            selected ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-[var(--border)]'
          }`}>
            {selected && (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
