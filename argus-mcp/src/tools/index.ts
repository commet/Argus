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
// Keep only descriptions that prevent a wrong call or explain a conditional
// contract. This stays far smaller than restoring all 100+ descriptions, while
// avoiding the false economy where a tiny schema causes failed calls and extra
// model round-trips.
const ESSENTIAL_FIELD_DESCRIPTIONS = new Set([
  'action', 'id', 'view', 'premises', 'text', 'source', 'ai_original',
  'amendment', 'outcome', 'what_happened', 'outcome_source',
  'predicate', 'check_by', 'predicate_owner', 'confirm_draft',
]);

function compactSchemaDescriptions(value: unknown, field?: string): unknown {
  if (Array.isArray(value)) return value.map((child) => compactSchemaDescriptions(child, field));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key !== 'description' || (field !== undefined && ESSENTIAL_FIELD_DESCRIPTIONS.has(field)))
      .map(([key, child]) => [
        key,
        compactSchemaDescriptions(child, key === 'properties' ? undefined : key === 'items' ? field : key),
      ]),
  );
}

function clarifyPublicSchemaDescriptions(toolName: string, value: unknown): unknown {
  if (toolName !== 'argus_capture' || !value || typeof value !== 'object') return value;
  const schema = value as {
    properties?: Record<string, {
      description?: string;
      items?: { properties?: Record<string, { description?: string }> };
    }>;
  };
  const props = schema.properties;
  if (!props) return value;
  if (props['source']) {
    props['source'].description =
      'action=update_fact에서만 사용: 현재 사실을 확인한 출처(url | user_stated | host_reported). For update_fact only.';
  }
  const premiseProps = props['premises']?.items?.properties;
  if (premiseProps?.['source']) {
    premiseProps['source'].description =
      '전제 문장의 작성자: user_stated=사용자 원문, ai_surfaced=AI 초안(이때 ai_original 필수). Premise authorship.';
  }
  if (premiseProps?.['ai_original']) {
    premiseProps['ai_original'].description =
      'source=ai_surfaced이면 필수: AI가 처음 제시한 정확한 원문. Required with ai_surfaced.';
  }
  return value;
}

export function servedPublicTools(): Record<string, unknown>[] {
  return TOOLS.map((t) => {
    const presentation = bilingualToolPresentation(t.name, t.annotations?.title, t.description);
    const schema = compactSchemaDescriptions(publicCopy(toolJsonSchema(t.inputSchema)));
    return {
      name: t.name,
      title: presentation.title,
      description: publicCopy(presentation.description),
      // Preserve only ambiguity-breaking descriptions. Modern hosts defer full
      // schemas until a tool is relevant; failed calls cost more than these few
      // short hints.
      inputSchema: clarifyPublicSchemaDescriptions(t.name, schema),
      ...(t.outputSchema ? { outputSchema: t.outputSchema } : {}),
      ...(t.annotations ? { annotations: t.annotations } : {}),
      ...(PUBLIC_TOOL_ICONS[t.name] ? { icons: PUBLIC_TOOL_ICONS[t.name] } : {}),
    };
  });
}
