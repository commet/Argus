import fs from 'fs';
import path from 'path';
import { elicitDetailed, canElicit } from './elicit.js';
import { replayLedger } from './ledger-replay.js';
import { resolveToday } from './resolve-today.js';
import { resolveResponseLocale } from './surfaces.js';
import { resolveToolArgusDir } from './argus-dir.js';
import { configPath } from './layout.js';
import { atomicWriteJson } from './atomic-write.js';
import { logError } from './log.js';
import { sanitizeLine } from '../v2/sanitize.js';
import { OUTCOME_VALUES, outcomeEnumNames, outcomeFieldDescription } from './outcome-labels.js';
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
/**
 * 다음 툴 결과 끝에 한 번 붙일 확인 한 줄 (아래 attachAmbientNote).
 *
 * argus_dir로 키를 잡는다: 한 세션이 프로젝트 두 개를 오갈 수 있는데, A 프로젝트의
 * 예측 문장이 B 프로젝트 작업 중에 튀어나오면 그건 확인이 아니라 다른 방 이야기의
 * 유출이다. 답을 받은 그 원장으로 돌아왔을 때만 말한다.
 */
let _pendingNote: { dir: string; text: string } | null = null;

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
  _pendingNote = null;
  _settleHandler = null;
  _serialize = (fn) => fn();
}

/**
 * 밖에서 물어본 답의 결말을 다음 툴 결과 한 줄로 돌려준다 (감사 2026-07-27).
 *
 * out-of-band 픽커는 툴 호출 밖에서 뜨므로, 사용자가 답을 넣어도 화면엔 아무
 * 변화가 없었다 — 성공했는지 실패했는지 알 길이 없는 채로 자기 판단을 던진
 * 셈이다. 확인용 팝업을 한 번 더 띄우는 건 의식(ceremony)이라 하지 않고,
 * 사용자가 이미 여기 와 있는 다음 순간 — 다음 툴 호출 — 에 사실 한 줄만 붙인다.
 *
 * 한 번 쓰고 비운다 (같은 확인을 두 번 보여주지 않는다). 실패해도 본 호출은
 * 그대로 — ambient는 절대 본 호출에 세금을 물리지 않는다.
 */
export function attachAmbientNote(result: McpToolResult, argusDir: string | null): McpToolResult {
  try {
    if (!_pendingNote) return result;
    if (!argusDir || argusDir !== _pendingNote.dir) return result; // 다른 원장 — 그 방 이야기는 그 방에서
    const sc = result.structuredContent as Record<string, unknown> | undefined;
    if (!sc || sc['ok'] !== true || typeof sc['surface'] !== 'string') return result;
    const note = _pendingNote.text;
    _pendingNote = null;
    sc['surface'] = String(sc['surface']) + note;
    (sc['data'] as Record<string, unknown> | undefined ?? (sc['data'] = {}) as Record<string, unknown>)['ambient_answer_note'] = true;
    result.content = [{ type: 'text', text: JSON.stringify(sc, null, 2) }];
    return result;
  } catch {
    return result;
  }
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

function readState(dir: string): { last_fired_at?: number } | null {
  try {
    return JSON.parse(fs.readFileSync(statePath(dir), 'utf8')) as { last_fired_at?: number };
  } catch {
    return null; // 상태 부재·파손 = 이력 없음
  }
}

function underCooldown(dir: string): boolean {
  const st = readState(dir);
  return !!st && typeof st.last_fired_at === 'number' && Date.now() - st.last_fired_at < COOLDOWN_MS;
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
    const priorState = readState(dir); // 되돌리기용 — 아래 rollback 참조
    try { await atomicWriteJson(statePath(dir), { last_fired_at: Date.now() }); } catch { return; }

    /**
     * 아무에게도 닿지 않은 물음은 쿨다운을 쓰지 않는다 (감사 2026-07-27).
     *
     * `elicitation`을 선언해놓고 실제로는 거부하는 호스트가 있다 (메서드 없음,
     * 전송 끊김). 그 경우 요청은 프로세스 밖으로 나가지도 않았는데 4시간 침묵이
     * 걸렸다 — 묻지도 않고 입을 막은 것이다. 화면이 실제로 떴을 수 있는
     * 경우(취소·시간초과)는 그대로 소진으로 둔다: 사용자를 방해한 건 사실이니까.
     */
    const rollbackCooldown = async (): Promise<void> => {
      try {
        if (priorState) await atomicWriteJson(statePath(dir), priorState);
        else await fs.promises.rm(statePath(dir), { force: true });
        _spent = false;
      } catch { /* 되돌리기 실패는 과침묵 — 안전한 쪽 */ }
    };

    const ko = resolveResponseLocale(dir) === 'ko';
    const text = sanitizeLine(first.text || first.id, 96);

    // 물음 1 — 정산 outcome (spine-SAFE 구조 픽: 현실이지 평결이 아니다).
    // 대화 맥락이 없는 사용자를 위해 그의 예측을 그대로 되비춘다 (우정 1조).
    const asked = await withTimeout(
      elicitDetailed(
        // Structured, not a paragraph (2026-07-28). This arrived as one run-on
        // line with the user's own prediction buried mid-sentence — and this is
        // the ask that appears when they did NOT ask for anything, mid-work.
        // Whatever it costs them in attention, it should at least be scannable.
        ko
          ? `Argus · 확인일이 지난 예측이 있어요.
"${text}" (확인일 ${first.date})

현실이 어떻게 답했나요? → 키로 고른 뒤, 아래 화살표로 수락 줄까지 내려가 선택하십시오. 지금 어려우면 그냥 닫으세요. 다시 조르지 않습니다.`
          : `Argus · a prediction passed its check-by.
"${text}" (due ${first.date})

What did reality do? Pick one with →, then press Enter twice to reach Accept. Just close this if now is a bad time; no re-asking.`,
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
              enum: [...OUTCOME_VALUES],
              // One definition, shared with the in-band picker (outcome-labels.ts).
              // These used to be written out here a second time with a comment
              // asking editors to keep them in lockstep by hand; a third,
              // different wording lived in the settle card. Same user, same week.
              enumNames: outcomeEnumNames(ko ? 'ko' : 'en'),
              title: ko ? '현실이 어떻게 답했나' : 'What reality did',
              description: outcomeFieldDescription(ko ? 'ko' : 'en'),
            },
          },
        },
        askTimeoutMs(),
      ),
      askTimeoutMs(),
    );
    // 호스트가 elicitation을 선언해놓고 거부했다 = 사용자는 아무것도 못 봤다.
    // 이 침묵은 사용자의 답이 아니므로 쿨다운을 되돌린다.
    //
    // 시간초과(withTimeout의 null)는 여기 포함하지 않는다 — 화면이 떴는데
    // 사용자가 지금은 답할 마음이 아닌 경우와 구분할 수 없고, 구분이 안 될 때의
    // 안전한 쪽은 침묵이다 (mirror clause: 개입할지를 대신 판단하지 않는다).
    // 취소도 같은 이유로 소진 그대로 — 창을 닫은 건 사람일 수 있다.
    if (asked && (asked.kind === 'unsupported' || (asked.kind === 'no_answer' && asked.reason === 'failed'))) {
      await rollbackCooldown();
      return;
    }
    const picked = asked && asked.kind === 'accepted' ? asked.content : null;
    const outcome = picked?.['outcome'];
    if (outcome !== 'held' && outcome !== 'avoided' && outcome !== 'partial' && outcome !== 'still_pending' && outcome !== 'missed') {
      return; // 거절·취소·시간초과 = 답이다. 아무것도 쓰지 않는다.
    }

    // still_pending은 실제 settle 핸들러의 defer elicitation이 같은 채널로
    // 이어서 묻는다 (두뇌 하나). 종결 outcome은 what_happened를 사용자의
    // 말로 받아야만 기록한다 — 비면 기록하지 않는다 (날조 금지, 정직한 공백).
    let whatHappened: string | undefined;
    if (outcome !== 'still_pending') {
      const wh = await withTimeout(
        elicitDetailed(
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
                title: ko ? '실제로 무슨 일이 있었나' : 'What actually happened',
                description: ko ? '당신의 말, 그대로.' : 'Your words, verbatim.',
              },
            },
          },
          askTimeoutMs(),
        ),
        askTimeoutMs(),
      );
      const whContent = wh && wh.kind === 'accepted' ? wh.content : null;
      whatHappened = typeof whContent?.['what_happened'] === 'string' ? (whContent['what_happened'] as string).trim() : '';
      // 여기서 비면 정말로 아무것도 안 쓴다 — 그런데 사용자는 이미 결과를 골랐다.
      // 그 한 번의 클릭이 허공으로 사라지지 않도록, 다음 툴 호출에 붙일 한 줄을
      // 남긴다 (아래 pendingNote). 날조 금지는 그대로: 기록은 안 한다.
      if (!whatHappened) {
        _pendingNote = { dir, text: ko
          ? `\n\n(아까 "${text}" 결과를 고르셨는데, 무슨 일이 있었는지는 못 받았습니다. 한 줄만 말씀해주시면 그때 기록합니다.)`
          : `\n\n(You picked an outcome for "${text}" earlier, but the one-line what-happened never arrived. Say it in a line and I'll record it then.)` };
        return;
      }
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
    // 결과를 사용자에게 돌려준다 (감사 2026-07-27). 이 물음은 툴 호출 밖에서
    // 떴기 때문에 답을 넣어도 화면에는 아무 일도 안 일어났다 — 사용자 입장에선
    // 자기 판단을 허공에 던진 것이다. out-of-band 채널로 확인을 또 띄우는 건
    // 팝업 두 번(의식)이라 안 한다. 대신 다음 툴 호출의 surface 끝에 한 줄로
    // 붙인다: 사용자가 이미 여기 있는 유일한 순간이 그때다 (due-note와 같은 자세).
    const code = (result.structuredContent as Record<string, unknown> | undefined)?.['error_code'];
    if (result.isError) {
      logError('[ambient-elicit] settle refused', code);
      _pendingNote = { dir, text: ko
        ? `\n\n(아까 답해주신 "${text}" 기록이 실패했습니다 (${String(code ?? 'unknown')}). 다시 알려주시면 그때 기록합니다.)`
        : `\n\n(The answer you gave earlier on "${text}" could not be recorded (${String(code ?? 'unknown')}). Tell me again and I'll record it then.)` };
    } else {
      _pendingNote = { dir, text: ko
        ? `\n\n(아까 답해주신 "${text}" 기록했습니다.)`
        : `\n\n(Recorded the answer you gave earlier on "${text}".)` };
    }
  } catch (e) {
    logError('[ambient-elicit] fire failed', e);
  } finally {
    _inFlight = false;
  }
}
