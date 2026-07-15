/**
 * Out-of-band elicitation probe SERVER (spike — not shipped).
 *
 * The question this server exists to answer: can an MCP server ask the user a
 * question when NO tool call is in flight? Two firing modes:
 *
 *   1. AUTOFIRE (env ARGUS_SPIKE_AUTOFIRE=<ms>): fire elicitInput N ms after
 *      initialize completes — no tool call ever happened. The purest
 *      "server speaks first" case.
 *   2. arm tool: `arm { delay_ms }` returns IMMEDIATELY ("armed"), then the
 *      server fires elicitInput delay_ms later — after its tool response has
 *      already been delivered. This is the product shape: a tool call ends,
 *      the user goes back to their main work, and the question arrives later.
 *
 * Every step is logged to stderr as JSON lines so the spike runner (and a
 * human testing against a real host) can see exactly what fired and when.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const log = (event, extra = {}) =>
  console.error(JSON.stringify({ t: Date.now(), event, ...extra }));

const mcp = new McpServer(
  { name: 'argus-oob-elicit-probe', version: '0.0.1' },
  { capabilities: { tools: {} } },
);

async function fireElicit(label) {
  log('elicit_firing', { label });
  try {
    const res = await mcp.server.elicitInput({
      message: `[${label}] Argus probe: this question was sent with NO tool call in flight. Pick anything.`,
      requestedSchema: {
        type: 'object',
        properties: {
          answer: { type: 'string', enum: ['saw-it', 'also-saw-it'], description: 'Any pick proves delivery.' },
        },
        required: ['answer'],
      },
    });
    log('elicit_resolved', { label, action: res.action, content: res.content ?? null });
    return res;
  } catch (e) {
    log('elicit_threw', { label, error: String(e?.message ?? e) });
    return null;
  }
}

mcp.registerTool(
  'arm',
  {
    description: 'Arms a delayed out-of-band question. Returns immediately; the server fires elicitation/create delay_ms later, OUTSIDE any tool call.',
    inputSchema: { delay_ms: z.number().int().min(0).max(60_000).default(300) },
  },
  async ({ delay_ms }) => {
    log('arm_called', { delay_ms });
    setTimeout(() => void fireElicit('armed'), delay_ms);
    // The tool response is delivered NOW — the elicit that follows is out-of-band.
    return { content: [{ type: 'text', text: JSON.stringify({ armed: true, fires_in_ms: delay_ms, tool_returned_at: Date.now() }) }] };
  },
);

const transport = new StdioServerTransport();
mcp.server.oninitialized = () => {
  const caps = mcp.server.getClientCapabilities();
  log('initialized', { client_declares_elicitation: Boolean(caps?.elicitation) });
  const autofire = Number(process.env.ARGUS_SPIKE_AUTOFIRE ?? 0);
  if (autofire > 0) setTimeout(() => void fireElicit('autofire'), autofire);
};
await mcp.connect(transport);
log('server_up');
