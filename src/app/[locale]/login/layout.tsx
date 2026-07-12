import type { Metadata } from 'next';

const META = {
  ko: { title: '로그인 — Argus', description: 'Argus 계정에 로그인하거나 새 계정을 만듭니다.' },
  en: { title: 'Sign in — Argus', description: 'Sign in to Argus or create a new account.' },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return META[locale === 'ko' ? 'ko' : 'en'];
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
