'use client';

import Link from 'next/link';
import { Card } from './Card';
import { ArrowRight, Map, Users, RefreshCw, FileText } from 'lucide-react';
import { t } from '@/lib/i18n';

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

  if (currentTool === 'rehearse') {
    // Refine no longer exists as a standalone step — feedback convergence
    // happens inside Rehearse, so the next stop is Synthesize.
    options.push({
      href: '/tools/synthesize',
      icon: <RefreshCw size={16} />,
      label: t('nextStep.toSynthesize.label'),
      reason: t('nextStep.toSynthesize.reason'),
      primary: true,
    });
  }

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
        {options.map((option, i) => (
          <div
            key={i}
            className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer hover:border-[var(--accent)] hover:bg-[var(--surface)] ${
              option.primary ? 'border-[var(--accent)] bg-[var(--surface)] shadow-sm' : 'border-[var(--border)]'
            }`}
            onClick={() => {
              if (onSendTo && option.primary) {
                onSendTo(option.href);
              }
            }}
          >
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
            <Link href={option.href} className="shrink-0 mt-1">
              <ArrowRight size={14} className="text-[var(--text-secondary)] hover:text-[var(--accent)]" />
            </Link>
          </div>
        ))}
      </div>
    </Card>
  );
}
