'use client';

/**
 * ErrorBanner — the inline error surface lifted out of ProgressiveFlow.
 * Handles the LOGIN_REQUIRED upsell and the generic / rate-limit error with
 * its Settings deep-link. Pure presentation over the  string.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, AlertTriangle } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';

export function ErrorBanner({ error }: { error: string | null }) {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  return (
          <AnimatePresence>
            {error && <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {error.startsWith('LOGIN_REQUIRED') ? (
                <div className="rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent)]/5 p-6">
                  <p className="text-[15px] font-bold text-[var(--text-primary)] mb-1">{L('무료 체험을 모두 사용했어요', 'Free trial limit reached')}</p>
                  <p className="text-[13px] text-[var(--text-secondary)] mb-4">{L('로그인하면 하루 10회까지 무료로 사용할 수 있습니다.', 'Sign in to get up to 10 free uses per day.')}</p>
                  <a href="/login" className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-white text-[14px] font-semibold" style={{ background: 'var(--gradient-gold)' }}>{L('로그인', 'Sign In')} <ChevronRight size={14} /></a>
                </div>
              ) : (
                <div className="flex items-start gap-2.5 px-5 py-4 rounded-2xl bg-red-50 border border-red-200 text-[13px] text-red-700">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <div>
                    <span>{error?.includes('한도') || error?.includes('rate') ? L('무료 체험 한도에 도달했습니다. Settings에서 본인의 API 키를 등록하면 무제한 사용이 가능합니다.', 'Free trial limit reached. Register your own API key in Settings for unlimited use.') : error}</span>
                    {(error?.includes('한도') || error?.includes('rate')) && (
                      <a href="/settings" className="block mt-1.5 text-[12px] text-red-600 font-medium hover:underline">{L('Settings에서 API 키 등록하기 →', 'Register API key in Settings →')}</a>
                    )}
                  </div>
                </div>
              )}
            </motion.div>}
          </AnimatePresence>
  );
}
