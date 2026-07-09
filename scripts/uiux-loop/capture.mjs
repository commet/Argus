/**
 * UI/UX 검증 루프 — CAPTURE 단계.
 *
 * 실LLM로 전체 결정 여정을 자동 주행하며 각 표면을 gallery/에 덤프한다:
 *   - NN-<surface>.png       : 뷰포트 스크린샷
 *   - surfaces.json          : [{ name, phase, url, text, measures }]
 *
 * measures = 표면별 핵심 요소의 실제 렌더값(fontSize/weight/color/여백/정렬).
 * 채점 에이전트가 "위계·크기·정렬"을 눈이 아니라 숫자로 판정하게 하는 층.
 *
 * 사용:
 *   node scripts/uiux-loop/capture.mjs [--base http://localhost:3000] [--scenario N]
 * 전제: dev 서버 실행 + .env.local에 ANTHROPIC_API_KEY + ARGUS_DEV_SKIP_RATE_LIMIT=1
 *
 * 설계 원칙:
 *   - 결정론적 진행: 각 단계는 명시적 신호(텍스트/셀렉터)를 폴링해서 넘어간다.
 *     시간 sleep은 LLM 스트리밍의 하한으로만 쓰고, 완료는 항상 조건으로 확인.
 *   - 실패해도 멈추지 않는다: 표면 하나를 못 잡으면 기록하고 다음으로.
 *   - ?e2e-no-anim=1: framer exit 애니메이션이 headless에서 안 끝나 화면 전환이
 *     막히는 문제 회피 (실사용 UX 무영향, 명시적 플래그).
 */

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dir, 'gallery');
const args = process.argv.slice(2);
const BASE = argVal('--base') || 'http://localhost:3000';
const SCN = Number(argVal('--scenario') || '0');
const DARK = args.includes('--dark'); // prefers-color-scheme: dark 로 대비 사각 검사

function argVal(flag) { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; }

const SCENARIOS = [
  { problem: '동탄에 지금 집을 사는게 맞을까?', lean: '사는 쪽으로 기운다 — 전세가율이 받쳐줘서' },
  { problem: '개발자 2명을 더 뽑을지 외주를 쓸지 고민이야', lean: '뽑는 쪽 — 장기적으로 팀 역량이 남으니까' },
  { problem: '경쟁사가 가격을 30% 내렸는데 우리도 따라내려야 하나', lean: '안 내린다 — 가치로 승부해야지' },
];
const scn = SCENARIOS[SCN % SCENARIOS.length];

const surfaces = [];
let idx = 0;

async function main() {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 900 }, colorScheme: DARK ? 'dark' : 'light' });
  page.setDefaultTimeout(15000);

  const log = (...a) => console.log('[capture]', ...a);
  try {
    await page.goto(`${BASE}/ko/workspace?e2e-no-anim=1`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { try { localStorage.clear(); } catch {} });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('textarea', { timeout: 20000 });

    // ── IDLE ──
    await snap(page, 'idle', 'idle');

    // ── 상황 입력 → 밧줄 ──
    await setTextarea(page, scn.problem);
    await clickByText(page, '시작', { exact: true });
    await page.waitForFunction(() => document.body.innerText.includes('밧줄'), null, { timeout: 20000 });
    await snap(page, 'bind', 'binding');

    // 밧줄: lean + 1일 확인일
    await setTextarea(page, scn.lean);
    await clickByText(page, '1일 ·');
    await clickByText(page, '묶고 계속');

    // ── 분석 스트리밍 ──
    await page.waitForFunction(
      () => /우리가 읽은 진짜 질문|따로따로 봐요|질문 [0-9]\/[0-9]/.test(document.body.innerText),
      null, { timeout: 40000 });
    await sleep(1500);
    await snap(page, 'analyzing', 'analyzing');

    // ── 질문 루프 (최대 3, 매번 첫 선택지 클릭) ──
    for (let q = 0; q < 3; q++) {
      const arrived = await page.waitForFunction(
        () => /질문 [0-9]\/[0-9]/.test(document.body.innerText) || document.body.innerText.includes('그만 묻고 초안'),
        null, { timeout: 60000 }).catch(() => null);
      if (!arrived) break;
      await sleep(800);
      if (q === 0) await snap(page, 'question', 'conversing');
      // 첫 실제 선택지(넓은 버튼) 클릭
      const clicked = await page.evaluate(() => {
        const opt = [...document.querySelectorAll('button')].find(b =>
          b.getBoundingClientRect().width > 300 && b.textContent.trim().length > 12 &&
          !/그만 묻고|다른 도구|직접 입력/.test(b.textContent));
        if (opt) { opt.click(); return opt.textContent.trim().slice(0, 30); }
        return null;
      });
      if (!clicked) break;
      await sleep(1200);
      // 답 반영 칩이 뜨는지 확인 후 다음 질문 대기
    }

    // ── 그만 묻고 초안 (남았으면) ──
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('그만 묻고 초안'));
      if (b) b.click();
    });

    // ── 선원 → 초안 게이트 ──
    const draftGate = await page.waitForFunction(
      () => document.body.innerText.includes('이 방향으로 초안') || document.body.innerText.includes('초안이 닿았어요'),
      null, { timeout: 90000 }).catch(() => null);
    if (draftGate) { await sleep(800); await snap(page, 'crew-and-draft-gate', 'mixing'); }
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('이 방향으로 초안'));
      if (b) b.click();
    });

    // ── 초안 도착 ──
    const draft = await page.waitForFunction(
      () => document.body.innerText.includes('초안이 닿았어요'),
      null, { timeout: 90000 }).catch(() => null);
    if (draft) { await sleep(800); await snap(page, 'draft-arrival', 'mixing'); }

    // ── 검토 요청 ──
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('검토 받아보기'));
      if (b) b.click();
    });
    const review = await page.waitForFunction(
      () => document.body.innerText.includes('통과 조건') || document.body.innerText.includes('반영하고 완성'),
      null, { timeout: 90000 }).catch(() => null);
    if (review) { await sleep(800); await snap(page, 'review', 'dm_feedback'); }

    // ── 반영하고 완성 → 사다리 ──
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('반영하고 완성'));
      if (b) b.click();
    });
    const ladder = await page.waitForFunction(
      () => document.body.innerText.includes('전부 믿겠어요') || document.body.innerText.includes('시험해볼게요'),
      null, { timeout: 90000 }).catch(() => null);
    if (ladder) { await sleep(800); await snap(page, 'ladder', 'testing'); }

    // ── 사다리 flinch (중간 rung 클릭) ──
    await page.evaluate(() => {
      const rungs = [...document.querySelectorAll('button')].filter(b =>
        b.getBoundingClientRect().width > 300 && /^[0-9]/.test(b.textContent.trim()) && b.textContent.length > 30);
      const target = rungs[Math.min(2, rungs.length - 1)];
      if (target) target.click();
    });
    const premise = await page.waitForFunction(
      () => document.body.innerText.includes('멈추셨네요') || document.body.innerText.includes('이대로 정하고'),
      null, { timeout: 30000 }).catch(() => null);
    if (premise) { await sleep(600); await snap(page, 'premise-extract', 'testing'); }

    // ── 봉인 ── (전제에 내 말 적고 마무리 → finalize(LLM 재생성)는 오래 걸림)
    await page.evaluate(() => {
      const ta = [...document.querySelectorAll('textarea')].find(x => x.getBoundingClientRect().width > 0);
      if (ta) { const s = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set; s.call(ta, '숫자를 다 봐도 마지막엔 배짱이 필요할 거다'); ta.dispatchEvent(new Event('input', { bubbles: true })); }
    });
    await sleep(300);
    // 마무리 버튼 (문구 변형 대비 여러 후보)
    await page.evaluate(() => {
      const cands = ['이대로 정하고 마무리', '이 문장 그대로 쓰기', '이대로 마무리', '마무리'];
      for (const c of cands) {
        const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes(c));
        if (b) { b.click(); return; }
      }
    });
    // finalize는 LLM 재생성이라 최대 2분. 봉인 종막(물어봐 드릴까요)까지 대기.
    let complete = await page.waitForFunction(
      () => document.body.innerText.includes('물어봐 드릴까요') || document.body.innerText.includes('현재 방위') || document.body.innerText.includes('완성된 문서'),
      null, { timeout: 120000 }).catch(() => null);
    // 봉인 종막 카드가 있으면 확인일 버튼까지 눌러 최종 완성 화면으로.
    if (complete) {
      await sleep(1200);
      await snap(page, 'complete-bearing', 'complete');
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find(x => /물어봐 주세요/.test(x.textContent));
        if (b) b.click();
      });
      await sleep(2500);
      await snapFull(page, 'complete-full', 'complete');
    }

    log(`captured ${surfaces.length} surfaces`);
  } catch (e) {
    log('ERROR', e.message);
    surfaces.push({ name: 'ERROR', phase: 'error', error: e.message, text: await page.evaluate(() => document.body.innerText.slice(0, 400)).catch(() => '') });
  } finally {
    writeFileSync(join(OUT, 'surfaces.json'), JSON.stringify({ scenario: scn, mode: DARK ? 'dark' : 'light', capturedAt: new Date().toISOString(), surfaces }, null, 2));
    await browser.close();
  }
}

async function snap(page, name, phase) {
  const n = String(++idx).padStart(2, '0');
  const file = `${n}-${name}.png`;
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: join(OUT, file), type: 'png' });
  const data = await measure(page);
  surfaces.push({ name, phase, file, ...data });
  console.log('[capture] snap', file);
}

async function snapFull(page, name, phase) {
  const n = String(++idx).padStart(2, '0');
  const file = `${n}-${name}.png`;
  await page.screenshot({ path: join(OUT, file), type: 'png', fullPage: true });
  surfaces.push({ name, phase, file, fullPage: true });
  console.log('[capture] snap(full)', file);
}

/** 표면의 텍스트 + 핵심 요소 렌더 측정값을 뽑는다. */
async function measure(page) {
  return page.evaluate(() => {
    const text = document.body.innerText.slice(0, 2400);
    const px = (el, props) => {
      if (!el) return null;
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const o = { text: (el.textContent || '').trim().slice(0, 60), w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.left) };
      for (const p of props) o[p] = s[p];
      return o;
    };
    const measures = {};
    // 헤드라인 후보 (display 세리프/큰 활자) — 화면당 몇 개나 소리치는지
    const heads = [...document.querySelectorAll('h1,h2,h3,[style*="font-display"],[class*="font-display"]')]
      .filter(e => e.getBoundingClientRect().width > 0 && (e.textContent || '').trim().length > 4)
      .map(e => px(e, ['fontSize', 'fontWeight', 'lineHeight', 'color']));
    measures.headlines = heads.slice(0, 8);
    // 주 CTA (넓은 버튼)
    const ctas = [...document.querySelectorAll('button')]
      .filter(b => { const r = b.getBoundingClientRect(); return r.width > 180 && r.height > 30; })
      .slice(0, 6).map(b => px(b, ['fontSize', 'fontWeight', 'backgroundColor', 'color', 'borderRadius', 'padding']));
    measures.ctas = ctas;
    // 상태바(정거장 레일) 요소
    const rail = document.querySelector('[role="group"][aria-label*="정거장"],[role="group"][aria-label*="stop"]');
    if (rail) {
      measures.rail = {
        eyebrow: rail.querySelector('span')?.textContent.trim().slice(0, 40),
        nodeCount: [...rail.querySelectorAll('button,div')].filter(e => /^(상황|밧줄|갈림|질문[0-9]|초안|검토|시험|확인|봉인|Case|Rope|Q[0-9]|Draft|Review|Test|Seal)$/.test(e.textContent.trim())).length,
      };
    }
    // 본문 단락 최소 폰트 (가독성 하한)
    const bodyEls = [...document.querySelectorAll('p')]
      .filter(e => e.getBoundingClientRect().width > 0 && (e.textContent || '').trim().length > 20)
      .map(e => ({ px: parseFloat(getComputedStyle(e).fontSize), text: (e.textContent || '').trim().slice(0, 70) }))
      .filter(e => e.px);
    const bodyFonts = bodyEls.map(e => e.px);
    measures.minBodyFontPx = bodyFonts.length ? Math.min(...bodyFonts) : null;
    measures.bodyFontCount = bodyFonts.length;
    // Record the exact sub-12px offenders so we never have to guess which <p> it is.
    measures.subMinBody = bodyEls.filter(e => e.px < 12).sort((a, b) => a.px - b.px);
    return { text, measures };
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function setTextarea(page, val) {
  await page.evaluate((v) => {
    const ta = [...document.querySelectorAll('textarea')].find(x => x.getBoundingClientRect().width > 0);
    if (!ta) return;
    const s = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    s.call(ta, v); ta.dispatchEvent(new Event('input', { bubbles: true }));
  }, val);
  await sleep(150);
}
async function clickByText(page, txt, opts = {}) {
  await page.evaluate(({ txt, exact }) => {
    const btns = [...document.querySelectorAll('button')].filter(b => b.getBoundingClientRect().width > 0);
    const b = exact ? btns.find(x => x.textContent.trim() === txt) : btns.find(x => x.textContent.includes(txt));
    if (b) b.click();
  }, { txt, exact: !!opts.exact });
  await sleep(200);
}

main();
