/**
 * 판단 카드 미리보기 — 실제 렌더러를 그대로 번들해서 그린다.
 * 코드를 베껴 쓰면 미리보기와 제품이 갈라지므로 esbuild 로 진짜 모듈을 묶는다.
 */
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUT = process.argv[2] ?? path.join(ROOT, 'card-preview');
fs.mkdirSync(OUT, { recursive: true });

const entry = path.join(OUT, 'entry.ts');
fs.writeFileSync(entry, `
import { renderJudgmentCard } from '${path.join(ROOT, 'src/lib/judgment-card-render.ts').replace(/\\/g, '/')}';
(window as any).__render = renderJudgmentCard;
`);

const res = await build({
  entryPoints: [entry],
  bundle: true,
  format: 'iife',
  write: false,
  platform: 'browser',
  target: 'es2020',
  alias: { '@': path.join(ROOT, 'src') },
});
const js = res.outputFiles[0].text;

const CASES = [
  {
    name: '01-user-authored',
    locale: 'ko',
    data: {
      statement: '다음 분기 매출이 지금 수준을 유지한다.',
      sealedOn: '2026-07-29',
      checkOn: '2026-10-27',
      authorship: 'user',
      context: '다음 분기에 신규 채용을 2명 더 할지, 지금 인원으로 버틸지 정해야 한다.',
    },
  },
  {
    name: '02-ai-surfaced',
    locale: 'ko',
    data: {
      statement: '기존 사용자가 자발적으로 공유할 것이다. 유료 채널 없이도 첫 100명은 입소문으로 온다.',
      sealedOn: '2026-07-29',
      checkOn: '2026-09-01',
      authorship: 'ai_surfaced',
      context: '런칭 채널을 유료로 갈지 입소문에 걸지',
    },
  },
  {
    name: '03-long-no-date',
    locale: 'ko',
    data: {
      statement: '지금 팀이 못 하고 있는 일은 사람이 없어서가 아니라 우선순위가 안 잡혀서다. 그래서 채용보다 역할 재분배가 먼저고, 그게 안 통하면 그때 사람을 늘린다.',
      sealedOn: '2026-07-29',
      checkOn: null,
      authorship: 'unknown',
      context: null,
    },
  },
  {
    name: '04-english',
    locale: 'en',
    data: {
      statement: 'Churn drops below 4% once onboarding ships.',
      sealedOn: '2026-07-29',
      checkOn: '2026-11-15',
      authorship: 'user',
      context: 'Whether to rebuild onboarding this quarter',
    },
  },
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setContent('<html><body></body></html>');
await page.addScriptTag({ content: js });

for (const c of CASES) {
  const b64 = await page.evaluate(async ({ data, locale }) => {
    const blob = await window.__render(data, locale);
    const buf = await blob.arrayBuffer();
    let s = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }, c);
  fs.writeFileSync(path.join(OUT, `${c.name}.png`), Buffer.from(b64, 'base64'));
  console.log(`✓ ${c.name}.png`);
}

await browser.close();
console.log(`\n→ ${OUT}`);
