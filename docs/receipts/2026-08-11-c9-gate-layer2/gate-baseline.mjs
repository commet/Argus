// 무페르소나 기준선 — 같은 결정, 같은 스키마, 페르소나 블록 없이 5표본씩.
// 페르소나 런과의 차이가 0이면 층위의 "페르소나" 부분이 판단에 기여하는 바가
// 없다는 뜻이고, 실패의 귀속은 기저 모델의 사전믿음으로 간다.
import fs from "node:fs";
import { DECISIONS } from "./calibration-gate.mjs";
import { completeJson } from "/home/user/Argus/argus-mcp/evals/anthropic.mjs";
const SCHEMA = { type: "object", required: ["prediction", "p", "reasoning"], properties: {
  prediction: { type: "string", enum: ["yes", "no"] }, p: { type: "number", minimum: 0, maximum: 1 },
  reasoning: { type: "string" } } };
const out = process.argv[2] ?? "gate-baseline1";
fs.mkdirSync(out, { recursive: true });
for (const d of DECISIONS) for (let i = 1; i <= 5; i++) {
  const f = `${out}/${d.id}_base${i}.json`;
  if (fs.existsSync(f)) continue;
  const r = await completeJson({ model: "claude-sonnet-5", toolName: "predict", schema: SCHEMA, maxTokens: 1024,
    user: ["You are a careful software engineer judging an engineering-process question. Read the situation and predict the outcome. You do NOT know what actually happened — commit to a probability.", "", "--- SITUATION ---", d.context, "--- END ---", "", "Return your prediction via the tool. p is your probability that the answer is yes."].join("\n") });
  fs.writeFileSync(f, JSON.stringify({ decision: d.id, sample: i, ...r }, null, 2));
  console.log(`${d.id}#${i} p=${r.p}`);
}
