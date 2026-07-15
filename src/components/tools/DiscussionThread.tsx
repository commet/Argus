'use client';

import type { DiscussionMessage, Persona } from '@/stores/types';
import { PersonaAvatar } from './FeedbackMessage';
import { Graticule } from '@/components/ui/VoyageElements';
import { Handshake, GitBranch, Lightbulb, HelpCircle } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';

interface DiscussionThreadProps {
  messages: DiscussionMessage[];
  personas: Persona[];
  keyTakeaway?: string;
}

const TYPE_CONFIG = {
  agreement: { icon: Handshake, labelKo: '동의', labelEn: 'agrees with', color: 'text-[var(--success)]' },
  disagreement: { icon: GitBranch, labelKo: '반박', labelEn: 'disagrees with', color: 'text-[#E24B4A]' },
  elaboration: { icon: Lightbulb, labelKo: '보충', labelEn: 'builds on', color: 'text-[var(--accent)]' },
  question: { icon: HelpCircle, labelKo: '질문', labelEn: 'asks', color: 'text-[var(--warning)]' },
};

export function DiscussionThread({ messages, personas, keyTakeaway }: DiscussionThreadProps) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const getPersona = (id: string) => personas.find(p => p.id === id);

  return (
    <div className="space-y-1 relative">
      <Graticule opacity={0.04} spacing={24} />
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex -space-x-2">
          {personas.slice(0, 3).map(p => (
            <PersonaAvatar key={p.id} name={p.name} personaId={p.id} size={28} />
          ))}
        </div>
        <h4 className="text-[14px] font-bold text-[var(--text-primary)]">{L('이해관계자 토론', 'Stakeholder discussion')}</h4>
      </div>

      {/* Messages */}
      <div className="space-y-3 phrase-entrance">
        {messages.map((msg, i) => {
          const persona = getPersona(msg.persona_id);
          if (!persona) return null;
          const config = TYPE_CONFIG[msg.type];
          const TypeIcon = config.icon;
          const reactingTo = msg.reacting_to ? getPersona(msg.reacting_to) : null;

          return (
            <div key={i} className="flex gap-2.5 md:gap-3">
              <div className="flex flex-col items-center shrink-0">
                <PersonaAvatar name={persona.name} personaId={persona.id} size={36} />
                {i < messages.length - 1 && (
                  <div className="w-px flex-1 mt-1 bg-[var(--border-subtle)]" />
                )}
              </div>
              <div className="flex-1 min-w-0 pb-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[13px] font-bold text-[var(--text-primary)]">{persona.name}</span>
                  <span className="text-[11px] text-[var(--text-tertiary)]">{persona.role}</span>
                </div>
                {reactingTo && (
                  <div className="flex items-center gap-1 mb-1.5">
                    <TypeIcon size={11} className={config.color} />
                    <span className={`text-[10px] font-semibold ${config.color}`}>
                      {locale === 'ko'
                        ? `${reactingTo.name}에게 ${config.labelKo}`
                        : `${config.labelEn} ${reactingTo.name}`}
                    </span>
                  </div>
                )}
                <div className="rounded-xl rounded-tl-sm bg-[var(--surface)] border border-[var(--border-subtle)] px-3.5 py-2.5 text-[13px] leading-relaxed text-[var(--text-primary)]">
                  {msg.message}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Key takeaway */}
      {keyTakeaway && (
        <div className="mt-4 flex items-start gap-2.5 px-4 py-3 rounded-xl bg-[var(--checkpoint)] border border-[var(--warning)]/30">
          <Lightbulb size={16} className="text-[var(--warning)] shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] font-bold text-[var(--warning)] mb-0.5">{L('핵심 결론', 'Key takeaway')}</p>
            <p className="text-[13px] text-[var(--text-primary)] leading-relaxed">{keyTakeaway}</p>
          </div>
        </div>
      )}
    </div>
  );
}
