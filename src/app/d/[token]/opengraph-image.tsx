import { ImageResponse } from 'next/og';
import { adminClient } from '@/lib/share-guard';

export const runtime = 'nodejs';
export const alt = 'Argus judgment receipt';
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
  // The decision is the hero of the card — not the absence of a verdict. The
  // subtitle says what this record IS (a sealed prediction settled by reality);
  // "AI VERDICT — NONE" rides at the foot as a quiet signature, never the lead.
  const kicker = ko ? '판단 영수증' : 'JUDGMENT RECEIPT';
  const subtitle = ko
    ? '봉인한 예측을 정한 날 현실과 대조한, 판단의 기록.'
    : 'A decision — its prediction sealed, then settled against reality.';
  const signature = ko ? 'AI 판정 —— 없음' : 'AI VERDICT —— NONE';

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
              {kicker}
            </div>
          </div>

          <div style={{ flex: 1 }} />

          {/* Hero: the decision itself. */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 52, fontWeight: 800, lineHeight: 1.14 }}>
              {title}
            </div>
            <div style={{ marginTop: 22, fontSize: 25, color: '#8b8170', lineHeight: 1.4 }}>
              {subtitle}
            </div>
          </div>

          <div style={{ flex: 1 }} />

          {/* Foot: quiet signature — the mark, not the message. */}
          <div
            style={{
              borderTop: '1px solid #e4d8bd',
              paddingTop: 24,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 20,
              color: '#8b8170',
            }}
          >
            <div>argus.voyage</div>
            <div style={{ fontFamily: 'monospace', letterSpacing: '0.1em' }}>{signature}</div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
