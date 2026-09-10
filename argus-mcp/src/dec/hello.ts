import fs from 'node:fs';
import { discoverRuleFiles } from './rules/discover.js';
import { splitRuleFile } from './rules/split.js';
import { draftWatchFromClause } from './watch/draft.js';
import { foldDecisions } from './fold.js';
import { collectPast } from './rehearse/collect.js';
import { rehearse, TOO_BROAD } from './rehearse/engine.js';
import { clauseSentence } from './rules/split.js';

/**
 * 첫 인사 — **한 번만 하는 말.**
 *
 * 이걸 짓기 전의 상태를 실측했다(2026-09-09): 갓 설치한 사람이 세션을 열어도,
 * 무엇을 타이핑해도, 세션을 닫아도 **훅 셋이 전부 침묵**했다. 결정이 0건이니
 * 당연하고 — 첫 결정을 넣는 길(`dec-scan-rules`·`dec-rehearse`·`dec-sign`)을
 * 알려주는 자리가 **0개**였다. 작동하는 현관에 손잡이가 없었다.
 *
 * 기획서 §3: *"제품은 §4의 구조가 아니라 이 절의 장면들로 기억된다"* —
 * 그 장면이 여기다. 그래서 규율 셋:
 *
 *  1. **한 번만.** 표식은 저장소가 아니라 플러그인 자기 자리에 남긴다 —
 *     아르고스를 안 쓸 저장소에 폴더를 만들지 않는다.
 *  2. **지어내지 않는다.** 읽을 규칙이 없으면 아무 말도 안 한다. 숫자는 전부
 *     방금 잰 것이고, 못 잰 것은 못 쟀다고 말한다.
 *  3. **판정하지 않는다.** "네 규칙이 안 지켜졌다"가 아니라 "이만큼 부딪혔다"
 *     까지다. 무엇을 할지는 사람이 고른다 (거울 조항).
 */

export interface HelloResult {
  /** 할 말이 있나 — 없으면 훅은 조용히 넘어간다. */
  greet: boolean;
  why_silent?: 'no_rule_files' | 'no_clauses' | 'already_greeted' | 'left';
  files: string[];
  clause_count: number;
  collided: number;
  /** 못 읽은 것 — 분모를 모르면 숫자가 뜻이 없다. */
  gaps: string[];
  say: string[];
}

const quiet = (why: HelloResult['why_silent']): HelloResult => ({
  greet: false, why_silent: why, files: [], clause_count: 0, collided: 0, gaps: [], say: [],
});

/** 이 저장소에 인사한 적 있나. 표식은 플러그인 자기 자리에 둔다. */
export function alreadyGreeted(dataDir: string | undefined, repo: string): boolean {
  if (!dataDir) return false;
  try {
    const raw = fs.readFileSync(`${dataDir}/dec-hello.json`, 'utf8');
    const seen = JSON.parse(raw) as { repos?: string[] };
    return Array.isArray(seen.repos) && seen.repos.includes(repo);
  } catch { return false; }
}

export function markGreeted(dataDir: string | undefined, repo: string): void {
  if (!dataDir) return;
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    const file = `${dataDir}/dec-hello.json`;
    let repos: string[] = [];
    try { repos = (JSON.parse(fs.readFileSync(file, 'utf8')) as { repos?: string[] }).repos ?? []; }
    catch { /* 처음이다 */ }
    if (!repos.includes(repo)) repos.push(repo);
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ repos }, null, 1), 'utf8');
    fs.renameSync(tmp, file);
  } catch { /* 표식을 못 남기는 것이 인사를 막지는 않는다 — 다음에 또 인사할 뿐이다 */ }
}

export function sayHello(repo: string, days = 30, argusDir?: string): HelloResult {
  // 떠난 저장소에는 인사하지 않는다. 나간 사람에게 현관을 다시 여는 것은
  // 떠남을 무르는 것이다.
  if (argusDir && foldDecisions(argusDir).left) return quiet('left');

  const found = discoverRuleFiles(repo);
  if (found.files.length === 0) return quiet('no_rule_files');

  const clauses = found.files.flatMap((f) =>
    splitRuleFile(f.rel, fs.readFileSync(f.abs, 'utf8')).clauses);
  if (clauses.length === 0) return quiet('no_clauses');

  // 지난 기록에 대 본다. **금지 표지가 있는 조항만 말로 잡는다** — 아니면
  // 순종이 위반으로 세어진다 (2026-09-09 실측, watch/draft.ts 주석 참조).
  const past = collectPast(repo, days);
  let collided = 0;
  let tooBroad = 0;
  const hottest: Array<{ text: string; hits: number; days: number }> = [];
  for (const clause of clauses) {
    const draft = draftWatchFromClause(clause, clause.markers.includes('금지') ? 'ban' : 'pin');
    const result = rehearse(draft.rule, past.past, { days, maxScenes: 1 });
    if (result.hit_count === 0) continue;
    collided += 1;
    // **너무 넓은 것을 맨 앞에 놓지 않는다.** 엔진이 스스로 "이만큼 부딪히면
    // 규칙이 너무 넓다"고 판정하는 선(TOO_BROAD)을 넘은 것은 가장 뜨거운
    // 규칙이 아니라 **가장 나쁜 초안**이다. 첫 화면이 그걸 먼저 보여주면
    // 사람은 이 도구가 아무거나 잡는다고 배운다 (2026-09-09 실측: 셋 중
    // 하나가 `docs/archive/` 전부에 걸린 80번짜리였다).
    if (result.hit_count >= TOO_BROAD) { tooBroad += 1; continue; }
    hottest.push({ text: clauseSentence(clause.text, 64), hits: result.hit_count, days: result.hit_days });
  }
  hottest.sort((a, b) => b.days - a.days || b.hits - a.hits);

  // 0조인 파일은 안 센다 — 있다고 말할 것이 없는 파일을 세면 숫자가 늘어난
  // 것처럼 보인다 (우리가 쓴 AGENTS.md 가 "0조" 로 목록에 올라왔다).
  const counted = found.files
    .map((f) => ({ rel: f.rel, n: clauses.filter((c) => c.file === f.rel).length }))
    .filter((f) => f.n > 0);
  const where = counted.map((f) => `${f.rel} ${f.n}조`).join(' · ');
  if (counted.length === 0) return quiet('no_clauses');

  const say: string[] = [
    '[아르고스] 이 저장소에는 이미 규칙이 적혀 있다.',
    '',
    `  ${where} 을 읽었다.`,
  ];
  if (hottest.length > 0) {
    say.push(`  그중 ${collided}조가 지난 ${days}일의 작업과 실제로 부딪혔다.`);
    for (const h of hottest.slice(0, 3)) {
      say.push(`    · ${h.text} — ${h.hits}번 (${h.days}일에 걸쳐)`);
    }
    // 뺀 것은 뺐다고 말한다 — 숫자와 목록이 안 맞으면 사람이 먼저 알아챈다.
    if (tooBroad > 0) {
      say.push(`    (초안이 너무 넓어 뺀 것 ${tooBroad}조 — 그대로 두면 아무 데나 걸린다)`);
    }
  } else if (collided > 0) {
    say.push(`  ${collided}조가 부딪히긴 했으나 초안이 전부 너무 넓었다 — 그대로는 못 쓴다.`);
  } else {
    // 없으면 없다고 말한다. 있는 척하면 첫 화면부터 거짓말이 된다.
    say.push(`  다만 지난 ${days}일에 부딪힌 것은 없었다.`);
  }
  if (past.gaps.length > 0) say.push(`  못 읽은 것: ${past.gaps.join(' / ')}`);
  say.push('');
  say.push('  아직 아무 구속력도 없다 — 읽기만 했다. 법이 되는 것은 사람이 서명한 것뿐이다.');
  say.push('  전부 보기:  argus-decision-mcp dec-rehearse --repo ' + repo
    + (argusDir ? ` --argus-dir ${argusDir}` : ''));
  say.push('  이 말은 이 저장소에서 한 번만 한다.');

  return { greet: true, files: found.files.map((f) => f.rel), clause_count: clauses.length, collided, gaps: past.gaps, say };
}
