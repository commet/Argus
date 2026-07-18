import { ImageResponse } from 'next/og';
import { adminClient } from '@/lib/share-guard';

export const runtime = 'nodejs';
export const alt = 'Argus judgment receipt — AI VERDICT -- NONE';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

async function fetchLink(token: string) {
  try {
    const { data, error } = await adminClient()
      .from('shared_links')
      .select('title, content, context')
      .eq('token', token)
      .maybeSingle();
    if (error) return null;
    return data as { title: string | null; content: string; context: string | null } | null;
  } catch {
    return null;
  }
}

function clipped(text: string, n: number): string {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}...` : t;
}

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const row = await fetchLink(token);
  const ko = /[가-힣ᄀ-ᇿ㄰-㆏]/.test(`${row?.title ?? ''}\n${row?.content ?? ''}`);
  const title = clipped(row?.title || (ko ? '판단 영수증' : 'Judgment Receipt'), 72);
  // The bare signature is a cipher on a shared card; one plain gloss says what
  // NONE means (mirrors the page + Act2 wording, localized to the receipt).
  const gloss = ko
    ? '점수 없음 · AI 판정 없음 — 정한 날, 현실이 답합니다.'
    : 'No score. No AI verdict — reality answers on the date you set.';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: '#fbfaf7',
          color: '#17130d',
          fontFamily: 'sans-serif',
          padding: 54,
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            border: '2px solid #d8c7a3',
            background: '#fffdf8',
            padding: 56,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#8a6724', letterSpacing: '0.16em' }}>
              ARGUS
            </div>
            <div style={{ fontSize: 18, color: '#8b8170', letterSpacing: '0.14em' }}>
              JUDGMENT RECEIPT
            </div>
          </div>

          <div style={{ marginTop: 64, fontSize: 44, fontWeight: 800, lineHeight: 1.16 }}>
            {title}
          </div>

          <div style={{ flex: 1 }} />

          <div
            style={{
              borderTop: '1px solid #d8c7a3',
              borderBottom: '1px solid #d8c7a3',
              padding: '26px 0',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              fontFamily: 'monospace',
              fontSize: 48,
              letterSpacing: '0.08em',
              color: '#17130d',
            }}
          >
            AI VERDICT -- NONE
          </div>

          <div style={{ marginTop: 26, fontSize: 22, color: '#8b8170' }}>
            Shared by URL. No score. No AI judgment.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
