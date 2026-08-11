# Minimum Elements of a Judgment Record

v0.2 · 2026-08-10 · CC BY 4.0 · format-neutral (modeled on the NTIA
minimum-elements approach that carried SBOM) · Requirement terms per RFC 2119

What any record of a consequential judgment — made by a human with, over, or
against an AI system — must capture to support explanation, oversight, and
verification. Independent of tool, vendor, and file format. Regulation
increasingly turns on one question of fact: **did a named human actually judge,
and what was the AI system's role?** The EU AI Act grants an explanation right
over "the role of the AI system in the decision-making procedure" (Art. 86);
Korean, UK, and US regimes make meaningful human judgment an exemption switch,
a liability defence, or a supervisory KPI. Yet no jurisdiction defines what a
record proving these facts minimally contains. This document defines that
floor. It is deliberately **not a format**: any format can meet it, and
competing formats that meet it strengthen rather than threaten it.

## E1 — Time and sequence

Every recorded act (proposal, decision, override, settlement) SHALL carry a
timestamp, and a record committed *before* an outcome was known SHALL be
distinguishable from one reconstructed afterwards — by append-only logging,
content hashing, or equivalent tamper-evident means. A self-editable log
without an external observer provides *evidence* of sequence, not proof; the
record SHALL state which strength it claims (self-declared / tamper-evident
log / signed attestation).
*Why*: retrospective documentation is the documented failure mode of every
record regime — what is written after the outcome silently becomes a
justification of it.
*Anchors*: EU AI Act Art. 12 · outcome-switching audit literature · FDA PCCP.

## E2 — Named, authorized humans

The record SHALL identify, by stable reference, the natural person(s) who took
each human act, and their role or authority to take it at that time.
Identification MAY be a stable pseudonymous reference (role + key) whose
resolution to a legal name is governed by a named procedure (formal inquiry,
works-council co-determination): "named" means *resolvable and accountable*,
not *displayed*.
*Why*: "a human was in the loop" is unfalsifiable without an accountable
reference — and records chill honest judgment when every entry doubles as a
public name-tag.
*Anchors*: EU Art. 26(2), 14(5) · KR AI Basic Act (관리·감독 + 5-year evidence)
· US SR 26-2 override logs · BetrVG §87 co-determination practice.

## E3 — Human–AI authorship, per contribution

Each element of decision content SHALL carry an authorship designation from a
closed vocabulary distinguishing at minimum: human-authored; AI-generated
without human adoption; AI-proposed and human-adopted; AI-executed under a
referenced human-authored policy; unknown (imports only — provenance genuinely
unrecoverable, not merely unrecorded). Designations are captured from the
interaction event at act time, not self-reported afterwards; **adoption
requires an affirmative act** (accept, edit, sign) — silence or a default is
not adoption. Symbolic values (arrows) SHALL always render with their word
gloss (*adopted*, *delegated*). Tools SHALL NOT rank or discount content by
authorship value.
*Why*: explanation of "the AI system's role" is impossible if human and machine
words are indistinguishable — and records stay honest only if honesty carries
no penalty.
*Anchors*: EU Art. 86 · UK DUAA ss. 22A–D · ASRS non-punitive principle.

## E4 — Adoption, modification, override

Where a human adopted, modified, or rejected a machine proposal, the record
SHALL preserve the contrast: the proposal as presented, the content as decided,
and the authorship of each. An override is evidenced by this preserved
contrast, not by an unverifiable flag.
*Why*: the single most litigated fact across jurisdictions is whether the human
judged differently from the machine; a boolean `override: true` proves nothing.
*Anchors*: EU Art. 14(4)(d) · nH Predict litigation · the "override accuracy"
gap in supervisory practice.

## E5 — Commitment and settlement

Where the record asserts something about the future, the assertion SHALL be
fixed (sealed) at commitment time together with named settlement criteria, a
settlement date, and the person(s) authorized to settle; outcomes SHALL be
appended, never edited; and exits from scoring SHALL be named and counted —
**withdrawal** (the author retracts before settlement), **annulment** (a void
condition named at commitment time occurred), **ambiguity** (the named settler
cannot map reality onto the sealed criteria). Vague claims are a lint concern
at commitment time, not a settlement-time escape.
*Why*: a judgment record that can be revised after reality arrives records
nothing; a settlement door that closes silently invites survivorship
laundering.
*Anchors*: scientific preregistration (COMPare: positive-result rates fell
96%→44% under sealed protocols) · FDA PCCP · forecasting-platform resolution
discipline.

## E6 — Explanation snapshot

The record SHALL capture what the AI system actually presented to the human at
decision time — outputs, scores, warnings, and options shown — **verbatim or by
content hash; a paraphrase is not a snapshot**.
*Why*: explanations and override reviews turn on what the human could see;
systems change weekly, so "what it would show today" is not evidence.
*Anchors*: EU Art. 86, Art. 13 · SG AI Verify · model-risk effective-challenge
review.

## E7 — Retention and erasure metadata

The record SHALL state the retention duty it is held under (duration, legal
basis) and SHALL support erasure of personal identity that preserves the
record's existence — an anonymized tombstone rather than silent deletion.
*Why*: retention regimes range from six months to five years while erasure
rights apply throughout; a record that must choose between remembering and
complying will be deleted.
*Anchors*: EU Art. 26(6) · KR AI Basic Act (5-year evidence) · GDPR Art. 17
reconciled via tombstoning.

## What the floor deliberately excludes

The floor requires **no quality judgment of the human decision, no
person-level scores exposed to others, and no ranking of people** — and a
conforming regime SHOULD avoid record designs whose primary foreseeable use is
appraisal or discipline of the recording persons. **Aggregating records into
per-person performance metrics is non-conforming use**; a conforming tool does
not produce person-rankings from records. This exclusion is load-bearing:
fifty years of safety reporting show that records are honest only where they
are safe for their authors. A floor that grades people collects fiction.

## Conformance

A record format or tool meets this floor when every element E1–E7 is either
**captured** or **explicitly declared absent with a reason**. A declared
absence names its element and its reason in the record itself; a blanket
"not applicable" across elements does not conform. Silent absence never
conforms — a gap the reader cannot see is the one failure mode this floor
exists to prevent.

---

**Changelog** — v0.2 (2026-08-10): revised after a 12-persona comprehension
run and 3 adversarial reviews. E3 (most-flagged, 7/12) gained the
affirmative-act rule, act-time capture, the word-gloss rule, and the `u`
definition; E5 (second, 5/12) gained named exit definitions; E2 gained the
escrowed-identity path; E1 the log-strength statement; E6 the
verbatim-not-paraphrase rule; exclusions gained the anti-aggregation sentence;
conformance closed the blanket-absence loophole. v0.1 (2026-08-10): initial.

One implementation exists: **Antefact** (`SPEC.md` in this directory); others
are welcome — the floor wins when formats compete above it.
