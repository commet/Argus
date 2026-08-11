/**
 * Deterministic persona sampling over the MatrAIx schema axes — the pure half
 * of persona-overfire.mjs, split out so the guard test can import it without
 * dragging in `dist/` (the harness imports SERVER_INSTRUCTIONS from the build,
 * which need not exist when unit tests run).
 *
 * PROVENANCE AND LICENSE. The axis ids and their value vocabularies are
 * transcribed from the MatrAIx canonical persona schema (1,290 categorical
 * dimensions; `persona_codes.schema.json`, format_version 2), whose code and
 * schema are MIT-licensed (github.com/MatrAIx-ai/MatrAIx-Persona-8B).
 * We deliberately do NOT ship or embed rows from the 1M persona coreset: as of
 * 2026-08-11 that dataset carries NO license declaration (its Hugging Face
 * cardData has no `license` field), so its redistribution terms are unknown.
 * Sampling our own persona vectors over their published schema keeps the
 * experiment reproducible, keeps us clear of unlicensed data, and stays
 * interoperable — if the coreset is ever licensed, its rows drop straight into
 * these same axes. Citation: MatrAIx, arXiv:2608.04205.
 */

/**
 * Persona axes, transcribed verbatim from the MatrAIx schema. Every axis is one
 * that plausibly changes HOW a person closes a decision in a work chat — the
 * schema has 1,290 dimensions and most (cuisine preference, music taste) cannot
 * move this outcome, so including them would buy noise, not coverage.
 * `category` is the schema's own grouping, kept so the mapping stays checkable.
 */
export const AXES = [
  { id: 'cog_directness', label: 'Directness', category: 'Linguistic: Communication',
    values: ['Blunt', 'Direct', 'Balanced', 'Indirect', 'Evasive'] },
  { id: 'cog_verbosity', label: 'Verbosity', category: 'Linguistic: Communication',
    values: ['Terse', 'Concise', 'Balanced', 'Wordy', 'Rambling'] },
  { id: 'cog_formality', label: 'Formality', category: 'Linguistic: Communication',
    values: ['Very formal', 'Formal', 'Neutral', 'Casual', 'Slangy'] },
  { id: 'cog_patience', label: 'Patience', category: 'Linguistic: Communication',
    values: ['Very high', 'High', 'Moderate', 'Low', 'None'] },
  { id: 'cog_conflict_approach', label: 'Conflict approach', category: 'Linguistic: Communication',
    values: ['Confronting', 'Collaborative', 'Compromising', 'Avoidant', 'Accommodating'] },
  { id: 'decision_style', label: 'Decision style', category: 'Risk & Decision',
    values: ['Analytical', 'Intuitive', 'Consensus-driven', 'Directive', 'Deliberative'] },
];

/** The scorer carries both an English (R2) and a Korean (R3) rule, so the
 *  population has to contain both or half the scorer is never exercised. */
export const LANGUAGES = ['Korean', 'English'];

export const SEED = 20260811;
export const N_PERSONAS = 10;

/**
 * Deterministic sampling. A fixed LCG, no Date/Math.random: the same command
 * on any machine on any day produces the same personas, or the run is not a
 * measurement anyone can repeat.
 *
 * Latin-hypercube rather than random draw: each axis gets a column of N entries
 * (every level repeated to length N) shuffled INDEPENDENTLY of the other axes.
 * Two properties matter and both are asserted by the guard test:
 *
 *   - every level of every axis appears (a random draw at N=10 would leave
 *     whole levels — plausibly the interesting ones, like Evasive — unsampled);
 *   - axes are not confounded with each other. The first version of this
 *     function cycled one shared permutation with `i % 5`, which made personas
 *     1..5 and 6..10 identical twins and pinned "Evasive" to "Very formal" in
 *     every row. Coverage looked perfect and the axis breakdown was worthless:
 *     with the axes moving in lockstep, no observed failure can be attributed
 *     to any one of them.
 */
function lcg(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}
function permute(arr, rand) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
/** Repeat `values` up to length n, then shuffle — one independent column. */
function column(values, n, rand) {
  const filled = Array.from({ length: n }, (_, i) => values[i % values.length]);
  return permute(filled, rand);
}

export function samplePersonas(n = N_PERSONAS, seed = SEED) {
  const rand = lcg(seed);
  const columns = AXES.map((axis) => column(axis.values, n, rand));
  const langs = column(LANGUAGES, n, rand);
  return Array.from({ length: n }, (_, i) => ({
    id: `P${String(i + 1).padStart(2, '0')}`,
    language: langs[i],
    traits: Object.fromEntries(AXES.map((axis, a) => [axis.id, columns[a][i]])),
  }));
}

export function describePersona(p) {
  const traits = AXES.map((a) => `${a.label}: ${p.traits[a.id]}`).join(' · ');
  return `${p.id} [${p.language}] ${traits}`;
}
