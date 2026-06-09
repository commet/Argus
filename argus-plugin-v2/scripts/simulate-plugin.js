#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const schema = JSON.parse(fs.readFileSync(path.join(root, "data", "schemas", "current-bearing.json"), "utf8"));

const forbiddenSurfaceTerms = [
  "multi-agent",
  "agent count",
  "ledger count",
  "schema",
  "model name",
  "supported_count",
  "challenged_count",
  "SurfaceCard",
  "workflow report"
];

const cases = [
  {
    id: "pr-auth-middleware",
    userInput: "/argus:sail @PR#42",
    targetRequiresSource: true,
    bearing: {
      label: "v0.1",
      current_course: {
        status: "hold",
        summary: "Hold the PR until the middleware bypass path is either removed or explicitly tested."
      },
      why_this_course: [
        {
          point: "The proposed auth change touches request routing before user identity is established.",
          source: "PR#42 diff: src/middleware.ts"
        },
        {
          point: "The safe path is a small test patch, not a full redesign.",
          source: "verification.json: challenged_claims[0]"
        }
      ],
      fog_or_reef: {
        issue: "The crew did not prove that public routes cannot inherit protected headers.",
        why_it_matters: "A confident merge could create an auth regression that only appears in production routing.",
        required_check: "Add a regression test for public route headers before merge."
      },
      road_not_taken: [
        {
          option: "Merge now and monitor",
          why_not_now: "Monitoring would detect damage after exposure, not prevent it."
        }
      ],
      next_helm: "Add the middleware regression test, then rerun /argus:verify.",
      contract_seed: {
        predicate: "If the regression test covers public and protected route headers, the PR can proceed without auth incident in the next deploy.",
        check_by: "next deploy plus 7 days",
        pass_condition: "No auth route incident and test stays green",
        fail_condition: "Any public/protected header leakage or rollback"
      },
      blocked: true,
      detail_path: ".argus/sessions/2026-06-10-pr-auth-middleware/versions/v0.1/",
      generated_at: "2026-06-10T00:00:00.000Z"
    }
  },
  {
    id: "strategy-doc-plugin-webapp",
    userInput: "/argus:sail @docs/plugin-strategy.md",
    targetRequiresSource: true,
    bearing: {
      label: "v0.2",
      current_course: {
        status: "fork",
        summary: "Keep webapp and plugin as separate surfaces for one release, but align them around Current Bearing."
      },
      why_this_course: [
        {
          point: "The webapp owns visual voyage, branch, and contract loops; the plugin owns workspace-native reading and git memory.",
          source: "docs/ARGUS-FINAL-DIRECTION.md"
        },
        {
          point: "Absorbing the webapp path now would erase the richer decision-contract loop before plugin demand is proven.",
          source: "verification.json: unresolved_tensions[0]"
        }
      ],
      fog_or_reef: {
        issue: "Plugin retention is unproven.",
        why_it_matters: "Without usage evidence, consolidation would be a product bet disguised as simplification.",
        required_check: "Compare 30-day repeat use by surface."
      },
      road_not_taken: [
        {
          option: "Full plugin absorption now",
          why_not_now: "It spends migration effort before proving users prefer the work-environment surface."
        },
        {
          option: "Keep old boss-card plugin",
          why_not_now: "It would preserve the machinery-first feel the product is trying to avoid."
        }
      ],
      next_helm: "Ship the plugin Current Bearing pass, then measure repeat use by surface for 30 days.",
      contract_seed: {
        predicate: "If plugin repeat use exceeds webapp repeat use for repo-linked decisions over 30 days, prioritize plugin-first loops.",
        check_by: "30 days after plugin release",
        pass_condition: "Plugin repeat use is higher for repo-linked decisions",
        fail_condition: "Webapp repeat use remains higher or plugin use is mostly one-off"
      },
      blocked: false,
      detail_path: ".argus/sessions/2026-06-10-plugin-webapp-direction/versions/v0.2/",
      generated_at: "2026-06-10T00:00:00.000Z"
    }
  },
  {
    id: "gdpr-eu-launch",
    userInput: "/argus:sail \"Ship EU this quarter with GDPR 70% ready?\"",
    targetRequiresSource: false,
    bearing: {
      label: "v0.1",
      current_course: {
        status: "collect_evidence",
        summary: "Do not launch this quarter until counsel identifies whether the remaining GDPR gap is launch-blocking."
      },
      why_this_course: [
        {
          point: "The revenue upside is real but does not override unresolved compliance exposure."
        },
        {
          point: "The 70% readiness number is not a shippability threshold without legal interpretation."
        }
      ],
      fog_or_reef: {
        issue: "GDPR readiness is quantified but not legally classified.",
        why_it_matters: "A partial readiness percentage could hide a single launch-blocking gap.",
        required_check: "Ask EU counsel to classify the current gap as launch-blocking or non-blocking."
      },
      road_not_taken: [
        {
          option: "Ship now with a kill switch",
          why_not_now: "A kill switch does not reduce legal exposure already created by launch."
        }
      ],
      next_helm: "Send the current gap list to EU counsel and resume Argus with the answer.",
      contract_seed: null,
      blocked: true,
      detail_path: ".argus/sessions/2026-06-10-eu-launch/versions/v0.1/",
      generated_at: "2026-06-10T00:00:00.000Z"
    }
  },
  {
    id: "low-density-rename",
    userInput: "/argus:sail \"Rename Workspace to Project?\"",
    minimalExpected: true,
    bearing: null
  }
];

function fail(caseId, message) {
  throw new Error(`${caseId}: ${message}`);
}

function requireString(caseId, value, field) {
  if (typeof value !== "string" || value.trim() === "") fail(caseId, `${field} must be a non-empty string`);
}

function validateBearing(testCase) {
  const { id, bearing } = testCase;
  if (!bearing) {
    if (testCase.minimalExpected) return;
    fail(id, "missing bearing");
  }

  for (const field of schema.required) {
    if (!(field in bearing)) fail(id, `missing required field ${field}`);
  }

  requireString(id, bearing.label, "label");
  requireString(id, bearing.current_course?.summary, "current_course.summary");
  if (!schema.properties.current_course.properties.status.enum.includes(bearing.current_course?.status)) {
    fail(id, `invalid current_course.status ${bearing.current_course?.status}`);
  }

  if (!Array.isArray(bearing.why_this_course) || bearing.why_this_course.length < 1 || bearing.why_this_course.length > 3) {
    fail(id, "why_this_course must contain 1-3 items");
  }
  for (const [index, reason] of bearing.why_this_course.entries()) {
    requireString(id, reason.point, `why_this_course[${index}].point`);
  }
  if (testCase.targetRequiresSource && !bearing.why_this_course.some((reason) => reason.source)) {
    fail(id, "file/PR/document cases require at least one source reference");
  }

  if (!Array.isArray(bearing.road_not_taken) || bearing.road_not_taken.length < 1 || bearing.road_not_taken.length > 2) {
    fail(id, "road_not_taken must contain 1-2 items");
  }
  for (const [index, road] of bearing.road_not_taken.entries()) {
    requireString(id, road.option, `road_not_taken[${index}].option`);
    requireString(id, road.why_not_now, `road_not_taken[${index}].why_not_now`);
  }

  requireString(id, bearing.next_helm, "next_helm");
  requireString(id, bearing.detail_path, "detail_path");

  if (bearing.blocked && !["hold", "revise", "collect_evidence"].includes(bearing.current_course.status)) {
    fail(id, "blocked bearings must use hold, revise, or collect_evidence status");
  }

  if (bearing.contract_seed) {
    for (const field of ["predicate", "check_by", "pass_condition", "fail_condition"]) {
      requireString(id, bearing.contract_seed[field], `contract_seed.${field}`);
    }
    const text = `${bearing.contract_seed.predicate} ${bearing.contract_seed.pass_condition} ${bearing.contract_seed.fail_condition}`.toLowerCase();
    if (!text.includes("if") && !text.includes("when") && !text.includes("after")) {
      fail(id, "contract_seed must read as a falsifiable future predicate");
    }
  }

  const rendered = renderBearing(bearing);
  const lines = rendered.split("\n").filter((line) => line.trim() !== "");
  if (lines.length > 16) fail(id, `rendered bearing is too long (${lines.length} lines)`);
  for (const term of forbiddenSurfaceTerms) {
    if (rendered.toLowerCase().includes(term.toLowerCase())) {
      fail(id, `rendered bearing leaks machinery term: ${term}`);
    }
  }
}

function renderBearing(bearing) {
  const lines = [
    `## Argus - Current Bearing - ${bearing.label}`,
    `Current course: ${bearing.current_course.summary}`,
    "Why this course:",
    ...bearing.why_this_course.map((reason) => `- ${reason.point}${reason.source ? ` (${reason.source})` : ""}`)
  ];

  if (bearing.fog_or_reef) {
    lines.push(`Fog / reef: ${bearing.fog_or_reef.issue}`);
    lines.push(`Required check: ${bearing.fog_or_reef.required_check || bearing.fog_or_reef.why_it_matters}`);
  }

  for (const road of bearing.road_not_taken) {
    lines.push(`Road not taken: ${road.option} - ${road.why_not_now}`);
  }

  lines.push(`Next helm: ${bearing.next_helm}`);

  if (bearing.contract_seed) {
    lines.push(`Contract seed: ${bearing.contract_seed.predicate}`);
    lines.push(`Check by: ${bearing.contract_seed.check_by}`);
  }

  if (bearing.blocked) lines.push("Status: hold before execution or signoff.");
  lines.push(`Details: ${bearing.detail_path}`);
  return lines.join("\n");
}

for (const testCase of cases) {
  validateBearing(testCase);
}

console.log(`Argus plugin simulations passed (${cases.length} cases).`);
