// Conformance tests for the Antefact reference CLI. Run: node --test antefact/test/
// These double as the golden-vector suite: vectors/valid must parse clean,
// vectors/invalid must fail with exactly the named codes, vectors/warn must warn.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseFlow,
  parseRecord, lint, lintDir, sealRecord, verifyRecord, settleRecord,
  canon, statementRev, stakeHash,
} from "../cli/antefact.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const vec = (...p) => path.join(here, "..", "vectors", ...p);
const load = (...p) => readFileSync(vec(...p), "utf8");

test("every valid vector parses with zero errors", () => {
  for (const f of readdirSync(vec("valid"))) {
    const rec = parseRecord(load("valid", f), f);
    assert.deepEqual(rec.errors, [], `${f} should parse clean`);
  }
});

test("invalid vectors fail with their expected codes", () => {
  const expected = {
    "i1-settled-no-settlement.antefact.md": ["E_NO_SETTLEMENT"],
    "i2-sealed-missing-settleby.antefact.md": ["E_STAKE_KEY", "E_SETTLED_BY"],
    "i3-delegation-no-policy.antefact.md": ["E_POLICY_REF"],
    "i4-recorded-with-seal.antefact.md": ["E_STATE_MISMATCH"],
    "i6-bad-outcome.antefact.md": ["E_OUTCOME"],
    "i7-settlement-no-settler.antefact.md": ["E_SETTLEMENT_BY"],
    "i8-bad-seal-level.antefact.md": ["E_SEAL_LEVEL"],
    "i9-abbreviated-digest.antefact.md": ["E_SEAL_DIGEST"],
  };
  for (const [f, codes] of Object.entries(expected)) {
    const r = lint(parseRecord(load("invalid", f), f));
    for (const code of codes)
      assert.ok(r.errors.some(e => e.code === code), `${f} must raise ${code}; got ${JSON.stringify(r.errors)}`);
  }
});

test("a seal missing any required field is an error, field by field", () => {
  const base = readFileSync(vec("invalid", "i8-bad-seal-level.antefact.md"), "utf8");
  const full = base.replace("level: L9", "level: L0");
  for (const [field, drop] of [
    ["proj", /, proj: v1/],
    ["statement_rev", /, statement_rev: "sha256:0{63}4"/],
    ["nonce", /, nonce: "aaaaaaaaaaaa"/],
  ]) {
    const r = lint(parseRecord(full.replace(drop, "")));
    assert.ok(r.errors.some(e => e.code === "E_SEAL_FIELD" && e.msg.includes(field)),
      `dropping seal.${field} must raise E_SEAL_FIELD; got ${JSON.stringify(r.errors)}`);
  }
});

test("verification refuses abbreviated digests instead of prefix-matching them", () => {
  const { text: sealed } = sealRecord(load("valid", "v2-unsealed.antefact.md"));
  const full = /hash: "sha256:([0-9a-f]{64})"/.exec(sealed)[1];
  const abbreviated = sealed.replace(`sha256:${full}`, `sha256:${full.slice(0, 8)}`);
  const v = verifyRecord(abbreviated);
  assert.equal(v.ok, false);
  assert.match(v.reason, /complete sha256 digest/);
  // the one-character case the prefix comparison used to accept outright
  const single = sealed.replace(`sha256:${full}`, `sha256:${full.slice(0, 1)}`);
  assert.equal(verifyRecord(single).ok, false);
});

test("sealing rejects levels the format does not define", () => {
  assert.throws(() => sealRecord(load("valid", "v2-unsealed.antefact.md"), { level: "L9" }), /seal level must be one of/);
  assert.equal(verifyRecord(readFileSync(vec("invalid", "i8-bad-seal-level.antefact.md"), "utf8")).ok, false);
});

test("a record with no Settlement heading still gets its seal written", () => {
  const source = load("valid", "v2-unsealed.antefact.md").replace(/\n## Settlement\n?/, "\n");
  assert.ok(!/## Settlement/.test(source), "fixture must have no Settlement heading");
  const { text: sealed } = sealRecord(source);
  assert.match(sealed, /^seal:/m, "state was changed to sealed, so a seal must exist");
  assert.match(sealed, /state: sealed/);
  assert.equal(verifyRecord(sealed).ok, true);
});

test("quoted escapes are parsed, not passed through", () => {
  assert.deepEqual(parseFlow('{ a: "say \\"hi\\"", b: "back\\\\slash" }'), { a: 'say "hi"', b: "back\\slash" });
  assert.throws(() => parseFlow('{ a: "bad \\n escape" }'), /unsupported escape/);
});

test("conflicting outcomes from different settlers make the record disputed, keeping both", () => {
  const { text: sealed } = sealRecord(load("valid", "v5-korean.antefact.md"));
  const first = settleRecord(sealed, { outcome: "yes", by: "h:김서진", observed: "감소율 3%" });
  assert.match(first, /state: settled/);
  const second = settleRecord(first, { outcome: "no", by: "h:박다인", observed: "감소율 14%" });
  const rec = parseRecord(second);
  assert.match(second, /state: disputed/);
  assert.equal(rec.settlements.length, 2, "both entries survive — neither settler overwrites the other");
  assert.equal(rec.settlements[0].by, "h:김서진");
  assert.equal(rec.settlements[1].by, "h:박다인");
  assert.deepEqual(lint(rec).errors, [], "a disputed record with conflicting named outcomes is well-formed");
});

test("duplicate ids across a store invalidate both records", () => {
  const results = lintDir(vec("invalid"));
  const dups = results.filter(({ result }) => result.errors.some(e => e.code === "E_ID_DUP"));
  assert.equal(dups.length, 2, "both i5a and i5b must carry E_ID_DUP");
});

test("warning vector raises the full warning cluster", () => {
  const r = lint(parseRecord(load("warn", "w1-warnings.antefact.md")));
  assert.deepEqual(r.errors, [], "w1 is legal — weak, not broken");
  for (const code of ["W_P_BARE", "W_CRITERIA", "W_SELF_SETTLED", "W_AUTHOR_U", "W_LAPSED"])
    assert.ok(r.warnings.some(w => w.code === code), `w1 must warn ${code}; got ${JSON.stringify(r.warnings)}`);
});

test("seal → verify round-trip, and Stake immutability", () => {
  const { text: sealed, hash } = sealRecord(load("valid", "v2-unsealed.antefact.md"));
  assert.match(sealed, /state: sealed/);
  assert.match(sealed, /proj: v2/);
  const v = verifyRecord(sealed);
  assert.equal(v.ok, true, JSON.stringify(v));
  assert.equal(v.hash, hash);
  assert.throws(() => sealRecord(sealed), /already sealed/);
});

test("tampering a sealed Stake field breaks verification loudly", () => {
  const { text: sealed } = sealRecord(load("valid", "v2-unsealed.antefact.md"));
  const tampered = sealed.replace("exceeds 8%", "exceeds 5%");
  const v = verifyRecord(tampered);
  assert.equal(v.ok, false);
  assert.match(v.reason, /SEAL BROKEN/);
});

test("amending the Statement after sealing is visible but legal", () => {
  const { text: sealed } = sealRecord(load("valid", "v2-unsealed.antefact.md"));
  const amended = sealed.replace("Churn is driven mainly by upfront cost", "Churn is driven mostly by upfront cost");
  const v = verifyRecord(amended);
  assert.equal(v.ok, true, JSON.stringify(v));
  assert.equal(v.statementAmended, true);
});

test("a seal without a projection version does not verify", () => {
  const { text: sealed } = sealRecord(load("valid", "v2-unsealed.antefact.md"));
  const stripped = sealed.replace(/proj: v2, /, "");
  const v = verifyRecord(stripped);
  assert.equal(v.ok, false);
  assert.match(v.reason, /projection version/);
});

test("v1 seals keep verifying after v2 exists — old recipes are never dropped", () => {
  const { text: sealedV1 } = sealRecord(load("valid", "v2-unsealed.antefact.md"), { proj: "v1" });
  assert.match(sealedV1, /proj: v1/);
  assert.ok(!/ts:/.test(sealedV1), "a v1 seal must not carry a field its recipe does not hash");
  assert.equal(verifyRecord(sealedV1).ok, true, "a record sealed under v1 must still verify once v2 is the default");
  // the golden vector on disk is a v1 seal too — it is the regression anchor
  assert.equal(verifyRecord(load("valid", "v6-sealed-v1.antefact.md")).ok, true);
});

test("the seal timestamp is sealed, not decoration", () => {
  const { text: sealed } = sealRecord(load("valid", "v2-unsealed.antefact.md"), { now: new Date("2026-08-11T02:15:00Z") });
  assert.match(sealed, /ts: "2026-08-11T02:15Z"/);
  assert.equal(verifyRecord(sealed).ok, true);
  // back-dating is the attack this field exists to make visible
  const backdated = sealed.replace('ts: "2026-08-11T02:15Z"', 'ts: "2020-01-01T00:00Z"');
  const v = verifyRecord(backdated);
  assert.equal(v.ok, false, "editing the seal time must break the seal");
  assert.match(v.reason, /SEAL BROKEN/);
  // and stripping it is not a way around that
  const stripped = sealed.replace(/, ts: "[^"]*"/, "");
  assert.equal(verifyRecord(stripped).ok, false);
  assert.match(verifyRecord(stripped).reason, /carries no ts/);
});

test("settlement: named settler only, append-only, state transition", () => {
  const { text: sealed } = sealRecord(load("valid", "v2-unsealed.antefact.md"));
  assert.throws(() => settleRecord(sealed, { outcome: "yes", by: "h:Nobody" }), /not named in settled_by/);
  assert.throws(() => settleRecord(load("valid", "v2-unsealed.antefact.md"), { outcome: "yes", by: "h:Dana Park" }), /unsealed/);
  assert.throws(() => settleRecord(sealed, { outcome: "partial", by: "h:Dana Park" }), /outcome must be one of/);
  const settled = settleRecord(sealed, { outcome: "yes", by: "h:Dana Park", observed: "9.4%", sourceRef: "dash-w45" });
  assert.match(settled, /state: settled/);
  const rec = parseRecord(settled);
  assert.equal(rec.settlements.length, 1);
  assert.equal(rec.settlements[0].outcome, "yes");
  assert.equal(rec.settlements[0].observed, "9.4%");
  // corrections are reversing entries: a second append is allowed, the first entry survives verbatim
  const corrected = settleRecord(settled, { outcome: "no", by: "h:Dana Park", note: "reverses entry 1 — dashboard restated w45" });
  const rec2 = parseRecord(corrected);
  assert.equal(rec2.settlements.length, 2);
  assert.equal(rec2.settlements[0].outcome, "yes", "original entry must survive unchanged");
  // settling never breaks the seal — settlement lives outside the sealed projection
  assert.equal(verifyRecord(corrected).ok, true);
});

test("canonical projection is independent of key order in the source file", () => {
  const a = parseRecord(load("valid", "v2-unsealed.antefact.md"));
  const b = parseRecord(load("valid", "v4-reordered.antefact.md"));
  assert.equal(statementRev(a), statementRev(b));
  assert.equal(stakeHash(a, "fixednonce00", "rev0"), stakeHash(b, "fixednonce00", "rev0"));
});

test("canon() is deterministic under object key insertion order", () => {
  assert.equal(canon({ b: 1, a: [2, "x", { d: 4, c: 3 }] }), canon({ a: [2, "x", { c: 3, d: 4 }], b: 1 }));
  assert.equal(canon({ a: 1, b: "s" }), '{"a":1,"b":"s"}');
});

test("korean records with token actor lists and wrapped criteria parse and seal", () => {
  const raw = load("valid", "v5-korean.antefact.md");
  const rec = parseRecord(raw);
  assert.deepEqual(rec.errors, []);
  assert.equal(rec.stake.settled_by.length, 2);
  assert.equal(rec.stake.criteria.threshold, "감소율 10%");
  const { text: sealed } = sealRecord(raw);
  assert.equal(verifyRecord(sealed).ok, true);
  const settled = settleRecord(sealed, { outcome: "no", by: "h:박다인", observed: "감소율 14%", sourceRef: "dash-w47" });
  assert.equal(parseRecord(settled).settlements[0].outcome, "no");
});
