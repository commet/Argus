#!/usr/bin/env node
// antefact — reference CLI for the Antefact judgment-record format (v0.1 draft).
// Zero-dependency by design: this zone must stay extractable to its own repository.
// Grammar note: frontmatter and Stake values are parsed as the constrained YAML
// subset the spec fixes per key (flow maps/arrays, quoted strings, numbers, bare
// tokens) — not a general YAML parser. Unknown shapes fail loudly, never guess.
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import path from "node:path";

// ---------- canonicalization ----------
export function canon(v) {
  if (v === null || v === undefined) return "null";
  if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
  if (typeof v === "object")
    return "{" + Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
  return JSON.stringify(v);
}
export const sha256 = (s) => createHash("sha256").update(s, "utf8").digest("hex");

// ---------- flow-value parser (constrained YAML subset) ----------
export function parseFlow(src) {
  let i = 0;
  const err = (m) => { throw new Error(`flow parse: ${m} at ${i} in ${JSON.stringify(src)}`); };
  const ws = () => { while (i < src.length && /\s/.test(src[i])) i++; };
  function value() {
    ws();
    const c = src[i];
    if (c === "{") return map();
    if (c === "[") return arr();
    if (c === '"') return qstr();
    return bare();
  }
  function map() {
    i++; const o = {};
    ws();
    if (src[i] === "}") { i++; return o; }
    for (;;) {
      ws();
      const k = keyToken();
      ws();
      if (src[i] !== ":") err("expected ':'");
      i++;
      o[k] = value();
      ws();
      if (src[i] === ",") { i++; continue; }
      if (src[i] === "}") { i++; return o; }
      err("expected ',' or '}'");
    }
  }
  function arr() {
    i++; const a = [];
    ws();
    if (src[i] === "]") { i++; return a; }
    for (;;) {
      a.push(value());
      ws();
      if (src[i] === ",") { i++; continue; }
      if (src[i] === "]") { i++; return a; }
      err("expected ',' or ']'");
    }
  }
  // Escapes are parsed, not passed through: a value containing \" used to end
  // the string early and change the canonical projection — i.e. silently alter
  // what a seal covers. Only the two escapes the format uses are accepted; any
  // other backslash form fails loudly rather than being guessed at.
  function qstr() {
    i++; let s = "";
    while (i < src.length && src[i] !== '"') {
      if (src[i] === "\\") {
        const next = src[i + 1];
        if (next !== '"' && next !== "\\") err(`unsupported escape \\${next ?? "<eof>"}`);
        s += next; i += 2; continue;
      }
      s += src[i]; i++;
    }
    if (src[i] !== '"') err("unterminated string");
    i++; return s;
  }
  function keyToken() {
    let s = "";
    while (i < src.length && /[^\s:,}\]]/.test(src[i])) { s += src[i]; i++; }
    if (!s) err("empty key");
    return s;
  }
  function bare() {
    let depth0 = 0, s = "";
    while (i < src.length) {
      const c = src[i];
      if (depth0 === 0 && (c === "," || c === "}" || c === "]")) break;
      s += c; i++;
    }
    s = s.trim();
    if (s === "") err("empty value");
    if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
    if (s === "true") return true;
    if (s === "false") return false;
    return s;
  }
  const v = value();
  ws();
  if (i !== src.length) err("trailing content");
  return v;
}

// authors / settled_by entries: [{h: "name"}] or token form [h:name]
export function parseActorList(src) {
  const v = parseFlow(src);
  return v.map((item) => {
    if (typeof item === "object" && !Array.isArray(item)) {
      const keys = Object.keys(item);
      if (keys.length !== 1) throw new Error(`actor entry must have exactly one key: ${JSON.stringify(item)}`);
      return { key: keys[0], name: String(item[keys[0]]) };
    }
    const m = String(item).match(/^(h|ai|u)\s*:\s*(.+)$/);
    if (!m) throw new Error(`unparseable actor entry: ${JSON.stringify(item)}`);
    return { key: m[1], name: m[2].trim() };
  });
}

// ---------- record parser ----------
const STATES = ["recorded", "sealed", "settled", "disputed", "withdrawn"];
const OUTCOMES = ["yes", "no", "ambiguous", "annulled"];
const AUTH_VALUES = ["h", "ai", "h←ai", "ai←h", "u"];
const SEAL_LEVELS = ["L0", "L1", "L2"];
const FULL_SHA256 = /^[0-9a-f]{64}$/;

export function parseRecord(text, file = "<memory>") {
  const errors = [];
  const fail = (code, msg) => errors.push({ code, msg });

  const fm = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!fm) return { errors: [{ code: "E_FRONTMATTER", msg: "missing --- frontmatter block" }] };
  const front = {};
  for (const line of fm[1].split("\n")) {
    if (!line.trim()) continue;
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (!m) { fail("E_FRONTMATTER_LINE", `unparseable line: ${line}`); continue; }
    front[m[1]] = m[2].trim();
  }
  for (const k of ["antefact", "id", "authors", "state"])
    if (!(k in front)) fail("E_REQUIRED_KEY", `frontmatter missing required key: ${k}`);

  let authors = [];
  if (front.authors) {
    try { authors = parseActorList(front.authors); }
    catch (e) { fail("E_AUTHORS", e.message); }
  }
  if (front.state && !STATES.includes(front.state))
    fail("E_STATE", `state must be one of ${STATES.join("/")}, got: ${front.state}`);

  const body = text.slice(fm[0].length);
  const title = (body.match(/^#\s+(.+)$/m) || [])[1] || "";

  const section = (name) => {
    const re = new RegExp(`## ${name}([\\s\\S]*?)(?=\\n## |$)`);
    const m = body.match(re);
    return m ? m[1] : null;
  };
  const stmtRaw = section("Statement");
  const stakeRaw = section("Stake");
  const settleRaw = section("Settlement");

  // Statement premises
  const premises = [];
  if (stmtRaw) {
    const lines = stmtRaw.split("\n");
    for (let li = 0; li < lines.length; li++) {
      const m = lines[li].match(/^- (P\d+) \(([^)]+)\)\s*(?:\[(\w+)·(\w+)\])?\s*(.*)$/);
      if (!m) continue;
      const [, pid, author, kind, confidence, ptext] = m;
      if (!AUTH_VALUES.includes(author)) fail("E_AUTHORSHIP_VALUE", `${pid}: unknown authorship value "${author}"`);
      const extra = [];
      while (li + 1 < lines.length && /^\s{2,}\S/.test(lines[li + 1]) && !/^- P\d+/.test(lines[li + 1].trim())) {
        extra.push(lines[li + 1].trim()); li++;
      }
      premises.push({ pid, author, kind: kind || null, confidence: confidence || null, text: ptext.trim(), extra });
    }
    const pids = premises.map(p => p.pid);
    for (const dup of pids.filter((p, ix) => pids.indexOf(p) !== ix))
      fail("E_PID_DUP", `duplicate premise id ${dup}`);
  }

  // Stake key/values — a value may wrap across indented continuation lines.
  let stake = null;
  if (stakeRaw) {
    stake = { raw: {}, seal: null };
    const lines = stakeRaw.split("\n");
    for (let li = 0; li < lines.length; li++) {
      const m = lines[li].match(/^(\w+):\s*(.*)$/);
      if (!m) continue;
      let [, key, val] = m;
      const balanced = (s) => {
        let d = 0, q = false;
        for (const ch of s) {
          if (ch === '"') q = !q;
          if (q) continue;
          if (ch === "{" || ch === "[") d++;
          if (ch === "}" || ch === "]") d--;
        }
        return d === 0;
      };
      while (!balanced(val) && li + 1 < lines.length) { li++; val += " " + lines[li].trim(); }
      stake.raw[key] = val.trim();
    }
    if (stake.raw.seal) {
      try { stake.seal = parseFlow(stake.raw.seal); }
      catch (e) { fail("E_SEAL_PARSE", e.message); }
    }
    if (stake.raw.p) {
      try {
        const p = parseFlow(stake.raw.p);
        stake.p = typeof p === "number"
          ? { raw: String(p), mode: "direct", canonical: p, granularity: null, bare: true }
          : p;
      } catch (e) { fail("E_P_PARSE", e.message); }
    }
    if (stake.raw.settled_by) {
      try { stake.settled_by = parseActorList(stake.raw.settled_by); }
      catch (e) { fail("E_SETTLED_BY", e.message); }
    }
    if (stake.raw.criteria) {
      try { stake.criteria = parseFlow(stake.raw.criteria); }
      catch (e) { fail("E_CRITERIA_PARSE", e.message); }
    }
  }

  // Settlement entries (append-only list)
  const settlements = [];
  if (settleRaw) {
    for (const line of settleRaw.split("\n")) {
      // `by` runs to the next · or end of line: settler names contain spaces
      // ("h:Dana Park"), and a \S+ capture silently truncated the whole entry.
      const m = line.match(/^- (\S+)\s+outcome:\s*(\S+)(?:\s*·\s*by:\s*([^·\n]+?))?(?:\s*·\s*observed:\s*"([^"]*)")?(?:\s*·\s*source_ref:\s*(.+))?$/);
      if (!m) continue;
      const [, ts, outcome, by, observed, source_ref] = m;
      if (!OUTCOMES.includes(outcome)) fail("E_OUTCOME", `unknown outcome "${outcome}"`);
      settlements.push({ ts, outcome, by: by ?? null, observed: observed ?? null, source_ref: source_ref ? source_ref.trim() : null });
    }
  }

  return { file, front, authors, title, premises, stake, settlements, errors };
}

// ---------- projections & hashing ----------
export function statementProjection(rec) {
  return {
    title: rec.title,
    premises: rec.premises.map(p => ({
      pid: p.pid, author: p.author, kind: p.kind, confidence: p.confidence, text: p.text, extra: p.extra,
    })),
  };
}
export function statementRev(rec) { return sha256(canon(statementProjection(rec))); }

/**
 * Projection recipes, oldest first. `v1` is what every record sealed before
 * 2026-08-11 used; `v2` adds the seal timestamp. Old recipes are never removed —
 * a record names its recipe in `seal.proj`, and dropping a recipe would turn
 * every record sealed under it into an unverifiable file.
 */
export const PROJ_VERSIONS = ["v1", "v2"];
export const PROJ_CURRENT = "v2";

/**
 * `ts` lives INSIDE the hashed projection, not beside it. A seal time that is
 * not itself sealed is the one field an adversary edits: the whole claim of
 * this format is that the record existed before the outcome, so a freely
 * rewritable date would let a record be back-dated without breaking its hash.
 * Under v2, editing `ts` breaks verification like any other sealed field.
 */
export function stakeProjection(rec, nonce, stmtRev, { proj = "v1", ts = null } = {}) {
  const s = rec.stake;
  const base = {
    claim: s.raw.claim ?? null,
    p: s.p ? { raw: String(s.p.raw), mode: s.p.mode ?? null, canonical: s.p.canonical ?? null, granularity: s.p.granularity ?? null } : null,
    confidence: s.raw.confidence ?? null,
    settle_by: s.raw.settle_by ?? null,
    settled_by: (s.settled_by ?? []).map(a => a.key + ":" + a.name),
    criteria: s.criteria ?? null,
    annul_if: s.raw.annul_if ?? null,
    nonce,
    statement_rev: stmtRev,
  };
  if (proj === "v1") return base;
  if (proj === "v2") return { ...base, ts: ts ?? null };
  throw new Error(`unknown projection recipe "${proj}" — known: ${PROJ_VERSIONS.join("/")}`);
}
export function stakeHash(rec, nonce, stmtRev, opts) { return sha256(canon(stakeProjection(rec, nonce, stmtRev, opts))); }

// ---------- lint ----------
export function lint(rec, { now = new Date() } = {}) {
  const errors = [...rec.errors];
  const warnings = [];
  const E = (code, msg) => errors.push({ code, msg });
  const W = (code, msg) => warnings.push({ code, msg });
  const state = rec.front?.state;

  if (state === "sealed" || state === "settled" || state === "disputed") {
    if (!rec.stake) E("E_NO_STAKE", `state=${state} requires a Stake block`);
    else {
      for (const k of ["claim", "settle_by"])
        if (!rec.stake.raw[k]) E("E_STAKE_KEY", `state=${state} requires stake.${k}`);
      if (!rec.stake.p) E("E_STAKE_KEY", `state=${state} requires stake.p`);
      else {
        if (typeof rec.stake.p.canonical !== "number") E("E_P_CANONICAL", "p.canonical must be a number (derived, marked as derived)");
        else if (rec.stake.p.canonical < 0 || rec.stake.p.canonical > 1) E("E_P_RANGE", "p.canonical must be within [0,1]");
        if (rec.stake.p.bare) W("W_P_BARE", "bare numeric p — raw input gesture not preserved (p {raw, mode, canonical, granularity} preferred)");
      }
      if (!rec.stake.settled_by?.length) E("E_SETTLED_BY", `state=${state} requires named settlers (settled_by)`);
      else {
        const authorNames = new Set(rec.authors.map(a => `${a.key}:${a.name}`));
        if (rec.stake.settled_by.some(s => authorNames.has(`${s.key}:${s.name}`)))
          W("W_SELF_SETTLED", "a named settler is also an author — allowed, but the record is self-settled and tools must show it; an independent settler strengthens it");
      }
      // The whole seal, not just its hash: a hash with no recipe version, no
      // Statement binding or no nonce cannot establish the commitment the spec
      // requires, and a record missing them would lint clean while being
      // unverifiable — the silent dead end this format exists to prevent.
      const seal = rec.stake.seal;
      if (!seal?.hash) E("E_SEAL", `state=${state} requires seal.hash`);
      else {
        for (const k of ["level", "proj", "statement_rev", "nonce"])
          if (seal[k] === undefined) E("E_SEAL_FIELD", `state=${state} requires seal.${k}`);
        if (seal.level !== undefined && !SEAL_LEVELS.includes(String(seal.level)))
          E("E_SEAL_LEVEL", `seal.level must be one of ${SEAL_LEVELS.join("/")}, got: ${seal.level}`);
        for (const k of ["hash", "statement_rev"]) {
          const v = String(seal[k] ?? "").replace(/^sha256:/, "");
          if (seal[k] !== undefined && !FULL_SHA256.test(v))
            E("E_SEAL_DIGEST", `seal.${k} must be sha256: + 64 lowercase hex characters (abbreviated digests can never verify)`);
        }
      }
      if (!rec.stake.criteria) W("W_CRITERIA", "no settlement criteria — settleability lint: name source/threshold/edge before sealing");
      if (rec.stake.raw.settle_by && state === "sealed") {
        const d = new Date(String(rec.stake.raw.settle_by).replace(/Z?$/, "Z"));
        if (!isNaN(d) && d < now) W("W_LAPSED", `settle_by ${rec.stake.raw.settle_by} has passed — record is lapsed, settle or withdraw`);
      }
      for (const a of rec.authors) if (a.key === "u") W("W_AUTHOR_U", "authorship 'u' on a sealed record — name the author or keep the record unsealed");
    }
  }
  if (state === "recorded" && rec.stake?.seal?.hash)
    E("E_STATE_MISMATCH", "record carries a seal but state=recorded — set state: sealed");
  if ((state === "settled" || state === "disputed") && rec.settlements.length === 0)
    E("E_NO_SETTLEMENT", `state=${state} requires at least one Settlement entry`);
  if (state !== "settled" && state !== "disputed" && rec.settlements.length > 0)
    E("E_STATE_MISMATCH", `Settlement entries present but state=${state} — set state: settled`);
  // Every settlement names its settler: authorization checked only in memory
  // and then discarded leaves a record that cannot show who closed the claim.
  for (const s of rec.settlements)
    if (!s.by) E("E_SETTLEMENT_BY", `settlement ${s.ts} does not name the settler (by:)`);
  if (state === "disputed" && new Set(rec.settlements.map(s => s.outcome)).size < 2)
    E("E_NOT_DISPUTED", "state=disputed requires conflicting outcomes from named settlers");

  const delegated = rec.premises.some(p => p.author === "ai←h") ||
    rec.authors.some(a => a.key === "ai" && (state === "sealed" || state === "settled") && false); // authors use h/ai/u only
  if (delegated && !rec.front.policy_ref)
    E("E_POLICY_REF", "ai←h (delegation) requires policy_ref — the delegator owns exposure through a named policy");

  const premisesWithoutSources = rec.premises.filter(p => p.kind !== "fact" && !p.extra.some(x => x.startsWith("sources:")));
  if ((state === "sealed" || state === "settled") && premisesWithoutSources.length === rec.premises.length && rec.premises.length > 0)
    W("W_SOURCES", "no premise cites sources — settleability lint (SHOULD)");

  return { errors, warnings };
}

export function lintDir(dir, opts) {
  const files = readdirSync(dir).filter(f => f.endsWith(".antefact.md")).map(f => path.join(dir, f));
  const byId = new Map();
  const results = [];
  for (const f of files) {
    const rec = parseRecord(readFileSync(f, "utf8"), f);
    const r = lint(rec, opts);
    if (rec.front?.id) {
      if (byId.has(rec.front.id)) {
        const msg = `duplicate id ${rec.front.id} (also in ${byId.get(rec.front.id)}) — both records invalid for verification`;
        r.errors.push({ code: "E_ID_DUP", msg });
        results.find(x => x.file === byId.get(rec.front.id))?.result.errors.push({ code: "E_ID_DUP", msg });
      } else byId.set(rec.front.id, f);
    }
    results.push({ file: f, result: r });
  }
  return results;
}

// ---------- seal / verify / settle ----------
export function sealRecord(text, { level = "L0", ref = null, now = new Date(), proj = PROJ_CURRENT } = {}) {
  const rec = parseRecord(text);
  if (rec.errors.length) throw new Error("cannot seal a record with parse errors: " + rec.errors.map(e => e.code).join(","));
  if (!SEAL_LEVELS.includes(level)) throw new Error(`seal level must be one of ${SEAL_LEVELS.join("/")}, got: ${level}`);
  if (rec.stake?.seal?.hash && rec.stake.seal.hash !== "TBS")
    throw new Error("record is already sealed — Stake is immutable once sealed (amend via a new record + superseded_by)");
  if (!rec.stake) throw new Error("no Stake block to seal");
  // Everything the sealed state requires EXCEPT the seal itself — that is what
  // this call is about to write, so its absence is not a reason to refuse.
  const SEAL_CODES = ["E_SEAL", "E_SEAL_FIELD", "E_SEAL_LEVEL", "E_SEAL_DIGEST"];
  const pre = lint({ ...rec, front: { ...rec.front, state: "sealed" }, stake: { ...rec.stake, seal: { hash: "x" } } });
  const blocking = pre.errors.filter(e => !SEAL_CODES.includes(e.code));
  if (blocking.length) throw new Error("seal blocked by lint: " + blocking.map(e => `${e.code}(${e.msg})`).join("; "));
  if (!PROJ_VERSIONS.includes(proj)) throw new Error(`unknown projection recipe "${proj}" — known: ${PROJ_VERSIONS.join("/")}`);
  const nonce = randomBytes(6).toString("hex");
  const stmtRev = statementRev(rec);
  // Minute precision, matching settlement entries. A seal claims "before", not
  // "at 10:42:07" — and at L0 the clock is the author's own, which is why the
  // seal level, not this field, is what a reader weighs.
  const ts = proj === "v1" ? null : now.toISOString().slice(0, 16) + "Z";
  const hash = stakeHash(rec, nonce, stmtRev, { proj, ts });
  const tsPart = ts ? `, ts: "${ts}"` : "";
  const sealLine = `seal:       { level: ${level}, proj: ${proj}${tsPart}, hash: "sha256:${hash}", statement_rev: "sha256:${stmtRev}", nonce: "${nonce}"${ref ? `, ref: "${ref}"` : ""} }`;
  let out = text;
  if (/^seal:.*$/m.test(out)) out = out.replace(/^seal:.*$/m, sealLine);
  else if (/## Settlement/.test(out)) out = out.replace(/## Settlement/, sealLine + "\n\n## Settlement");
  // No Settlement heading is legal (settleRecord adds one), but the seal still
  // has to land somewhere: appending it after the Stake block keeps a record
  // from being stamped `sealed` while carrying no seal at all.
  else out = out.trimEnd() + "\n" + sealLine + "\n";
  out = out.replace(/^state: recorded$/m, "state: sealed");
  if (!/^seal:/m.test(out)) throw new Error("internal: seal line was not written");
  return { text: out, hash, statementRev: stmtRev, nonce };
}

export function verifyRecord(text) {
  const rec = parseRecord(text);
  if (rec.errors.length) return { ok: false, reason: "parse errors: " + rec.errors.map(e => e.code).join(",") };
  const seal = rec.stake?.seal;
  if (!seal?.hash) return { ok: false, reason: "record is not sealed" };
  if (seal.proj === undefined)
    return { ok: false, reason: "seal carries no projection version (pre-v1 harness) — verify with the sealing harness or re-seal; a hash whose recipe is unknown proves nothing" };
  if (!PROJ_VERSIONS.includes(seal.proj))
    return { ok: false, reason: `unknown projection version "${seal.proj}" — this CLI verifies ${PROJ_VERSIONS.join("/")}` };
  // A v2 seal without its timestamp is not a v1 seal wearing a v2 label: the
  // recipe it names includes `ts`, so a missing one is a broken seal, not an
  // absent optional field. Falling back to null here would let anyone strip the
  // date off a back-dating claim and still verify.
  if (seal.proj === "v2" && !seal.ts)
    return { ok: false, reason: "proj v2 seal carries no ts — the recipe it names includes the seal time, so it cannot be verified without one" };
  if (!SEAL_LEVELS.includes(String(seal.level)))
    return { ok: false, reason: `unknown seal level "${seal.level}" — the format defines ${SEAL_LEVELS.join("/")} only` };
  const nonce = String(seal.nonce ?? "");
  const recordedStmtRev = String(seal.statement_rev ?? "").replace(/^sha256:/, "");
  const recordedHash = String(seal.hash).replace(/^sha256:/, "");
  // Whole digests only. Comparing a prefix meant `sha256:a` verified against
  // any hash starting with "a" — a verifier that accepts an abbreviation is
  // not a verifier. Display may abbreviate; verification never does.
  for (const [k, v] of [["hash", recordedHash], ["statement_rev", recordedStmtRev]])
    if (!FULL_SHA256.test(v))
      return { ok: false, reason: `seal.${k} is not a complete sha256 digest (need 64 lowercase hex characters) — abbreviated digests cannot be verified` };
  const currentStmtRev = statementRev(rec);
  const recomputed = stakeHash(rec, nonce, recordedStmtRev, { proj: seal.proj, ts: seal.ts ?? null });
  const matches = recomputed === recordedHash;
  const statementAmended = currentStmtRev !== recordedStmtRev;
  return matches
    ? { ok: true, statementAmended, hash: recomputed }
    : { ok: false, reason: "SEAL BROKEN — sealed Stake fields do not match the recorded hash", recomputed, recorded: recordedHash };
}

export function settleRecord(text, { outcome, by, observed = null, sourceRef = null, note = null, now = new Date() }) {
  const rec = parseRecord(text);
  if (rec.errors.length) throw new Error("cannot settle: parse errors " + rec.errors.map(e => e.code).join(","));
  if (!rec.stake?.seal?.hash) throw new Error("cannot settle an unsealed record");
  const v = verifyRecord(text);
  if (!v.ok) throw new Error("refusing to settle: " + v.reason);
  if (!OUTCOMES.includes(outcome)) throw new Error(`outcome must be one of ${OUTCOMES.join("/")}`);
  const allowed = (rec.stake.settled_by ?? []).map(a => `${a.key}:${a.name}`);
  if (!allowed.includes(by)) throw new Error(`settler "${by}" is not named in settled_by [${allowed.join(", ")}] — only named settlers may settle`);
  const ts = now.toISOString().slice(0, 16) + "Z";
  // `by` is written into the entry, not just checked: the record has to show
  // which named settler closed it, or a later dispute has no counterparties.
  let entry = `- ${ts}  outcome: ${outcome} · by: ${by}`;
  if (observed !== null) entry += ` · observed: "${observed}"`;
  if (sourceRef !== null) entry += ` · source_ref: ${sourceRef}`;
  if (note) entry += `\n  note: ${note}`;
  let out = text.replace(/\(미정산[^\n]*\)\n?/, "");
  if (!/## Settlement/.test(out)) out = out.trimEnd() + "\n\n## Settlement\n";
  out = out.trimEnd() + "\n" + entry + "\n";
  // Conflicting outcomes from different named settlers do not overwrite each
  // other — both entries stay and the record becomes `disputed` (unscored).
  const priorOutcomes = new Set(rec.settlements.map(s => s.outcome));
  const conflicting = rec.settlements.some(s => s.outcome !== outcome && s.by && s.by !== by);
  const nextState = conflicting || (priorOutcomes.size && !priorOutcomes.has(outcome) && rec.settlements.some(s => s.by !== by))
    ? "disputed" : "settled";
  out = out.replace(/^state: (sealed|settled|disputed)$/m, `state: ${nextState}`);
  return out;
}

// ---------- CLI ----------
function main() {
  const [cmd, target, ...rest] = process.argv.slice(2);
  const flags = {};
  for (let i = 0; i < rest.length; i++)
    if (rest[i].startsWith("--")) { flags[rest[i].slice(2)] = rest[i + 1] && !rest[i + 1].startsWith("--") ? rest[++i] : true; }

  const die = (msg, code = 1) => { console.error(msg); process.exit(code); };
  const load = () => { try { return readFileSync(target, "utf8"); } catch { die(`cannot read ${target}`); } };

  switch (cmd) {
    case "parse": {
      const rec = parseRecord(load(), target);
      if (rec.errors.length) { console.error(JSON.stringify(rec.errors, null, 2)); process.exit(2); }
      console.log(JSON.stringify({ front: rec.front, title: rec.title, premises: rec.premises, stake: rec.stake && { ...rec.stake, raw: rec.stake.raw }, settlements: rec.settlements }, null, 2));
      break;
    }
    case "projection": {
      const rec = parseRecord(load(), target);
      if (rec.errors.length) die(JSON.stringify(rec.errors), 2);
      const seal = rec.stake?.seal ?? {};
      const stmtRev = String(seal.statement_rev ?? "").replace(/^sha256:/, "") || statementRev(rec);
      // An unsealed record has no recipe of its own yet, so show what it would
      // be sealed under today rather than silently projecting it as v1.
      const proj = seal.proj ?? PROJ_CURRENT;
      if (!PROJ_VERSIONS.includes(proj)) die(`unknown projection version "${proj}"`, 2);
      console.log(canon(stakeProjection(rec, String(seal.nonce ?? ""), stmtRev, { proj, ts: seal.ts ?? null })));
      break;
    }
    case "lint": {
      const isDir = statSync(target).isDirectory();
      const results = isDir ? lintDir(target) : [{ file: target, result: lint(parseRecord(load(), target)) }];
      let errs = 0, warns = 0;
      for (const { file, result } of results) {
        for (const e of result.errors) { console.log(`ERROR ${e.code} ${file}: ${e.msg}`); errs++; }
        for (const w of result.warnings) { console.log(`warn  ${w.code} ${file}: ${w.msg}`); warns++; }
      }
      console.log(`${results.length} record(s) · ${errs} error(s) · ${warns} warning(s)`);
      process.exit(errs > 0 || (flags.strict && warns > 0) ? 2 : 0);
      break;
    }
    case "seal": {
      try {
        const { text, hash } = sealRecord(load(), { level: flags.level || "L0", ref: flags.ref || null });
        writeFileSync(target, text);
        console.log(`sealed ${target}\nhash: sha256:${hash}`);
        console.log(`L1 tip: commit this file now and re-run with --ref "git:<short-hash>" recorded at seal time next time; the log entry is the evidence.`);
      } catch (e) { die(e.message, 2); }
      break;
    }
    case "verify": {
      const v = verifyRecord(load());
      if (v.ok) {
        console.log(`OK — seal verifies (sha256:${v.hash.slice(0, 16)}…)${v.statementAmended ? "\nnote: Statement amended after sealing (visible and allowed; Stake unchanged)" : ""}`);
      } else die(`FAIL — ${v.reason}`, 2);
      break;
    }
    case "settle": {
      try {
        const out = settleRecord(load(), { outcome: flags.outcome, by: flags.by, observed: flags.observed ?? null, sourceRef: flags.source ?? null, note: flags.note ?? null });
        writeFileSync(target, out);
        console.log(`settled ${target}: outcome=${flags.outcome} by=${flags.by}`);
      } catch (e) { die(e.message, 2); }
      break;
    }
    default:
      die(`usage: antefact <parse|projection|lint|seal|verify|settle> <file|dir> [--strict] [--level L0|L1|L2] [--ref git:abc] [--outcome yes|no|ambiguous|annulled] [--by "h:Name"] [--observed X] [--source ref] [--note text]`);
  }
}
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) main();
