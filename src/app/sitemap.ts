import type { MetadataRoute } from 'next';

const SITE_URL = 'https://argus.voyage';
const LOCALES = ['en', 'ko'] as const;

// Locale-less paths and their priority. Each is emitted once per locale with
// hreflang alternates pointing at the sibling locales.
const ROUTES: Array<{ path: string; priority: number }> = [
  { path: '', priority: 1 },
  { path: '/workspace', priority: 0.9 },
  // /boss is deliberately absent — public/robots.txt disallows it.
  { path: '/guide', priority: 0.8 },
  { path: '/import', priority: 0.7 },
  { path: '/login', priority: 0.4 },
  { path: '/privacy', priority: 0.2 },
  { path: '/terms', priority: 0.2 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.flatMap(({ path, priority }) =>
    LOCALES.map((locale) => ({
      url: `${SITE_URL}/${locale}${path}`,
      priority,
      alternates: {
        languages: Object.fromEntries(
          LOCALES.map((l) => [l, `${SITE_URL}/${l}${path}`]),
        ),
      },
    })),
  );
}
