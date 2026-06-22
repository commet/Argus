import { Header } from 'argus';

// Header — the sticky app chrome: wordmark, the three-door nav (워크스페이스 ·
// 프로젝트 · 설정), locale + theme toggles, and the auth area. It bails to null
// ONLY on the landing route ("/"); the preview runtime has no Next pathname
// (usePathname returns null across the bundle boundary), which Header tolerates
// — so it renders, just without an active-nav highlight. Signed-out state (the
// preview's AuthProvider resolves to no user) shows the Sign In link. The full
// desktop nav appears at md+, which the 900px capture viewport clears.
if (typeof window !== 'undefined') {
  window.localStorage.setItem('sot_settings', JSON.stringify({ language: 'ko' }));
}

export const Default = () => (
  <div style={{ background: 'var(--bg)', minHeight: 220 }}>
    <Header />
  </div>
);
