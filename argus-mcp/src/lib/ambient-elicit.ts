import fs from 'fs';
import path from 'path';
import { elicit, canElicit } from './elicit.js';
import { replayLedger } from './ledger-replay.js';
import { resolveToday } from './resolve-today.js';
import { resolveResponseLocale } from './surfaces.js';
import { resolveToolArgusDir } from './argus-dir.js';
import { configPath } from './layout.js';
import { atomicWriteJson } from './atomic-write.js';
import { logError } from './log.js';
import { sanitizeLine } from '../v2/sanitize.js';
import type { McpToolResult } from './envelope.js';

/**
 * Out-of-band ambient elicitation — the MCP-side firing gate (창업자 컨셉
 * 2026-07-15, 스파이크 spikes/ambient-elicit/ 가 프로토콜 층을 실증).
 *
 * The wire is bidirectional: `elicitation/create` is a server→client request
 * and nothing ties it to an in-flight tool call. So after a tool call ends and
 * the user goes back to their main work, THIS module may ask them the one due
 * question — the wait becomes judgment time, no plugin required.
 *
 * Gate BEFORE form (spine mirror clause — don't judge WHETHER to intervene in
 * the user's stead; default is restraint):
 *
 *   arm-time  — host declared elicitation? not already spent? then debounce:
 *               each tool call re-arms one quiet-delay timer (fire only when
 *               Argus goes quiet — mid-conversation is not the wait).
 *   fire-time — EVERYTHING re-checked: capability, `ambient_mute: true` in
 *               config.yaml (the SAME escape hatch as the due-note tail — one
 *               mute, not two), cross-session cooldown (4h, state file), and
 *               due recomputed from the ledger (zero due = silence).
 *   budget    — at most ONE ask per server process (one question per sitting);
 *               an argus_check_in call spends the budget (the user just saw
 *               their dues — asking again in a minute is nagging, the same
 *               principle as due-note's SKIP_TOOLS mark).
 *   decline   — is an answer. Nothing written, budget stays spent, the state
 *               file's cooldown keeps the next session from insta-re-asking.
 *
 * Form (spine §9.2): only the settlement outcome — the ONE spine-SAFE
 * structured pick (reality, not a verdict; same enum as argus_settle's
 * in-band elicit). Premise re-checks and open questions are deliberately NOT
 * asked out-of-band in v1: their honest form is free text, and free text
 * without conversational context invites fabricated-feeling answers. The
 * recording brain is NOT duplicated: an accepted answer is fed to the real
 * settle handler (injected via init), which runs every guard, receipt, and
 * dual-write exactly as an in-band settle would. still_pending composes for
 * free — the settle handler's own defer elicitation runs over the same
 * out-of-band channel.
 *
 * Honest limits: real-host rendering of out-of-band pickers is per-host
 * empirical (spike README table); an unanswered ask times out to null and is
 * treated as a decline. Any internal failure is swallowed — an ambient extra
 * must never tax the session it rides on.
 */

const COOLDOWN_MS = 4 * 60 * 60 * 1000; // 세션(연결)을 넘는 재발사 간격
const DEFAULT_ASK_TIMEOUT_MS = 120_000; // 렌더 안 하는 호스트에서 조용히 접는 시한
const DEFAULT_QUIET_MS = 45_000; // 마지막 툴 호출 뒤 이만큼 조용하면 발사

function askTimeoutMs(): number {
  const raw = Number(process.env['ARGUS_AMBIENT_ASK_TIMEOUT_MS']);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_ASK_TIMEOUT_MS;
}

type SettleHandler = (args: Record<string, unknown>) => Promise<McpToolResult>;
type Serialize = <T>(fn: () => Promise<T>) => Promise<T>;

let _settleHandler: SettleHandler | null = null;
let _serialize: Serialize = (fn) => fn();
let _timer: ReturnType<typeof setTimeout> | null = null;
let _spent = false; // 프로세스당 질문 1개 — 한 자리에 한 질문
let _inFlight = false;

/** server.ts가 시동 시 배선한다. 미배선이면 arm은 완전 no-op (정직한 미연결). */
export function initAmbientElicit(deps: { settleHandler: SettleHandler; serialize?: Serialize }): void {
  _settleHandler = deps.settleHandler;
  if (deps.serialize) _serialize = deps.serialize;
}

/** 테스트 리셋 — 타이머·예산·배선을 모두 되돌린다. */
export function resetAmbientElicit(): void {
  if (_timer) clearTimeout(_timer);
  _timer = null;
  _spent = false;
  _inFlight = false;
  _settleHandler = null;
  _serialize = (fn) => fn();
}

function quietMs(): number {
  const raw = Number(process.env['ARGUS_AMBIENT_DELAY_MS']);
  return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_QUIET_MS;
}

function muted(dir: string): boolean {
  try {
    return /^ambient_mute:\s*true\b/m.test(fs.readFileSync(configPath(dir), 'utf8'));
  } catch {
    return false;
  }
}

const statePath = (dir: string): string => path.join(dir, 'ambient-elicit-state.json');

function underCooldown(dir: string): boolean {
  try {
    const st = JSON.parse(fs.readFileSync(statePath(dir), 'utf8')) as { last_fired_at?: number };
    return typeof st.last_fired_at === 'number' && Date.now() - st.last_fired_at < COOLDOWN_MS;
  } catch {
    return false; // 상태 부재·파손 = 이력 없음
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((res) => {
    const t = setTimeout(() => res(null), ms);
    t.unref?.();
    p.then(
      (v) => { clearTimeout(t); res(v); },
      () => { clearTimeout(t); res(null); },
    );
  });
}

/**
 * 디스패처가 매 툴 호출 뒤에 부른다 (fire-and-forget, 절대 던지지 않음).
 * 타이머는 디바운스 — 새 호출이 오면 리셋되어, Argus가 조용해진 뒤에만 발사.
 */
export function armAmbientElicit(toolName: string, args: Record<string, unknown>): void {
  try {
    if (!_settleHandler) return; // 미배선 = no-op
    if (toolName === 'argus_check_in') { _spent = true; return; } // due를 방금 봤다 — 예산 소진
    if (_spent || !canElicit()) return;

    let dir: string;
    try { dir = resolveToolArgusDir(args['argus_dir']); } catch { return; }
    const todayOverride = typeof args['today_override'] === 'string' ? args['today_override'] : undefined;

    if (_timer) clearTimeout(_timer);
    _timer = setTimeout(() => { void fire(dir, todayOverride); }, quietMs());
    _timer.unref?.();
  } catch { /* ambient는 절대 본 호출에 세금을 물리지 않는다 */ }
}

async function fire(dir: string, todayOverride?: string): Promise<void> {
  try {
    if (_spent || _inFlight || !_settleHandler || !canElicit()) return;
    if (muted(dir) || underCooldown(dir)) return;

    const today = resolveToday({ override: todayOverride });
    const state = replayLedger(dir, today);
    const first = state.overdue[0];
    if (!first) return; // due 0건 = 침묵 (빈 질문은 표현 불가)

    // 여기서부터는 시도 = 예산 소진. 상태 기록이 실패하면 발사하지 않는다 —
    // 상한 없는 질문보다 한 번 거르는 쪽이 안전하다 (driver 훅과 같은 자세).
    _spent = true;
    _inFlight = true;
    try { await atomicWriteJson(statePath(dir), { last_fired_at: Date.now() }); } catch { return; }

    const ko = resolveResponseLocale(dir) === 'ko';
    const text = sanitizeLine(first.text || first.id, 120);

    // 물음 1 — 정산 outcome (spine-SAFE 구조 픽: 현실이지 평결이 아니다).
    // 대화 맥락이 없는 사용자를 위해 그의 예측을 그대로 되비춘다 (우정 1조).
    const picked = await withTimeout(
      elicit(
        ko
          ? `Argus: 확인일이 지난 예측이 있어요. "${text}" (확인일 ${first.date}). 현실이 어떻게 답했나요? 지금 어려우면 닫아도 됩니다. 다시 조르지 않아요.`
          : `Argus: a prediction passed its check-by. "${text}" (due ${first.date}). What did reality do? Dismiss if now is a bad time; no re-asking.`,
        {
          type: 'object',
          // 필수 필드 없음 (2026-07-27) — 필수 enum은 호스트가 접어서 렌더하고
          // (펼치기 키가 하나 더 붙는다) 빈 Accept를 폼 안에서 빨갛게 막는다.
          // 여기선 특히 나쁘다: 이건 사용자가 부르지도 않았는데 뜨는 선제
          // 픽커라, 마찰 탈출구가 살아 있어야 한다. 빈 Accept는 아래에서
          // 거절과 같은 길로 흘러 아무것도 쓰지 않는다 — 정직한 공백.
          properties: {
            outcome: {
              type: 'string',
              enum: ['held', 'avoided', 'partial', 'still_pending', 'missed'],
              // Same labels as the in-band settle picker (settle.ts) — 풀어쓰기.
              // (Duplicated across the two picker sites; keep them in lockstep.)
              enumNames: ko
                ? ['예측대로 됐다', '걱정한 일은 안 일어났다', '일부만 맞았다', '아직 불분명', '예측이 빗나갔다']
                : ['It held', 'Avoided', 'Partially', 'Still unclear', 'Missed: my read was wrong'],
              description: ko ? '봉인한 예측에 현실이 어떻게 답했는지.' : 'What reality did to your sealed prediction.',
            },
          },
        },
      ),
      askTimeoutMs(),
    );
    const outcome = picked?.['outcome'];
    if (outcome !== 'held' && outcome !== 'avoided' && outcome !== 'partial' && outcome !== 'still_pending' && outcome !== 'missed') {
      return; // 거절·시간초과·미렌더 = 답이다. 아무것도 쓰지 않는다.
    }

    // still_pending은 실제 settle 핸들러의 defer elicitation이 같은 채널로
    // 이어서 묻는다 (두뇌 하나). 종결 outcome은 what_happened를 사용자의
    // 말로 받아야만 기록한다 — 비면 기록하지 않는다 (날조 금지, 정직한 공백).
    let whatHappened: string | undefined;
    if (outcome !== 'still_pending') {
      const wh = await withTimeout(
        elicit(
          ko
            ? '실제로 무슨 일이 있었나요? 한 줄이면 됩니다. 당신의 말 그대로 기록됩니다.'
            : 'What actually happened, in one line? Recorded verbatim, in your words.',
          {
            type: 'object',
            // 필수 필드 없음 — 같은 이유. 비우고 Accept하면 아래에서
            // 기록하지 않는다(날조 금지). 폼이 막을 일이 아니다.
            properties: {
              what_happened: {
                type: 'string',
                description: ko ? '당신의 말, 그대로.' : 'Your words, verbatim.',
              },
            },
          },
        ),
        askTimeoutMs(),
      );
      whatHappened = typeof wh?.['what_happened'] === 'string' ? (wh['what_happened'] as string).trim() : '';
      if (!whatHappened) return; // 현실 서술 없이는 종결 정산을 쓰지 않는다
    }

    // 기록은 실제 settle 핸들러로 — 가드·영수증·이중쓰기 전부 본 경로 그대로.
    // 툴 호출 직렬화 사슬에 태워 원장 read-replay-append가 절대 끼어들지 않게.
    const result = await _serialize(() =>
      _settleHandler!({
        argus_dir: dir,
        id: first.id,
        outcome,
        outcome_source: 'user_stated',
        ...(whatHappened ? { what_happened: whatHappened } : {}),
        ...(todayOverride ? { today_override: todayOverride } : {}),
      }),
    );
    if (result.isError) logError('[ambient-elicit] settle refused', (result.structuredContent as Record<string, unknown> | undefined)?.['error_code']);
  } catch (e) {
    logError('[ambient-elicit] fire failed', e);
  } finally {
    _inFlight = false;
  }
}
