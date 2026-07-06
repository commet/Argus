# Licensing — plain-language guide

Argus is **source-available**, not fully open source. This page explains, in
plain language, what you may and may not do. If anything here conflicts with the
actual license files, **the license files win** — this page is a guide, not the
contract.

> TL;DR — The **plugins and the MCP server are open source (MIT)**: use them
> however you like, including commercially. The **web app** is **read-and-learn,
> non-commercial**: you can look at it and run it for yourself, but you can't
> build a business on it without a separate license.

## What license covers what

| Part of the repo | License | Can you use it commercially? |
|---|---|---|
| `argus-plugin/` | **MIT** | ✅ Yes |
| `argus-plugin-v2/` | **MIT** | ✅ Yes |
| `argus-mcp/` (published as `argus-decision-mcp` on npm) | **MIT** | ✅ Yes |
| **Everything else** — the web app (`src/`, server routes, DB schema, `public/`, `assets/`, `tools/`, `scripts/`, `docs/`, config) | **PolyForm Noncommercial 1.0.0** | ❌ No — needs a separate commercial license |

The MIT parts each carry their own `LICENSE` file inside their directory. The
non-commercial part is governed by the root [`LICENSE`](./LICENSE).

## The web app: what "noncommercial" means

**You MAY**, for free, without asking:

- Read and study the source code.
- Clone it and run it locally for personal use, learning, or evaluation.
- Modify it for those same non-commercial purposes.
- Use it for research, teaching, or inside a non-profit / school / government body.
- Share your changes, as long as they stay non-commercial and carry this license.

**You MAY NOT**, without a separate written license from the copyright holder:

- Host it as a paid or ad-supported service.
- Fold it (whole or in part, as-is or modified) into a commercial product.
- Use it in the course of running a for-profit business.
- Re-sell it or sub-license it.
- Launch a competing product built on this code.

If you're not sure whether your use is commercial, assume it is and ask.

## Two honest limits worth knowing

1. **A license protects the *code*, not the *idea*.** Copyright covers the exact
   source in this repo. It does **not** stop someone from re-implementing a
   similar product from scratch — ideas and features aren't copyrightable, only
   their specific expression is. No license can prevent that.

2. **A license is a legal boundary, not a physical lock.** Because the web app
   source is visible, someone *could* copy it in violation of the license. The
   license doesn't make that impossible; it makes it **unlawful**, giving the
   copyright holder standing to act. In practice this deters the realistic
   threat — legitimate companies won't touch non-commercial-licensed code.

## Trademarks

The Argus **name**, **logo**, and **argus.voyage** are trademarks. Neither the
MIT license nor the PolyForm license gives you any right to use them. Concretely:

- ✅ You may say your project "works with Argus" or "is based on Argus (MIT parts)".
- ❌ You may **not** name your fork or product "Argus", use the logo, or present
  your service in a way that suggests it is the official Argus.

## Contributors

By opening a pull request you agree that your contribution is licensed under the
same license that governs the files you changed (MIT for the plugin/MCP
directories, PolyForm Noncommercial for the web app). If a formal Contributor
License Agreement is added later, larger contributions may be asked to sign it.

## Getting a commercial license

Want to use the web app commercially? That's usually fine — it just needs an
agreement. Open an issue at <https://github.com/commet/Argus> or reach the
maintainer via <https://argus.voyage>.

## Why it's set up this way

The plugins and MCP server are the parts meant to spread — the more people use
them, the better for the project — so they're fully open (MIT). The web app is
the product, so its source stays visible for trust and learning while remaining
protected from commercial cloning. See [`SECURITY.md`](./SECURITY.md) for the
security posture.
