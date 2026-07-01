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
import { listResources, listResourceTemplates, readResource } from './resources.js';
import { listPrompts, getPrompt } from './prompts.js';
import { SERVER_INSTRUCTIONS } from './lib/spine.js';
import { setElicitor } from './lib/elicit.js';
import { logError } from './lib/log.js';

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
    { name: 'argus-mcp', version: '1.0.0' },
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
      inputSchema: t.inputSchema,
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
    try {
      return await serialize(() => tool.handler((args || {}) as Record<string, unknown>));
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
