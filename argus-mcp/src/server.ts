import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { TOOLS, TOOL_MAP } from './tools/index.js';
import { toolJsonSchema } from './tools/tool-types.js';
import { listResources, listResourceTemplates, readResource } from './resources.js';
import { listPrompts, getPrompt } from './prompts.js';
import { SERVER_INSTRUCTIONS } from './lib/spine.js';
import { setElicitor } from './lib/elicit.js';
import { appendDueNote } from './lib/due-note.js';
import { logError } from './lib/log.js';
import { readFileSync } from 'node:fs';

// Single version source — package.json (the '1.0.0' literal had drifted from
// 1.3.0). Both src/server.ts (tests) and dist/server.js sit one level below it.
function readPackageVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0'; // never block startup on a packaging quirk
  }
}

/**
 * Argus MCP server (blueprint §4). v1 surface = Tools only — the universal
 * floor that works on every host. The spine bias is carried once by the
 * `instructions` field (the one spec-sanctioned home for the killed
 * paste-prompt), rendered from the single spine source. Resources and Prompts
 * are Phase 2; their capabilities are NOT declared until their handlers exist,
 * so a host never probes a no-op.
 */
export async function createServer(): Promise<Server> {
  const server = new Server(
    { name: 'argus-decision-mcp', version: readPackageVersion() },
    {
      // Capabilities are declared only for primitives whose handlers exist, so
      // a host never probes a no-op (addendum J). `elicitation` is a client
      // capability we USE, not a server one we serve — advertised so the SDK
      // permits elicitInput; tools degrade to text when the host lacks it.
      capabilities: { tools: {}, resources: {}, prompts: {} },
      instructions: SERVER_INSTRUCTIONS,
    },
  );

  // Elicitation — structured user choices for spine-SAFE inputs (settlement
  // outcome etc.), text-fallback when the host lacks support. Wired to the SDK's
  // elicitInput; capability is advertised so a supporting host offers a picker.
  // The SDK's Server exposes elicitInput; type just that method rather than
  // casting the whole server to `any`. If the running SDK/host lacks it, the
  // call throws and lib/elicit.ts catches it → text fallback.
  type ElicitCapableServer = {
    elicitInput(params: { message: string; requestedSchema: Record<string, unknown> }): Promise<{
      action: 'accept' | 'decline' | 'cancel';
      content?: Record<string, unknown>;
    }>;
  };
  setElicitor((message, requestedSchema) =>
    (server as unknown as ElicitCapableServer).elicitInput({ message, requestedSchema }),
  );

  // Resources — read-only context (blueprint §4.3).
  server.setRequestHandler(ListResourcesRequestSchema, async () => listResources());
  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => listResourceTemplates());
  server.setRequestHandler(ReadResourceRequestSchema, async (req) => readResource(req.params.uri));

  // Prompts — user-triggered discipline rituals (blueprint §4.2).
  server.setRequestHandler(ListPromptsRequestSchema, async () => listPrompts());
  server.setRequestHandler(GetPromptRequestSchema, async (req) => getPrompt(req.params.name, req.params.arguments));

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      // JSON Schema generated from the Zod source of truth (no hand-kept copy).
      inputSchema: toolJsonSchema(t.inputSchema),
      ...(t.outputSchema ? { outputSchema: t.outputSchema } : {}),
      ...(t.annotations ? { annotations: t.annotations } : {}),
    })),
  }));

  // Serialize tool calls so concurrent invocations can't interleave a
  // read-replay-then-append against the same ledger (real hosts already wait
  // for each response; this removes the foot-gun for batched/parallel clients).
  let chain: Promise<unknown> = Promise.resolve();
  const serialize = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = chain.then(fn, fn);
    chain = run.then(() => undefined, () => undefined);
    return run;
  };

  // The low-level SDK handler's expected return is a broad ServerResult union
  // (incl. a task-augmented variant) our envelope type isn't nominally part of —
  // `any` is the sanctioned boundary here; every return below is a real
  // McpToolResult, built by the typed helpers.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  server.setRequestHandler(CallToolRequestSchema, async (request): Promise<any> => {
    const { name, arguments: args } = request.params;
    const tool = TOOL_MAP.get(name);
    if (!tool) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, error_code: 'UNKNOWN_TOOL', message: `Unknown tool: ${name}` }) }],
        isError: true,
      };
    }
    // Runtime input validation from the Zod source (mcp-builder best-practices).
    // A schema failure is a client bug → a clean, actionable tool-result error
    // (not a protocol crash); the handler only ever sees validated, default-
    // applied args.
    const parsed = tool.inputSchema.safeParse(args ?? {});
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, tool: name, error_code: 'INVALID_INPUT', message: `Invalid arguments — ${issues}` }) }],
        isError: true,
      };
    }
    try {
      const result = await serialize(() => tool.handler(parsed.data as Record<string, unknown>));
      return appendDueNote(name, parsed.data as Record<string, unknown>, result);
    } catch (e) {
      // Last-resort guard — individual handlers already map their own errors.
      logError(`[${name}] escaped handler`, e);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, error_code: 'INTERNAL_ERROR', message: String(e) }) }],
        isError: true,
      };
    }
  });

  return server;
}
