// @vitest-environment jsdom
/**
 * 계정 경계 (account scope) — 2026-07-30 근원 분석의 예방 장치.
 *
 * 실제 사망: 브라우저가 계정 A로 쓰다 세션이 끊기고 계정 B로 로그인하자, A의
 * 행들을 B 이름으로 밀어넣는 배치가 RLS(42501)에 거부되고 — 한 배치는 한
 * 문장이라 B의 정상 행까지 같이 롤백 — 그 뒤 모든 로드에서 같은 실패가
 * 영구 반복됐다. 배지는 "백업 보류"에서 절대 벗어날 수 없었다.
 *
 * 이 테스트가 지키는 것은 세 가지다: (1) 익명→계정 경로는 절대 오탐이 아니다
 * (그 경로는 서버 이관으로 정상 작동함이 실측됐다), (2) 도장이 다르면 벌크
 * 쓰기 전에 멈춘다, (3) 정리 목록이 동기화 계약과 어긋나지 않는다 — 빠진 키
 * 하나가 초기화 후 살아남아 다음 계정을 다시 오염시킨다.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ACCOUNT_SCOPED_KEYS,
  discardForeignLocalData,
  foreignRowCounts,
  getForeignIds,
  isForeignOwnerError,
  localDataBelongsToAnotherAccount,
  markForeignRows,
  otherAccountLabel,
  readDataOwner,
  stampDataOwner,
} from '@/lib/account-scope';
import { STORAGE_KEYS } from '@/lib/storage';

const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';

beforeEach(() => localStorage.clear());

describe('주인 도장', () => {
  it('도장이 없으면 불일치가 아니다 — 익명 방문자와 기존 브라우저 전부가 이 상태다', () => {
    expect(readDataOwner()).toBeNull();
    expect(localDataBelongsToAnotherAccount(A)).toBe(false);
  });

  it('같은 계정으로 다시 로그인하면 불일치가 아니다', () => {
    stampDataOwner(A, 'a@example.com');
    expect(localDataBelongsToAnotherAccount(A)).toBe(false);
  });

  it('다른 계정으로 로그인하면 불일치이고, 앞 계정을 이름으로 말할 수 있다', () => {
    stampDataOwner(A, 'a@example.com');
    expect(localDataBelongsToAnotherAccount(B)).toBe(true);
    expect(readDataOwner()?.email).toBe('a@example.com');
  });

  it('로그아웃 상태(userId 없음)에서는 불일치를 주장하지 않는다', () => {
    stampDataOwner(A);
    expect(localDataBelongsToAnotherAccount(null)).toBe(false);
    expect(localDataBelongsToAnotherAccount(undefined)).toBe(false);
  });
});

describe('서버가 확정한 남의 행 (42501)', () => {
  it('RLS 거부를 코드로도, 문구로도 알아본다', () => {
    expect(isForeignOwnerError({ code: '42501' })).toBe(true);
    expect(isForeignOwnerError({
      message: 'new row violates row-level security policy (USING expression) for table "projects"',
    })).toBe(true);
  });

  it('다른 실패를 남의 행으로 오인하지 않는다 — 오인하면 진짜 실패가 조용히 격리된다', () => {
    expect(isForeignOwnerError({ code: 'PGRST204', message: "Could not find the 'contact' column" })).toBe(false);
    expect(isForeignOwnerError({ message: 'Failed to fetch' })).toBe(false);
    expect(isForeignOwnerError(null)).toBe(false);
  });

  it('격리는 누적되고 중복되지 않는다', () => {
    markForeignRows('projects', ['p1', 'p2']);
    markForeignRows('projects', ['p2', 'p3']);
    markForeignRows('personas', ['x1']);
    expect([...getForeignIds('projects')].sort()).toEqual(['p1', 'p2', 'p3']);
    expect(foreignRowCounts()).toEqual({ rows: 4, projects: 3 });
  });
});

describe('알림이 부를 계정 이름', () => {
  it('도장이 지금 로그인한 계정과 같으면 이름을 부르지 않는다 (내 주소를 "다른 계정"이라 부르는 실측 버그)', () => {
    // 도장 없는 낡은 브라우저는 첫 로그인에서 현재 사용자로 도장이 찍힌 뒤에야
    // 첫 거부가 일어난다 — 그대로 읽으면 자기 주소가 남의 계정으로 표시된다.
    expect(otherAccountLabel('b@example.com', 'b@example.com')).toBeUndefined();
    expect(otherAccountLabel('B@Example.com', 'b@example.com')).toBeUndefined();
  });

  it('정말 다른 계정일 때만 이름을 부른다', () => {
    expect(otherAccountLabel('a@example.com', 'b@example.com')).toBe('a@example.com');
    expect(otherAccountLabel(undefined, 'b@example.com')).toBeUndefined();
    expect(otherAccountLabel('a@example.com', null)).toBe('a@example.com');
  });
});

describe('이 기기에서 정리', () => {
  it('계정 소유 행은 지우고, 사용자 소유 설정은 건드리지 않는다', () => {
    localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify([{ id: 'p1' }]));
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify({ apiKey: 'sk-user-own' }));
    markForeignRows('projects', ['p1']);
    stampDataOwner(A, 'a@example.com');

    discardForeignLocalData(B, 'b@example.com');

    expect(localStorage.getItem(STORAGE_KEYS.PROJECTS)).toBeNull();
    // 사용자 자기 API 키까지 날리면 "정리"가 아니라 사고다.
    expect(localStorage.getItem(STORAGE_KEYS.SETTINGS)).toContain('sk-user-own');
    expect(foreignRowCounts().rows).toBe(0);
    expect(readDataOwner()).toEqual({ userId: B, email: 'b@example.com' });
  });

  it('정리 목록은 동기화 계약의 synced 집합과 정확히 같다 (한 키만 빠져도 다음 계정이 다시 오염된다)', () => {
    const contractSrc = readFileSync(
      join(process.cwd(), 'src/lib/__tests__/persistence-contract.test.ts'),
      'utf8',
    );
    const contractBody = contractSrc.slice(
      contractSrc.indexOf('const CONTRACT'),
      contractSrc.indexOf('const ROGUE_ALLOWLIST'),
    );
    const syncedNames = [...contractBody.matchAll(/^\s{2}([A-Z0-9_]+):\s*\{\s*table:/gm)].map((m) => m[1]);
    expect(syncedNames.length, 'synced 선언을 하나도 못 읽었다 — 이 가드가 아무것도 검사하지 않는다').toBeGreaterThan(10);

    const expected = syncedNames
      .map((n) => STORAGE_KEYS[n as keyof typeof STORAGE_KEYS])
      .filter(Boolean)
      .sort();
    expect([...ACCOUNT_SCOPED_KEYS].sort()).toEqual(expected);
  });
});
