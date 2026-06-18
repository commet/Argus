// design-sync preview provider — NOT shipped to the real app.
// Several landing sections (Act2DecisionVoyage, SirenHero) call useRouter() from
// next/navigation at render time. Outside a Next.js app, next/navigation throws
// "invariant expected app router to be mounted". claude.ai/design renders these
// components in a plain React runtime, so we supply a no-op App Router context.
// Both components only ever call router.push() inside click handlers, so a stub
// with the full method surface is enough — nothing navigates in a preview.
// MUST be first: defines `process` before app-router-context / supabase / gotrue
// evaluate it. Belt-and-suspenders with the entry's first-line import — guarantees
// the shim runs before THIS module's own imports initialize.
import './_process-shim';
import React from 'react';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
// LandingHeader (and any auth-aware surface) calls useAuth(), which throws
// "useAuth must be used within AuthProvider" outside the provider. AuthProvider's
// only mount side-effect is supabase.auth.getSession() — with the dummy supabase
// env it rejects and falls to { loading:false, user:null }, i.e. the signed-out
// state, so wrapping every preview in it is safe for the components that ignore it.
import { AuthProvider } from '../src/lib/auth';

const noop = () => {};
const stubRouter = {
  push: noop,
  replace: noop,
  back: noop,
  forward: noop,
  refresh: noop,
  prefetch: () => Promise.resolve(),
};

export function DesignRouterProvider({ children }: { children?: React.ReactNode }) {
  return (
    <AppRouterContext.Provider value={stubRouter as never}>
      <AuthProvider>{children}</AuthProvider>
    </AppRouterContext.Provider>
  );
}
