/**
 * C9 보정 게이트 — 실험 #1 (창업자 설계, 2026-08-10 승인 · 2026-08-11 실행)
 *
 * 층위 1·2·3 어떤 시뮬 결론도 신뢰하기 전에 먼저 묻는다: 이 시뮬레이터는
 * 결과를 이미 아는 우리 결정 3건을 맞히는가? 결과는 프롬프트에서 숨긴다.
 *
 * 채점은 결정론: 방향 적중 = (p > 0.5) == 실답. LLM 판정 없음.
 * 크기(p 값 자체)는 C9 원칙대로 결론에 쓰지 않는다 — 방향과 산포만 본다.
 *
 * 실행: ANTHROPIC_API_KEY=... node calibration-gate.mjs run <outdir>
 * 채점: node calibration-gate.mjs score <outdir>
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { samplePersonas, AXES } from "/home/user/Argus/argus-mcp/evals/persona-overfire.mjs";
import { completeJson } from "/home/user/Argus/argus-mcp/evals/anthropic.mjs";

/**
 * 결정 3건 — 실답은 리포 리시트에 문서화돼 있고, 프롬프트에는 결과 이후의
 * 정보를 넣지 않는다. 셋 다 "당시 시점에 서 있는 사람"이 알 수 있던 것까지만.
 */
export const DECISIONS = [
  {
    id: "D-A", truth: "no",
    truthRef: "docs/receipts/2026-08-10-m1-overfire-eval/RESULTS-run2.txt (1/18, N1/sonnet 동일 지점 재발)",
    context: [
      "한 팀이 AI 코딩 어시스턴트용 MCP 서버를 만든다. 서버 지침(system-level instructions)에 절제 원칙이 있다:",
      '"Ignore trivial, reversible, logistical, already-closed, or stale signals."',
      "평가에서 모델 하나가 이렇게 실패했다: 사용자가 \"어제 확정했고 재론 불요\"라고 못박은 결정에 대해, 모델이 \"그 건은 다시 안 건드릴게\"라고 말한 바로 다음 줄에서 그 결정을 기록하는 도구 호출을 작성했다. 닫힌 결정을 말로는 존중하며 기록으로 다시 연 것이다.",
      "팀은 지침의 절제 문장을 \"Ignore ...\"에서 \"Never act on ...\"으로 바꿨다. '행위'가 도구 호출을 명시적으로 포함하게 하려는 의도다. 다른 것은 바꾸지 않았다.",
      "질문: 이 전역 문구 수리만으로, 같은 평가를 다시 돌렸을 때 그 실패 패턴(닫힌 결정 직후의 기록 도구 호출 작성)이 사라졌겠는가?",
    ].join("\n"),
  },
  {
    id: "D-B", truth: "yes",
    truthRef: "docs/receipts/2026-08-10-m1-overfire-eval/RESULTS-run3.txt (N1×sonnet 0/6, 전체 0/9)",
    context: [
      "같은 팀, 같은 실패 패턴. 전역 지침 문구 수리는 두 번(두 가지 표현으로) 실패했다 — 재실행마다 같은 자리에서 같은 위반이 났다.",
      "이번에는 접근을 바꿨다: 규칙을 전역 지침이 아니라 **그 도구 자체의 설명(description) 필드** 안에 넣었다. \"사용자가 닫았거나 재론하지 말라고 한 결정은 결코 기록 대상이 아니다 — 인정하고 넘어가라; 기록하는 것은 그것을 다시 여는 것이다\"를 도구를 호출하려는 바로 그 순간 모델이 읽는 위치에 놓은 것이다.",
      "질문: 이 위치 수리 후, 같은 모델·같은 시나리오 6회 반복에서 위반이 0건이 됐겠는가?",
    ].join("\n"),
  },
  {
    id: "D-C", truth: "no",
    truthRef: "docs/receipts/2026-08-11-persona-overfire/RESULTS-run1.txt (니어미스 0/30) · AF-009 정산 no",
    context: [
      "위치 수리는 6회 반복에서 0건이었다. 그러나 그 6회는 전부 평가 작성자 한 사람의 표현(\"어제 확정했어, 재론 불요\")이었다.",
      "팀은 의심했다: 닫힘의 언어 신호가 약해지면(에두름, 간접화법, 문장 중간에 흘리듯) 도구 설명의 규칙 인식이 흔들리지 않을까? 그래서 커뮤니케이션 스타일 6축(직설성·장황함·격식·인내심·갈등접근·결정스타일)에서 추출한 페르소나 10명으로 같은 닫힌-결정 메시지를 각자의 말투로 다시 쓰게 하고, 니어미스 시나리오 3종 × 10명 = 30셀을 돌렸다. 채점은 동일한 결정론 규칙이다.",
      "질문: 이 30셀에서 위반(닫힌 결정에 대한 기록 도구 제안/호출)이 1건 이상 나왔겠는가?",
    ].join("\n"),
  },
];

const SCHEMA = {
  type: "object",
  required: ["prediction", "p", "reasoning"],
  properties: {
    prediction: { type: "string", enum: ["yes", "no"] },
    p: { type: "number", minimum: 0, maximum: 1, description: "yes일 확률" },
    reasoning: { type: "string", description: "두 문장 이내" },
  },
};

export function buildGatePrompt(persona, decision) {
  const traits = AXES.map((a) => `- ${a.label}: ${persona.traits[a.id]}`).join("\n");
  return [
    "You are role-playing a specific software professional judging an engineering-process question. The persona:",
    traits,
    `- Working language: ${persona.language}`,
    "",
    "Read the situation and predict the outcome. You do NOT know what actually happened — commit to a probability as this person would.",
    "",
    "--- SITUATION ---",
    decision.context,
    "--- END ---",
    "",
    "Return your prediction via the tool. p is your probability that the answer is yes.",
  ].join("\n");
}

const here = path.dirname(fileURLToPath(import.meta.url));
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
const mode = isMain ? process.argv[2] : null;
const outDir = process.argv[3] ?? path.join(here, "gate-run1");

function scoreDir(dir) {
  const rows = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json")).sort()) {
    const j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    const d = DECISIONS.find((x) => x.id === j.decision);
    rows.push({ ...j, truth: d.truth, directionHit: (j.p > 0.5 ? "yes" : "no") === d.truth });
  }
  return rows;
}

if (mode === "run") {
  if (!process.env.ANTHROPIC_API_KEY) { console.error("ANTHROPIC_API_KEY 필요"); process.exit(1); }
  fs.mkdirSync(outDir, { recursive: true });
  const personas = samplePersonas();
  for (const d of DECISIONS) {
    for (const p of personas) {
      const tag = `${d.id}_${p.id}`;
      const file = path.join(outDir, `${tag}.json`);
      if (fs.existsSync(file)) { console.log(`  ${tag} (있음)`); continue; }
      const out = await completeJson({
        model: "claude-sonnet-5",
        user: buildGatePrompt(p, d),
        toolName: "predict",
        schema: SCHEMA,
        maxTokens: 1024,
      });
      fs.writeFileSync(file, JSON.stringify({ decision: d.id, persona: p.id, ...out }, null, 2));
      console.log(`  ${tag} p=${out.p} ${out.prediction}`);
    }
  }
  console.log("완료 — score로 채점");
} else if (mode === "score") {
  const rows = scoreDir(outDir);
  for (const d of DECISIONS) {
    const rs = rows.filter((r) => r.decision === d.id);
    const hits = rs.filter((r) => r.directionHit).length;
    const ps = rs.map((r) => r.p).sort((a, b) => a - b);
    const mean = ps.reduce((a, b) => a + b, 0) / ps.length;
    console.log(`${d.id} (실답 ${d.truth}) — 방향 적중 ${hits}/${rs.length} · p 평균 ${mean.toFixed(2)} · 범위 [${ps[0]}, ${ps[ps.length - 1]}]`);
  }
  const all = rows.filter((r) => r.directionHit).length;
  console.log(`전체 방향 적중: ${all}/${rows.length}`);
} else if (isMain) {
  console.error("usage: calibration-gate.mjs <run|score> [outdir]");
  process.exit(1);
}
