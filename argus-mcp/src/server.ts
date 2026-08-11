import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { TOOLS, TOOL_MAP, servedPublicTools } from './tools/index.js';
import { listResources, listResourceTemplates, readResource } from './resources.js';
import { SERVER_INSTRUCTIONS } from './lib/spine.js';
import { setElicitor, DECISION_ASK_TIMEOUT_MS, supportsReliableElicitation } from './lib/elicit.js';
import { setAppsCapability, withUiMeta, UI_EXTENSION_ID } from './lib/apps-ui.js';
import { initAmbientElicit, armAmbientElicit, attachAmbientNote } from './lib/ambient-elicit.js';
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
    elicitInput(
      params: { message: string; requestedSchema: Record<string, unknown> },
      options?: { timeout?: number },
    ): Promise<{
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
  // The timeout is passed EXPLICITLY. Without it the SDK applies its 60-second
  // default to a request whose responder is a human deciding whether to commit
  // to a prediction — and an answer that arrives at 71 seconds is discarded
  // after the tool has already reported that nothing was recorded. See
  // DECISION_ASK_TIMEOUT_MS for the host log that proves it happened.
  setElicitor(
    (message, requestedSchema, timeoutMs) =>
      ec.elicitInput({ message, requestedSchema }, { timeout: timeoutMs ?? DECISION_ASK_TIMEOUT_MS }),
    () => supportsReliableElicitation(ec.getClientCapabilities?.()),
  );
  // MCP Apps (SEP-1865): same declared-capability pattern. Hosts that announce
  // the io.modelcontextprotocol/ui extension get the settle CARD (tool _meta.ui
  // + awaiting_picker path); everyone else keeps the elicitation/text flow.
  setAppsCapability(() => {
    const caps = ec.getClientCapabilities?.() as { extensions?: Record<string, unknown> } | undefined;
    return Boolean(caps?.extensions?.[UI_EXTENSION_ID]);
  });

  // Resources — read-only context (blueprint §4.3).
  server.setRequestHandler(ListResourcesRequestSchema, async () => listResources());
  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => listResourceTemplates());
  server.setRequestHandler(ReadResourceRequestSchema, async (req) => readResource(req.params.uri));

  // Anonymous, opt-in activation signal (no-op unless ARGUS_TELEMETRY=1). Fire-
  // and-forget: never blocks server startup, never throws. See lib/telemetry.ts.
  recordServerStart();

  // Single source (tools/index.ts): builds the descriptors AND runs schemas
  // through publicCopy so a legacy tool name in a field description can't leak.
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: withUiMeta(servedPublicTools()) }));

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
    const rawArgs = (args ?? {}) as Record<string, unknown>;
    // Deterministic protocol tests need a logical clock, but that test-only
    // control must not become part of the public MCP schema users and models
    // have to understand.
    const hiddenTestClock = process.env['NODE_ENV'] === 'test'
      && TOOLS.some((candidate) => candidate.name === name)
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
        recovery: 'Fix the named argument(s) and call the same tool again. Do not infer missing user-owned fields. If a predicate was rejected for length, it is usually several predictions bundled into one — split it and seal each separately rather than shortening it into vagueness.',
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
      let result = localizeToolResult(callArgs, raw);
      // Learn the session's language from the user's OWN words (never env), so
      // every later surface — including contentless ones (errors, recall) — stays
      // in that language start to finish. This is BEST-EFFORT: a bad argus_dir
      // (relative / unexpanded ${VAR} — the #1 setup mistake) already surfaced a
      // proper, localized error from the handler; re-resolving it here to learn
      // the locale must NOT re-throw and clobber that with a raw INTERNAL_ERROR.
      try {
        const dirForLocale = resolveToolArgusDir(callArgs['argus_dir']);
        learnLocaleFromContent(dirForLocale, callArgs);
        // §9.7 O1: if an EXPLICIT pin contradicts the language the user is
        // actually speaking, say so once (fact + argus_settings handle) — a pin
        // is never silently overridden, but it must not be silently obeyed
        // against the user's own words forever either.
        result = appendLocaleMismatchNote(dirForLocale, callArgs, result);
      } catch { /* invalid argus_dir — the handler already surfaced it; skip locale learning */ }
      // Opt-in usage signal: which tool ran + that it didn't crash. Carries no
      // arguments — never the decision content. Fire-and-forget (see telemetry.ts).
      recordToolCall(name, true);
      // Debounced out-of-band ask arms on every call and fires only after the
      // session goes quiet; a check_in call spends the budget instead (the user
      // just saw their dues). Never throws, never taxes this call.
      armAmbientElicit(name, callArgs);
      // 밖에서 물어본 답의 결말을 한 줄로 돌려준 뒤 due 꼬리를 붙인다 (순서:
      // 확인이 먼저 — 사용자가 방금 한 행동의 결과가 due 안내보다 앞선다).
      let dirForNote: string | null = null;
      try { dirForNote = resolveToolArgusDir(callArgs['argus_dir']); } catch { /* unbound — no note */ }
      return appendDueNote(name, callArgs, attachAmbientNote(result, dirForNote));
    } catch (e) {
      recordToolCall(name, false);
      // Last-resort guard — individual handlers already map their own errors.
      logError(`[${name}] escaped handler`, e);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({
          ok: false,
          error_code: 'INTERNAL_ERROR',
          message: 'Argus could not complete the request. Check the server log and retry.',
        }) }],
        isError: true,
      };
    }
  });

  return server;
}
