# Argus plugin data

Runtime contracts live here:

- `classification.yaml` defines the bounded review vocabulary and depth.
- `boss-types.yaml` contains optional stakeholder tone presets.
- `schemas/` contains persisted session artifact contracts.
- `prompts/` contains reusable probe prompts.

Reviewer roles are defined once in `../agents/`. The plugin intentionally does
not mirror the web app’s historical persona roster. Standard judgment uses no
reviewer; explicit deep review uses at most two specialists and, only for a
critical or irreversible judgment, one risk pass.

Before release:

```bash
node ./argus-plugin-v2/scripts/validate-plugin.js
node ./argus-plugin-v2/scripts/install-smoke.mjs
```
