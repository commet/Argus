// Spokes — machine-generated projections OUT of one original record (hub-spoke).
// The hub is the .antefact.md file; every other shape of the same judgment is
// produced by code from a parse, never written by hand, so the shapes cannot
// drift from the record or from each other. Zero-dependency, like the CLI.
import { parseRecord, lintDir } from "./antefact.mjs";

// ---------- one-line embed (SPEC Annex H) ----------
/**
 * `Antefact: <id> sealed <date> sha256:<8>` — the adoption unit. SPDX won as a
 * one-line comment, not as a document format; this line is that move. The 8-hex
 * abbreviation is display (SPEC allows shortened display; verification never
 * accepts one) and the date is the DATE PART of seal.ts.
 *
 * A v1 seal records no time, so it cannot produce this line — and the honest
 * response is a named refusal, not a date pulled from file mtime or the wall
 * clock. Fabricating the one field whose whole point is "existed before the
 * outcome" would make the embed a lie at the exact place it claims proof.
 */
export function embedLine(text) {
  const rec = parseRecord(text);
  if (rec.errors.length) throw new Error("cannot embed: parse errors " + rec.errors.map(e => e.code).join(","));
  const seal = rec.stake?.seal;
  if (!seal?.hash) throw new Error("cannot embed an unsealed record — the line asserts a seal that does not exist");
  if (!seal.ts)
    throw new Error("this seal has no sealed time (recipe v1) — re-seal under proj v2 to carry ts; inventing a date here would defeat the embed's whole claim");
  const hash8 = String(seal.hash).replace(/^sha256:/, "").slice(0, 8);
  const date = String(seal.ts).slice(0, 10);
  return `Antefact: ${rec.front.id} sealed ${date} sha256:${hash8}`;
}

// ---------- human-readable receipt ----------
const AUTH_LABEL = {
  "h": "human", "ai": "AI (no human uptake)", "h←ai": "AI-proposed, human adopted",
  "ai←h": "AI under human-authored policy", "u": "unknown origin",
};

/**
 * Markdown receipt for one record — what a reader sees, not what a verifier
 * checks. Everything here is projected from the parse; nothing is authored at
 * render time, so a receipt can disagree with its record only if this code is
 * wrong, never because someone edited one of them.
 */
export function renderReceipt(text) {
  const rec = parseRecord(text);
  if (rec.errors.length) throw new Error("cannot render: parse errors " + rec.errors.map(e => e.code).join(","));
  const L = [];
  const seal = rec.stake?.seal;
  L.push(`# ${rec.title || "(untitled record)"}`);
  L.push("");
  L.push(`- **id** \`${rec.front.id}\` · **state** ${rec.front.state}`);
  L.push(`- **authors** ${rec.authors.map(a => `${a.name} (${AUTH_LABEL[a.key] ?? a.key})`).join(", ")}`);
  if (rec.premises.length) {
    L.push("", "## Statement");
    for (const p of rec.premises) {
      const tags = [p.kind, p.confidence].filter(Boolean).join("·");
      L.push(`- ${p.pid} — ${p.text}${tags ? ` _[${tags}]_` : ""} — ${AUTH_LABEL[p.author] ?? p.author}`);
    }
  }
  if (rec.stake) {
    L.push("", "## Stake");
    if (rec.stake.raw.claim) L.push(`- **claim** ${rec.stake.raw.claim}`);
    if (rec.stake.p) L.push(`- **p** ${rec.stake.p.raw} (${rec.stake.p.mode ?? "?"})`);
    if (rec.stake.raw.settle_by) L.push(`- **settle by** ${rec.stake.raw.settle_by} · **settlers** ${(rec.stake.settled_by ?? []).map(a => a.name).join(", ")}`);
    if (seal?.hash) {
      const short = String(seal.hash).replace(/^sha256:/, "").slice(0, 16);
      L.push(`- **seal** ${seal.level} · ${seal.ts ? `sealed ${seal.ts} · ` : "no sealed time (recipe v1) · "}\`sha256:${short}…\` (proj ${seal.proj})`);
    }
  }
  if (rec.settlements.length) {
    L.push("", "## Settlement");
    for (const s of rec.settlements)
      L.push(`- ${s.ts} — **${s.outcome}** by ${s.by}${s.observed ? ` · observed ${s.observed}` : ""}${s.source_ref ? ` · ${s.source_ref}` : ""}`);
  } else if (rec.front.state === "sealed") {
    L.push("", "_Awaiting settlement._");
  }
  return L.join("\n") + "\n";
}

// ---------- PROV-O JSON-LD (SPEC Annex E) ----------
const NS = "https://antefact.org/ns#";

function agentNode(actor) {
  return {
    "@id": `antefact:agent/${encodeURIComponent(actor.key + ":" + actor.name)}`,
    "@type": actor.key === "ai" ? "prov:SoftwareAgent" : actor.key === "h" ? "prov:Person" : "prov:Agent",
    "rdfs:label": `${actor.key}:${actor.name}`,
  };
}

/**
 * The interop rule: dominant vocabulary carries what it can express natively,
 * and OUR precision rides in the antefact: namespace instead of being rounded
 * off. Attribution stays at the record level (the parse knows the authors);
 * premise level carries only antefact:authorship, because the algebra value
 * names a KIND of authorship, not which named agent — linking `h←ai` to a
 * specific person would be inference, not projection. Same for delegation:
 * PROV-O has prov:actedOnBehalfOf, but a v0.1 record names its policy
 * (`policy_ref`), not the policy's human owner, so emitting actedOnBehalfOf
 * would fabricate an edge the record does not contain — the delegation fact
 * rides as antefact:authorship "ai←h" + antefact:policyRef instead. A PROV-only
 * consumer sees everything the record actually states; nothing is invented to
 * look more connected than the source.
 */
export function provJsonLd(text) {
  const rec = parseRecord(text);
  if (rec.errors.length) throw new Error("cannot export: parse errors " + rec.errors.map(e => e.code).join(","));
  const id = rec.front.id;
  const recordIri = `antefact:record/${id}`;
  const graph = [];
  const agents = new Map();
  const agent = (actor) => {
    const key = actor.key + ":" + actor.name;
    if (!agents.has(key)) { const n = agentNode(actor); agents.set(key, n); graph.push(n); }
    return agents.get(key)["@id"];
  };

  graph.push({
    "@id": recordIri,
    "@type": ["prov:Entity", "antefact:Record"],
    "rdfs:label": rec.title || id,
    "antefact:state": rec.front.state,
    "antefact:specVersion": rec.front.antefact,
    "prov:wasAttributedTo": rec.authors.map((a) => ({ "@id": agent(a) })),
  });

  for (const p of rec.premises) {
    // owner under the algebra: adoption belongs to the human, delegation to the AI
    const node = {
      "@id": `${recordIri}/statement/${p.pid}`,
      "@type": ["prov:Entity", "antefact:Premise"],
      "rdfs:label": p.text,
      "antefact:authorship": p.author,
    };
    if (p.kind) node["antefact:kind"] = p.kind;
    if (p.confidence) node["antefact:confidence"] = p.confidence;
    if (p.author === "ai←h" && rec.front.policy_ref) node["antefact:policyRef"] = rec.front.policy_ref;
    graph.push(node);
  }

  const seal = rec.stake?.seal;
  if (seal?.hash) {
    const activity = {
      "@id": `${recordIri}/seal`,
      "@type": ["prov:Activity", "antefact:Sealing"],
      "prov:generated": { "@id": recordIri },
      "prov:wasAssociatedWith": rec.authors.map((a) => ({ "@id": agent(a) })),
      "antefact:sealLevel": seal.level,
      "antefact:projection": seal.proj,
      "antefact:hash": String(seal.hash),
      "antefact:statementRev": String(seal.statement_rev ?? ""),
    };
    // v1 seals carry no time — the export mirrors the record instead of
    // improving on it; an invented endedAtTime here would be plausible and false.
    if (seal.ts) activity["prov:endedAtTime"] = { "@value": String(seal.ts).replace(/Z$/, ":00Z"), "@type": "xsd:dateTime" };
    graph.push(activity);
  }

  rec.settlements.forEach((s, i) => {
    const m = String(s.by ?? "").match(/^(h|ai|u)\s*:\s*(.+)$/);
    const node = {
      "@id": `${recordIri}/settlement/${i + 1}`,
      "@type": ["prov:Activity", "antefact:Settlement"],
      "prov:used": { "@id": recordIri },
      "antefact:outcome": s.outcome,
      "prov:endedAtTime": { "@value": String(s.ts).replace(/Z$/, ":00Z"), "@type": "xsd:dateTime" },
    };
    if (m) node["prov:wasAssociatedWith"] = { "@id": agent({ key: m[1], name: m[2].trim() }) };
    if (s.observed != null) node["antefact:observed"] = String(s.observed);
    if (s.source_ref != null) node["antefact:sourceRef"] = String(s.source_ref);
    graph.push(node);
  });

  return {
    "@context": {
      "prov": "http://www.w3.org/ns/prov#",
      "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
      "xsd": "http://www.w3.org/2001/XMLSchema#",
      "antefact": NS,
    },
    "@graph": graph,
  };
}

// ---------- store report with the denominator line (SPEC §2 MUST) ----------
/**
 * Aggregate over a directory of records. The denominator-line norm is the
 * point: every unscored post-seal exit is COUNTED AND SHOWN next to any scored
 * number — whatever door a losing stake leaves through, the denominator shows
 * it. Per the non-ranking clause the report never aggregates per author, and
 * per §8 it shows a binned curve, not a single score.
 */
export function storeReport(dir, { now = new Date() } = {}) {
  const results = lintDir(dir, { now });
  const states = { recorded: 0, sealed: 0, settled: 0, disputed: 0, withdrawn: 0 };
  let lapsed = 0;
  const scored = []; // { p, outcome yes/no }
  let ambiguous = 0, annulled = 0, invalid = 0;

  for (const { result, rec } of results) {
    if (!rec?.front || result.errors.length) { invalid++; continue; }
    const state = rec.front.state;
    if (state in states) states[state]++;
    const isLapsed = result.warnings.some((w) => w.code === "W_LAPSED");
    if (isLapsed && state === "sealed") lapsed++;
    if (state === "settled" && rec.settlements.length) {
      // last entry wins for scoring (corrections are reversing entries);
      // ambiguous/annulled land in the denominator, never in the curve
      const last = rec.settlements[rec.settlements.length - 1];
      if (last.outcome === "ambiguous") ambiguous++;
      else if (last.outcome === "annulled") annulled++;
      else if (rec.stake?.p?.canonical != null) scored.push({ p: rec.stake.p.canonical, yes: last.outcome === "yes" });
    }
  }

  const everSealed = states.sealed + states.settled + states.disputed +
    results.filter(({ rec }) => rec?.front?.state === "withdrawn" && rec?.stake?.seal?.hash).length;
  const unscoredExits = states.withdrawn + states.disputed + ambiguous + annulled + lapsed;

  const L = [];
  L.push(`# Antefact store report`);
  L.push("");
  L.push(`records: ${results.length} · invalid: ${invalid}`);
  L.push(`states: recorded ${states.recorded} · sealed ${states.sealed} · settled ${states.settled} · disputed ${states.disputed} · withdrawn ${states.withdrawn}`);
  L.push("");
  L.push(`**Denominator: ${everSealed} sealed · ${scored.length} scored · ${unscoredExits} unscored exits** (withdrawn ${states.withdrawn} · disputed ${states.disputed} · ambiguous ${ambiguous} · annulled ${annulled} · lapsed ${lapsed})`);
  L.push("");
  if (scored.length) {
    L.push(`## Calibration (binned curve, n=${scored.length})`);
    L.push("");
    L.push("| p bin | n | predicted mean | observed yes |");
    L.push("|---|---|---|---|");
    const BINS = [[0, 0.2], [0.2, 0.4], [0.4, 0.6], [0.6, 0.8], [0.8, 1.0001]];
    for (const [lo, hi] of BINS) {
      const inBin = scored.filter((s) => s.p >= lo && s.p < hi);
      if (!inBin.length) { L.push(`| ${lo.toFixed(1)}–${Math.min(hi, 1).toFixed(1)} | 0 | — | — |`); continue; }
      const mean = inBin.reduce((a, s) => a + s.p, 0) / inBin.length;
      const obs = inBin.filter((s) => s.yes).length / inBin.length;
      L.push(`| ${lo.toFixed(1)}–${Math.min(hi, 1).toFixed(1)} | ${inBin.length} | ${mean.toFixed(2)} | ${obs.toFixed(2)} |`);
    }
    L.push("");
    L.push("_A single aggregate score is intentionally absent (SPEC §8: curve over score); nothing here aggregates per author (non-ranking clause)._");
  } else {
    L.push("_No scored settlements yet — the curve appears when settled yes/no records exist._");
  }
  return L.join("\n") + "\n";
}
