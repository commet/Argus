import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Argus',
    short_name: 'Argus',
    description: '결정을 적으면 현재 항로 한 화면으로 — 그리고 정한 날짜에 돌아와 묻습니다.',
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
