import fs from 'fs';
import path from 'path';
import { contentLocaleFromArgs } from './locale.js';
import { configLocale } from './surfaces.js';
import type { McpToolResult } from './envelope.js';

/**
 * Locale-mismatch once-note (§9.7 O1 product contract: "locale은 대화-언어
 * 우선 — 설정과 대화 언어가 어긋나면 1회 확인, 감지 1회 영구 고착 금지").
 *
 * The escape hatch stays intact: an explicit config locale is never silently
 * overridden (that guarantee is what makes the pin trustworthy). But until
 * now the pin was also never QUESTIONED — the 2026-06-15 incident wrote
 * `locale: en` into a real config during an English-driven eval run, and a
 * Korean founder then got English surfaces for a month with nothing ever
 * saying "your saved language disagrees with your words".
 *
 * Contract: when an explicit pin exists AND the user's own content confidently
 * speaks the other language, append ONE note — a fact plus the argus_settings
 * handle, in the language the user is speaking — to the next successful
 * surface. Once per ledger, ever (marker file); declining by ignoring it is a
 * valid answer and is never re-asked. No auto-update, no directive: the config
 * change stays an authorial act the user performs.
 */
const MARKER = 'locale-mismatch-noted';

export function appendLocaleMismatchNote(
  argusDir: string | null | undefined,
  args: Record<string, unknown>,
  result: McpToolResult,
): McpToolResult {
  try {
    if (!argusDir) return result;
    const pinned = configLocale(argusDir);
    if (!pinned) return result; // no pin → the text-detection chain already speaks the user's language
    const spoken = contentLocaleFromArgs(args);
    if (!spoken || spoken === pinned) return result;
    const marker = path.join(argusDir, MARKER);
    if (fs.existsSync(marker)) return result; // asked once already — silence forever
    const sc = result.structuredContent as Record<string, unknown> | undefined;
    if (!sc || sc['ok'] !== true || typeof sc['surface'] !== 'string') return result; // never decorate errors
    fs.writeFileSync(marker, new Date().toISOString());
    const note = spoken === 'ko'
      ? '\n(설정 언어가 English로 고정되어 있어요. 한국어로 바꾸려면 argus_settings에 locale="ko" 한 번이면 돼요. 이 안내는 다시 나오지 않아요.)'
      : '\n(Your saved language is Korean. To switch, call argus_settings with locale="en" once; this note will not appear again.)';
    const next = { ...sc, surface: `${sc['surface'] as string}${note}` };
    result.structuredContent = next;
    result.content = [{ type: 'text', text: JSON.stringify(next, null, 2) }];
    return result;
  } catch {
    return result; // a broken note must never wedge a tool call
  }
}
