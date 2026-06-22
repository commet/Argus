import type { Metadata } from 'next';
import { headers } from 'next/headers';

const META = {
  ko: { title: '워크스페이스 — Argus' },
  en: { title: 'Workspace — Argus' },
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
