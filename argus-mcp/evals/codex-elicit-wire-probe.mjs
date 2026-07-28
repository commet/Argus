import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const server = new Server(
  { name: 'argus-codex-elicit-wire-probe', version: '1' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: 'probe_elicitation',
    description: 'Return the exact elicitation result received from the host.',
    inputSchema: { type: 'object', properties: {} },
  }],
}));

server.setRequestHandler(CallToolRequestSchema, async () => {
  const result = await server.elicitInput({
    message: 'Argus Codex policy wire probe',
    requestedSchema: { type: 'object', properties: {} },
  });
  return {
    content: [{ type: 'text', text: JSON.stringify(result) }],
    structuredContent: result,
  };
});

await server.connect(new StdioServerTransport());
