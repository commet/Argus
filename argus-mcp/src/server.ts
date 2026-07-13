import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { PUBLIC_TOOLS, TOOL_MAP, servedPublicTools } from './tools/index.js';
import { listResources, listResourceTemplates, readResource } from './resources.js';
import { SERVER_INSTRUCTIONS } from './lib/spine.js';
import { setElicitor } from './lib/elicit.js';
import { appendDueNote } from './lib/due-note.js';
import { logError } from './lib/log.js';
import { packageMeta } from './lib/package-meta.js';
import { localizeToolResult } from './lib/localize-result.js';
import { recordServerStart, recordToolCall } from './lib/telemetry.js';

/**
 * Argus MCP server (blueprint §4). v1 surface = Tools only — the universal
 * floor that works on every host. The spine bias is carried once by the
 * `instructions` field (the one spec-sanctioned home for the killed
 * paste-prompt), rendered from the single spine source. Resources provide one
 * passive attention view. Separate MCP prompts were removed: they duplicated
 * the tool surface and made users learn a second invocation system.
 */
export async function createServer(): Promise<Server> {
  const meta = packageMeta();
  const server = new Server(
    { name: meta.name, version: meta.version },
    {
      // Capabilities are declared only for primitives whose handlers exist, so
      // a host never probes a no-op (addendum J). `elicitation` is a client
      // capability we USE, not a server one we serve — advertised so the SDK
      // permits elicitInput; tools degrade to text when the host lacks it.
      capabilities: { tools: {}, resources: {} },
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
    getClientCapabilities(): { elicitation?: unknown } | undefined;
  };
  const ec = server as unknown as ElicitCapableServer;
  // The capability probe reads the client's DECLARED elicitation support (set at
  // initialize). Gating canElicit() on it means a host that never declared the
  // capability takes the text path instead of calling elicitInput (which the SDK
  // throws on) and silently dropping a confirm_draft seal.
  setElicitor(
    (message, requestedSchema) => ec.elicitInput({ message, requestedSchema }),
    () => Boolean(ec.getClientCapabilities?.()?.elicitation),
  );

  // Resources — read-only context (blueprint §4.3).
  server.setRequestHandler(ListResourcesRequestSchema, async () => listResources());
  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => listResourceTemplates());
  server.setRequestHandler(ReadResourceRequestSchema, async (req) => readResource(req.params.uri));

  // Anonymous, opt-in activation signal (no-op unless ARGUS_TELEMETRY=1). Fire-
  // and-forget: never blocks server startup, never throws. See lib/telemetry.ts.
  recordServerStart();

  // Single source (tools/index.ts): builds the descriptors AND runs schemas
  // through publicCopy so a legacy tool name in a field description can't leak.
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: servedPublicTools() }));

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
    // The v6 semantic recorder is a P4 pilot. Keeping it out of discovery is
    // not enough: a cached or hand-written client must not be able to invoke it
    // until the operator explicitly opts in.
    const pilotDisabled = name === 'argus_record' && process.env['ARGUS_DKK_V6_PILOT'] !== '1';
    if (!tool || pilotDisabled) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, error_code: 'UNKNOWN_TOOL', message: `Unknown tool: ${name}` }) }],
        isError: true,
      };
    }
    // Runtime input validation from the Zod source (mcp-builder best-practices).
    // A schema failure is a client bug → a clean, actionable tool-result error
    // (not a protocol crash); the handler only ever sees validated, default-
    // applied args.
    const rawArgs = (args ?? {}) as Record<string, unknown>;
    // Deterministic protocol tests need a logical clock, but that test-only
    // control must not become part of the public MCP schema users and models
    // have to understand.
    const hiddenTestClock = process.env['NODE_ENV'] === 'test'
      && PUBLIC_TOOLS.some((candidate) => candidate.name === name)
      && typeof rawArgs['today_override'] === 'string';
    const validationArgs = hiddenTestClock
      ? Object.fromEntries(Object.entries(rawArgs).filter(([key]) => key !== 'today_override'))
      : rawArgs;
    const parsed = tool.inputSchema.safeParse(validationArgs);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
      const error = {
        ok: false,
        tool: name,
        error_code: 'INVALID_INPUT',
        message: `Invalid arguments. ${issues}`,
        recovery: 'Fix the named argument(s) and call the same tool again. Do not infer missing user-owned fields.',
      };
      return localizeToolResult((args ?? {}) as Record<string, unknown>, {
        content: [{ type: 'text' as const, text: JSON.stringify(error) }],
        structuredContent: error,
        isError: true,
      });
    }
    try {
      const callArgs = hiddenTestClock
        ? { ...(parsed.data as Record<string, unknown>), today_override: rawArgs['today_override'] }
        : parsed.data as Record<string, unknown>;
      const result = localizeToolResult(
        callArgs,
        await serialize(() => tool.handler(callArgs)),
      );
      // Opt-in usage signal: which tool ran + that it didn't crash. Carries no
      // arguments — never the decision content. Fire-and-forget (see telemetry.ts).
      recordToolCall(name, true);
      return appendDueNote(name, callArgs, result);
    } catch (e) {
      recordToolCall(name, false);
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
