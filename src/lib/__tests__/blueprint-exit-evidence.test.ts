/**
 * BLUEPRINT exit-체크 증거 계약 (2026-07-08 근원 분석에서 추가).
 *
 * 왜: exit 체크박스는 산문이라 `[ ]`→`[x]`가 공짜 행동이었다 — 시공한
 * 에이전트가 자기 성적표를 쓰고, "토막 테스트 됨"을 "여정 됨"으로 올려 적어도
 * 아무것도 빨개지지 않았다 (공정 3/4 완료 선언 감사에서 실증: 체크된 exit
 * 2건이 부분 미달, 1건은 검증 자체가 없었음). LLM-glue invariant 그대로 —
 * 완료 "선언"도 기계가 감시하지 않으면 조용히 부풀려진다.
 *
 * 계약: docs/ARGUS-BLUEPRINT.md §6의 공정별 `[x]` 개수 == 아래 EVIDENCE 맵의
 * 항목 수. 각 증거는 (a) 리포에 실존하는 기계 증거 경로이거나 (b) `manual:`로
 * 시작하는 정직한 수동-검증 기록(무엇을/어느 세션이 확인했나)이다. 박스를
 * 체크하려면 같은 커밋에서 이 맵에 증거를 추가해야 한다 — 안 하면 여기가
 * 빨개진다. 박스를 되돌리면(취소) 맵에서도 지워야 한다.
 */

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** 공정별 exit 증거. 순서는 BLUEPRINT의 체크박스 순서를 따른다. */
const EVIDENCE: Record<string, string[]> = {
  '공정 0': [
    'manual: docs/ 최상위 정본 8편 — 공정 0 아카이브 스윕 커밋에서 이동 확인',
    'CLAUDE.md', // 빌드 정본 포인터 문단
    'src/app/[locale]/admin/page.tsx', // 표면별 4단 퍼널
    'manual: 내비 강등(항구·워크스페이스·설정만) — 공정 0 세션 육안 확인',
  ],
  '공정 1': [
    'src/lib/__tests__/process1-journey-fixture.test.ts', // BS-5 여정 fixture
    'manual: ko 영수증 전문 한국어 스크린샷 — 공정 1 세션 캡처',
    'manual: missed→missed SQL 대조 — 공정 1 세션 실DB 확인',
    'manual: 만료 토큰 seal surface 실패 1줄 — 공정 1 세션 확인',
    'manual: 이메일 CTA 1클릭=4-tap 실메일 캡처 — 공정 1 세션',
  ],
  '공정 2': [
    'src/lib/__tests__/notification-gate-reflection.test.ts', // 6 cron gate 통과
    'src/lib/__tests__/checkpoint-loop-contract.test.ts', // 30초 계약
    'src/lib/__tests__/first-settlement.test.ts', // 첫 귀환 ≤ 7일 (T4 트리거)
    'src/lib/__tests__/companion-brief.test.ts', // 빈 브리프 0건
    'manual: 정산 화면 라이트/다크 스냅샷 — 공정 2 세션 브라우저 검증',
  ],
  '공정 3': [
    'src/lib/__tests__/premise-drift-journey.test.tsx', // 감지→gate→이메일→화면 여정
    'src/lib/__tests__/notification-copy-validator.test.ts', // 해석 어휘 validator
  ],
  '공정 4': [
    'src/app/d/[token]/__tests__/opengraph-image.test.tsx', // OG 카드 렌더 캡처
    'src/app/api/share/link/__tests__/route.test.ts', // 기본 비공개
    'src/lib/__tests__/demo-settle-latency.test.ts', // 데모 확인일 ≤ 7일
  ],
  // 공정 5 (첫인상 수리, 2026-07-08 신설) — 아직 체크된 exit 없음.
  '공정 5': [],
};

/** §9 MCP 재건축 트랙(공정 M0~M4)의 exit 증거 — 같은 계약, 같은 규약.
 *  §9는 §6과 헤딩 형식이 다르므로(볼드 문단) 별도 파서로 감시한다 —
 *  M-트랙을 사각지대로 두면 이 테스트가 존재하는 이유가 무색해진다. */
const EVIDENCE_M: Record<string, string[]> = {
  '공정 M0': [
    'argus-mcp/src/lib/__tests__/resolve-tool-argus-dir.test.ts', // 무설정 첫 도구 호출 → ~/.argus fixture
    'argus-mcp/src/lib/__tests__/resolve-tool-argus-dir.test.ts', // 미확장 ${...} 전용 에러
    'argus-mcp/src/tools/__tests__/m0-doors-and-language.test.ts', // ko 여정 receipt_text 전문 한국어
    'argus-mcp/src/tools/__tests__/m0-doors-and-language.test.ts', // check_in due 상한
    'src/lib/__tests__/companion-brief.test.ts', // 이메일 페이로드에 터미널 명령
  ],
  '공정 M1': [
    'argus-mcp/src/tools/__tests__/m1-watch-loop.test.ts', // 당직 여정 fixture
    'argus-mcp/src/tools/__tests__/m1-watch-loop.test.ts', // 앵커 비산입
    'argus-mcp/src/tools/__tests__/m1-watch-loop.test.ts', // 어휘 가드 (recheck 포함)
  ],
  '공정 M2': [
    'argus-mcp/src/tools/__tests__/m2-bridges.test.ts', // capture→봉인→정산 승격 여정
    'argus-mcp/src/tools/__tests__/m2-bridges.test.ts', // 웹 정산 발산 0 (import_settlements)
    'argus-mcp/src/tools/__tests__/m2-bridges.test.ts', // fleet 두 프로젝트 fixture
  ],
  '공정 M3': [
    'argus-mcp/src/tools/__tests__/m3-safety.test.ts', // BS-1 두 원장 같은 slug 충돌 0
    'argus-mcp/src/tools/__tests__/m3-safety.test.ts', // 동시 이중 settle 한 건만
    'src/lib/__tests__/mcp-premise-optin-journey.test.ts', // opt-in 전제 → T2 게이트 도달
  ],
  '공정 M4': [
    'src/components/import/__tests__/McpInstallGuide.test.tsx', // /import Windows 블록 렌더
  ],
};

/** §9.7 전면 개편 위계(공정 O0~O5)의 exit 증거 — 같은 계약. O-트랙 헤딩도
 *  M-트랙과 같은 볼드 문단 형식이라 별도 파서로 감시한다 (M-트랙 신설 때의
 *  교훈 그대로: 새 트랙을 사각지대로 두면 이 테스트의 존재 이유가 무색해진다). */
const EVIDENCE_O: Record<string, string[]> = {
  '공정 O0': [], // 헌법 동결 — 체크박스 없음 (완료 = §9.7 커밋 자체)
  '공정 O1': [
    'argus-mcp/src/tools/__tests__/journey-o1.test.ts', // 설치→봉인→재시작→귀환→정산 ko/en 여정
    'argus-mcp/src/lib/__tests__/os-locale-hint.test.ts', // 스위트 결정성 — env 규칙 매트릭스 + 격리 카나리아 (홈/로케일)
    'argus-mcp/src/lib/__tests__/locale-mismatch-note.test.ts', // 대화-언어 불일치 1회 확인
  ],
  '공정 O2': [
    'argus-mcp/src/lib/__tests__/core-boundary.test.ts', // canonical append 단독 (O_APPEND census) + 경계 게이트
    'argus-mcp/src/lib/__tests__/cross-surface-contract.test.ts', // 같은 fixture → 3두뇌 동일 해석 + 쓰기 규율 계약
  ],
  '공정 O3': [
    'argus-mcp/src/v2/one-install.test.ts', // 하나의 설치 — marketplace 1항목 + .mcp.json·훅·doctor 번들 + driver 잔재 0
    'argus-mcp/src/v2/activation-contract.test.ts', // 자동 deep review 0 — 문 잠금(disable-model-invocation)·fan-out 폐포·메뉴 5+2
  ],
  '공정 O4': [],
  '공정 O5': [],
};

/** §9.8 자기지식·AI 영향 권한 트랙 E의 phase별 exit 증거. */
const EVIDENCE_E: Record<string, string[]> = {
  E0: [
    'docs/EVIDENCE-epistemic-agency-e0-baseline-2026-07-17.md',
    'src/lib/__tests__/epistemic-agency-e0-baseline.test.ts',
    'docs/EVIDENCE-epistemic-agency-e0-baseline-2026-07-17.md',
  ],
  E1: [
    'src/lib/__tests__/epistemic-agency-e0-baseline.test.ts',
    'src/lib/__tests__/voyage-log.test.ts',
    'src/lib/__tests__/voyage-log-export.test.ts',
  ],
  E2: [
    'src/lib/__tests__/epistemic-agency-e2-control-plane.test.ts',
    'src/lib/__tests__/epistemic-agency-e2-control-plane.test.ts',
    'src/lib/__tests__/epistemic-agency-e2-control-plane.test.ts',
    'src/lib/__tests__/epistemic-agency-e0-baseline.test.ts',
  ],
};

/** §9.9 병렬 트랙 V(연동·시각화)의 phase별 exit 증거 — 같은 규약. V-트랙을
 *  사각지대로 두면 M/O/E와 똑같이 완료 선언이 부풀 수 있으므로 함께 감시한다. */
const EVIDENCE_V: Record<string, string[]> = {
  V1: [
    'argus-plugin-v2/scripts/push-webapp.test.mjs', // 승인 탭 1클릭 연동(복붙 0) — device/browser 흐름 블랙박스
    'argus-plugin-v2/scripts/push-webapp.test.mjs', // 첫 seal 자동 트리거(--ensure-connect) + decline restraint
    'manual: 2026-07-21 창업자 실주행 — argus.voyage device 승인 후 push, admin의 plugin_bearings·plugin_decisions 0→1 육안 확인',
  ],
};

function readBlueprintMTrackSections(): Map<string, string> {
  const md = readFileSync(join(process.cwd(), 'docs/ARGUS-BLUEPRINT.md'), 'utf8');
  const s9Start = md.indexOf('## §9.');
  if (s9Start === -1) return new Map(); // §9 없으면 M-트랙도 없다
  const s9 = md.slice(s9Start, md.indexOf('## 마지막 장'));
  const sections = new Map<string, string>();
  const headings = [...s9.matchAll(/^\*\*(공정 M\d+)[^\n]*\*\*$/gm)];
  for (let i = 0; i < headings.length; i++) {
    const start = headings[i].index! + headings[i][0].length;
    const end = i + 1 < headings.length ? headings[i + 1].index! : s9.indexOf('**exit 체크 규약');
    sections.set(headings[i][1], s9.slice(start, end === -1 ? undefined : end));
  }
  return sections;
}

function readBlueprintOTrackSections(): Map<string, string> {
  const md = readFileSync(join(process.cwd(), 'docs/ARGUS-BLUEPRINT.md'), 'utf8');
  const s97Start = md.indexOf('### 9.7');
  if (s97Start === -1) return new Map(); // §9.7 없으면 O-트랙도 없다
  const s97 = md.slice(s97Start, md.indexOf('## 마지막 장'));
  const sections = new Map<string, string>();
  const headings = [...s97.matchAll(/^\*\*(공정 O\d+)[^\n]*\*\*$/gm)];
  for (let i = 0; i < headings.length; i++) {
    const start = headings[i].index! + headings[i][0].length;
    // 마지막 O-공정(O5) 뒤에는 K-트랙 등록 블록이 온다 — 그 앞에서 끊는다.
    const tail = s97.indexOf('**병렬 코어 트랙 K');
    const end = i + 1 < headings.length ? headings[i + 1].index! : (tail === -1 ? s97.indexOf('**exit 체크 규약') : tail);
    sections.set(headings[i][1], s97.slice(start, end === -1 ? undefined : end));
  }
  return sections;
}

function readBlueprintETrackSection(): string {
  const md = readFileSync(join(process.cwd(), 'docs/ARGUS-BLUEPRINT.md'), 'utf8');
  const start = md.indexOf('### 9.8');
  if (start === -1) return '';
  const end = md.indexOf('\n---', start);
  return md.slice(start, end === -1 ? undefined : end);
}

function readBlueprintVTrackSection(): string {
  const md = readFileSync(join(process.cwd(), 'docs/ARGUS-BLUEPRINT.md'), 'utf8');
  const start = md.indexOf('### 9.9');
  if (start === -1) return '';
  const end = md.indexOf('\n---', start);
  return md.slice(start, end === -1 ? undefined : end);
}

function readBlueprintProcessSections(): Map<string, string> {
  const md = readFileSync(join(process.cwd(), 'docs/ARGUS-BLUEPRINT.md'), 'utf8');
  const s6Start = md.indexOf('## §6.');
  const s6End = md.indexOf('## §7.');
  expect(s6Start, 'BLUEPRINT에서 §6을 찾지 못함').toBeGreaterThan(-1);
  const s6 = md.slice(s6Start, s6End === -1 ? undefined : s6End);

  const sections = new Map<string, string>();
  const headings = [...s6.matchAll(/^### (공정 \d+)[^\n]*\n/gm)];
  for (let i = 0; i < headings.length; i++) {
    const start = headings[i].index! + headings[i][0].length;
    const end = i + 1 < headings.length ? headings[i + 1].index! : s6.indexOf('### 준공 검사');
    sections.set(headings[i][1], s6.slice(start, end === -1 ? undefined : end));
  }
  return sections;
}

describe('BLUEPRINT §6 exit 체크 증거 계약', () => {
  const sections = readBlueprintProcessSections();

  it('§6에서 다섯 공정을 모두 찾는다', () => {
    expect([...sections.keys()]).toEqual(['공정 0', '공정 1', '공정 2', '공정 3', '공정 4', '공정 5']);
  });

  it.each([...sections.keys()])('%s: 체크된 exit 수 == 등록된 증거 수', (name) => {
    const body = sections.get(name)!;
    const checked = (body.match(/\[x\]/g) || []).length;
    const evidence = EVIDENCE[name] || [];
    expect(
      evidence.length,
      `${name}의 [x]는 ${checked}개인데 EVIDENCE 맵에는 ${evidence.length}개 — 체크(또는 취소)와 같은 커밋에서 맵을 갱신할 것`,
    ).toBe(checked);
  });

  it('기계 증거 경로는 전부 리포에 실존한다', () => {
    for (const [name, entries] of Object.entries(EVIDENCE)) {
      for (const entry of entries) {
        if (entry.startsWith('manual: ')) {
          expect(entry.length, `${name}의 manual 증거는 무엇을/누가 확인했는지 적어야 함`).toBeGreaterThan(20);
          continue;
        }
        expect(existsSync(join(process.cwd(), entry)), `${name}의 증거 파일이 없음: ${entry}`).toBe(true);
      }
    }
  });
});

describe('BLUEPRINT §9 M-트랙 exit 체크 증거 계약 (같은 규약)', () => {
  const sections = readBlueprintMTrackSections();

  it('§9에서 다섯 M-공정을 모두 찾는다', () => {
    expect([...sections.keys()]).toEqual(['공정 M0', '공정 M1', '공정 M2', '공정 M3', '공정 M4']);
  });

  it.each([...readBlueprintMTrackSections().keys()])('%s: 체크된 exit 수 == 등록된 증거 수', (name) => {
    const body = sections.get(name)!;
    const checked = (body.match(/\[x\]/g) || []).length;
    const evidence = EVIDENCE_M[name] || [];
    expect(
      evidence.length,
      `${name}의 [x]는 ${checked}개인데 EVIDENCE_M 맵에는 ${evidence.length}개 — 체크(또는 취소)와 같은 커밋에서 맵을 갱신할 것`,
    ).toBe(checked);
  });

  it('M-트랙 기계 증거 경로도 전부 리포에 실존한다', () => {
    for (const [name, entries] of Object.entries(EVIDENCE_M)) {
      for (const entry of entries) {
        if (entry.startsWith('manual: ')) {
          expect(entry.length, `${name}의 manual 증거는 무엇을/누가 확인했는지 적어야 함`).toBeGreaterThan(20);
          continue;
        }
        expect(existsSync(join(process.cwd(), entry)), `${name}의 증거 파일이 없음: ${entry}`).toBe(true);
      }
    }
  });
});

describe('BLUEPRINT §9.7 O-트랙 exit 체크 증거 계약 (같은 규약)', () => {
  const sections = readBlueprintOTrackSections();

  it('§9.7에서 여섯 O-공정을 모두 찾는다', () => {
    expect([...sections.keys()]).toEqual(['공정 O0', '공정 O1', '공정 O2', '공정 O3', '공정 O4', '공정 O5']);
  });

  it.each([...readBlueprintOTrackSections().keys()])('%s: 체크된 exit 수 == 등록된 증거 수', (name) => {
    const body = sections.get(name)!;
    const checked = (body.match(/\[x\]/g) || []).length;
    const evidence = EVIDENCE_O[name] || [];
    expect(
      evidence.length,
      `${name}의 [x]는 ${checked}개인데 EVIDENCE_O 맵에는 ${evidence.length}개 — 체크(또는 취소)와 같은 커밋에서 맵을 갱신할 것`,
    ).toBe(checked);
  });

  it('O-트랙 기계 증거 경로도 전부 리포에 실존한다', () => {
    for (const [name, entries] of Object.entries(EVIDENCE_O)) {
      for (const entry of entries) {
        if (entry.startsWith('manual: ')) {
          expect(entry.length, `${name}의 manual 증거는 무엇을/누가 확인했는지 적어야 함`).toBeGreaterThan(20);
          continue;
        }
        expect(existsSync(join(process.cwd(), entry)), `${name}의 증거 파일이 없음: ${entry}`).toBe(true);
      }
    }
  });
});

describe('BLUEPRINT §9.8 E-트랙 exit 체크 증거 계약 (같은 규약)', () => {
  const section = readBlueprintETrackSection();

  it('§9.8 E 트랙과 완료된 E0~E2 exit를 찾는다', () => {
    expect(section).toContain('병렬 권한 트랙 E');
    for (const phase of Object.keys(EVIDENCE_E)) expect(section).toContain(`**${phase} exit:**`);
  });

  it.each(Object.keys(EVIDENCE_E))('%s: 체크된 exit 수 == 등록된 증거 수', (phase) => {
    const start = section.indexOf(`**${phase} exit:**`);
    const next = section.indexOf('\n\n**E', start + 1);
    const body = section.slice(start, next === -1 ? undefined : next);
    const checked = (body.match(/\[x\]/g) || []).length;
    expect(
      EVIDENCE_E[phase].length,
      `${phase}의 [x]는 ${checked}개인데 EVIDENCE_E에는 ${EVIDENCE_E[phase].length}개 — 체크(또는 취소)와 같은 커밋에서 맵을 갱신할 것`,
    ).toBe(checked);
  });

  it('E0~E2 기계·문서 증거 경로는 전부 리포에 실존한다', () => {
    for (const [phase, entries] of Object.entries(EVIDENCE_E)) {
      for (const entry of entries) {
        expect(existsSync(join(process.cwd(), entry)), `${phase}의 증거 파일이 없음: ${entry}`).toBe(true);
      }
    }
  });
});

describe('BLUEPRINT §9.9 V-트랙 exit 체크 증거 계약 (같은 규약)', () => {
  const section = readBlueprintVTrackSection();

  it('§9.9 V 트랙과 V1 exit를 찾는다', () => {
    expect(section).toContain('병렬 트랙 V');
    expect(section).toContain('**V1 exit:**');
  });

  it.each(Object.keys(EVIDENCE_V))('%s: 체크된 exit 수 == 등록된 증거 수', (phase) => {
    const start = section.indexOf(`**${phase} exit:**`);
    const body = section.slice(start); // V1 exit는 절의 마지막 문단 — 뒤에 다른 [x] 없음
    const checked = (body.match(/\[x\]/g) || []).length;
    expect(
      EVIDENCE_V[phase].length,
      `${phase}의 [x]는 ${checked}개인데 EVIDENCE_V에는 ${EVIDENCE_V[phase].length}개 — 체크(또는 취소)와 같은 커밋에서 맵을 갱신할 것`,
    ).toBe(checked);
  });

  it('V-트랙 증거 경로는 전부 리포에 실존한다', () => {
    for (const [phase, entries] of Object.entries(EVIDENCE_V)) {
      for (const entry of entries) {
        if (entry.startsWith('manual: ')) {
          expect(entry.length, `${phase}의 manual 증거는 무엇을/누가 확인했는지 적어야 함`).toBeGreaterThan(20);
          continue;
        }
        expect(existsSync(join(process.cwd(), entry)), `${phase}의 증거 파일이 없음: ${entry}`).toBe(true);
      }
    }
  });
});
