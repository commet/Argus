# Argus final-surface verification

Run:

```bash
npm run verify
```

The command verifies the shipped product surface:

- build and typecheck;
- all unit and real-stdio protocol tests;
- adversarial input fuzzing;
- picker behavior;
- refusal to write when a ledger cannot be read safely;
- npm package contents;
- plugin validation, install smoke, and bounded review simulations.

The npm package exposes six MCP tools and ships one runtime entrypoint. Historic
tool-name journey suites were removed because exercising aliases that no longer
exist gives a false picture of the released product.
