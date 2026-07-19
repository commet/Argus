import type { Metadata } from 'next';

const META = {
  ko: { title: 'MCP 판단 기록 연결 — Argus', description: '터미널·MCP에서 기록한 판단을 Argus 계정에 연결합니다.' },
  en: { title: 'Import records — Argus', description: 'Connect judgments sealed in the terminal or MCP to your Argus account.' },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return META[locale === 'ko' ? 'ko' : 'en'];
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
