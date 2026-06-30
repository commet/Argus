#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const schema = JSON.parse(fs.readFileSync(path.join(root, "data", "schemas", "current-bearing.json"), "utf8"));

// SINGLE SOURCE: data/contracts/machinery-terms.json (shared with evals/static-gate.mjs
// — no second hand-maintained copy that can drift).
const forbiddenSurfaceTerms = JSON.parse(
  fs.readFileSync(path.join(root, "data", "contracts", "machinery-terms.json"), "utf8"),
).forbidden_surface_terms;

const cases = [
  {
    id: "pr-auth-middleware",
    userInput: "/argus:sail @PR#42",
    targetRequiresSource: true,
    developerTarget: true,
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
    id: "dev-billing-plan",
    userInput: "/argus:sail \"Claude made a billing refactor plan; can I run it?\"",
    targetRequiresSource: true,
    developerTarget: true,
    bearing: {
      label: "v0.1",
      current_course: {
        status: "hold",
        summary: "Do not run the full billing refactor plan yet; first isolate the invoice write path and lock it with one regression test."
      },
      why_this_course: [
        {
          point: "The plan changes invoice creation and webhook settlement in the same move, so rollback would mix money-state and event-state failures.",
          source: "src/lib/billing/invoices.ts + src/app/api/stripe/webhook/route.ts"
        },
        {
          point: "No worker found a test that proves duplicate webhook delivery cannot double-write an invoice.",
          source: "verification.json: challenged_claims[0]"
        }
      ],
      fog_or_reef: {
        issue: "Duplicate Stripe webhook delivery may still create or settle the same invoice twice.",
        why_it_matters: "A successful local refactor could still corrupt billing state under production retry behavior.",
        required_check: "Add a duplicate-webhook regression test around invoice idempotency before executing the refactor."
      },
      road_not_taken: [
        {
          option: "Run the full AI-generated plan now",
          why_not_now: "It bundles two money-state surfaces before the idempotency invariant is pinned."
        }
      ],
      next_helm: "Add a duplicate-webhook idempotency test for src/app/api/stripe/webhook/route.ts, then rerun /argus:sail --resume.",
      contract_seed: null,
      blocked: true,
      detail_path: ".argus/sessions/2026-06-30-billing-refactor/versions/v0.1/",
      generated_at: "2026-06-30T00:00:00.000Z"
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
        summary: "Keep webapp and plugin as separate surfaces for one release, but align them around Current Heading."
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
      next_helm: "Ship the plugin Current Heading pass, then measure repeat use by surface for 30 days.",
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
  },
  // ── v2.6.0 negative-control fixtures (over-fire regression floor) ──
  // Flat decisions from the validated stress test (docs/STRESS-round4-findings,
  // §1) where the leverage engine over-fired. The under-fire default must render
  // a restraint bearing: no manufactured fork, no fabricated fog, a done-handle.
  {
    id: "R4-04-folder-rename",
    userInput: "/argus:sail \"name the scratch folder tmp or scratch?\"",
    flat: true,
    bearing: {
      label: "v0.1",
      current_course: {
        status: "proceed",
        summary: "Either name is fine — it's a two-second reversible rename with no downstream signal, so pick one and move on."
      },
      why_this_course: [
        { point: "The folder is local scratch; renaming later costs nothing, so no axis separates the two names." }
      ],
      fog_or_reef: null,
      road_not_taken: [],
      next_helm: "Nothing else to decide here — name it and keep going.",
      contract_seed: null,
      blocked: false,
      detail_path: ".argus/sessions/2026-06-17-folder-rename/versions/v0.1/",
      generated_at: "2026-06-17T00:00:00.000Z"
    }
  },
  {
    id: "R4-05-incumbent-stay",
    userInput: "/argus:sail \"I'm happy in my job, all good — should I look around anyway?\"",
    flat: true,
    bearing: {
      label: "v0.1",
      current_course: {
        status: "anchor",
        summary: "Every axis you named is already satisfied — staying is the answer; there's no fork here to work."
      },
      why_this_course: [
        { point: "You report pay, growth, and team are all good and nothing has changed — so no decision pressure exists to act on." }
      ],
      fog_or_reef: null,
      road_not_taken: [],
      next_helm: "You're done — no action needed.",
      contract_seed: null,
      blocked: false,
      detail_path: ".argus/sessions/2026-06-17-incumbent/versions/v0.1/",
      generated_at: "2026-06-17T00:00:00.000Z"
    }
  },
  {
    id: "R4-07-express-stack",
    userInput: "/argus:sail \"my Express API runs fine, keep it?\"",
    flat: true,
    bearing: {
      label: "v0.1",
      current_course: {
        status: "proceed",
        summary: "The stack works and you named no problem with it — keep it; there is no load-bearing reason to migrate."
      },
      why_this_course: [
        { point: "A well-running Express API with no stated pain point has no axis that a rewrite would improve." }
      ],
      fog_or_reef: null,
      road_not_taken: [],
      next_helm: "Keep shipping on it — nothing to change.",
      contract_seed: null,
      blocked: false,
      detail_path: ".argus/sessions/2026-06-17-express/versions/v0.1/",
      generated_at: "2026-06-17T00:00:00.000Z"
    }
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
  if (testCase.developerTarget) {
    const sourceCount = bearing.why_this_course.filter((reason) => reason.source).length;
    if (sourceCount < 2) {
      fail(id, "developer target bearings require at least two source-backed reasons");
    }
    const developerText = [
      bearing.current_course.summary,
      ...bearing.why_this_course.map((reason) => `${reason.point} ${reason.source || ""}`),
      bearing.fog_or_reef?.issue || "",
      bearing.fog_or_reef?.required_check || "",
      bearing.next_helm
    ].join(" ");
    const hasConcreteArtifact = /(?:src\/|app\/|lib\/|test|spec|PR#?\d+|route\.ts|\.ts|\.tsx|\.js|\.py|migration|verification\.json)/i.test(developerText);
    if (!hasConcreteArtifact) {
      fail(id, "developer target bearing must name a concrete file/test/PR/artifact");
    }
    const hasFailureMode = /(regression|leak|rollback|double-write|duplicate|corrupt|incident|bypass|break|fail|unsafe)/i.test(developerText);
    if (!hasFailureMode) {
      fail(id, "developer target bearing must name a concrete failure mode");
    }
    const hasSmallNextCheck = /(test|rerun|inspect|split|add|run|check|route|file|PR|\/argus:sail --resume|\/argus:verify)/i.test(bearing.next_helm);
    if (!hasSmallNextCheck) {
      fail(id, "developer target next_helm must be a small executable engineering check");
    }
    for (const vague of ["be careful", "consider edge cases", "ensure correctness", "monitor closely", "review further"]) {
      if (developerText.toLowerCase().includes(vague)) {
        fail(id, `developer target bearing contains vague review language: ${vague}`);
      }
    }
  }

  // v2.6.0 under-fire: 0-2 items. Empty is legitimate on a flat decision.
  if (!Array.isArray(bearing.road_not_taken) || bearing.road_not_taken.length > 2) {
    fail(id, "road_not_taken must contain 0-2 items");
  }
  for (const [index, road] of bearing.road_not_taken.entries()) {
    requireString(id, road.option, `road_not_taken[${index}].option`);
    requireString(id, road.why_not_now, `road_not_taken[${index}].why_not_now`);
  }

  // Over-fire-shape lint (regression FLOOR, not a safety proof — the stress test
  // proved tilt can live below structural checks; this catches the gross shapes).
  if (testCase.flat) {
    // A flat negative-control decision must NOT manufacture a fork/fog.
    if (bearing.road_not_taken.length !== 0) {
      fail(id, "flat decision must have an EMPTY road_not_taken — a manufactured alternative is over-fire");
    }
    if (bearing.fog_or_reef !== null) {
      fail(id, "flat decision must have fog_or_reef: null — manufactured fog is over-fire");
    }
    if (!["proceed", "anchor"].includes(bearing.current_course.status)) {
      fail(id, `flat decision must use proceed/anchor status, not ${bearing.current_course.status} (no manufactured fork)`);
    }
  }
  if (bearing.current_course.status === "fork" && bearing.road_not_taken.length < 1) {
    // A 'fork' bearing surfaces the chosen course + at least one real alternative pole.
    fail(id, "a 'fork' status bearing must show at least one road_not_taken pole (the other viable path)");
  }
  // Gross parity floor: when a real alternative pole is shown, neither side may be
  // ~3x the other in length (a crude asymmetric_steer floor — tilt can still live
  // below this, per the stress test; it only catches the gross engine-weighted pole).
  if (bearing.current_course.status === "fork" && bearing.road_not_taken.length >= 1) {
    const chosen = bearing.current_course.summary.length;
    const other = (bearing.road_not_taken[0].option + " " + bearing.road_not_taken[0].why_not_now).length;
    const ratio = Math.max(chosen, other) / Math.max(1, Math.min(chosen, other));
    if (ratio > 3) {
      fail(id, `fork poles are grossly asymmetric (length ratio ${ratio.toFixed(1)}x > 3) — likely an engine-weighted pole`);
    }
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
    `## Argus - Current Heading - ${bearing.label}`,
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

const negativeCases = [
  {
    id: "bad-generic-dev-review",
    targetRequiresSource: true,
    developerTarget: true,
    bearing: {
      label: "v0.1",
      current_course: { status: "proceed", summary: "Proceed carefully after reviewing the edge cases." },
      why_this_course: [{ point: "There may be implementation risks." }],
      fog_or_reef: { issue: "Potential regressions.", why_it_matters: "It could break things.", required_check: "Consider edge cases." },
      road_not_taken: [],
      next_helm: "Review further and monitor closely.",
      contract_seed: null,
      blocked: false,
      detail_path: ".argus/sessions/bad/versions/v0.1/",
      generated_at: "2026-06-30T00:00:00.000Z"
    }
  }
];

for (const testCase of negativeCases) {
  let failed = false;
  try {
    validateBearing(testCase);
  } catch {
    failed = true;
  }
  if (!failed) fail(testCase.id, "negative fixture unexpectedly passed");
}

console.log(`Argus plugin simulations passed (${cases.length} cases, ${negativeCases.length} negative).`);
