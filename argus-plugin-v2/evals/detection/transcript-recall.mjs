/**
 * 실 트랜스크립트 recall — 손으로 만든 코퍼스가 아니라 진짜 대화 트랜스크립트에
 * 실제 훅 파이프라인(prefilterTurn + detectSignals)을 그대로 돌린다. 측정 대상:
 *   1. base rate — 진짜 대화 턴 중 몇 %가 사전필터를 통과하나(주입 비용).
 *   2. skip-safety(실전) — 신호가 실재하는 턴을 사전필터가 놓치지 않나.
 *      (코퍼스의 하드 게이트를 실 분포에서 재확인 — messy·장문·혼합 턴)
 *
 * 결정론 층만 잰다(키 불요). AI 진단 층의 실 추출 recall은 실 API가 필요하며
 * 코퍼스에서 이미 측정됨(detect-report). 여기 산출은 '어느 실 턴에 AI 진단이
 * 주입되었을 것인가'까지 — 그 뒤 추출 품질은 AI의 몫.
 *
 *   node argus-plugin-v2/evals/detection/transcript-recall.mjs <transcript.jsonl>
 *
 * 진짜 사용자 발화만 본다: tool_result·meta·슬래시명령·시스템리마인더·웹훅활동은
 * 훅도 무시하거나(슬래시 early-return) 사용자 저작이 아니므로 제외하고 분류한다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { prefilterTurn, detectSignals } = require(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../scripts/lib/decision-signals.js'),
);

const file = process.argv[2];
if (!file) { console.log('사용: transcript-recall.mjs <transcript.jsonl>'); process.exit(1); }

function textOf(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    // tool_result 블록이 있으면 진짜 발화가 아님 → 빈 문자열로 제외 신호
    if (content.some((b) => b && b.type === 'tool_result')) return '';
    return content.filter((b) => b && b.type === 'text').map((b) => b.text).join(' ');
  }
  return '';
}

// 훅 관점의 '진짜 사용자 발화가 아님' 분류 (제외).
function classifyNonReal(t) {
  const s = t.trim();
  if (!s) return 'empty/tool_result';
  if (s.startsWith('/') || /^<(command|local-command|user-prompt|system)/i.test(s)) return 'slash/command';
  if (/^<system-reminder|<local-command-caveat/i.test(s)) return 'system-reminder';
  if (/^<github-webhook-activity|<untrusted_external_data/i.test(s)) return 'webhook';
  return null; // 진짜 발화
}

const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
const turns = [];
let lastAssistant = '';
for (const ln of lines) {
  let o; try { o = JSON.parse(ln); } catch { continue; }
  const role = o.type || (o.message && o.message.role);
  const content = o.message ? o.message.content : o.content;
  if (role === 'assistant') {
    const t = textOf(content);
    if (t.trim()) lastAssistant = t;
    continue;
  }
  if (role !== 'user' || o.isMeta) continue;
  const raw = textOf(content);
  const nonReal = classifyNonReal(raw);
  if (nonReal) { turns.push({ kind: 'excluded', reason: nonReal }); lastAssistant = ''; continue; }
  // 진짜 사용자 턴 — 훅과 동일한 창(직전 어시스턴트 + 사용자)
  const window = lastAssistant ? lastAssistant.slice(-4000) + '\n' + raw : raw;
  const pre = prefilterTurn(window);
  const sigs = detectSignals(window, { max: 3 }).map((s) => s.kind);
  turns.push({ kind: 'real', text: raw, window, pre, rules: sigs });
  lastAssistant = '';
}

const real = turns.filter((t) => t.kind === 'real');
const passed = real.filter((t) => t.pre.pass);

console.log(`\n실 트랜스크립트 recall — ${path.basename(file)}`);
console.log(`전체 라인 ${lines.length} · 진짜 사용자 턴 ${real.length} (나머지는 tool_result/명령/리마인더/웹훅)\n`);
console.log(`사전필터 통과(= AI 진단이 주입될 턴): ${passed.length}/${real.length} (${real.length ? Math.round(passed.length / real.length * 1000) / 10 : 0}%)\n`);

// 턴별 표 — 짧은 스니펫 + 통과 여부 + 규칙 후보. 라벨은 사람이 이 표에서 채운다.
real.forEach((t, i) => {
  const snip = t.text.replace(/\s+/g, ' ').slice(0, 72);
  console.log(`  #${String(i).padStart(2)} ${t.pre.pass ? 'PASS' : 'skip'} [${(t.rules.join(',') || '-').padEnd(24)}] ${snip}`);
});

// raw는 실 사용자 발화 스니펫을 담으므로 .gitignore된다 (개인 대화 내용은
// 저장소·PR로 새면 안 됨 — 집계 숫자만 공개, 원문은 로컬에만).
fs.writeFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'transcript-recall-raw.json'),
  JSON.stringify({ file, real_turns: real.length, passed: passed.length, turns: real.map((t, i) => ({ i, pass: t.pre.pass, cues: t.pre.cues, rules: t.rules, snippet: t.text.slice(0, 200) })) }, null, 2),
);
console.log(`\nraw 저장(gitignored, 로컬 전용): evals/detection/transcript-recall-raw.json`);
