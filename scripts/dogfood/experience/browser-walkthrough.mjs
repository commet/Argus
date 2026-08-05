/**
 * Browser loop walkthrough — drives the REAL Argus web app like a person and
 * screenshots every screen, so you can judge the lived experience (does the
 * loop complete? does typed content land on later screens? any dead-end or
 * error?) by flipping through images, not by reading code.
 *
 * This is deliberately NOT a pass/fail verdict on UX — a machine can't feel
 * whether a screen is pleasant. It proves the loop is reachable and completes
 * (or shows exactly where it stalls), surfaces console/network/visible errors,
 * flags when your decision text disappears, and hands you an ordered gallery.
 *
 * Run on a machine that can reach the app, with a disposable account:
 *
 *   ARGUS_BASE_URL=https://argus.voyage \
 *   DOGFOOD_EMAIL=... DOGFOOD_PASSWORD=... \
 *   npm run experience:web
 *
 * Options (env): ARGUS_LOCALE=ko|en, HEADLESS=false (watch it live),
 *   ARGUS_DECISION="your sentence", MAX_STEPS=16, PW_EXECUTABLE=/path/to/chrome
 *
 * Two modes added 2026-07-29 so this can run as a STANDING CI check:
 *
 *   DOGFOOD_ANON=1   Walk the logged-out journey — no credentials at all. This is
 *                    the path 95%+ of early visitors take, and the one two
 *                    production outages (share 18 days, teams 10 days) lived in.
 *
 *   CI_ASSERT=1      Exit NON-ZERO when the walk finds a blocker, a crash, a page
 *                    error, or fails to reach a milestone. Without this the script
 *                    always exited 0 — which is why putting it in CI unchanged
 *                    would have been decoration: a harness that cannot go red is
 *                    not a check. (Same lesson as the two eval observatories that
 *                    died quietly in 2026-07.)
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { playwrightExecutablePath as executablePath } from '../../lib/playwright-executable.mjs';

const BASE = (process.env.ARGUS_BASE_URL ?? 'https://argus.voyage').replace(/\/$/, '');
const EMAIL = process.env.DOGFOOD_EMAIL;
const PASSWORD = process.env.DOGFOOD_PASSWORD;
/** Walk logged-out. Explicit flag, never inferred from missing credentials — a
 *  silent downgrade would let a CI job report "loop fine" while never signing in. */
const ANON = process.env.DOGFOOD_ANON === '1';
/** Turn findings into an exit code so CI can actually go red. */
const ASSERT = process.env.CI_ASSERT === '1';
const LOCALE = process.env.ARGUS_LOCALE ?? 'ko';
const HEADLESS = process.env.HEADLESS !== 'false';
const MAX_STEPS = Number(process.env.MAX_STEPS ?? 16);
const VIEWPORT = process.env.ARGUS_VIEWPORT === 'mobile'
  ? { width: 390, height: 844 }
  : {
      width: Number(process.env.ARGUS_VIEWPORT_WIDTH ?? 1280),
      height: Number(process.env.ARGUS_VIEWPORT_HEIGHT ?? 900),
    };
const DECISION = process.env.ARGUS_DECISION
  ?? '다음 분기에 신규 채용을 할지, 지금 팀으로 버틸지 결정해야 하는데 근거가 애매해.';

// 브라우저 경로는 scripts/lib/playwright-executable.mjs 가 단일 출처다.

const ADVANCE = /(다음|계속|진행|시작|봉인|생성|만들|확인|좋아요|네,|적용|저장|완료|정산|기록|next|continue|start|seal|generate|create|confirm|looks good|apply|save|done|settle)/i;
const AVOID = /(취소|삭제|뒤로|닫기|로그아웃|이전|건너뛰|더보기 메뉴|전체 보기|접기|빠른 이동|결정 기록|지금까지의 기록|전체 결정 지도|타임라인|open next\.js dev tools|decision log|timeline|full decision map|cancel|delete|back|close|logout|previous|skip|sign out)/i;
const ERROR_TEXT = /(오류|실패|문제가 발생|다시 시도|something went wrong|error|failed|try again)/i;
const MILESTONE = /(봉인했|Sealed|봉인 완료|정산|입항|settle|기록을 종결|closed)/i;
const BUSY_TEXT = /(상황을 읽는 중|찾는 중|답변 반영 중|추가 검토 중|분석 중|기다려 주세요|reading the situation|finding the question|applying your answer|reviewing|analyzing|please wait)/i;

function ts() {
  // Date.now is fine here (this is a runner on the founder's machine, not a
  // replayable workflow); keep it simple.
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function main() {
  if (!ANON && (!EMAIL || !PASSWORD)) {
    console.error('Missing DOGFOOD_EMAIL / DOGFOOD_PASSWORD. Use a DISPOSABLE test account,');
    console.error('or set DOGFOOD_ANON=1 to walk the logged-out journey with no account.');
    process.exit(2);
  }
  const outDir = path.join('scripts', 'dogfood', 'experience', 'shots', ts());
  fs.mkdirSync(outDir, { recursive: true });
  const manifest = [];
  const issues = [];
  let shotN = 0;

  const browser = await chromium.launch({ headless: HEADLESS, executablePath: executablePath() });
  const context = await browser.newContext({ viewport: VIEWPORT, locale: LOCALE });
  /** Same declaration as the main context — a share-link visit is still a machine.
   *  Keep in sync with SYNTHETIC_RUN_KEY (src/lib/analytics.ts). */
  await context.addInitScript(() => {
    try {
      sessionStorage.setItem('argus:synthetic', '1');
      localStorage.setItem('argus:synthetic', '1');
    } catch { /* storage unavailable */ }
  });
  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') issues.push({ kind: 'console-error', at: page.url(), detail: msg.text().slice(0, 300) });
  });
  page.on('pageerror', (err) => issues.push({ kind: 'page-error', at: page.url(), detail: String(err).slice(0, 300) }));
  page.on('requestfailed', (req) => {
    // Ignore benign aborts (navigation, prefetch).
    const failure = req.failure()?.errorText ?? '';
    if (!/ERR_ABORTED/.test(failure)) issues.push({ kind: 'request-failed', at: req.url().slice(0, 160), detail: failure });
  });

  const shot = async (label) => {
    const name = `${String(++shotN).padStart(2, '0')}-${label}.png`;
    try {
      await page.screenshot({ path: path.join(outDir, name), fullPage: true });
      manifest.push({ name, label, url: page.url() });
      console.log(`  📸 ${name}  (${page.url().replace(BASE, '')})`);
    } catch (e) {
      manifest.push({ name, label, url: page.url(), note: `screenshot failed: ${e.message}` });
    }
  };

  const visibleText = async () => {
    try { return (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim(); }
    catch { return ''; }
  };

  const result = { reachedMilestone: null, contentLanded: null, stoppedReason: null, steps: 0 };

  try {
    // ── 1. Sign in — or deliberately don't ──────────────────────────────
    if (ANON) {
      // The logged-out journey is the product's front door: /workspace and
      // /project are public by design so an anonymous voyager can seal and come
      // back. Walking it needs no account, which is exactly why it can run on
      // every push — and why it is the cheapest standing guard we have.
      console.log(`
▶ Walking LOGGED OUT (no account) — ${BASE}/${LOCALE}`);
      await page.goto(`${BASE}/${LOCALE}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1500);
      await shot('landing-anon');
    } else {
      console.log(`
▶ Opening ${BASE}/${LOCALE}/login`);
      await page.goto(`${BASE}/${LOCALE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1200);
      await shot('login');
      const emailInput = page.locator('input[type=email]').first();
      const passInput = page.locator('input[type=password]').first();
      if (await emailInput.count() === 0 || await passInput.count() === 0) {
        issues.push({ kind: 'blocker', at: page.url(), detail: 'no email/password fields on the login page' });
        result.stoppedReason = 'login form not found (Google-only? locale route wrong?)';
      } else {
        await emailInput.fill(EMAIL);
        await passInput.fill(PASSWORD);
        // The primary submit: a button whose text is a login verb, else [type=submit].
        const loginBtn = page.locator('button:has-text("로그인"), button:has-text("Log in"), button:has-text("Sign in"), button[type=submit]').first();
        await loginBtn.click({ timeout: 5000 }).catch(() => page.keyboard.press('Enter'));
        await page.waitForTimeout(3500);
        await shot('after-login');
        if (/\/login/.test(page.url())) {
          const text = await visibleText();
          if (ERROR_TEXT.test(text)) {
            issues.push({ kind: 'blocker', at: page.url(), detail: 'login appears to have failed (error text on page)' });
            result.stoppedReason = 'login failed — check the disposable account credentials';
          }
        }
      }
    }

    if (!result.stoppedReason) {
      // ── 2. Workspace ────────────────────────────────────────────────────
      console.log(`▶ Opening the workspace`);
      await page.goto(`${BASE}/${LOCALE}/workspace`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      await shot('workspace');

      // ── 3. Start a decision ─────────────────────────────────────────────
      const box = page.locator('textarea, input[type=text]').first();
      if (await box.count() === 0) {
        issues.push({ kind: 'blocker', at: page.url(), detail: 'no decision input found on the workspace' });
        result.stoppedReason = 'could not find where to type a decision';
      } else {
        await box.click();
        await box.fill(DECISION);
        await shot('decision-typed');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2500);

        // ── 4. Walk the loop ──────────────────────────────────────────────
        const decisionHead = DECISION.slice(0, 12);
        let lastSig = '';
        let stuck = 0;
        result.contentLanded = false;
        for (let step = 1; step <= MAX_STEPS; step++) {
          result.steps = step;
          await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
          await page.waitForTimeout(800);
          await shot(`loop-${String(step).padStart(2, '0')}`);
          const text = await visibleText();

          if (text.includes(decisionHead)) result.contentLanded = true;
          if (MILESTONE.test(text) && !result.reachedMilestone) {
            result.reachedMilestone = (text.match(MILESTONE) || [])[0];
            console.log(`  ✓ reached a milestone: "${result.reachedMilestone}"`);
          }
          if (ERROR_TEXT.test(text)) {
            issues.push({ kind: 'visible-error', at: page.url(), detail: (text.match(ERROR_TEXT) || [])[0] });
          }

          // A model turn is intentionally tens of seconds. Repeated loading
          // frames are progress, not a dead end; do not click unrelated chrome
          // or trip the stuck detector while the product says it is working.
          if (BUSY_TEXT.test(text)) {
            console.log('  … waiting for the current model turn');
            lastSig = '';
            stuck = 0;
            await page.waitForTimeout(3500);
            continue;
          }

          // Fill a blocking empty input if the flow is waiting on the user.
          const emptyBox = page.locator('textarea:visible, input[type=text]:visible').first();
          if (await emptyBox.count() > 0 && !(await emptyBox.inputValue().catch(() => 'x'))) {
            await emptyBox.fill('네, 이 방향으로 좀 더 구체화해 줘.').catch(() => {});
            // Let controlled-input state commit so its adjacent submit button
            // becomes enabled before candidate collection.
            await page.waitForTimeout(250);
          }

          // Choose the most "advance-y" enabled, visible button we can click.
          const buttons = page.locator('button:visible:not([disabled])');
          const count = Math.min(await buttons.count(), 40);
          let picked = null; let pickedScore = -1;
          for (let i = 0; i < count; i++) {
            const b = buttons.nth(i);
            const label = ((await b.innerText().catch(() => '')) || (await b.getAttribute('aria-label').catch(() => '')) || '').trim();
            if (!label) continue;
            if (AVOID.test(label)) continue;
            // Header/nav utilities and dev overlays are never progress. Prefer a
            // concise, explicit action inside main over a long card that merely
            // happens to contain an advance-like word.
            if (await b.locator('xpath=ancestor::header | ancestor::nav').count()) continue;
            const inMain = await b.locator('xpath=ancestor::main').count() > 0;
            const score = (ADVANCE.test(label) ? 200 : 0) + (inMain ? 100 : 0) - Math.min(label.length, 80);
            if (score > pickedScore) { pickedScore = score; picked = { b, label }; }
          }

          const sig = `${page.url()}|${text.length}|${count}`;
          if (sig === lastSig) stuck++; else stuck = 0;
          lastSig = sig;
          if (stuck >= 2) { result.stoppedReason = 'the flow stopped advancing (no new screen after clicks)'; break; }
          if (result.reachedMilestone && /정산|settle|입항|종결|closed/i.test(result.reachedMilestone)) {
            result.stoppedReason = 'reached a settle/close milestone'; break;
          }

          if (picked) {
            console.log(`  → clicking "${picked.label.slice(0, 30)}"`);
            await picked.b.click({ timeout: 5000 }).catch(() => {});
          } else {
            await page.keyboard.press('Enter').catch(() => {});
          }
          await page.waitForTimeout(1500);
        }
        if (!result.stoppedReason) result.stoppedReason = `reached MAX_STEPS (${MAX_STEPS})`;
      }
    }
  } catch (e) {
    issues.push({ kind: 'crash', at: page.url(), detail: String(e).split('\n')[0] });
    await shot('crash');
  } finally {
    await browser.close();
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  const lines = [];
  lines.push(`# Browser loop walkthrough — ${new Date().toISOString()}`);
  lines.push('');
  lines.push(`- app: ${BASE} · locale: ${LOCALE} · viewport: ${VIEWPORT.width}×${VIEWPORT.height} · ${ANON ? 'LOGGED OUT (no account)' : `account: ${EMAIL?.replace(/(.).*(@.*)/, '$1***$2')}`}`);
  lines.push(`- steps walked: **${result.steps}** · stopped because: ${result.stoppedReason ?? '—'}`);
  lines.push(`- milestone reached: ${result.reachedMilestone ? `**${result.reachedMilestone}**` : '**none** (loop did not visibly complete)'}`);
  lines.push(`- your decision text landed on later screens: ${result.contentLanded === null ? 'n/a' : result.contentLanded ? '**yes**' : '**NO — content disappeared, worth checking**'}`);
  lines.push('');
  lines.push('## What to look at');
  lines.push('Flip through the screenshots in order — that IS the UX review. Ask of each:');
  lines.push('is it obvious what to do next? does my input show up? does anything look broken or generic?');
  lines.push('');
  lines.push('## Screens');
  lines.push('');
  for (const s of manifest) lines.push(`- \`${s.name}\` — ${s.label}${s.note ? ` (${s.note})` : ''}`);
  lines.push('');
  lines.push('## Issues surfaced automatically');
  lines.push('');
  if (issues.length === 0) {
    lines.push('None (no console errors, failed requests, or visible error text detected).');
  } else {
    for (const i of issues) lines.push(`- **${i.kind}** @ ${i.at}\n  - ${i.detail}`);
  }
  fs.writeFileSync(path.join(outDir, 'summary.md'), lines.join('\n'));

  console.log(`\n${manifest.length} screens → ${outDir}`);
  console.log(`Summary: ${path.join(outDir, 'summary.md')}`);
  console.log(result.reachedMilestone
    ? `Loop reached: ${result.reachedMilestone}. Flip through the screenshots to judge the UX.`
    : `Loop did NOT visibly complete (${result.stoppedReason}). The screenshots show where it stalled.`);
  if (issues.length) console.log(`⚠ ${issues.length} issue(s) auto-surfaced — see summary.md.`);

  // ── Verdict ─────────────────────────────────────────────────────────────
  // Without CI_ASSERT this stays a reviewing tool: it reports and exits 0, so a
  // founder flipping through screenshots is never blocked by a judgement call a
  // machine should not make about UX.
  //
  // With CI_ASSERT it becomes a CHECK, and a check must be able to go red. These
  // three are the failures no screenshot review can excuse:
  //   crash / page-error  — the app threw; nothing downstream is trustworthy
  //   blocker             — the walk could not proceed (dead end, missing form)
  //   no milestone        — the loop never visibly completed
  // Console errors and failed sub-requests are REPORTED but do not fail the run:
  // third-party noise would make this flaky, and a flaky check gets ignored,
  // which is the same as not having one.
  if (!ASSERT) process.exit(0);

  const fatal = issues.filter((i) => i.kind === 'crash' || i.kind === 'page-error' || i.kind === 'blocker');
  const noisy = issues.filter((i) => !fatal.includes(i));
  console.log(`
── CI verdict ──`);
  console.log(`fatal: ${fatal.length} · reported-only: ${noisy.length} · milestone: ${result.reachedMilestone ?? 'NONE'}`);
  for (const f of fatal) console.log(`  ✖ ${f.kind} @ ${f.at}
     ${f.detail}`);
  if (noisy.length) for (const n of noisy.slice(0, 5)) console.log(`  · ${n.kind}: ${String(n.detail).slice(0, 120)}`);

  if (fatal.length) {
    console.error(`
🔴 the walk hit ${fatal.length} fatal issue(s) — see above.`);
    process.exit(1);
  }
  if (!result.reachedMilestone) {
    console.error(`
🔴 the loop did not visibly complete (${result.stoppedReason ?? 'no reason recorded'}).`);
    console.error('   Screens are in the artifact; the walk stalled where the last one shows.');
    process.exit(1);
  }
  console.log(`
🟢 loop reached "${result.reachedMilestone}" with no fatal issue.`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(2); });
