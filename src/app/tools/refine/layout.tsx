import type { Metadata } from 'next';
import { headers } from 'next/headers';

const META = {
  ko: { title: '수정 반영 — Argus', description: '피드백을 반영하여 수렴합니다.' },
  en: { title: 'Refine — Argus', description: 'Apply feedback and converge to the final draft.' },
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
