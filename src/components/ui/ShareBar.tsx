'use client';

import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { CopyButton } from './CopyButton';
import { EmailButton } from './EmailButton';
import { SlackChannelPicker } from './SlackChannelPicker';
import { Button } from './Button';
import { useSlackStore } from '@/stores/useSlackStore';
import { useT } from '@/contexts/LocaleProvider';
import { track } from '@/lib/analytics';

interface ShareBarProps {
  getText: () => string;
  getTitle: () => string;
  copyLabel?: string;
  /** Identifies the surface (e.g. 'rehearsal_result', 'project_brief') so we can
   *  measure which exports drive sharing. Defaults to 'unknown'. */
  shareContext?: string;
}

export function ShareBar({ getText, getTitle, copyLabel, shareContext = 'unknown' }: ShareBarProps) {
  const t = useT();
  const [slackOpen, setSlackOpen] = useState(false);
  const isConnected = useSlackStore(s => s.isConnected());
  const effectiveCopyLabel = copyLabel ?? t('ui.copyMarkdown');

  const trackShare = (channel: 'copy' | 'email' | 'slack') =>
    track('output_shared', { channel, context: shareContext });

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <CopyButton getText={getText} label={effectiveCopyLabel} onCopied={() => trackShare('copy')} />
        <EmailButton getSubject={getTitle} getBody={getText} onSent={() => trackShare('email')} />
        {isConnected ? (
          <Button variant="secondary" onClick={() => { trackShare('slack'); setSlackOpen(true); }}>
            <MessageSquare size={14} />
            Slack
          </Button>
        ) : (
          <a href="/settings" className="text-[12px] text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors px-2">
            {t('ui.connectSlack')}
          </a>
        )}
      </div>

      <SlackChannelPicker
        open={slackOpen}
        onClose={() => setSlackOpen(false)}
        title={getTitle()}
        content={getText()}
      />
    </>
  );
}
