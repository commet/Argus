# Argus final-surface verification

Run:

```bash
npm run verify
```

One command, one verdict. It checks the shipped product surface:

- build and typecheck;
- all unit and real-stdio protocol tests;
- adversarial input fuzzing;
- picker behaviour, over ten host profiles (see below);
- the out-of-band ask, driven against the real server;
- diverse-content journeys, driven against the real server;
- the settle card's JavaScript, actually executed in a VM host;
- refusal to write when a ledger cannot be read safely;
- npm package contents;
- plugin validation, install smoke, bounded review simulations, and that every
  confirm surface the server can report has a sentence explaining it.

The npm package exposes six MCP tools and ships one runtime entrypoint. Historic
tool-name journey suites were removed because exercising aliases that no longer
exist gives a false picture of the released product. Three came back, PORTED to
the public six rather than resurrected, because they are the only thing that can
tell a working picker from a broken one:

| file | what it holds |
| --- | --- |
| `host-matrix.mjs` | ten host profiles × every ask that can reach a user. No dead end, no lost work, no form blocking, no dishonest surface, no crash. |
| `ambient-picker.mjs` | the out-of-band ask — the one surface that appears when the user did not ask for anything. |
| `battery.mjs` | real content in both languages, hostile inputs, and every picker exit. |

## The self-tests

`verify` does not stop at green. It re-plants each known regression, one at a
time, and fails unless the gate catches it — then puts the file back and checks
that every byte returned. A suite that cannot fail is not evidence, and the two
failures that reached the founder in July 2026 both shipped past a green suite.

If you add a fix that matters, add its self-test. The question to answer is not
"does this pass?" but **"what makes this go red?"**
