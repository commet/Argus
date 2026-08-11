// Spoke tests — every projection out of the hub must be producible from a
// conforming record and must refuse to fabricate what the record lacks.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sealRecord, settleRecord } from "../cli/antefact.mjs";
import { embedLine, renderReceipt, provJsonLd, storeReport } from "../cli/spokes.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const vec = (...p) => path.join(here, "..", "vectors", ...p);
const load = (...p) => readFileSync(vec(...p), "utf8");

test("embed: a v2 seal produces the Annex H line from sealed data only", () => {
  const { text: sealed } = sealRecord(load("valid", "v2-unsealed.antefact.md"), { now: new Date("2026-08-11T02:15:00Z") });
  const line = embedLine(sealed);
  assert.match(line, /^Antefact: 018f0000-0000-7000-8000-000000000002 sealed 2026-08-11 sha256:[0-9a-f]{8}$/);
  // the 8 hex chars are the head of the real seal hash, not a re-hash
  const full = /hash: "sha256:([0-9a-f]{64})"/.exec(sealed)[1];
  assert.ok(line.endsWith(full.slice(0, 8)));
});

test("embed: refuses unsealed records and v1 seals instead of inventing a date", () => {
  assert.throws(() => embedLine(load("valid", "v2-unsealed.antefact.md")), /unsealed/);
  // v1 golden vector has a real seal but no ts — the embed's date would have to
  // be fabricated, so the spoke must refuse with the honest reason
  assert.throws(() => embedLine(load("valid", "v6-sealed-v1.antefact.md")), /no sealed time .*v1/);
});

test("render: receipt carries claim, authorship labels, seal, and settlement", () => {
  const { text: sealed } = sealRecord(load("valid", "v2-unsealed.antefact.md"), { now: new Date("2026-08-11T02:15:00Z") });
  const settled = settleRecord(sealed, { outcome: "yes", by: "h:Dana Park", observed: "9.4%", now: new Date("2026-08-12T00:00:00Z") });
  const md = renderReceipt(settled);
  assert.match(md, /New-signup conversion exceeds 8%/);
  assert.match(md, /AI-proposed, human adopted/, "h←ai must be spelled out, not shown as a glyph only");
  assert.match(md, /sealed 2026-08-11T02:15Z/);
  assert.match(md, /\*\*yes\*\* by h:Dana Park · observed 9\.4%/);
  // display abbreviation is allowed; the full 64-hex digest is not a display
  assert.ok(!/[0-9a-f]{64}/.test(md), "receipt shows abbreviated digests only");
});

test("embed and render refuse to dress a broken seal as intact", () => {
  const { text: sealed } = sealRecord(load("valid", "v2-unsealed.antefact.md"), { now: new Date("2026-08-11T02:15:00Z") });
  const tampered = sealed.replace("exceeds 8%", "exceeds 5%");
  // the embed is a claim line — a broken seal must refuse it outright
  assert.throws(() => embedLine(tampered), /refusing to embed.*SEAL BROKEN/);
  // the receipt still renders (it displays the record) but names the break
  assert.match(renderReceipt(tampered), /SEAL DOES NOT VERIFY/);
  assert.ok(!/SEAL DOES NOT VERIFY/.test(renderReceipt(sealed)), "an intact seal draws no warning");
});

test("prov: a settlement timestamp that already carries seconds is not corrupted", () => {
  const { text: sealed } = sealRecord(load("valid", "v2-unsealed.antefact.md"), { now: new Date("2026-08-11T02:15:00Z") });
  const settled = settleRecord(sealed, { outcome: "yes", by: "h:Dana Park", now: new Date("2026-08-12T00:00:00Z") });
  // hand-edit the entry to second precision — legal, the schema types it as a plain string
  const secondPrecision = settled.replace(/^- 2026-08-12T00:00Z/m, "- 2026-08-12T00:00:00Z");
  const doc = provJsonLd(secondPrecision);
  const st = doc["@graph"].find((n) => [].concat(n["@type"]).includes("antefact:Settlement"));
  assert.equal(st["prov:endedAtTime"]["@value"], "2026-08-12T00:00:00Z",
    "appending :00 to a value that already has seconds produced ...T00:00:00:00Z");
});

test("render: a v1 seal is shown with its missing time named, not padded", () => {
  const md = renderReceipt(load("valid", "v6-sealed-v1.antefact.md"));
  assert.match(md, /no sealed time \(recipe v1\)/);
});

test("prov: record, premises, seal activity and settlement project to PROV-O", () => {
  const { text: sealed } = sealRecord(load("valid", "v2-unsealed.antefact.md"), { now: new Date("2026-08-11T02:15:00Z") });
  const settled = settleRecord(sealed, { outcome: "yes", by: "h:Dana Park", now: new Date("2026-08-12T00:00:00Z") });
  const doc = provJsonLd(settled);
  const g = doc["@graph"];
  const byType = (t) => g.filter((n) => [].concat(n["@type"]).includes(t));
  assert.equal(byType("antefact:Record").length, 1);
  assert.equal(byType("antefact:Premise").length, 2);
  assert.equal(byType("antefact:Sealing").length, 1);
  assert.equal(byType("antefact:Settlement").length, 1);
  // the sealing activity carries the sealed time as xsd:dateTime
  const sealing = byType("antefact:Sealing")[0];
  assert.equal(sealing["prov:endedAtTime"]["@value"], "2026-08-11T02:15:00Z");
  // the settler agent exists and the settlement points at them
  const settlement = byType("antefact:Settlement")[0];
  assert.ok(settlement["prov:wasAssociatedWith"]["@id"].includes("Dana"));
  // ai agent typed as SoftwareAgent, human as Person
  assert.ok(g.some((n) => n["@type"] === "prov:SoftwareAgent"));
  assert.ok(g.some((n) => n["@type"] === "prov:Person"));
});

test("prov: v1 seal exports WITHOUT endedAtTime — the export never improves on the record", () => {
  const doc = provJsonLd(load("valid", "v6-sealed-v1.antefact.md"));
  const sealing = doc["@graph"].find((n) => [].concat(n["@type"]).includes("antefact:Sealing"));
  assert.ok(sealing, "seal activity still exported");
  assert.equal(sealing["prov:endedAtTime"], undefined, "a time the record does not carry must not appear in the export");
});

test("prov: delegation carries authorship + policyRef, and no fabricated actedOnBehalfOf edge", () => {
  const doc = provJsonLd(load("valid", "v3-delegation.antefact.md"));
  const premise = doc["@graph"].find((n) => [].concat(n["@type"]).includes("antefact:Premise"));
  assert.equal(premise["antefact:authorship"], "ai←h");
  assert.equal(premise["antefact:policyRef"], "policies/refund-auto-approve-v2.md");
  assert.ok(!JSON.stringify(doc).includes("actedOnBehalfOf"),
    "the record names a policy, not the policy's owner — an agent-to-agent edge would be invented");
});

test("report: denominator line counts every unscored exit next to the scored count", (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), "antefact-report-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const base = load("valid", "v2-unsealed.antefact.md");
  const mk = (id, p) => base
    .replace(/^id: .*$/m, `id: 018f0000-0000-7000-8000-0000000002${id}`)
    .replace('{ raw: "0.65", mode: direct, canonical: 0.65, granularity: 0.05 }',
      `{ raw: "${p}", mode: direct, canonical: ${p}, granularity: 0.01 }`);
  const now = new Date("2026-08-11T03:00:00Z");
  const seal = (t) => sealRecord(t, { now }).text;
  const settle = (t, outcome) => settleRecord(t, { outcome, by: "h:Dana Park", now });
  writeFileSync(path.join(dir, "a.antefact.md"), settle(seal(mk("01", 0.9)), "yes"));
  writeFileSync(path.join(dir, "b.antefact.md"), settle(seal(mk("02", 0.15)), "no"));
  writeFileSync(path.join(dir, "c.antefact.md"), settle(seal(mk("03", 0.7)), "ambiguous"));
  writeFileSync(path.join(dir, "d.antefact.md"), seal(mk("04", 0.5)));

  const md = storeReport(dir, { now });
  assert.match(md, /\*\*Denominator: 4 sealed · 2 scored · 1 unscored exits\*\*/);
  assert.match(md, /ambiguous 1/);
  assert.match(md, /withdrawn-after-seal 0/);
  assert.match(md, /\| 0\.8–1\.0 \| 1 \| 0\.90 \| 1\.00 \|/);
  assert.match(md, /\| 0\.0–0\.2 \| 1 \| 0\.15 \| 0\.00 \|/);
  // asserted directly — the earlier `!A || B` form was vacuously true because
  // the report always contains B, so it could never catch a Brier line
  assert.ok(!/brier|single score:/i.test(md), "no single aggregate score");
  assert.match(md, /intentionally absent/);
  assert.match(md, /non-ranking clause/);
});

test("report: a record withdrawn before sealing is not a post-seal exit", (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), "antefact-neversealed-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  // recorded → withdrawn without ever sealing: no seal, state withdrawn
  const never = load("valid", "v1-recorded.antefact.md")
    .replace(/^state: recorded$/m, "state: withdrawn")
    .replace(/^id: .*$/m, "id: 018f0000-0000-7000-8000-0000000003aa");
  writeFileSync(path.join(dir, "never.antefact.md"), never);
  const md = storeReport(dir, { now: new Date("2026-08-11T03:00:00Z") });
  // exits must not exceed entries: nothing was sealed, so nothing exited
  assert.match(md, /\*\*Denominator: 0 sealed · 0 scored · 0 unscored exits\*\*/);
});

test("report: a lapsed sealed record lands in the denominator", (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), "antefact-lapsed-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const base = load("valid", "v2-unsealed.antefact.md")
    .replace(/^settle_by: .*$/m, "settle_by:  2020-01-01T00:00Z");
  writeFileSync(path.join(dir, "lapsed.antefact.md"), sealRecord(base, { now: new Date("2026-08-11T03:00:00Z") }).text);
  const md = storeReport(dir, { now: new Date("2026-08-11T03:00:00Z") });
  assert.match(md, /lapsed 1/);
  assert.match(md, /1 unscored exits/);
});
