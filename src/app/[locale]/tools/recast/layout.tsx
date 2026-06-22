import type { Metadata } from 'next';
import { headers } from 'next/headers';

const META = {
  ko: { title: '실행 설계 — Argus', description: '구조와 역할을 설계합니다.' },
  en: { title: 'Recast — Argus', description: 'Design the structure and split of roles.' },
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
