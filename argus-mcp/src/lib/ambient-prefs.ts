import fs from 'fs';
import os from 'os';
import path from 'path';
import { STANDING_SENSE_REFRESH } from './spine.js';

/**
 * 감도 다이얼의 MCP 쪽 절반 (A-part-2, 창업자 지시 2026-07-22).
 *
 * 플러그인(sense-signal.js)은 매턴 훅이 있어 감도를 '캡 스케일'로 돌리지만,
 * raw MCP엔 턴 훅이 없다 — 여기서 할 수 있는 정직한 최대치는 사용자가 저장한
 * 선호를 STANDING_SENSE_REFRESH(모든 툴 결과에 동봉되는 배경감각 재장전 줄)에
 * 한 줄 편향으로 얹는 것이다. 정본은 플러그인과 **같은 파일**
 * (`${ARGUS_HOME|~/.argus}/config.json`의 `ambient.sensitivity`/`ambient.opt_out`)
 * — 두 표면이 다른 값을 읽는 순간 다이얼은 거짓말이 된다.
 *
 * 스파인 경계: 이 편향은 "무엇을 판단하라"가 아니라 "얼마나 자주 offer하라"만
 * 만진다(사용자가 자기 경험을 조율하는 마찰 손잡이 — zero-judgment 위반 아님).
 * 값은 enum으로만 해석하고 원시 문자열은 절대 지시문에 섞지 않는다. opt_out도
 * 정산(사용자가 말한 결과의 부기)은 끄지 않는다 — 그건 감도 무관 부기다.
 */

export interface AmbientPrefs {
  sensitivity: 'low' | 'normal' | 'high';
  optOut: boolean;
}

export function readAmbientPrefs(): AmbientPrefs {
  const fallback: AmbientPrefs = { sensitivity: 'normal', optOut: false };
  try {
    const home = process.env['ARGUS_HOME'] || path.join(os.homedir(), '.argus');
    const cfg = JSON.parse(fs.readFileSync(path.join(home, 'config.json'), 'utf8')) as Record<string, unknown>;
    const amb = cfg && typeof cfg['ambient'] === 'object' && cfg['ambient'] !== null
      ? (cfg['ambient'] as Record<string, unknown>) : null;
    if (!amb) return fallback;
    const s = amb['sensitivity'];
    return {
      sensitivity: s === 'low' || s === 'high' ? s : 'normal',
      optOut: amb['opt_out'] === true,
    };
  } catch {
    return fallback; // 설정 없음/파손 = 기본 감도 (조용한 기본, 시끄러운 실패 불필요 — 선호 부재는 gap이 아니다)
  }
}

const LOW_SUFFIX =
  ' (User sensitivity preference: LOW — offer only on the very clearest consequential commitments; when in any doubt, stay silent.)';
const HIGH_SUFFIX =
  ' (User sensitivity preference: HIGH — they asked for more surfacing; the restraint gate still applies, but on a consequential call do not skip the one offer out of excess caution.)';
const OFF_SUFFIX =
  ' (User preference: ambient offers are OFF — make no unsolicited predict/capture offers. Recording an outcome the user themselves states is bookkeeping and stays on.)';

/** 감도 선호를 반영한 배경감각 줄 — 모든 주입 지점은 이걸 쓴다(직접 상수 금지). */
export function tunedStandingSense(): string {
  const p = readAmbientPrefs();
  if (p.optOut) return STANDING_SENSE_REFRESH + OFF_SUFFIX;
  if (p.sensitivity === 'low') return STANDING_SENSE_REFRESH + LOW_SUFFIX;
  if (p.sensitivity === 'high') return STANDING_SENSE_REFRESH + HIGH_SUFFIX;
  return STANDING_SENSE_REFRESH;
}
