/**
 * MCP Apps (SEP-1865, extension io.modelcontextprotocol/ui) — the settle picker
 * as a REAL interactive card rendered inside the host chat (2026-01-26 spec).
 *
 * Why: elicitation forms are drawn by the host — we send a questionnaire and
 * cannot touch how it looks or how many keystrokes it takes (the founder's
 * 2026-07-27 dogfooding pain). MCP Apps flips that: the server ships a
 * self-contained HTML view (`ui://` resource), the host renders it sandboxed,
 * and the view talks JSON-RPC over postMessage — including `tools/call` back
 * into THIS server. One click on "예측대로" IS the settle.
 *
 * Safety rails:
 *  - Capability-gated end to end: the tool advertises `_meta.ui` and settle
 *    takes the awaiting-picker path ONLY when the client declared the
 *    extension at initialize. Every other host keeps today's elicitation /
 *    text flow byte-identical.
 *  - The HTML is fully self-contained (inline CSS/JS, no external origins),
 *    so the spec's restrictive default CSP applies untouched.
 *  - Spine: the card offers the SAME five reality outcomes and a free-text
 *    "what happened" in the user's words. No verdict, no score, decline path
 *    (지금은 넘어가기) always visible. A click is user action — authorship is
 *    honest by construction.
 */

import { SETTLE_APP_HTML } from './apps-ui-html.js';

export const UI_EXTENSION_ID = 'io.modelcontextprotocol/ui';
export const UI_MIME = 'text/html;profile=mcp-app';
export const SETTLE_APP_URI = 'ui://argus/settle-picker';

let _appsCapable: () => boolean = () => false;

/** server.ts wires this at initialize (same pattern as setElicitor). */
export function setAppsCapability(fn: () => boolean): void {
  _appsCapable = fn;
}

export function appsCapable(): boolean {
  try { return _appsCapable(); } catch { return false; }
}

/** 테스트 리셋. */
export function resetAppsCapability(): void {
  _appsCapable = () => false;
}

/** resources/list entry for the settle app. Listed unconditionally (a resource
 *  listing is inert data); rendering only ever happens on hosts that declared
 *  the extension and follow a tool's _meta.ui link. */
export function appsResourceListEntry(): { uri: string; name: string; description: string; mimeType: string } {
  return {
    uri: SETTLE_APP_URI,
    name: 'Argus settle picker',
    description: 'One-tap settlement card: what reality did to a saved prediction, in the user\'s words.',
    mimeType: UI_MIME,
  };
}

/** resources/read payload for the settle app, or null when uri is not ours. */
export function readAppsResource(uri: string): { contents: Array<{ uri: string; mimeType: string; text: string }> } | null {
  if (uri !== SETTLE_APP_URI) return null;
  return { contents: [{ uri: SETTLE_APP_URI, mimeType: UI_MIME, text: SETTLE_APP_HTML }] };
}

/** Attach `_meta.ui` to the tools that have a card, ONLY when the client
 *  declared the extension. Non-apps hosts see the exact tool list they always
 *  saw (some proxies choke on unknown _meta — don't tax them). */
export function withUiMeta<T extends { name?: unknown }>(tools: T[]): T[] {
  if (!appsCapable()) return tools;
  return tools.map((t) =>
    t.name === 'argus_resolve'
      ? { ...t, _meta: { ui: { resourceUri: SETTLE_APP_URI } } }
      : t,
  );
}
