'use client';

/**
 * SessionExpiredToast — the one-line lantern for a lapsed login (P0-5).
 *
 * Listens to the `argus:session-expired` CustomEvent dispatched by
 * AuthProvider's onAuthStateChange when the session drops while the
 * `argus:knew-you` flag is still set (i.e. a token expiry, NOT an explicit
 * sign-out — signOut clears the flag first via clearAllStorage).
 *
 * Honesty contract: state facts only. "Work keeps saving on this device" is
 * true (localStorage-first); "cloud backup resumes on sign-in" is what
 * loadAndMerge actually does. Shown at most once per browser tab session
 * (sessionStorage dedupe) so a logged-out returning visitor isn't nagged on every
 * navigation. Mounted once in the global Header, next to StorageErrorToast.
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { CloudOff, X } from 'lucide-react';
import { LocaleLink } from '@/components/ui/LocaleLink';
import { useLocale } from '@/hooks/useLocale';
import { stripLocale } from '@/lib/locale-path';

const VISIBLE_MS = 15_000;
const SEEN_KEY = 'argus:expired-toast-seen';

export function SessionExpiredToast() {
  const locale = useLocale();
  const pathname = usePathname();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = () => {
      // Once per tab session — the amber SyncStatus badge carries the ongoing state.
      try {
        if (sessionStorage.getItem(SEEN_KEY) === '1') return;
        sessionStorage.setItem(SEEN_KEY, '1');
      } catch { /* if sessionStorage is unavailable, still show once */ }
      setVisible(true);
    };
    window.addEventListener('argus:session-expired', handler);
    return () => window.removeEventListener('argus:session-expired', handler);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setVisible(false), VISIBLE_MS);
    return () => clearTimeout(t);
  }, [visible]);

  // The login page already IS the handle — no toast on top of it.
  if (stripLocale(pathname || '/').startsWith('/login')) return null;

  const redirect = encodeURIComponent(pathname || '/');

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          role="status"
          aria-live="polite"
          className="fixed top-14 right-4 z-50 flex items-start gap-2 max-w-xs rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 shadow-md"
        >
          <CloudOff size={14} className="mt-0.5 shrink-0 text-amber-600" />
          <div className="min-w-0">
            <p className="text-[12px] leading-snug text-amber-800">
              {L(
                '로그인이 잠시 풀렸어요. 작업은 이 기기에 계속 저장되고 있어요 — 다시 로그인하면 클라우드 백업이 이어져요.',
                'Your sign-in lapsed. Work keeps saving on this device — sign in again and cloud backup resumes.',
              )}
            </p>
            <LocaleLink
              href={`/login?redirect=${redirect}`}
              className="inline-block mt-1 text-[12px] font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-700"
              onClick={() => setVisible(false)}
            >
              {L('다시 로그인', 'Sign in again')}
            </LocaleLink>
          </div>
          <button
            onClick={() => setVisible(false)}
            aria-label={L('닫기', 'Dismiss')}
            className="shrink-0 text-amber-600 hover:text-amber-800 cursor-pointer"
          >
            <X size={13} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
