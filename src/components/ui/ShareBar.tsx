'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';
import { CopyButton } from './CopyButton';
import { Button } from './Button';
import { ShareComposer } from './ShareComposer';
import { useT } from '@/contexts/LocaleProvider';
import { useLocale } from '@/hooks/useLocale';

interface ShareBarProps {
  getText: () => string;
  getTitle: () => string;
  copyLabel?: string;
  /** Identifies the surface (e.g. 'rehearsal_result', 'project_brief') so we can
   *  measure which exports drive sharing. Defaults to 'unknown'. */
  shareContext?: string;
}

/**
 * Copy is instant (paste IS the review). Every *transmitting* channel — email,
 * Slack, Telegram — goes through ShareComposer's preview→confirm flow behind one
 * "Send…" button, so nothing leaves the app without the user seeing it first.
 */
export function ShareBar({ getText, getTitle, copyLabel, shareContext = 'unknown' }: ShareBarProps) {
  const t = useT();
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const [composerOpen, setComposerOpen] = useState(false);
  const effectiveCopyLabel = copyLabel ?? t('ui.copyMarkdown');

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <CopyButton getText={getText} label={effectiveCopyLabel} />
        <Button variant="secondary" onClick={() => setComposerOpen(true)}>
          <Send size={14} />
          {L('보내기', 'Send')}
        </Button>
      </div>

      <ShareComposer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        getText={getText}
        getTitle={getTitle}
        shareContext={shareContext}
      />
    </>
  );
}
