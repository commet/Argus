import fs from 'fs/promises';
import fsSync from 'fs';
import yaml from 'js-yaml';
import { configPath, sessionsRoot, ledgerDir } from '../lib/layout.js';
import { atomicWriteText } from '../lib/atomic-write.js';
import { detectLocale } from '../lib/locale.js';
import { resolveToolArgusDir, writeBoundMarker } from '../lib/argus-dir.js';
import { ensurePrivacyGitignore } from '../lib/privacy.js';
import { replayLedger } from '../lib/ledger-replay.js';
import { resolveDefaultTimeZone, resolveToday } from '../lib/resolve-today.js';
import { SCHEMA_VERSION } from '../lib/spine.js';
import { z } from 'zod';
import path from 'path';
import { envelope, toolError } from '../lib/envelope.js';
import { ENVELOPE_OUTPUT_SCHEMA, zArgusDir, type ToolModule } from './tool-types.js';
import { handleToolException } from './errors.js';
import { localizedMessage } from '../lib/localized-message.js';
import { gitCommonDirOf } from '../v2/git-discovery.js';
import { initV2 } from '../v2/init.js';
import { argusHome, ledgerPath } from '../v2/ledger.js';

interface ArgusConfig {
  schema_version: number;
  /** Absent = no explicit locale; runtime content-detection decides the voice.
   *  Only ever written on a positive Korean env signal at init, or an explicit
   *  user choice. See the auto-init note below. */
  locale?: 'ko' | 'en';
  boss: string | null;
  team: string | null;
  archive: boolean | null;
  /** M1 §1.3 — when true, silence the in-session ambient due-line (the surface
   *  tail). The machine due_note count channel is unaffected. The escape hatch;
   *  never affects the spine. Absent/false → the ambient line may fire once. */
  ambient_mute?: boolean | null;
  /** M3 §9.2-4 — OPT-IN: when true, monitored premises ride along with the
   *  seal push so the account premise-watch (T2) covers them. Absent/false →
   *  premise data never leaves this machine. */
  premise_sync?: boolean | null;
}

function readConfig(dir: string): ArgusConfig | null {
  try {
    return yaml.load(fsSync.readFileSync(configPath(dir), 'utf8')) as ArgusConfig;
  } catch {
    return null;
  }
}

export const init: ToolModule = {
  name: 'argus_init',
  description: 'Initialize the .argus directory (sessions, ledger, config, privacy .gitignore) and bind it for resource reads. Call once before other tools. Safe to call again.',
  inputSchema: z.strictObject({ argus_dir: zArgusDir }),
  outputSchema: ENVELOPE_OUTPUT_SCHEMA,
  annotations: { title: 'Initialize Argus', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async (a) => {
    try {
      const dir = resolveToolArgusDir(a['argus_dir']);
      await fs.mkdir(sessionsRoot(dir), { recursive: true });
      await fs.mkdir(ledgerDir(dir), { recursive: true });
      await ensurePrivacyGitignore(dir);
      writeBoundMarker(dir);

      if (!fsSync.existsSync(configPath(dir))) {
        // Seed a locale ONLY on a positive Korean env signal (KST machine → ko
        // once, so the very first contentless surface is Korean). On the default
        // English/Intl fallback, OMIT locale so runtime content-detection stays
        // live — otherwise a Korean user on an English-locale OS gets locale:en
        // pinned on first use, and config-wins means their Korean text can NEVER
        // reclaim a Korean surface. (Found via the check_in localization yellow,
        // 2026-07-14: an all-Korean session came back in English forever.)
        const seededLocale = detectLocale(dir);
        const cfg: ArgusConfig = {
          schema_version: SCHEMA_VERSION,
          ...(seededLocale === 'ko' ? { locale: 'ko' as const } : {}),
          boss: null, team: null, archive: null,
        };
        await atomicWriteText(configPath(dir), yaml.dump(cfg));
      }

      // ── v2 바인딩 (P1 수술 1단계 — 파괴 없는 추가) ──
      // 정본 II-D: git repo면 registry에 repository_id를 등록하고 내구 원장
      // (~/.argus/projects/{id}/)을 연다. v1 위치의 원장이 발견되면 복사 이전.
      // git repo가 아니면 v2 바인딩 없이 v1 그대로 — 사유를 정직하게 병기한다.
      // 바인딩 실패(MIGRATION_CONFLICT 등)는 init 전체를 죽이지 않되 삼키지도
      // 않는다: data.v2.error로 노출 (사람이 봐야 하는 상황을 조용히 해소 금지).
      let v2: Record<string, unknown>;
      try {
        const commonDir = gitCommonDirOf(dir);
        if (commonDir) {
          const report = initV2({
            home: argusHome(), gitCommonDir: commonDir,
            workspaceArgusDir: dir, projectRoot: path.dirname(dir),
          });
          v2 = {
            bound: true,
            repository_id: report.repository_id,
            workspace_id: report.workspace_id,
            newly_registered: report.newly_registered,
            durable_ledger: ledgerPath(argusHome(), report.repository_id),
            v1_migration: report.v1_migration.filter((m) => m.action !== 'source_missing'),
          };
        } else {
          v2 = { bound: false, reason: 'not inside a git repository — the durable ledger home (II-D) is keyed by git repo; v1 behavior continues unchanged' };
        }
      } catch (e) {
        v2 = { bound: false, error: e instanceof Error ? e.message : String(e) };
      }

      const today = resolveToday({});
      const empty = replayLedger(dir, today).ids.size === 0;
      // TZ visibility (12 §3.3): expose today + tz so an install in KST notices
      // "today is yesterday" immediately instead of at the first missed check-in.
      // Default is system-local; ARGUS_TZ is the explicit override.
      const tz = process.env['ARGUS_TZ'] || `${resolveDefaultTimeZone()} (system local; set ARGUS_TZ to override)`;
      const locale = readConfig(dir)?.locale ?? detectLocale(dir);
      return envelope({
        ok: true, tool: 'argus_init',
        surface: empty
          ? localizedMessage(dir, undefined, {
              en: 'Argus is ready. Describe a decision you are weighing. It can sharpen the sentence, preserve what you meant, and bring it back when reality can answer it.',
              ko: 'Argus가 준비됐습니다. 고민 중인 결정을 말해 주세요. 생각을 날카로운 한 문장으로 다듬고, 그때 무엇을 뜻했는지 보존한 뒤, 현실이 답할 수 있을 때 다시 가져옵니다.',
            })
          : localizedMessage(dir, undefined, { en: 'Argus is ready.', ko: 'Argus가 준비됐습니다.' }),
        next_actions: empty ? ['argus_capture'] : ['argus_check_in'],
        data: {
          initialized: true, argus_dir: dir, today, tz, locale, v2,
        },
      });
    } catch (e) {
      return handleToolException('argus_init', e);
    }
  },
};

export const config: ToolModule = {
  name: 'argus_config',
  description: 'Read or update non-spine settings (locale, boss, team, archive). Passing only argus_dir reads; passing fields merges and writes. There is no setting that turns off falsifiability, seal-before-settle, or honest provenance — the spine is not configurable.',
  inputSchema: z.strictObject({
    argus_dir: zArgusDir,
    locale: z.enum(['ko', 'en']).optional(),
    boss: z.string().optional(),
    team: z.string().optional(),
    archive: z.boolean().optional(),
    ambient_mute: z.boolean().optional().describe('Silence the in-session ambient due-line (the "by the way — N to settle" surface tail). The machine due_note count is unaffected.'),
    premise_sync: z.boolean().optional().describe('OPT-IN (default off — premise data never leaves this machine otherwise): when true AND an ARGUS_TOKEN is set, a sealed decision\'s MONITORED premises ride along to your account so the autonomous premise-watch can re-check them against reality and email a material drift (T2). Turn it on only when the user explicitly chose it.'),
  }),
  outputSchema: ENVELOPE_OUTPUT_SCHEMA,
  annotations: { title: 'Read/update settings', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async (a) => {
    try {
      const dir = resolveToolArgusDir(a['argus_dir']);
      const writeKeys = ['locale', 'boss', 'team', 'archive', 'ambient_mute', 'premise_sync'].filter((k) => k in a);

      const existing = readConfig(dir) ?? { schema_version: SCHEMA_VERSION, locale: detectLocale(dir), boss: null, team: null, archive: null };

      if (writeKeys.length === 0) {
        // action=update with no writable field is a MISTAKE (a read is
        // action=status). Saying "Config read." reports the OPPOSITE operation
        // as a success and hides that nothing changed — name the supported set.
        if (a['action'] === 'update') {
          return envelope({
            ok: true, tool: 'argus_config',
            surface: localizedMessage(dir, undefined, {
              en: 'No setting was changed. Supported fields: locale (ko/en), ambient_mute (true/false), premise_sync (true/false).',
              ko: '변경된 설정이 없습니다. 바꿀 수 있는 항목: locale(ko/en), ambient_mute(true/false), premise_sync(true/false).',
            }),
            next_actions: ['stop'],
            data: { config: existing, existed: !!readConfig(dir), changed: [] },
          });
        }
        return envelope({
          ok: true,
          tool: 'argus_config',
          surface: localizedMessage(dir, undefined, { en: 'Config read.', ko: '설정을 읽었습니다.' }),
          next_actions: ['stop'],
          data: { config: existing, existed: !!readConfig(dir) },
        });
      }

      if ('locale' in a && a['locale'] !== 'ko' && a['locale'] !== 'en') {
        return toolError({ ok: false, tool: 'argus_config', error_code: 'INVALID_LOCALE', message: 'locale must be "ko" or "en".' });
      }

      const merged: ArgusConfig = {
        ...existing,
        schema_version: SCHEMA_VERSION,
        ...(('locale' in a) ? { locale: a['locale'] as 'ko' | 'en' } : {}),
        ...(('boss' in a) ? { boss: a['boss'] as string } : {}),
        ...(('team' in a) ? { team: a['team'] as string } : {}),
        ...(('archive' in a) ? { archive: a['archive'] as boolean } : {}),
        ...(('ambient_mute' in a) ? { ambient_mute: a['ambient_mute'] as boolean } : {}),
        ...(('premise_sync' in a) ? { premise_sync: a['premise_sync'] as boolean } : {}),
      };
      await atomicWriteText(configPath(dir), yaml.dump(merged));
      return envelope({
        ok: true,
        tool: 'argus_config',
        surface: localizedMessage(dir, undefined, {
          en: `Config updated: ${writeKeys.join(', ')}.`,
          ko: `설정을 수정했습니다: ${writeKeys.join(', ')}.`,
        }),
        next_actions: ['stop'],
        data: { config: merged },
      });
    } catch (e) {
      return handleToolException('argus_config', e);
    }
  },
};
