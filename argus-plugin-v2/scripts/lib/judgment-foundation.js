const DECISION_KINDS = ["prediction", "commitment", "declaration", "witness"];

const COMMITMENT_PATTERNS = [
  /\b(i\s+(?:will|commit|promise|am going to)|we\s+will)\b/i,
  // 정본은 argus-mcp/src/v3/kind.ts 의 같은 이름 상수다 (2026-07-30 동기화).
  // 이전 판은 맨 `합니다`를 품어 "예상합니다"까지 전부 약속으로 먹었다 —
  // 정중형 종결어미는 약속 어휘가 아니다. 공용 픽스처
  // (data/contracts/judgment-foundation-conformance.json)가 이 드리프트를 잡는다.
  /(?:하겠습니다|할게요|하기로\s*(?:했다|한다|합니다)|약속(?:한다|할게|하겠다)|(?:수락|거절|진행|실행|선택|중단|유지)합니다|(?:수락|거절|진행|실행|선택)하겠다|지키겠다|하지\s*않겠다)/u,
];

const DECLARATION_PATTERNS = [
  /\b(i\s+(?:value|prioriti[sz]e)|my\s+(?:rule|principle|standard)|we\s+(?:value|prioriti[sz]e))\b/i,
  /(?:우선(?:한다|하겠다)|중요하게\s*(?:본다|여긴다)|원칙(?:이다|으로)|기준(?:이다|으로)|가치(?:로|는))/u,
];

const PREDICTION_PATTERNS = [
  /\b(if|when|unless|expect|predict|likely|should|by\s+\w+)\b/i,
  /(?:하면|한다면|(?:을|ㄹ)\s*것|일\s*것|예상|전망|가능성|때까지|이내|이상|이하|확인하면|나오면)/u,
];

function deriveDecisionKind(statement, explicitKind, recordOnly = false, hasReturn = false) {
  if (explicitKind && DECISION_KINDS.includes(explicitKind)) return { kind: explicitKind, rule: "explicit_kind" };
  if (recordOnly) return { kind: "witness", rule: "record_only_path" };
  const text = String(statement || "").trim();
  if (COMMITMENT_PATTERNS.some((pattern) => pattern.test(text))) {
    return { kind: "commitment", rule: "commitment_wording" };
  }
  if (DECLARATION_PATTERNS.some((pattern) => pattern.test(text))) {
    return { kind: "declaration", rule: "declaration_wording" };
  }
  if (PREDICTION_PATTERNS.some((pattern) => pattern.test(text))) {
    return { kind: "prediction", rule: "prediction_wording" };
  }
  return { kind: "prediction", rule: hasReturn ? "return_handle" : "legacy_default" };
}

module.exports = { DECISION_KINDS, deriveDecisionKind };
