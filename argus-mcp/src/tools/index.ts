import type { ToolModule } from './tool-types.js';
import { decide, history, settings, publicSeal, publicCheckIn, publicSettle, publicCopy } from './public-tools.js';
import { toolJsonSchema } from './tool-types.js';
import { bilingualToolPresentation } from '../lib/tool-presentation.js';

/**
 * The complete callable surface. Internal modules are implementation details:
 * cached names from older releases intentionally return UNKNOWN_TOOL.
 */
export const TOOLS: ToolModule[] = [
  decide,
  publicSeal,
  publicCheckIn,
  publicSettle,
  history,
  settings,
];

/** Compatibility alias for source consumers; it is identical to TOOLS. */
export const PUBLIC_TOOLS = TOOLS;

export const TOOL_MAP: Map<string, ToolModule> = new Map(TOOLS.map((t) => [t.name, t]));

/** MCP 2025-11-25 tool icons. Clients that implement the optional icon field
 * show the same closing-loop anchor used by the web app; older clients simply
 * ignore the field. The image is deliberately attached only to resolve — the
 * mark means a return to reality was completed, not generic Argus decoration. */
const PUBLIC_TOOL_ICONS: Record<string, Array<{ src: string; mimeType: string; sizes: string[] }>> = {
  argus_resolve: [
    { src: 'https://argus.voyage/images/voyage/closing-anchor-icon-48.png', mimeType: 'image/png', sizes: ['48x48'] },
    { src: 'https://argus.voyage/images/voyage/closing-anchor-icon-96.png', mimeType: 'image/png', sizes: ['96x96'] },
  ],
};

/**
 * The exact tool descriptors returned by tools/list — single source shared by
 * the server and the host-surface guard test. inputSchema runs through
 * publicCopy so that a legacy tool name embedded in a Zod field description
 * (e.g. seal's "no prior argus_open_decision is needed") is rewritten to the
 * public name before it reaches a host. Without this, the tool-call RESULTS are
 * translated but the tool SCHEMAS still leaked the old vocabulary.
 */
function withoutSchemaDescriptions(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutSchemaDescriptions);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key !== 'description')
      .map(([key, child]) => [key, withoutSchemaDescriptions(child)]),
  );
}

export function servedPublicTools(): Record<string, unknown>[] {
  return TOOLS.map((t) => {
    const presentation = bilingualToolPresentation(t.name, t.annotations?.title, t.description);
    return {
      name: t.name,
      title: presentation.title,
      description: publicCopy(presentation.description),
      // Field names, types and enums carry the contract. Repeating prose on
      // every property taxes every model turn and previously leaked old names.
      inputSchema: withoutSchemaDescriptions(publicCopy(toolJsonSchema(t.inputSchema))),
      ...(t.outputSchema ? { outputSchema: t.outputSchema } : {}),
      ...(t.annotations ? { annotations: t.annotations } : {}),
      ...(PUBLIC_TOOL_ICONS[t.name] ? { icons: PUBLIC_TOOL_ICONS[t.name] } : {}),
    };
  });
}
