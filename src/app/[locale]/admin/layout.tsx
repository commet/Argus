import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return locale === 'ko'
    ? { title: '관리자 지표 — Argus', description: 'Argus 운영 지표를 확인합니다.' }
    : { title: 'Admin Metrics — Argus', description: 'Review Argus operational metrics.' };
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
