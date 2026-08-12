/**
 * Minimal Anthropic Messages client over fetch — no SDK dependency, so the
 * eval harness adds nothing to the published package's dependency surface.
 */
const API = 'https://api.anthropic.com/v1/messages';

export async function complete({ model, system, user, maxTokens = 1024 }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY not set');

  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      ...(system ? { system } : {}),
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`anthropic ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = await res.json();
  const text = json.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim();
  // A TRUNCATED completion is never what a caller wants, and swallowing
  // stop_reason made the harness lie about the product (2026-08-11).
  //
  // The Korean personas write long, and Korean costs far more tokens per
  // sentence than English, so their turns hit the ceiling and arrived as half
  // sentences. The assistant did the RIGHT thing — "your message got cut off,
  // please continue" — and the harness scored the whole journey 0/4 with zero
  // tool calls. Read only the score, and the conclusion is "the product fails
  // Korean users." The product never saw a complete sentence.
  //
  // This is the LLM-glue invariant turned on the harness itself: a measuring
  // instrument that silently feeds broken input and records the subject's
  // confusion as the subject's defect is worse than no instrument. Every gap
  // fails loudly or is surfaced honestly — including our own.
  if (json.stop_reason === 'max_tokens') {
    throw new Error(
      `completion truncated at max_tokens=${maxTokens} (produced ${text.length} chars). `
      + 'Raise maxTokens for this call — a half sentence must never reach the subject under test. '
      + `Tail: ${JSON.stringify(text.slice(-90))}`,
    );
  }
  return text;
}

/**
 * A judge that must return structured data gets a FORCED tool call, not a prose
 * request. Asking "reply ONLY with JSON" fails open: the model writes a preamble,
 * runs out of max_tokens before the first `{`, and extractJson throws "no JSON
 * object in response" — which reads like a model quirk but is really a truncated
 * response. The harness then silently dropped that persona, so a 17-persona run
 * reported on 15 and nobody noticed. tool_choice makes the schema the only legal
 * output, and a truncated tool call is reported as truncation.
 */
export async function completeJson({ model, system, user, toolName = 'result', schema, maxTokens = 2048 }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY not set');
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model, max_tokens: maxTokens,
      ...(system ? { system } : {}),
      messages: [{ role: 'user', content: user }],
      tools: [{ name: toolName, description: 'Return the structured verdict.', input_schema: schema }],
      tool_choice: { type: 'tool', name: toolName },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`anthropic ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = await res.json();
  const block = json.content.find((b) => b.type === 'tool_use' && b.name === toolName);
  if (!block) {
    const text = json.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim();
    throw new Error(
      json.stop_reason === 'max_tokens'
        ? `judge response truncated before emitting ${toolName} (raise maxTokens)`
        : `judge did not call ${toolName} (stop_reason=${json.stop_reason}): ${text.slice(0, 200)}`,
    );
  }
  // 블록이 **있어도** max_tokens면 인자가 중간에서 잘린 것이다. 위의 `!block`
  // 분기는 아무것도 못 낸 경우만 잡는다 — 절반짜리 인자(잘린 predicate, 빈
  // what_happened)는 그대로 통과해서, 제품이 못 채운 것처럼 기록된다. complete()가
  // 한국어 페르소나 실행에서 겪은 것과 같은 실패이고, 여기만 안 고쳐져 있었다.
  if (json.stop_reason === 'max_tokens') {
    throw new Error(
      `${toolName} tool call truncated at max_tokens=${maxTokens} — arguments are incomplete. `
      + 'Raise maxTokens for this call; a half-written tool call must never be scored as the subject\'s output. '
      + `Partial input: ${JSON.stringify(block.input).slice(0, 200)}`,
    );
  }
  return block.input;
}

/**
 * Full Messages call with tool support — for the experience loop, where the
 * model plays the HOST (Claude Desktop/Code) and drives the real MCP server.
 * Returns the raw response (content blocks + stop_reason) so the caller can
 * execute tool_use blocks and continue the conversation.
 */
export async function chat({ model, system, messages, tools, maxTokens = 1024 }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY not set');
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model, max_tokens: maxTokens,
      ...(system ? { system } : {}),
      ...(tools && tools.length ? { tools } : {}),
      messages,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`anthropic ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

/** Pull the first JSON object out of a possibly-fenced model response. */
export function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('no JSON object in response');
  return JSON.parse(raw.slice(start, end + 1));
}
