import { chromium } from 'playwright';
const BASE = 'http://127.0.0.1:3700';
const b = await chromium.launch();

// 1. Anon /project — no localStorage. Should render the empty state, NOT the sign-in wall.
{
  const c = await b.newContext({ viewport: { width: 1100, height: 900 }, reducedMotion: 'reduce' });
  const p = await c.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).split('\n')[0]));
  await p.goto(`${BASE}/project`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  const body = await p.evaluate(() => document.body.innerText);
  const walled = /Projects need an account|로그인이 필요해요|Sign in to save/.test(body);
  const emptyOrList = /No projects yet|아직 프로젝트가 없습니다|Projects|프로젝트/.test(body);
  console.log('[anon /project] errors:', errs.length, errs.slice(0, 2));
  console.log('[anon /project] walled?:', walled, '| renders projects page?:', emptyOrList);
  await p.screenshot({ path: '.post/nsA-project-anon.png' });
  await c.close();
}

// 2. Anon /project WITH a seeded due decision_contract in localStorage — the due strip + return must appear.
{
  const c = await b.newContext({ viewport: { width: 1100, height: 1000 }, reducedMotion: 'reduce' });
  const p = await c.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).split('\n')[0]));
  // seed BEFORE the app mounts
  await p.addInitScript(() => {
    const past = new Date(Date.now() - 2 * 86400_000).toISOString().slice(0, 10);
    const proj = {
      id: 'seed-1', name: 'Seed: ship the feature?', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      decision_contract: {
        sealed_at: new Date(Date.now() - 9 * 86400_000).toISOString(),
        check_in_date: past,
        predicates: [{ id: 'p1', text: 'rivals ship first', resolved: false }],
      },
    };
    try { localStorage.setItem('sot_projects', JSON.stringify([proj])); } catch {}
  });
  await p.goto(`${BASE}/project`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1800);
  const body = await p.evaluate(() => document.body.innerText);
  const dueStrip = /how did it go|어떻게 됐어요|to return to|돌아올 결정/.test(body);
  console.log('[anon /project + seeded due] errors:', errs.length, errs.slice(0, 2));
  console.log('[anon /project + seeded due] due-strip present?:', dueStrip);
  await p.screenshot({ path: '.post/nsA-project-due.png', fullPage: true });
  await c.close();
}

await b.close();
console.log('done');
