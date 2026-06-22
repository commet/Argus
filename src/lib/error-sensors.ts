/**
 * Global client error sensors — capture uncaught JS errors and unhandled promise
 * rejections as analytics events so silent failures during a traffic spike are
 * visible (previously these only hit the console / nothing). Idempotent; mounted
 * once from Providers. Never throws (analytics must never break the app).
 */
import { track } from './analytics';

let _installed = false;

export function initErrorSensors() {
  if (_installed || typeof window === 'undefined') return;
  _installed = true;

  // Rate-limit: a single broken render can fire hundreds of errors — cap per load.
  let budget = 25;
  const guard = () => budget-- > 0;

  window.addEventListener('error', (e: ErrorEvent) => {
    if (!guard()) return;
    try {
      track('unhandled_error', {
        message: String(e.message || '').slice(0, 300),
        source: e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : undefined,
        name: e.error?.name,
      });
    } catch { /* never break */ }
  });

  window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
    if (!guard()) return;
    try {
      const reason = e.reason;
      const message = reason instanceof Error ? reason.message : String(reason ?? '');
      track('unhandled_rejection', {
        message: message.slice(0, 300),
        name: reason instanceof Error ? reason.name : undefined,
      });
    } catch { /* never break */ }
  });
}
