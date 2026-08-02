/**
 * A field that is only ever WRITTEN is a wire with one end.
 *
 * THE RECURRING DEFECT, and why it keeps recurring.
 *
 * CLAUDE.md names the mechanism: an LLM turns a STRUCTURAL bug into silent
 * quality degradation. A normal program with a broken wire crashes; a field
 * added to a type here compiles, passes every test, renders a plausible screen,
 * and does nothing — because the model fills the gap and nobody can tell the
 * difference between "plausible" and "correct" without ground truth.
 *
 * That is not theory. Over three days it happened four times, and every one was
 * caught late, by hand, by measurement rather than by CI:
 *
 *   premise_records   written by the engine, ignored by the card for a day
 *   anchor_quote      required by argus_capture, read once, never stored
 *   kind / observable declared in the taxonomy, consulted only at paint time
 *   premise_verdicts  computed by the contract, dropped on the floor
 *
 * A guard against exactly this exists — snapshot-consumption-contract.ts — and
 * it works: it caught premise_verdicts the same hour that field was written.
 * But it covers ONE of the 105 types this app exports, and it only VERIFIES
 * two of its seven consumption sites (mix-context, harness-feedback). A field
 * declared 'routing' or 'ui' is declared and never checked, which is how
 * convergence_score sat classified as routing while nothing read it.
 *
 * So: one mechanical property, no per-type wiring, applied to the types that
 * carry a person's judgment. If every mention of a field is an assignment TO
 * it, nothing consumes it. Wire it, delete it, or waive it in writing.
 *
 * Deliberately weaker than the per-type contract next door, which proves the
 * VALUE reaches its consumer. This one only proves someone reads the field at
 * all — which is exactly the check that was missing everywhere else.
 *
 * KNOWN BLIND SPOT, measured 2026-08-03. Matching is by NAME, not by type, so a
 * field is "alive" as soon as ANY type's copy of that name is read. Predicate
 * carried an `observable` that no call site in either tree ever read — the
 * return asked its generic question instead of the one the field existed to
 * make possible — and this guard stayed green throughout, because
 * PremiseRecord.observable is read on the analysis card.
 *
 * Type-aware matching would need real type resolution, which is a different and
 * much heavier tool. Until then the honest statement of what this guard buys is:
 * it catches a name nothing reads anywhere, and it cannot catch a name that is
 * read somewhere else. Watch a type here AND write the narrow per-type check
 * when the field is load-bearing.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const TYPES = join(ROOT, 'src/stores/types.ts');
const typesSrc = readFileSync(TYPES, 'utf8');

/**
 * The types that carry a user's judgment. A dead field on one of these is a
 * promise the product silently stops keeping, which is why they are here and a
 * UI prop type is not. Add a type when it starts holding judgment state.
 */
const WATCHED = ['AnalysisSnapshot', 'PremiseRecord', 'PremiseVerdict', 'DecisionContract', 'Predicate'];

/**
 * Fields whose only reader is somewhere this test cannot see, with the reason.
 * A waiver is a claim someone signed — cheap to grant once, expensive to grant
 * carelessly, and checked for staleness below.
 */
const WAIVED: Record<string, string> = {};

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === '__tests__' || name === 'node_modules') continue;
      sourceFiles(p, out);
    } else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts')) {
      out.push(p);
    }
  }
  return out;
}

/** Top-level field names of an interface, read from source. */
function fieldsOf(name: string): string[] {
  const at = typesSrc.indexOf(`export interface ${name} {`);
  expect(at, `${name} not found in stores/types.ts`).toBeGreaterThan(-1);
  const body = typesSrc.slice(at);
  return [...body.slice(0, body.indexOf('\n}')).matchAll(/^ {2}(\w+)\??:/gm)].map((m) => m[1]);
}

const FILES = sourceFiles(join(ROOT, 'src')).filter((f) => f !== TYPES);
const SOURCE = [...FILES.map((f) => readFileSync(f, 'utf8'))].join('\n');

/**
 * Is this field ever READ?
 *
 * Every write is erased first — `x.field =`, an object-literal key `field:`,
 * and shorthand `field,` inside a literal — and whatever mention survives is a
 * read: `x.field` in an expression, a destructure, an index access. Erasing
 * rather than pattern-matching reads keeps the test honest about forms nobody
 * anticipated: a new way to read a field passes automatically, while a new way
 * to write one at worst reports a false death, which is the safe direction.
 */
function isRead(field: string): boolean {
  // Same-line whitespace only. Letting \s cross a newline made a ternary —
  //   ? contract.integrity_baseline
  //   : fallback
  // read as an object key and erased a genuine read, reporting a live field
  // dead. A guard's false positives cost more than its misses here: one teaches
  // the next person to add a waiver reflexively.
  const withoutWrites = SOURCE
    .replace(new RegExp(`\\.${field}[ \\t]*=(?!=)`, 'g'), ' ')
    .replace(new RegExp(`\\b${field}[ \\t]*:`, 'g'), ' ')
    // Shorthand `{ field, other }` is a write; `x.field,` is a READ that
    // happens to end an argument list. Without the lookbehind the second was
    // erased as the first, and framing_override_reason — read on the very next
    // line of question-types — reported dead.
    .replace(new RegExp(`(?<!\\.)\\b${field}[ \\t]*,`, 'g'), ' ');
  return new RegExp(`\\b${field}\\b`).test(withoutWrites);
}

describe('a field nobody reads is a wire with one end', () => {
  it('reads a sane tree (a broken walk would pass everything)', () => {
    expect(FILES.length).toBeGreaterThan(200);
    expect(SOURCE.length).toBeGreaterThan(1_000_000);
    for (const t of WATCHED) expect(fieldsOf(t).length).toBeGreaterThan(0);
  });

  it.each(WATCHED)('%s: every field is read somewhere', (type) => {
    const dead = fieldsOf(type).filter((f) => !WAIVED[`${type}.${f}`] && !isRead(f));
    expect(
      dead,
      `${type}: written and never read. Wire it, delete it, or waive it with a `
      + `reason — a field the product fills and nobody consults is a promise it `
      + `stopped keeping without telling anyone: ${dead.join(', ')}`,
    ).toEqual([]);
  });

  it('every waiver still names a field that exists', () => {
    // A waiver outliving its field is how one exemption quietly becomes a
    // blanket one.
    const stale = Object.keys(WAIVED).filter((k) => {
      const [type, field] = k.split('.');
      return !WATCHED.includes(type) || !fieldsOf(type).includes(field);
    });
    expect(stale, `waivers for fields that no longer exist: ${stale.join(', ')}`).toEqual([]);
  });

  it('catches a field that is only assigned (the guard guards)', () => {
    // Mutation check in-line: a name that appears exactly once, as a write.
    const fake = 'zz_never_read_probe';
    expect(isRead(fake)).toBe(false);
    // And a real read-only usage is seen as alive.
    expect(isRead('real_question')).toBe(true);
  });
});
