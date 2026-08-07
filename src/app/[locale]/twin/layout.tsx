import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const ko = locale === 'ko';
  return {
    title: ko ? '분신 — Argus' : 'Twin — Argus',
    description: ko
      ? '당신이 결정할 때 분신이 같은 시험을 칩니다. 그 기록이 쌓이는 곳.'
      : 'Your twin takes the same test when you decide. This is where that record accumulates.',
    // 개인 기록 화면이다 — 색인될 이유가 없다.
    robots: { index: false, follow: false },
  };
}

export default function TwinLayout({ children }: { children: React.ReactNode }) {
  return children;
}
