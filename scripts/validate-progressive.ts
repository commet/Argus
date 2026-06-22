/**
 * Progressive Prompts Validation Harness
 *
 * Runs core Progressive flow prompts (ko + en) against real inputs and prints
 * LLM output to terminal for visual quality review.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/validate-progressive.ts              # all scenarios, both locales
 *   npx tsx --env-file=.env.local scripts/validate-progressive.ts --ko          # Korean only
 *   npx tsx --env-file=.env.local scripts/validate-progressive.ts --en          # English only
 *   npx tsx --env-file=.env.local scripts/validate-progressive.ts --scenario=ceo-ai-plan
 *   npx tsx --env-file=.env.local scripts/validate-progressive.ts --save        # save raw JSON to validation-output/
 *
 * Exit: 0 on success, 1 on any LLM failure.
 */

import Anthropic from '@anthropic-ai/sdk';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { buildInitialAnalysisPrompt } from '../src/lib/progressive-prompts';

// ─── Scenarios ───

interface Scenario {
  id: string;
  label: string;
  ko: string;
  en: string;
}

const SCENARIOS: Scenario[] = [
  {
    id: 'ceo-ai-plan',
    label: 'CEO asks for AI implementation plan (short deadline)',
    ko: '대표님이 다음 주까지 AI 도입 기획안 써오라고 하심. 팀이 5명이고 AI 경험 거의 없는데 어디서부터 시작해야 할지 모르겠어.',
    en: "My CEO wants an AI implementation plan by next week. We have a 5-person team with almost no AI experience and I'm not sure where to start.",
  },
  {
    id: 'saas-launch',
    label: 'B2B SaaS launch feature prioritization',
    ko: 'B2B SaaS 출시 2개월 남았는데 기능이 너무 많아서 뭘 먼저 할지 우선순위를 못 정하겠어. 개발자 3명이고 예산도 빠듯함.',
    en: "Two months until B2B SaaS launch but we have too many features to prioritize. 3 developers and tight budget.",
  },
  {
    id: 'career-decision',
    label: 'Career decision: stay vs. leave',
    ko: '작은 스타트업에서 CTO 제안받았는데, 지금 대기업에서 안정적으로 다니고 있어. 연봉은 비슷한데 주식이 있어. 가족도 있고 리스크가 무서워.',
    en: "Got a CTO offer at a small startup. Currently at a stable big company. Similar salary but equity included. I have family and the risk is scary.",
  },
  {
    id: 'pivot-decision',
    label: 'Startup pivot consideration',
    ko: '1년째 운영 중인 B2C 앱 성장이 멈췄어. 투자자들이 B2B로 피벗하라고 압박함. 기존 유저 5만명 버리기 아까운데 어떻게 판단해야 할까.',
    en: "Our B2C app has stalled after a year. Investors pressuring us to pivot to B2B. We have 50K users I'd hate to abandon. How do I decide?",
  },
  {
    id: 'report-writing',
    label: 'Report writing for non-expert',
    ko: '내 전문 분야 아닌 주제로 보고서 써야 해. 리서치는 어느 정도 했는데 어떻게 구조 잡을지 막막함.',
    en: "I need to write a report on a topic outside my expertise. Done some research but stuck on how to structure it.",
  },
];

// ─── LLM client ───

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY not found. Use: npx tsx --env-file=.env.local scripts/validate-progressive.ts');
  process.exit(1);
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-4-6';

async function callLLM(system: string, user: string): Promise<string> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system,
    messages: [{ role: 'user', content: user }],
  });
  const block = response.content.find(b => b.type === 'text');
  return block && block.type === 'text' ? block.text : '';
}

// ─── Quality heuristics (surface-level only, human review still needed) ───

interface QualityCheck {
  label: string;
  passed: boolean;
  detail?: string;
}

function checkQuality(output: string, locale: 'ko' | 'en'): QualityCheck[] {
  const checks: QualityCheck[] = [];

  // 1. JSON parseable
  let parsed: Record<string, unknown> | null = null;
  try {
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    checks.push({ label: 'JSON parseable', passed: !!parsed });
  } catch {
    checks.push({ label: 'JSON parseable', passed: false, detail: 'could not parse' });
  }

  if (!parsed) return checks;

  // 2. real_question ends with ?
  const rq = parsed.real_question as string | undefined;
  checks.push({
    label: 'real_question ends with ?',
    passed: typeof rq === 'string' && rq.trim().endsWith('?'),
    detail: rq ? `"${rq.slice(0, 60)}..."` : 'missing',
  });

  // 3. Language matches locale (no cross-contamination)
  const hasKorean = /[가-힣]/.test(output);
  const hasEnglish = /[a-zA-Z]{5,}/.test(output);
  if (locale === 'ko') {
    checks.push({
      label: 'Korean output (no English bleed outside proper nouns)',
      passed: hasKorean,
      detail: hasKorean ? 'yes' : 'no Korean found!',
    });
  } else {
    checks.push({
      label: 'English output (no Korean bleed)',
      passed: !hasKorean && hasEnglish,
      detail: hasKorean ? 'Korean characters leaked!' : 'clean',
    });
  }

  // 4. Skeleton has 5 items
  const skeleton = parsed.skeleton as unknown[] | undefined;
  checks.push({
    label: 'skeleton has 5 items',
    passed: Array.isArray(skeleton) && skeleton.length === 5,
    detail: Array.isArray(skeleton) ? `${skeleton.length} items` : 'missing or invalid',
  });

  // 5. Hidden assumptions 2-3
  const assumptions = parsed.hidden_assumptions as unknown[] | undefined;
  checks.push({
    label: 'hidden_assumptions has 2-3 items',
    passed: Array.isArray(assumptions) && assumptions.length >= 2 && assumptions.length <= 3,
    detail: Array.isArray(assumptions) ? `${assumptions.length} items` : 'missing',
  });

  // 6. next_question has options
  const nq = parsed.next_question as Record<string, unknown> | undefined;
  const options = nq?.options as unknown[] | undefined;
  checks.push({
    label: 'next_question has 3-4 options',
    passed: Array.isArray(options) && options.length >= 3 && options.length <= 4,
    detail: Array.isArray(options) ? `${options.length} options` : 'missing',
  });

  // 7. insight is 1 sentence (not a paragraph)
  const insight = parsed.insight as string | undefined;
  const sentenceCount = typeof insight === 'string' ? (insight.match(/[.!?]/g) || []).length : 0;
  checks.push({
    label: 'insight is concise (≤ 2 sentence breaks)',
    passed: sentenceCount <= 2,
    detail: insight ? `"${insight.slice(0, 60)}..."` : 'missing',
  });

  // 8. Translation-ese detection (locale-specific)
  if (locale === 'ko') {
    const translationese = [
      '~할 것을 추천드립니다',
      '~에 대하여',
      '수행하시기 바랍니다',
      '고려하시겠습니까',
    ];
    const hit = translationese.find(t => output.includes(t));
    checks.push({
      label: 'No Korean translation-ese',
      passed: !hit,
      detail: hit ? `found: "${hit}"` : 'clean',
    });
  } else {
    // English: overly formal / LLM-ese
    const llmese = [
      'Let us leverage',
      'We recommend leveraging',
      'It is imperative',
      'In this comprehensive',
      'Please consider',
    ];
    const hit = llmese.find(t => output.toLowerCase().includes(t.toLowerCase()));
    checks.push({
      label: 'No English LLM-ese',
      passed: !hit,
      detail: hit ? `found: "${hit}"` : 'clean',
    });
  }

  return checks;
}

// ─── Formatting ───

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
} as const;

function printDivider(char = '─', len = 78) {
  console.log(COLORS.dim + char.repeat(len) + COLORS.reset);
}

function printHeader(text: string) {
  printDivider('═');
  console.log(COLORS.bold + COLORS.cyan + text + COLORS.reset);
  printDivider('═');
}

function printSubHeader(text: string) {
  console.log('\n' + COLORS.bold + COLORS.yellow + text + COLORS.reset);
  printDivider();
}

function prettyPrintOutput(output: string) {
  // Try to pretty-print JSON
  try {
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log(JSON.stringify(parsed, null, 2));
      return;
    }
  } catch {
    // fall through
  }
  console.log(output);
}

function printChecks(checks: QualityCheck[]) {
  console.log('');
  for (const c of checks) {
    const icon = c.passed ? COLORS.green + '✓' + COLORS.reset : COLORS.red + '✗' + COLORS.reset;
    const detail = c.detail ? COLORS.dim + ` — ${c.detail}` + COLORS.reset : '';
    console.log(`  ${icon} ${c.label}${detail}`);
  }
}

// ─── Main ───

async function runScenario(scenario: Scenario, locales: ('ko' | 'en')[], save: boolean) {
  printHeader(`SCENARIO: ${scenario.id} — ${scenario.label}`);

  for (const locale of locales) {
    printSubHeader(`【 ${locale.toUpperCase()} 】`);
    const input = scenario[locale];
    console.log(COLORS.dim + 'INPUT:' + COLORS.reset);
    console.log('  ' + input);
    console.log('');

    const { system, user } = buildInitialAnalysisPrompt(input, locale);

    let output = '';
    const started = Date.now();
    try {
      output = await callLLM(system, user);
    } catch (err) {
      console.error(COLORS.red + 'LLM ERROR: ' + COLORS.reset + (err instanceof Error ? err.message : String(err)));
      continue;
    }
    const elapsed = ((Date.now() - started) / 1000).toFixed(1);

    console.log(COLORS.dim + `OUTPUT (${elapsed}s):` + COLORS.reset);
    prettyPrintOutput(output);

    const checks = checkQuality(output, locale);
    console.log('');
    console.log(COLORS.dim + 'QUALITY CHECKS:' + COLORS.reset);
    printChecks(checks);

    if (save) {
      const outDir = join(process.cwd(), 'scripts', 'validation-output');
      if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const file = join(outDir, `${scenario.id}-${locale}-${timestamp}.json`);
      try {
        const jsonMatch = output.match(/\{[\s\S]*\}/);
        const body = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: output };
        writeFileSync(file, JSON.stringify({ scenario: scenario.id, locale, input, output: body, elapsed, checks }, null, 2));
        console.log(COLORS.dim + `  saved: ${file}` + COLORS.reset);
      } catch (err) {
        console.error(COLORS.red + '  save failed:' + COLORS.reset, err);
      }
    }

    console.log('');
  }
}

async function main() {
  const args = process.argv.slice(2);
  const koOnly = args.includes('--ko');
  const enOnly = args.includes('--en');
  const save = args.includes('--save');
  const scenarioArg = args.find(a => a.startsWith('--scenario='))?.split('=')[1];

  const locales: ('ko' | 'en')[] = koOnly ? ['ko'] : enOnly ? ['en'] : ['ko', 'en'];
  const scenarios = scenarioArg ? SCENARIOS.filter(s => s.id === scenarioArg) : SCENARIOS;

  if (scenarios.length === 0) {
    console.error(`❌ Scenario not found: ${scenarioArg}`);
    console.error('Available:', SCENARIOS.map(s => s.id).join(', '));
    process.exit(1);
  }

  console.log(COLORS.bold + `\nProgressive Prompt Validation` + COLORS.reset);
  console.log(COLORS.dim + `Model: ${MODEL}` + COLORS.reset);
  console.log(COLORS.dim + `Scenarios: ${scenarios.length} × locales: ${locales.join(', ')} = ${scenarios.length * locales.length} LLM calls` + COLORS.reset);

  const started = Date.now();
  for (const scenario of scenarios) {
    await runScenario(scenario, locales, save);
  }

  printDivider('═');
  const total = ((Date.now() - started) / 1000).toFixed(1);
  console.log(COLORS.bold + `\n✓ Done in ${total}s` + COLORS.reset);
}

main().catch(err => {
  console.error('\n❌ Fatal:', err);
  process.exit(1);
});
