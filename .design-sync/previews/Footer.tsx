import { Footer } from 'argus';

// Footer — the quiet bottom rule of every app page: the wordmark tagline plus
// Terms / Privacy links. Locale-aware (seeded to Korean here).
if (typeof window !== 'undefined') {
  window.localStorage.setItem('sot_settings', JSON.stringify({ language: 'ko' }));
}

export const Default = () => (
  <div style={{ background: 'var(--bg)' }}>
    <Footer />
  </div>
);
