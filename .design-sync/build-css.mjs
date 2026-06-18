// Off-script styles.css generator for design-sync (synth-entry shape).
// Compiles the app's real globals.css with Tailwind v4 over the full source tree,
// then prepends the 3 remote brand fonts (loaded via <link> in layout.tsx, not in CSS).
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { readFileSync, writeFileSync } from 'node:fs';

const INPUT = 'src/app/globals.css';
const OUT = '.design-sync/styles.css';

const css = readFileSync(INPUT, 'utf8');
const result = await postcss([tailwind()]).process(css, { from: INPUT, to: OUT });

const fonts = [
  "/* Brand fonts — served remotely (mirrors the <link> tags in src/app/layout.tsx) */",
  "@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css');",
  "@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;700&display=swap');",
  "@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap');",
].join('\n');

writeFileSync(OUT, fonts + '\n' + result.css);
console.log('wrote', OUT, '—', (result.css.length / 1024).toFixed(1), 'KB');
