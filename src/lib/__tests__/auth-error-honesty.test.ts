/**
 * 로그인 오류 문구의 정직성 — 원인이 다르면 문구도 달라야 한다.
 *
 * **왜 이게 중요한가.** 인증 오류는 사용자가 스스로 고칠 수 있는 유일한 종류의
 * 실패다. 그런데 서로 다른 원인을 한 문구로 뭉개면 사용자는 무엇을 해야 할지
 * 알 수 없고, 문구는 있으나 마나가 된다 — 화면은 "친절하게" 실패하지만
 * 실질적으로는 침묵한 것과 같다. LLM-glue 불변식이 말하는 "정직한 공백"의
 * 인증판이다.
 *
 * 실제로 겪은 것 (2026-08-09): `Email not confirmed` 가 **가입 실패 문구**로
 * 매핑돼 있었다. 확인 메일을 안 누른 사람이 로그인하면 "가입을 완료할 수
 * 없습니다. 이미 계정이 있다면 로그인해주세요" 를 보게 된다 — 지금 로그인
 * 중인데. 막다른 골목이고, 해야 할 일(받은편지함의 링크)은 어디에도 없었다.
 *
 * 열거(enumeration) 방지와의 경계도 여기 못박는다. 가입에서 "이미 있는
 * 계정입니다"를 알리는 것은 이메일 존재를 누설하므로 모호해야 맞다. 반면
 * 로그인에서 `Email not confirmed` 는 **자격증명이 맞을 때만** 나오므로,
 * 그 문구를 보는 사람은 이미 비밀번호를 아는 사람이다 — 숨길 것이 없다.
 * 두 경우에 같은 규칙을 적용하면 한쪽은 반드시 틀린다.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const SRC = 'src/lib/auth.tsx';
const TEXT = readFileSync(SRC, 'utf8');

/** `{ match: 'X', ko: '…', en: '…' }` 항목들을 읽는다. */
function authErrors(): Array<{ match: string; ko: string; en: string }> {
  const out: Array<{ match: string; ko: string; en: string }> = [];
  const re =
    /\{\s*match:\s*'([^']+)',\s*ko:\s*'((?:[^'\\]|\\.)*)',\s*en:\s*"((?:[^"\\]|\\.)*)"\s*,?\s*\}|\{\s*match:\s*'([^']+)',\s*ko:\s*'((?:[^'\\]|\\.)*)',\s*en:\s*'((?:[^'\\]|\\.)*)'\s*,?\s*\}/g;
  for (const m of TEXT.matchAll(re)) {
    out.push({
      match: m[1] ?? m[4],
      ko: m[2] ?? m[5],
      en: m[3] ?? m[6],
    });
  }
  return out;
}

const ERRORS = authErrors();
const byMatch = (s: string) => ERRORS.find((e) => e.match === s);

describe('인증 오류 문구', () => {
  it('스캐너가 실제로 표를 읽었다 (형식이 바뀌면 조용히 무력해지는 것을 막는다)', () => {
    expect(ERRORS.length).toBeGreaterThanOrEqual(5);
    expect(byMatch('Invalid login credentials')).toBeTruthy();
    expect(byMatch('Email not confirmed')).toBeTruthy();
  });

  it('모든 항목이 ko·en 양쪽을 갖는다 (한쪽 언어만 채워 두면 반대 언어 사용자는 원문 오류를 본다)', () => {
    const missing = ERRORS.filter((e) => !e.ko.trim() || !e.en.trim()).map((e) => e.match);
    expect(missing, `번역이 빠진 항목:\n${missing.join('\n')}`).toEqual([]);
  });

  it('미확인 이메일은 가입 실패 문구를 재사용하지 않는다', () => {
    const unconfirmed = byMatch('Email not confirmed')!;
    const registered = byMatch('User already registered')!;
    // 같은 문구를 쓰면 로그인하려는 사람이 "가입하라/로그인하라"는 순환을 본다.
    expect(unconfirmed.ko).not.toBe(registered.ko);
    expect(unconfirmed.en).not.toBe(registered.en);
  });

  it('미확인 이메일 문구가 사용자가 **할 수 있는 일**을 말한다', () => {
    const { ko, en } = byMatch('Email not confirmed')!;
    // 원인만 말하고 행동을 안 알려주면 사용자는 여전히 막혀 있다.
    expect(ko, '받은편지함/확인 링크로 안내해야 합니다').toMatch(/확인 링크|받은편지함|메일함/);
    expect(en.toLowerCase()).toMatch(/confirmation link|confirm|inbox/);
  });

  it('자격증명 오류는 계정 존재 여부를 누설하지 않는다', () => {
    const { ko, en } = byMatch('Invalid login credentials')!;
    // "그런 계정이 없습니다" 류는 열거 채널이 된다 — 이메일과 비밀번호를
    // 한 덩어리로 두는 것이 맞다.
    expect(ko).not.toMatch(/없는 계정|가입되지 않은|존재하지 않/);
    expect(en.toLowerCase()).not.toMatch(/no such account|not registered|does not exist/);
  });

  it('가입에서 "이미 있는 계정"은 계속 모호하다 (여기서는 모호함이 옳다)', () => {
    const { ko } = byMatch('User already registered')!;
    // 이쪽은 비밀번호를 몰라도 볼 수 있으므로 존재를 확정해 주면 안 된다.
    expect(ko).not.toMatch(/이미 가입된 이메일|이미 존재하는 계정/);
  });
});
