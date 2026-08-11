/**
 * 층위 2 — 합성 판단 코퍼스 (C9, 게이트 후 재정의판)
 *
 * 정답이 프로그래밍된 문제(코드 술어 — 실행하면 참/거짓이 결정됨)에 페르소나
 * 시뮬레이터가 확률 예측을 하고, 그 예측 하나하나를 **진짜 antefact CLI**로
 * 봉인(proj v2)→정산(실답)→report 스포크까지 태운다. 두 산출물:
 *
 *   1. antefact 포맷의 대량 도그푸드 — 수백 레코드에서 CLI가 깨지는 곳 발견
 *   2. 시뮬레이터 보정 곡선 — "0.8이라 말할 때 실제 적중률" 표. 게이트에
 *      떨어진 층위 3이 재응시하려면 이 곡선이 필요하다.
 *
 * 게이트 발견(말투는 판단을 안 움직임)에 따라 페르소나는 부차 축이다 —
 * 1차 곡선은 모델 단위로 읽고, 페르소나별 분해는 부록.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { samplePersonas, AXES } from "/home/user/Argus/argus-mcp/evals/persona-overfire.mjs";
import { completeJson } from "/home/user/Argus/argus-mcp/evals/anthropic.mjs";

const CLI = "/home/user/Argus/antefact/cli/antefact.mjs";

/** 술어 시나리오 — truth는 지금 이 자리에서 실행해 얻는다. 절대 손으로 쓰지 않는다. */
function buildScenarios() {
  const raw = [
    ["S01", '/^\\d{3}-\\d{4}$/.test("123-4567")'],
    ["S02", '/^\\d{3}-\\d{4}$/.test("1234-567")'],
    ["S03", '"antefact".slice(-4) === "fact"'],
    ["S04", '[1,2,3].reduce((a,b)=>a+b,0) > 6'],
    ["S05", '"Ab".toLowerCase() === "ab" && "ß".toUpperCase() === "SS"'],
    ["S06", 'parseInt("08") === 8'],
    ["S07", '[..."안녕"].length === 2'],
    ["S08", '"x".padStart(3, "0") === "00x"'],
    ["S09", '0.1 + 0.2 === 0.3'],
    ["S10", '[10,9,1].sort()[0] === 1'],
    ["S11", 'new Set([1,"1"]).size === 1'],
    ["S12", 'JSON.stringify({a:undefined}) === "{}"'],
  ];
  return raw.map(([id, expr]) => ({ id, expr, truth: eval(expr) ? "yes" : "no" }));
}

const SCHEMA = { type: "object", required: ["prediction", "p"], properties: {
  prediction: { type: "string", enum: ["yes", "no"] },
  p: { type: "number", minimum: 0, maximum: 1, description: "true일 확률" } } };

function record(persona, s, p) {
  return `---
antefact: 0.1
id: L2-${s.id}-${persona.id}
authors: [{ai: "sim:${persona.id} (claude-sonnet-5, layer2-harness policy)"}]
state: recorded
policy_ref: layer2-corpus.mjs
---

# L2 술어 예측 — ${s.id} × ${persona.id}

## Statement
- P1 (ai) [fact·high] 술어: \`${s.expr}\` (JavaScript, Node 22)

## Stake
claim:      위 술어를 Node 22에서 평가하면 true다
p:          { raw: "${p}", mode: ai_suggested, canonical: ${p}, granularity: 0.01 }
settle_by:  2026-08-11T12:00Z
settled_by: [ai:layer2-harness]
criteria:   { source: "node -e 실행", threshold: "평가 결과 그대로", edge: "실행 에러면 annulled" }

## Settlement
`;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
const mode = isMain ? process.argv[2] : null;
const outDir = process.argv[3] ?? path.join(here, "layer2-store");

if (mode === "run") {
  if (!process.env.ANTHROPIC_API_KEY) { console.error("키 필요"); process.exit(1); }
  fs.mkdirSync(outDir, { recursive: true });
  const scenarios = buildScenarios();
  const personas = samplePersonas();
  for (const s of scenarios) for (const per of personas) {
    const f = path.join(outDir, `L2-${s.id}-${per.id}.antefact.md`);
    if (fs.existsSync(f)) continue;
    const traits = AXES.map((a) => `${a.label}: ${per.traits[a.id]}`).join(" · ");
    const out = await completeJson({ model: "claude-sonnet-5", toolName: "predict", schema: SCHEMA, maxTokens: 512,
      user: `You are role-playing a software professional (${traits}; language ${per.language}). Without running it, predict whether this JavaScript expression evaluates to true on Node 22:\n\n${s.expr}\n\nReturn prediction and p (probability of true) via the tool.` });
    fs.writeFileSync(f, record(per, s, out.p.toFixed(2)));
    // 봉인 → 검증 → 실답 정산: 전부 진짜 CLI로. 여기서 죽으면 그게 도그푸드 수확이다.
    execFileSync("node", [CLI, "seal", f], { stdio: "pipe" });
    execFileSync("node", [CLI, "verify", f], { stdio: "pipe" });
    execFileSync("node", [CLI, "settle", f, "--outcome", s.truth, "--by", "ai:layer2-harness",
      "--observed", String(s.truth === "yes"), "--source", "node-eval"], { stdio: "pipe" });
    console.log(`${s.id}×${per.id} p=${out.p} 실답=${s.truth}`);
  }
  console.log("완료");
} else if (mode === "curve") {
  // 보정 곡선: p 구간별 실제 적중률. 스코어링은 결정론 — 파일에서 그대로 읽는다.
  const rows = [];
  for (const f of fs.readdirSync(outDir).filter((x) => x.endsWith(".antefact.md"))) {
    const t = fs.readFileSync(path.join(outDir, f), "utf8");
    const p = Number(/raw: "([\d.]+)"/.exec(t)[1]);
    const outcome = /outcome: (yes|no)/.exec(t)[1];
    rows.push({ p, hit: (p > 0.5 ? "yes" : "no") === outcome, outcome });
  }
  const bins = [[0, .2], [.2, .4], [.4, .6], [.6, .8], [.8, 1.001]];
  console.log(`레코드 ${rows.length} · 방향 적중 ${rows.filter(r => r.hit).length}/${rows.length}`);
  console.log("보정 곡선 (p 구간 → 실제 yes 비율 · n):");
  for (const [lo, hi] of bins) {
    const rs = rows.filter((r) => r.p >= lo && r.p < hi);
    if (!rs.length) { console.log(`  [${lo},${hi}) — 표본 없음`); continue; }
    const yesRate = rs.filter((r) => r.outcome === "yes").length / rs.length;
    console.log(`  [${lo},${hi}) → 실제 yes ${(yesRate * 100).toFixed(0)}% (n=${rs.length}) — 완벽 보정이면 ${((lo + Math.min(hi, 1)) / 2 * 100).toFixed(0)}% 부근`);
  }
  const report = execFileSync("node", [CLI, "report", outDir], { encoding: "utf8" });
  console.log("\n--- antefact report 스포크 (분모 규범 검증) ---\n" + report);
} else if (isMain) { console.error("usage: layer2-corpus.mjs <run|curve> [outdir]"); process.exit(1); }
