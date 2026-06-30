import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { argus_config_read, argus_config_write, argus_init } from './tools/config.js';
import {
  argus_session_create,
  argus_session_read,
  argus_session_update,
  argus_session_list,
} from './tools/session.js';
import {
  argus_version_write,
  argus_version_read,
  argus_version_list,
} from './tools/version.js';
import {
  argus_ledger_append,
  argus_ledger_replay,
  argus_contracts_due,
} from './tools/ledger.js';
import { argus_bearing_write, argus_bearing_read } from './tools/bearing.js';

const TOOLS = [
  {
    name: 'argus_init',
    description: 'Initialize the .argus/ directory structure for a project. Call this once before using other Argus tools.',
    inputSchema: {
      type: 'object',
      properties: {
        argus_dir: { type: 'string', description: 'Path to the .argus/ directory (e.g. /project/.argus)' },
      },
      required: ['argus_dir'],
    },
  },
  {
    name: 'argus_config_read',
    description: 'Read Argus config (locale, boss, team, archive). Returns defaults if no config file exists.',
    inputSchema: {
      type: 'object',
      properties: {
        argus_dir: { type: 'string', description: 'Path to the .argus/ directory' },
      },
      required: ['argus_dir'],
    },
  },
  {
    name: 'argus_config_write',
    description: 'Write Argus config. Merges with existing config.',
    inputSchema: {
      type: 'object',
      properties: {
        argus_dir: { type: 'string', description: 'Path to the .argus/ directory' },
        config: {
          type: 'object',
          description: 'Config fields to set (locale, boss, team, archive)',
          properties: {
            locale: { type: 'string', enum: ['en', 'ko'] },
            boss: { type: ['string', 'null'] },
            team: { type: ['string', 'null'] },
            archive: { type: ['string', 'null'] },
          },
        },
      },
      required: ['argus_dir', 'config'],
    },
  },
  {
    name: 'argus_session_create',
    description: 'Create a new decision session.',
    inputSchema: {
      type: 'object',
      properties: {
        argus_dir: { type: 'string' },
        id: { type: 'string', description: 'Unique session id (slug, e.g. "migrate-db-2026-07-01")' },
        title: { type: 'string', description: 'Short human-readable title' },
        decision: { type: 'string', description: 'The decision being considered' },
        context: { type: 'string', description: 'Background context' },
      },
      required: ['argus_dir', 'id', 'title'],
    },
  },
  {
    name: 'argus_session_read',
    description: 'Read a session by id.',
    inputSchema: {
      type: 'object',
      properties: {
        argus_dir: { type: 'string' },
        id: { type: 'string' },
      },
      required: ['argus_dir', 'id'],
    },
  },
  {
    name: 'argus_session_update',
    description: 'Update fields on an existing session (patch, not replace).',
    inputSchema: {
      type: 'object',
      properties: {
        argus_dir: { type: 'string' },
        id: { type: 'string' },
        patch: {
          type: 'object',
          description: 'Fields to update',
          properties: {
            title: { type: 'string' },
            status: { type: 'string', enum: ['active', 'settled', 'dismissed'] },
            decision: { type: 'string' },
            context: { type: 'string' },
          },
        },
      },
      required: ['argus_dir', 'id', 'patch'],
    },
  },
  {
    name: 'argus_session_list',
    description: 'List all sessions with summary info.',
    inputSchema: {
      type: 'object',
      properties: {
        argus_dir: { type: 'string' },
      },
      required: ['argus_dir'],
    },
  },
  {
    name: 'argus_version_write',
    description: 'Write a versioned artifact (JSON file) to a session version directory.',
    inputSchema: {
      type: 'object',
      properties: {
        argus_dir: { type: 'string' },
        session_id: { type: 'string' },
        label: { type: 'string', description: 'Version label (e.g. "v1", "draft", "final")' },
        filename: { type: 'string', description: 'Filename within the version dir (e.g. "analysis.json")' },
        data: { description: 'JSON-serializable data to write' },
      },
      required: ['argus_dir', 'session_id', 'label', 'filename', 'data'],
    },
  },
  {
    name: 'argus_version_read',
    description: 'Read a versioned artifact.',
    inputSchema: {
      type: 'object',
      properties: {
        argus_dir: { type: 'string' },
        session_id: { type: 'string' },
        label: { type: 'string' },
        filename: { type: 'string' },
      },
      required: ['argus_dir', 'session_id', 'label', 'filename'],
    },
  },
  {
    name: 'argus_version_list',
    description: 'List all versions for a session, with their files.',
    inputSchema: {
      type: 'object',
      properties: {
        argus_dir: { type: 'string' },
        session_id: { type: 'string' },
      },
      required: ['argus_dir', 'session_id'],
    },
  },
  {
    name: 'argus_bearing_write',
    description: 'Write the current bearing (recommendation + contract_seed) for a session version.',
    inputSchema: {
      type: 'object',
      properties: {
        argus_dir: { type: 'string' },
        session_id: { type: 'string' },
        label: { type: 'string' },
        bearing: {
          type: 'object',
          description: 'The bearing object',
          properties: {
            title: { type: 'string' },
            recommendation: { type: 'string' },
            rationale: { type: 'string' },
            risks: { type: 'array', items: { type: 'string' } },
            contract_seed: {
              type: 'object',
              properties: {
                predicate: { type: 'string', description: 'Falsifiable prediction (e.g. "Revenue grows 20% in 6 months")' },
                check_by: { type: 'string', description: 'ISO date to check (e.g. "2027-01-01")' },
              },
              required: ['predicate', 'check_by'],
            },
          },
          required: ['title', 'recommendation', 'rationale', 'risks'],
        },
      },
      required: ['argus_dir', 'session_id', 'label', 'bearing'],
    },
  },
  {
    name: 'argus_bearing_read',
    description: 'Read the current bearing for a session version.',
    inputSchema: {
      type: 'object',
      properties: {
        argus_dir: { type: 'string' },
        session_id: { type: 'string' },
        label: { type: 'string' },
      },
      required: ['argus_dir', 'session_id', 'label'],
    },
  },
  {
    name: 'argus_ledger_append',
    description: 'Append one or more events to the ledger. Events: harvest, seal, amend, dismiss, settle.',
    inputSchema: {
      type: 'object',
      properties: {
        argus_dir: { type: 'string' },
        events: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Decision id (same as session id)' },
              event: { type: 'string', enum: ['harvest', 'seal', 'amend', 'dismiss', 'settle'] },
              ts: { type: 'string', description: 'ISO timestamp (auto-set if omitted)' },
              predicate: { type: 'string', description: 'For seal/amend: the falsifiable prediction' },
              check_by: { type: 'string', description: 'For seal/amend: ISO date to check' },
              decision: { type: 'string', description: 'For harvest: the decision text' },
              outcome: { type: 'string', description: 'For settle: what actually happened' },
            },
            required: ['id', 'event'],
          },
        },
      },
      required: ['argus_dir', 'events'],
    },
  },
  {
    name: 'argus_ledger_replay',
    description: 'Replay the full ledger and return all contract states.',
    inputSchema: {
      type: 'object',
      properties: {
        argus_dir: { type: 'string' },
        today: { type: 'string', description: 'Override today date (YYYY-MM-DD). Defaults to system date.' },
      },
      required: ['argus_dir'],
    },
  },
  {
    name: 'argus_contracts_due',
    description: 'Return all overdue decision contracts (from ledger + bearing files). Call at session start.',
    inputSchema: {
      type: 'object',
      properties: {
        argus_dir: { type: 'string' },
        today: { type: 'string', description: 'Override today date (YYYY-MM-DD). Defaults to system date.' },
      },
      required: ['argus_dir'],
    },
  },
] as const;

type ToolName = typeof TOOLS[number]['name'];

export async function createServer(): Promise<Server> {
  const server = new Server(
    { name: 'argus-mcp', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  server.setRequestHandler(CallToolRequestSchema, async (request): Promise<any> => {
    const { name, arguments: args } = request.params;
    const a = (args || {}) as Record<string, unknown>;

    try {
      switch (name as ToolName) {
        case 'argus_init':
          return await argus_init(a as { argus_dir: string });
        case 'argus_config_read':
          return await argus_config_read(a as { argus_dir: string });
        case 'argus_config_write':
          return await argus_config_write(a as never);
        case 'argus_session_create': {
          // Normalize flat args → nested session object expected by session.ts
          const now = new Date().toISOString();
          const session = { id: a['id'] as string, problem_text: (a['decision'] as string) || (a['title'] as string) || '', created_at: now, updated_at: now, ...((a['session'] as object) || {}) };
          return await argus_session_create({ argus_dir: a['argus_dir'] as string, session });
        }
        case 'argus_session_read':
          return await argus_session_read({ argus_dir: a['argus_dir'] as string, session_id: (a['session_id'] || a['id']) as string });
        case 'argus_session_update':
          return await argus_session_update({ argus_dir: a['argus_dir'] as string, session_id: (a['session_id'] || a['id']) as string, patch: (a['patch'] || {}) as Record<string, unknown> });
        case 'argus_session_list':
          return await argus_session_list(a as { argus_dir: string });
        case 'argus_version_write':
          return await argus_version_write({ argus_dir: a['argus_dir'] as string, session_id: a['session_id'] as string, label: a['label'] as string, filename: a['filename'] as string, content: a['content'] ?? a['data'], overwrite: a['overwrite'] as boolean | undefined });
        case 'argus_version_read':
          return await argus_version_read(a as { argus_dir: string; session_id: string; label: string; filename: string });
        case 'argus_version_list':
          return await argus_version_list(a as { argus_dir: string; session_id: string });
        case 'argus_bearing_write':
          return await argus_bearing_write(a as { argus_dir: string; session_id: string; label: string; bearing: Record<string, unknown> });
        case 'argus_bearing_read':
          return await argus_bearing_read(a as { argus_dir: string; session_id: string; label: string | null });
        case 'argus_ledger_append':
          return await argus_ledger_append(a as never);
        case 'argus_ledger_replay':
          return await argus_ledger_replay(a as { argus_dir: string });
        case 'argus_contracts_due':
          return await argus_contracts_due(a as { argus_dir: string });
        default:
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: `Unknown tool: ${name}` }) }],
            isError: true,
          };
      }
    } catch (e) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: String(e) }) }],
        isError: true,
      };
    }
  });

  return server;
}
