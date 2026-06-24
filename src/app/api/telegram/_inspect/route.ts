import { NextRequest, NextResponse } from 'next/server';
import { reframeSystemPrompt, deeperSuffix, coerceReframe, reframeToMarkdown, REFRAME_TOOL_SCHEMA, questionSystemPrompt, coerceQuestion, questionToMarkdown, QUESTION_TOOL_NAME, QUESTION_TOOL_SCHEMA } from '@/lib/reframe-core';
import { sealSystemPrompt, coerceSealDraft, sealPreviewMarkdown, SEAL_TOOL_NAME, SEAL_TOOL_SCHEMA } from '@/lib/seal-core';
import { rehearseSystemPrompt, buildRehearseUser, coerceRehearse, rehearseToMarkdown, REHEARSE_PRESETS, REHEARSE_TOOL_NAME, REHEARSE_TOOL_SCHEMA } from '@/lib/rehearse-core';
import { recastSystemPrompt, coerceRecast, recastToMarkdown, RECAST_TOOL_NAME, RECAST_TOOL_SCHEMA } from '@/lib/recast-core';
import { callAnthropicJson } from '@/lib/llm-server';

// TEMP — quality-inspection harness. Runs a bot feature server-side (with the
// Anthropic key) and returns the rendered output so it can be reviewed directly.
// Auth-gated by the webhook secret. Remove after the prompt-quality pass.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (req.headers.get('x-telegram-bot-api-secret-token') !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  let body: { feature?: string; q?: string; who?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }); }
  const feature = body.feature || '';
  const q = (body.q || '').slice(0, 4000);
  const locale: 'ko' | 'en' = /[가-힣]/.test(q) ? 'ko' : 'en';
  if (!q) return NextResponse.json({ error: 'q required' }, { status: 400 });

  try {
    if (feature === 'reframe' || feature === 'deeper') {
      const raw = await callAnthropicJson({ system: reframeSystemPrompt(locale) + (feature === 'deeper' ? deeperSuffix(locale) : ''), user: q, toolName: 'reframe_result', schema: REFRAME_TOOL_SCHEMA, model: 'fast', maxTokens: 1500 });
      return NextResponse.json({ ok: true, markdown: reframeToMarkdown(coerceReframe(raw), locale) });
    }
    if (feature === 'question') {
      const raw = await callAnthropicJson({ system: questionSystemPrompt(locale), user: q, toolName: QUESTION_TOOL_NAME, schema: QUESTION_TOOL_SCHEMA, model: 'fast', maxTokens: 900 });
      const cq = coerceQuestion(raw);
      return NextResponse.json({ ok: true, raw, markdown: cq ? questionToMarkdown(cq, locale) : '(null)' });
    }
    if (feature === 'rehearse') {
      const who = body.who || (locale === 'ko' ? REHEARSE_PRESETS.boss.whoKo : REHEARSE_PRESETS.boss.whoEn);
      const raw = await callAnthropicJson({ system: rehearseSystemPrompt(locale), user: buildRehearseUser(q, who, locale), toolName: REHEARSE_TOOL_NAME, schema: REHEARSE_TOOL_SCHEMA, model: 'fast', maxTokens: 1100 });
      const cr = coerceRehearse(raw);
      return NextResponse.json({ ok: true, markdown: cr ? rehearseToMarkdown(cr, body.who || (locale === 'ko' ? '👔 상사' : '👔 Boss'), locale) : '(null)' });
    }
    if (feature === 'recast') {
      const raw = await callAnthropicJson({ system: recastSystemPrompt(locale), user: q, toolName: RECAST_TOOL_NAME, schema: RECAST_TOOL_SCHEMA, model: 'fast', maxTokens: 1200 });
      const cr = coerceRecast(raw);
      return NextResponse.json({ ok: true, markdown: cr ? recastToMarkdown(cr, locale) : '(null)' });
    }
    if (feature === 'seal') {
      const raw = await callAnthropicJson({ system: sealSystemPrompt(locale), user: q, toolName: SEAL_TOOL_NAME, schema: SEAL_TOOL_SCHEMA, model: 'fast', maxTokens: 900 });
      const d = coerceSealDraft(raw);
      return NextResponse.json({ ok: true, markdown: d ? sealPreviewMarkdown(d, 'N월 N일', locale) : '(null)' });
    }
    return NextResponse.json({ error: 'unknown feature' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String((err as { message?: string })?.message || err).slice(0, 300) }, { status: 500 });
  }
}
