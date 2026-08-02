/**
 * The reader that re-reads our own writing must be total.
 *
 * Between turns, the engine reads the last snapshot's premises back out so the
 * next turn revises the record instead of starting from nothing. It does that by
 * enumerating fields by hand — which means a field added to PremiseRecord is
 * DROPPED BY DEFAULT, and dropped silently: the turn runs, the model answers,
 * the record just quietly forgets.
 *
 * That is not hypothetical. `decisive` was lost this way. It is the one field on
 * the record a model is forbidden to write — the user's own answer to "이게
 * 틀렸다면 다른 선택을 하셨을까요?" — and if they answered it, backed out of the
 * seal, and took one more turn, the next snapshot no longer had it. Nothing
 * failed. Nothing was logged. They would simply be asked again, and the
 * product's claim that their judgment is load-bearing would be false in the one
 * place it is checkable.
 *
 * `field-liveness-contract` asks whether anyone reads a field at all. This asks
 * a narrower question it cannot: does the specific reader that reconstructs this
 * record carry every field the record has?
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const typesSrc = readFileSync(join(ROOT, 'src/stores/types.ts'), 'utf8');
const engineSrc = readFileSync(join(ROOT, 'src/lib/progressive-engine.ts'), 'utf8');

/**
 * Fields carried somewhere other than this reader, with the reason. Empty on
 * purpose: every field of a premise record belongs to the next turn. A waiver
 * here is a claim that some other code path re-supplies it, and that claim
 * should be written down and read by the next person.
 */
const CARRIED_ELSEWHERE: Record<string, string> = {};

function fieldsOfPremiseRecord(): string[] {
  const at = typesSrc.indexOf('export interface PremiseRecord {');
  expect(at, 'PremiseRecord not found in stores/types.ts').toBeGreaterThan(-1);
  const body = typesSrc.slice(at);
  return [...body.slice(0, body.indexOf('\n}')).matchAll(/^ {2}(\w+)\??:/gm)].map((m) => m[1]);
}

const BODY_OPENER = '): AdmittedPremise[] {';

/**
 * The function BODY, brace-matched from its own opening brace.
 *
 * Two earlier attempts each read the wrong region, and both looked fine. The
 * first took everything up to `\n}` and stopped at the closing brace of the
 * INLINE PARAMETER TYPE, ~150 characters in. The second brace-matched from the
 * `function` keyword — and that parameter type IS a brace pair that opens and
 * closes at depth zero, so it stopped in exactly the same place.
 *
 * Both fragments happen to contain `{ text: string }`, so `text` was reported
 * as carried while every other field was reported dropped: a confident, wrong,
 * specific answer. That is the gate-that-measures-nothing shape, and the reason
 * the sanity assertion below checks for a string only the real body contains
 * rather than a character count.
 */
function bodyOfRecordsFromSnapshot(): string {
  const at = engineSrc.indexOf('function recordsFromSnapshot(');
  expect(at, 'recordsFromSnapshot not found — was it renamed?').toBeGreaterThan(-1);
  const from = engineSrc.slice(at);
  const opener = from.indexOf(BODY_OPENER);
  expect(
    opener,
    `the signature of recordsFromSnapshot changed — update BODY_OPENER, or this `
    + `guard silently starts measuring the parameter type instead of the body`,
  ).toBeGreaterThan(-1);

  const start = opener + BODY_OPENER.length - 1;
  let depth = 0;
  for (let i = start; i < from.length; i += 1) {
    if (from[i] === '{') depth += 1;
    else if (from[i] === '}') {
      depth -= 1;
      if (depth === 0) return from.slice(start, i + 1);
    }
  }
  throw new Error('recordsFromSnapshot never closes — the brace walk is broken');
}

describe('the snapshot reader carries the whole record', () => {
  it('reads a sane pair of files (a broken read would pass everything)', () => {
    expect(fieldsOfPremiseRecord().length).toBeGreaterThanOrEqual(6);
    // Comfortably past the inline parameter type, so a walk that stops early
    // fails here rather than silently searching a fragment.
    expect(bodyOfRecordsFromSnapshot()).toContain('hidden_assumptions || []');
  });

  it('every PremiseRecord field survives the round trip', () => {
    const body = bodyOfRecordsFromSnapshot();
    const dropped = fieldsOfPremiseRecord()
      .filter((f) => !CARRIED_ELSEWHERE[f])
      .filter((f) => !new RegExp(`\\b${f}\\b`).test(body));

    expect(
      dropped,
      'recordsFromSnapshot enumerates fields by hand, so anything missing from it '
      + 'is erased between turns with nothing turning red. Carry it, or add it to '
      + `CARRIED_ELSEWHERE with the path that re-supplies it: ${dropped.join(', ')}`,
    ).toEqual([]);
  });

  it('would notice a field that is not carried (the guard guards)', () => {
    // Mutation check in-line: a name PremiseRecord does not have must not be
    // findable in the reader, or the regex above is matching noise.
    expect(/\bzz_never_carried\b/.test(bodyOfRecordsFromSnapshot())).toBe(false);
  });

  it('every waiver still names a field that exists', () => {
    const fields = new Set(fieldsOfPremiseRecord());
    const stale = Object.keys(CARRIED_ELSEWHERE).filter((f) => !fields.has(f));
    expect(stale, `waivers for fields PremiseRecord no longer has: ${stale.join(', ')}`).toEqual([]);
  });

  it('keeps the model-forbidden field out of the model’s reach on the way back', () => {
    // The round trip must not become a laundering route: a field the contract
    // strips from model output would be worthless if the engine re-read it from
    // a snapshot the model had influenced. `decisive` is only ever written by
    // setPremiseDecisive, so the store is the only writer.
    const storeSrc = readFileSync(join(ROOT, 'src/stores/useProgressiveStore.ts'), 'utf8');
    expect(storeSrc).toContain('decisive: answers[record.text]');
    const contractSrc = readFileSync(join(ROOT, 'src/lib/judgment-state-contract.ts'), 'utf8');
    expect(contractSrc).toContain("MODEL_MAY_NOT_SET = ['decisive', 'revised_from']");
  });
});
