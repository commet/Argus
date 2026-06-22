import type { Metadata } from 'next';
import { headers } from 'next/headers';

const META = {
  ko: { title: '설정 — Argus' },
  en: { title: 'Settings — Argus' },
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  const first = (h.get('accept-language') || '').split(',')[0]?.toLowerCase() ?? '';
  const lang: 'ko' | 'en' = first.startsWith('ko') ? 'ko' : 'en';
  return META[lang];
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
