import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Argus',
    short_name: 'Argus',
    description: '막힌 결정을 다음 움직임으로 바꾸고, 현실이 답하면 다음 판단까지 이어갑니다.',
    start_url: '/workspace',
    display: 'standalone',
    background_color: '#f4ede0',
    theme_color: '#b8963e',
    // Next serves file-convention icons at the extensionless route (/icon),
    // not /icon.png — verified against the generated <link> tags.
    icons: [
      { src: '/icon', sizes: '512x512', type: 'image/png' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  };
}
