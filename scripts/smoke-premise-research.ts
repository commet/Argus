/**
 * Local smoke test for the autonomous premise researcher (Workstream E) — the
 * ONLY part that answers the founder's real question: "does it fetch genuinely
 * recent sources, and reject stale ones?" It hits the REAL Brave + REAL Claude,
 * with NO Supabase and NO cron, so it needs only two keys and touches nothing.
 *
 * Run from the repo that has your env + deps (the main checkout, not a worktree):
 *   npx tsx --env-file=.env.local scripts/smoke-premise-research.ts
 *
 * Requires in .env.local:  BRAVE_SEARCH_API_KEY,  ANTHROPIC_API_KEY
 * Reads no secrets from code; prints only whether keys are present.
 */

import { searchRecent } from '../src/lib/web-research';
import { investigatePremise } from '../src/lib/premise-researcher';

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function main() {
  const today = new Date();
  const since = ymd(new Date(today.getTime() - 90 * 86_400_000)); // last 90 days
  console.log('=== Premise-watch researcher smoke ===');
  console.log('BRAVE_SEARCH_API_KEY:', process.env.BRAVE_SEARCH_API_KEY ? 'set' : 'MISSING ❌');
  console.log('ANTHROPIC_API_KEY   :', process.env.ANTHROPIC_API_KEY ? 'set' : 'MISSING ❌');
  console.log('baseline (since)    :', since, '\n');

  // 1) Raw recency gate: recent, dated sources only; undated/old dropped.
  console.log('--- [1] searchRecent("한국 기준금리 현재") — recent dated results ---');
  const raw = await searchRecent('한국 기준금리 현재', { sinceYMD: since, locale: 'ko' });
  if (raw.length === 0) console.log('  (none passed the recency gate — expected if nothing recent is dated)');
  for (const r of raw) console.log(`  ${r.publishedYMD}  ${r.title.slice(0, 72)}\n            ${r.url}`);

  // 1b) Prove the gate drops old: same query with a future baseline → should be empty.
  const future = ymd(new Date(today.getTime() + 365 * 86_400_000));
  const none = await searchRecent('한국 기준금리 현재', { sinceYMD: future, locale: 'ko' });
  console.log(`\n  recency-gate check: baseline in the FUTURE (${future}) → ${none.length} results (should be 0)`);

  // 2) Full researcher on a NUMERIC premise (baseline 3.5) — numeric drift verdict.
  console.log('\n--- [2] investigatePremise (numeric: "한국 기준금리가 3.5% 근처다", prior 3.5) ---');
  const r1 = await investigatePremise({ text: '한국 기준금리가 3.5% 근처다', kind: 'premise', baselineYMD: since, priorValue: 3.5, locale: 'ko' });
  console.log(JSON.stringify(r1, null, 2));

  // 3) Full researcher on an OPEN QUESTION (trigger b) — novelty verdict.
  console.log('\n--- [3] investigatePremise (open_question: "내년 한국 기준금리 방향") ---');
  const r2 = await investigatePremise({ text: '내년 한국 기준금리가 어떻게 될지', kind: 'open_question', baselineYMD: since, locale: 'ko' });
  console.log(JSON.stringify(r2, null, 2));

  console.log('\n=== read the verdicts above ===');
  console.log('- material  = it found a real recent change/news, WITH a source+date → would email');
  console.log('- quiet / no_recent_source = stays silent (the safe default)');
  console.log('- every source_date must be >= the baseline; no stale info should appear.');
}

main().catch((e) => { console.error('SMOKE FAILED:', e); process.exit(1); });
