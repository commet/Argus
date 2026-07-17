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
import { initAmbientElicit, armAmbientElicit } from './lib/ambient-elicit.js';
import { settle } from './tools/settle.js';
import { appendDueNote } from './lib/due-note.js';
import { logError } from './lib/log.js';
import { packageMeta } from './lib/package-meta.js';
import { localizeToolResult } from './lib/localize-result.js';
import { learnLocaleFromContent } from './lib/locale.js';
import { appendLocaleMismatchNote } from './lib/locale-mismatch.js';
import { resolveToolArgusDir } from './lib/argus-dir.js';
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

  // Out-of-band ambient ask (lib/ambient-elicit.ts) — after a tool call ends
  // and the session goes quiet, the server may ask the ONE due settlement
  // question directly (spike-proven server→client elicitation). Recording rides
  // the real settle handler through the SAME serialize chain, so an ambient
  // write can never interleave with an in-band tool call.
  initAmbientElicit({ settleHandler: (a) => settle.handler(a), serialize });

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
      // Carry the offending field(s) + machine-readable reason STRUCTURALLY, so
      // the Korean localizer can name what to fix (not collapse every failure to
      // a generic "invalid input"). Without this, a Korean user is told to "fix
      // the flagged argument" but nothing is flagged — an unactionable dead end.
      const invalidFields = parsed.error.issues.map((i) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw = i as any;
        return {
          field: i.path.join('.') || '(root)',
          code: i.code,
          message: i.message,
          ...(typeof raw.minimum === 'number' ? { minimum: raw.minimum } : {}),
          ...(typeof raw.maximum === 'number' ? { maximum: raw.maximum } : {}),
          ...(raw.expected !== undefined ? { expected: String(raw.expected) } : {}),
          // Zod v4 tags size issues with `origin` ('string' | 'number' | 'array'…).
          ...(raw.origin !== undefined ? { origin: String(raw.origin) } : raw.type !== undefined ? { origin: String(raw.type) } : {}),
        };
      });
      const error = {
        ok: false,
        tool: name,
        error_code: 'INVALID_INPUT',
        message: `Invalid arguments. ${issues}`,
        invalid_fields: invalidFields,
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
      const raw = await serialize(() => tool.handler(callArgs));
      // Learn the session's language from the user's OWN words (never env), so
      // every later surface — including contentless ones (errors, recall) — stays
      // in that language start to finish. Runs after the handler (auto-init has
      // created config by now) and before localize, so even this call's result
      // is localized to the just-learned locale.
      const dirForLocale = resolveToolArgusDir(callArgs['argus_dir']);
      learnLocaleFromContent(dirForLocale, callArgs);
      // §9.7 O1: if an EXPLICIT pin contradicts the language the user is
      // actually speaking, say so once (fact + argus_settings handle) — a pin
      // is never silently overridden, but it must not be silently obeyed
      // against the user's own words forever either.
      const result = appendLocaleMismatchNote(dirForLocale, callArgs, localizeToolResult(callArgs, raw));
      // Opt-in usage signal: which tool ran + that it didn't crash. Carries no
      // arguments — never the decision content. Fire-and-forget (see telemetry.ts).
      recordToolCall(name, true);
      // Debounced out-of-band ask arms on every call and fires only after the
      // session goes quiet; a check_in call spends the budget instead (the user
      // just saw their dues). Never throws, never taxes this call.
      armAmbientElicit(name, callArgs);
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
