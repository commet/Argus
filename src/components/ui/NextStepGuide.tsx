'use client';

import { LocaleLink } from '@/components/ui/LocaleLink';
import { Card } from './Card';
import { ArrowRight, Map, Users, FileText } from 'lucide-react';
import { useT } from '@/contexts/LocaleProvider';

interface NextStepOption {
  href: string;
  icon: React.ReactNode;
  label: string;
  reason: string;
  primary?: boolean;
}

interface NextStepGuideProps {
  currentTool: 'reframe' | 'recast' | 'rehearse' | 'refine';
  projectId?: string;
  onSendTo?: (tool: string) => void;
}

export function NextStepGuide({
  currentTool,
  projectId,
  onSendTo,
}: NextStepGuideProps) {
  const t = useT();
  const options: NextStepOption[] = [];

  if (currentTool === 'reframe') {
    options.push({
      href: '/tools/recast',
      icon: <Map size={16} />,
      label: t('nextStep.toRecast.label'),
      reason: t('nextStep.toRecast.reason'),
      primary: true,
    });
  }

  if (currentTool === 'recast') {
    options.push({
      href: '/tools/rehearse',
      icon: <Users size={16} />,
      label: t('nextStep.toRehearse.label'),
      reason: t('nextStep.toRehearse.reason'),
      primary: true,
    });
  }

  // rehearse deliberately pushes NOTHING as primary (Argus 2.0 H1-B2): the old
  // "→ Synthesize" guidance sent users to a terminus that dropped their context
  // (no handoff fired from this card) and, until recently, couldn't even seal.
  // The project-overview row below remains the honest landing; H2 replaces this
  // whole leg with rehearse → SealMoment directly.

  if (currentTool === 'refine') {
    options.push({
      href: '/project',
      icon: <FileText size={16} />,
      label: t('nextStep.toPerform.label'),
      reason: t('nextStep.toPerform.reason'),
      primary: true,
    });
    options.push({
      href: '/tools/rehearse',
      icon: <Users size={16} />,
      label: t('nextStep.rehearseAgain.label'),
      reason: t('nextStep.rehearseAgain.reason'),
    });
  }

  if (projectId && currentTool !== 'refine') {
    options.push({
      href: '/project',
      icon: <FileText size={16} />,
      label: t('nextStep.overview.label'),
      reason: t('nextStep.overview.reason'),
    });
  }

  if (options.length === 0) return null;

  return (
    <Card className="!bg-[var(--bg)] !border-[var(--border)]">
      <p className="text-[12px] font-bold text-[var(--text-secondary)] mb-3">{t('ui.nextStep')}</p>
      <div className="space-y-2">
        {options.map((option, i) => {
          const rowClass = `flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer hover:border-[var(--accent)] hover:bg-[var(--surface)] ${
            option.primary ? 'border-[var(--accent)] bg-[var(--surface)] shadow-sm' : 'border-[var(--border)]'
          }`;
          const body = (
            <>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                option.primary ? 'bg-[var(--accent)] text-[var(--bg)]' : 'bg-[var(--bg)] text-[var(--text-secondary)]'
              }`}>
                {option.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold text-[var(--text-primary)]">{option.label}</span>
                  {option.primary && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent)] text-[var(--bg)] font-semibold">{t('ui.recommended')}</span>
                  )}
                </div>
                <p className="text-[12px] text-[var(--text-secondary)] mt-0.5 leading-relaxed">{option.reason}</p>
              </div>
              <ArrowRight size={14} className="shrink-0 mt-1 text-[var(--text-secondary)]" />
            </>
          );
          // One row = one action (F30 fix): a primary row with an in-page
          // handler is a real button; every other row is a real link. No more
          // rows that look clickable but do nothing, no nested link-in-button.
          return onSendTo && option.primary ? (
            <div
              key={i}
              role="button"
              tabIndex={0}
              className={rowClass}
              onClick={() => onSendTo(option.href)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSendTo(option.href); } }}
            >
              {body}
            </div>
          ) : (
            <LocaleLink key={i} href={option.href} className={rowClass}>
              {body}
            </LocaleLink>
          );
        })}
      </div>
    </Card>
  );
}
