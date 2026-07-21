import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(__dirname, '..', 'page.tsx'), 'utf8');

describe('settings form accessibility', () => {
  it('connects persistent labels to every settings field', () => {
    for (const id of [
      'settings-anthropic-api-key',
      'settings-openai-api-key',
      'settings-openai-model',
      'settings-gemini-api-key',
      'settings-gemini-model',
      'settings-import-backup',
      'settings-user-name',
      'settings-user-role',
      'settings-user-context',
      'settings-audio-volume',
    ]) {
      expect(source).toContain(`htmlFor="${id}"`);
      expect(source).toContain(`id="${id}"`);
    }
  });

  it('exposes grouped choices and their selected states', () => {
    expect(source.match(/<fieldset/g)).toHaveLength(5);
    expect(source.match(/<legend/g)).toHaveLength(5);
    expect(source).toContain("aria-pressed={(settings.llm_provider || 'anthropic') === provider.value}");
    expect(source).toContain('aria-pressed={settings.llm_mode === mode.value}');
    expect(source).toContain('aria-pressed={settings.user_seniority === opt.value}');
    expect(source).toContain('aria-pressed={locale === lang.value}');
    expect(source).toContain('aria-pressed={themePref === opt.value}');
  });

  it('keeps compact settings controls keyboard and touch accessible', () => {
    expect(source).toContain('className="peer sr-only"');
    expect(source).toContain('peer-focus-visible:ring-2');
    expect(source).toContain('aria-valuetext={`${Math.round(settings.audio_volume * 200)}%`}');
    expect(source).toContain('grid grid-cols-1 gap-3 sm:grid-cols-2');
    expect(source).toContain('grid grid-cols-2 gap-1.5 sm:grid-cols-4');
    expect(source).not.toContain('min-h-[36px]');
  });
});
