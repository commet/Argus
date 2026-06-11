import type { MetadataRoute } from 'next';

const SITE_URL = 'https://argus.voyage';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, priority: 1 },
    { url: `${SITE_URL}/workspace`, priority: 0.9 },
    // /boss is deliberately absent — public/robots.txt disallows it.
    { url: `${SITE_URL}/guide`, priority: 0.8 },
    { url: `${SITE_URL}/login`, priority: 0.4 },
    { url: `${SITE_URL}/privacy`, priority: 0.2 },
    { url: `${SITE_URL}/terms`, priority: 0.2 },
  ];
}
