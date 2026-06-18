// design-sync browser shim — NOT shipped to the real app.
// Next's app-router-context.shared-runtime.js references `process.env.NODE_ENV`
// at module-eval with no `typeof` guard. In claude.ai/design's plain-browser
// runtime there is no `process`, so loading the bundle would throw
// "ReferenceError: process is not defined" and every preview would go blank.
// This must be imported BEFORE any module that touches `process` (the entry
// imports it on its first line, so it evaluates first in ESM order).
// The stores some components import build a Supabase client at module-eval
// (`createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, …)` in src/lib/supabase.ts),
// which throws "supabaseUrl is required" on an empty env. Dummy values keep the
// client constructable; previews never make a network call, so the values are inert.
const g = globalThis as unknown as {
  process?: {
    env: Record<string, string>;
    nextTick?: (cb: (...a: unknown[]) => void) => void;
    version?: string;
    versions?: Record<string, string>;
    platform?: string;
    browser?: boolean;
  };
};
if (typeof g.process === 'undefined') {
  g.process = { env: {} };
}
// gotrue-js (pulled in by AuthProvider's getSession) schedules with
// process.nextTick on the non-edge path; without it the auth call throws.
g.process.nextTick ||= (cb, ...args) => setTimeout(() => cb(...args), 0);
g.process.version ||= 'v20.0.0';
g.process.versions ||= {};
g.process.platform ||= 'browser';
g.process.browser ||= true;
g.process.env.NODE_ENV ||= 'production';
g.process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://stub.supabase.co';
g.process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'stub-anon-key';
export {};
