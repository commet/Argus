export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

export function ok(data: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

export function err(message: string, detail?: unknown): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: message, detail }, null, 2) }],
    isError: true,
  };
}
