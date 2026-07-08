/**
 * Copy audit — is the user-facing prose actually GOOD writing?
 *
 *   npm run copy                 # deterministic: em-dash, register, fragments
 *   ANTHROPIC_API_KEY=... npm run copy   # + a senior editor's read per surface
 *
 * The contract/life/experience loops check behavior. This one checks the WORDS
 * themselves against the house style the founder set:
 *   - NO em-dash cadence (— used as a rhythmic device is the #1 AI/"hip" tell)
 *   - ONE register (formal 합쇼체 …습니다/…세요; never a stray …예요/…어요)
 *   - no forced fragmentation or 도치(inversion) for effect
 *   - plain, helpful sentences over clever ones; light on personified "현실"
 *
 * Deterministic flags run with no key (CI-grade). With a key, a Korean/English
 * senior editor reads each surface and returns a natural rewrite for the worst.
 *
 * Every SURFACES leaf is walked; em-dash/register are measured on the RAW
 * template (args never add an em-dash or change register), so the counts are
 * exact even where a sample render would be imperfect.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { SURFACES } from '../dist/lib/surfaces.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (!fs.existsSync(path.join(ROOT, 'dist', 'lib', 'surfaces.js'))) execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });

const EMDASH = /—/g;
// casual declarative -요 endings; the house register is formal 합쇼체. Formal
// imperatives (…세요/…십시오) are correct and excluded.
const CASUAL = /(예요|에요|었어요|았어요|뒀어요|봤어요|해요[.)]|정확해요|몫이에요|거예요)/;
const FORMAL = /(습니다|입니다|됩니다|하세요|십시오|세요)/;

/** Walk a locale's SURFACES tree → [{path, raw, sample}]. raw = literal (or fn
 *  source) for exact em-dash/register; sample = a best-effort render for display. */
function collect(node, prefix, out) {
  for (const [k, v] of Object.entries(node)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out.push({ path: p, raw: v, sample: v });
    else if (typeof v === 'function') {
      const src = v.toString();
      let sample = src;
      try { sample = String(v(...sampleArgs(src))); } catch { /* keep source */ }
      out.push({ path: p, raw: src, sample });
    } else if (v && typeof v === 'object') collect(v, p, out);
  }
}

// Name-based sampler: numbers for count/day params, dates for date params,
// realistic text otherwise. Only for DISPLAY — never affects the em-dash count.
function sampleArgs(src) {
  const m = src.match(/^\(?\s*([^)]*?)\s*\)?\s*=>/);
  const names = (m?.[1] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return names.map((name) => {
    const n = name.toLowerCase();
    if (/frag/.test(n)) return ['재확인할 전제 2건', '정산할 것 1건'];
    if (/(date|checkby|by)$/.test(n) || n === 'date') return '2026-09-01';
    if (/(days|count|total|sealed|settled|tracked|changed|shown|matched|due|projects|held|avoided|partial|staledays|sinceadd|anchors|captures|cadencedays|ref|^n$|^c$|^p$|^q$)/.test(n)) return 2;
    return '엔터프라이즈 플랜을 분리할지 말지';
  });
}

// An em-dash that OPENS a value ("— (you skipped naming this)") is a blank-field
// glyph (data absence), not prose cadence — the one legitimate use. Allow it.
const BLANK_GLYPH = /^—\s/;

function flagsFor(raw, locale) {
  const flags = [];
  const em = BLANK_GLYPH.test(raw.trim()) ? 0 : (raw.match(EMDASH) || []).length;
  if (em > 0) flags.push({ sev: 'red', rule: 'em-dash', msg: `${em} em-dash${em > 1 ? 'es' : ''} (house style bans the — cadence)` });
  if (locale === 'ko' && CASUAL.test(raw)) {
    flags.push({ sev: FORMAL.test(raw) ? 'red' : 'red', rule: 'register', msg: FORMAL.test(raw) ? 'MIXED register (formal + casual -요 in one line)' : 'casual -요 register (house style is formal 합쇼체)' });
  }
  return flags;
}

const JUDGE_SYSTEM = `You are a senior editor for a decision-accountability tool. Its voice: plain, calm, genuinely useful; formal Korean (합쇼체, …습니다/…세요) or plain clear English. HARD BANS the product set on itself: no em-dash(—) cadence, no sentence fragments for punch, no 도치(inversion) or forced 대구(parallelism) for effect, no AI-flavored balance ("not X, but Y" stacked), no over-personifying "현실/reality". Brand terms are fixed and MUST be kept verbatim: 봉인, 정산, 판단 영수증, 닻, argus_*, and the line "AI VERDICT ... NONE".
For the surface given, decide if a real user would find it natural and helpful. Reply ONLY JSON:
{"verdict":"keep"|"rewrite","problems":["em_dash"|"fragment"|"inversion"|"ai_tone"|"personification"|"unnatural"|"vague"|"founderism"],"rewrite":"the improved line, brand terms kept, or empty if keep"}`;

async function main() {
  const rows = [];
  for (const locale of ['ko', 'en']) {
    const leaves = [];
    collect(SURFACES[locale], '', leaves);
    for (const leaf of leaves) rows.push({ locale, ...leaf, flags: flagsFor(leaf.raw, locale) });
  }

  const flagged = rows.filter((r) => r.flags.length);
  const emTotal = rows.reduce((s, r) => s + (BLANK_GLYPH.test(r.raw.trim()) ? 0 : (r.raw.match(EMDASH) || []).length), 0);
  const registerBad = rows.filter((r) => r.flags.some((f) => f.rule === 'register'));

  console.log(`\nArgus copy audit · ${rows.length} surfaces (ko+en)`);
  console.log(`  em-dash total        : ${emTotal}  ${emTotal > 0 ? '← house style bans — cadence' : '✓'}`);
  console.log(`  register violations  : ${registerBad.length} ${registerBad.length ? '← ' + registerBad.map((r) => r.path).join(', ') : '✓'}`);
  console.log(`  surfaces with a flag : ${flagged.length}/${rows.length}`);

  // optional editor pass (worst first: most em-dashes)
  let judged = [];
  if (process.env.ANTHROPIC_API_KEY) {
    const { complete, extractJson } = await import('./anthropic.mjs');
    const JUDGE = process.env.ARGUS_EVAL_JUDGE || 'claude-opus-4-8';
    const targets = [...rows].sort((a, b) => (b.raw.match(EMDASH) || []).length - (a.raw.match(EMDASH) || []).length).slice(0, Number(process.env.COPY_AUDIT_TOP || 24));
    console.log(`\n  editor reading ${targets.length} surfaces (judge=${JUDGE})…`);
    for (const t of targets) {
      try {
        const out = await complete({ model: JUDGE, system: JUDGE_SYSTEM, user: `locale: ${t.locale}\npath: ${t.path}\nsurface: ${t.sample}`, maxTokens: 400 });
        const j = extractJson(out);
        if (j.verdict === 'rewrite') judged.push({ ...t, ...j });
      } catch (e) { /* skip */ }
    }
    console.log(`\n──  editor wants ${judged.length} rewrites  ──`);
    for (const j of judged) {
      console.log(`\n  [${j.locale}] ${j.path}  (${j.problems.join(', ')})`);
      console.log(`    now: ${j.sample}`);
      console.log(`    →    ${j.rewrite}`);
    }
  } else {
    console.log('\n  (set ANTHROPIC_API_KEY for the editor rewrite pass)');
    console.log('\n  worst by em-dash:');
    for (const r of [...flagged].sort((a, b) => (b.raw.match(EMDASH) || []).length - (a.raw.match(EMDASH) || []).length).slice(0, 12)) {
      console.log(`   [${r.locale}] ${r.path.padEnd(28)} ${r.flags.map((f) => f.msg).join('; ')}`);
    }
  }

  const outDir = path.join(ROOT, 'evals', 'out');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'copy-audit-latest.json'), JSON.stringify({ emTotal, registerBad: registerBad.map((r) => r.path), flagged: flagged.map((r) => ({ locale: r.locale, path: r.path, sample: r.sample, flags: r.flags })), judged }, null, 2));
  console.log(`\nFull list → evals/out/copy-audit-latest.json`);
}

main().catch((e) => { console.error(e); process.exit(1); });
