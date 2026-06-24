import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import { resolve } from 'path';

const harness = pathToFileURL(resolve('.shots/harness.html')).href;

const CH = {
  bind: { film: 'frames/bind.jpg', num: 'I', eyebrow: 'I · 묶기', folioc: 'var(--bp-ink)',
    quote: '“나를 돛대에 묶어라. 풀어달라 빌어도, 더 단단히.”', qink: 'var(--bp-ink)',
    attr: '— 오디세우스, 세이렌을 앞두고 스스로를 묶으며', svc: '묻기 전에, 지금 내 판단부터 적어 둬요.' },
  listen: { film: 'frames/listen.jpg', num: 'II', eyebrow: 'II · 듣기', folioc: 'var(--bp-ink)',
    quote: '“우리 노래를 들은 자는, 모든 것을 알고 떠나리라.”', qink: 'var(--bp-lure)',
    attr: '— 세이렌의 노래 — “다 알려주겠다”는 유혹', svc: 'AI는 칭찬 대신, 당신이 놓친 단 하나를 짚어줘요.' },
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });

async function shot(key, variant) {
  const c = CH[key];
  await page.goto(harness);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  await page.evaluate(({ c, variant }) => {
    document.getElementById('film').src = c.film;
    const folio = document.getElementById('folio');
    folio.textContent = c.num;
    folio.style.setProperty('--folioc', c.folioc);
    document.getElementById('eyebrow').textContent = c.eyebrow;
    const q = document.getElementById('quote');
    q.textContent = c.quote; q.style.setProperty('--qink', c.qink);
    document.getElementById('attr').textContent = c.attr;
    document.getElementById('svc').textContent = c.svc;
    const frost = document.getElementById('frost');
    if (variant === 'A') { // current: no frost, stroke-only faint numeral
      frost.style.display = 'none';
      folio.classList.remove('folioB');
    } else {
      frost.style.display = '';
      folio.classList.add('folioB');
    }
  }, { c, variant });
  if (variant === 'C') {
    await page.evaluate(() => {
      const frost = document.getElementById('frost');
      frost.style.display = '';
      frost.style.width = 'min(780px,76%)';
      frost.style.height = 'min(64%,400px)';
      frost.style.backdropFilter = 'blur(9px) saturate(1.02) brightness(1.03)';
      frost.style.webkitBackdropFilter = 'blur(9px) saturate(1.02) brightness(1.03)';
      frost.style.background = 'linear-gradient(to top right, color-mix(in srgb, var(--bp-paper) 56%, transparent), transparent 70%)';
      frost.style.maskImage = 'radial-gradient(132% 128% at 0% 100%, #000 48%, transparent 80%)';
      frost.style.webkitMaskImage = 'radial-gradient(132% 128% at 0% 100%, #000 48%, transparent 80%)';
      const folio = document.getElementById('folio');
      folio.classList.add('folioB');
      folio.style.opacity = '0.36';
      folio.style.fontSize = '150px';
      folio.style.textShadow = '0 0 2px var(--bp-paper),0 0 10px var(--bp-paper),0 0 24px var(--bp-paper)';
      const attr = document.getElementById('attr');
      attr.style.color = 'var(--bp-ink)';
      attr.style.fontWeight = '600';
      attr.style.fontSize = '14.5px';
      attr.style.opacity = '0.92';
    });
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(700);
  await page.locator('#stage').screenshot({ path: `.shots/out-${key}-${variant}.png` });
  console.log(`out-${key}-${variant}.png`);
}

for (const k of ['bind', 'listen']) for (const v of ['B', 'C']) await shot(k, v);
await browser.close();
