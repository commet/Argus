'use client';

/**
 * ForeignDataNotice — this device is holding a different account's decisions.
 *
 * Why a persistent notice and not a toast: the sync badge could only ever say
 * "백업 보류" forever, which reads as "the app is broken" when the truth is
 * "these decisions belong to another account, and yours are safe." That is a fact
 * the user has to act on, so it stays on screen until they do, and BOTH exits are
 * theirs — sign back into the other account, or start fresh here. Argus does not
 * pick, and does not quietly delete on their behalf.
 *
 * Listens for FOREIGN_DATA_EVENT (lib/account-scope), mirroring the window-event
 * pattern of AccountSyncToast so auth/db never import a component.
 */

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CloudOff, X } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import { useAuth } from '@/lib/auth';
import {
  FOREIGN_DATA_EVENT,
  discardForeignLocalData,
  foreignRowCounts,
  otherAccountLabel,
  readDataOwner,
  type ForeignDataSummary,
} from '@/lib/account-scope';

/** Dismissal lasts the tab session only. A permanent "never show again" would
 *  restore the exact silence this notice exists to break. */
const DISMISS_KEY = 'argus:foreign-data-dismissed';

export function ForeignDataNotice() {
  const locale = useLocale();
  const L = useCallback((ko: string, en: string) => (locale === 'ko' ? ko : en), [locale]);
  const { user, signOut } = useAuth();
  const [info, setInfo] = useState<ForeignDataSummary | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const dismissed = () => {
      try { return sessionStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
    };
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as ForeignDataSummary | undefined;
      if (detail && detail.rows > 0 && !dismissed()) setInfo(detail);
    };
    window.addEventListener(FOREIGN_DATA_EVENT, handler);
    // The live event fires at the moment of rejection — which already happened on
    // a previous page load for anyone whose rows are ALREADY quarantined. Without
    // this mount-time read, the quarantine would end the failure loop and then say
    // nothing, leaving another account's decisions on screen unexplained: a silent
    // swallow, which is the failure mode this whole change exists to remove.
    const counts = foreignRowCounts();
    if (counts.rows > 0 && !dismissed()) {
      setInfo({ ...counts, previousEmail: readDataOwner()?.email, reason: 'rejected' });
    }
    return () => window.removeEventListener(FOREIGN_DATA_EVENT, handler);
  }, []);

  if (!info || !user) return null;

  const count = info.projects || info.rows;
  const other = otherAccountLabel(info.previousEmail, user.email);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        role="status"
        aria-live="polite"
        className="fixed top-14 right-4 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-[var(--warning)]/30 bg-[var(--surface)] p-4 shadow-lg"
      >
        <div className="flex items-start gap-2">
          <CloudOff size={14} className="mt-0.5 shrink-0 text-[var(--warning)]" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium leading-snug text-[var(--text-primary)]">
              {other
                ? L(`이 기기에 다른 계정(${other})의 기록 ${count}건이 있어요.`,
                    `This device holds ${count} record${count === 1 ? '' : 's'} from another account (${other}).`)
                : L(`이 기기에 다른 계정의 기록 ${count}건이 있어요.`,
                    `This device holds ${count} record${count === 1 ? '' : 's'} from another account.`)}
            </p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--text-secondary)]">
              {L('그 기록은 지금 로그인한 계정에 백업되지 않아요 — 원래 계정에 그대로 남아 있어요. 지금 계정의 새 작업은 정상 백업됩니다.',
                 "They are not backed up to the account you are signed into — they stay with the account that made them. New work on this account backs up normally.")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* private mode — dismiss stays in-memory */ }
              setInfo(null);
            }}
            aria-label={L('닫기', 'Dismiss')}
            className="-mr-1 -mt-1 shrink-0 rounded p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            <X size={13} />
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => { setBusy(true); void signOut(); }}
            className="min-h-8 rounded-md border border-[var(--border-subtle)] px-2.5 py-1 text-[12px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            {L('그 계정으로 로그인', 'Sign in to that account')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              discardForeignLocalData(user.id, user.email);
              window.location.reload();
            }}
            className="min-h-8 rounded-md border border-[var(--border-subtle)] px-2.5 py-1 text-[12px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            {L('이 기기에서 정리', 'Clear from this device')}
          </button>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-tertiary)]">
          {L('정리하면 이 기기의 사본만 지워져요. 아직 백업되지 않은 것이 있다면 함께 사라지니, 확실히 지키려면 먼저 그 계정으로 로그인하세요.',
             'Clearing removes only this device’s copy. Anything not yet backed up would go with it — to be sure, sign in to that account first.')}
        </p>
      </motion.div>
    </AnimatePresence>
  );
}
