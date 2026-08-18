import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 배선 가드 — **엔진이 낸 것이 사람에게 닿는가.**
 *
 * 이 저장소의 규약: *"생산된 필드는 기본이 dead-on-arrival. 소비를 가드한다."*
 * 그런데 그 규약을 인지 엔진 자신이 어기고 있었다. 2026-08-18 진단:
 * 공개 함수 98개 중 화면에 닿는 것이 39개였고, `returnTriggers`(전제가
 * 흔들리면 판단을 깨움)·`recordReading`/`retractCrossing`(두 세계 넘나듦)·
 * `calibration`(예측 채점)은 **테스트와 시뮬레이터에서만** 불리고 있었다.
 *
 * 컴파일도 되고 테스트도 초록인데 사용자는 그 기능을 쓸 수 없다. 이게 이
 * 프로젝트가 이름 붙인 실패다 — 명사(모양)는 타입했고 동사(소비)는 안 했다.
 *
 * 그래서 **하중 받는 배선만 골라** 이름으로 못박는다. 전부를 세면 하네스
 * 내부와 이름 붙인 관례 상수까지 걸려 시끄러워지고, 시끄러운 가드는 아무도
 * 안 본다.
 */
const ROOT = process.cwd();

/** 사용자가 실제로 보는 곳. 여기 안 닿으면 그 기능은 없는 것과 같다. */
const SURFACE_DIRS = ['src/app', 'src/components', 'src/stores'];

/**
 * 끊기면 **기능 하나가 통째로 사라지는** 배선. 각 항목은 "이게 없으면 사용자가
 * 무엇을 못 하게 되는가"로 적는다 — 이름만 적으면 다음 사람이 왜 여기 있는지
 * 모르고 지운다.
 */
const LOAD_BEARING: Array<{ fn: string; breaks: string }> = [
  { fn: 'sealFrame', breaks: '판단을 잠글 수 없다' },
  { fn: 'settleFrame', breaks: '결과를 적을 수 없다' },
  { fn: 'returnTriggers', breaks: '전제가 흔들려도 그 위에 세운 판단이 안 깨어난다 (인트로 전용이 된다)' },
  { fn: 'assessPremise', breaks: '전제가 지금 어떤 처지인지 볼 수 없다' },
  { fn: 'recordReading', breaks: '문장이 현실에 닿을 수 없다 — 영원히 프레임 안에 갇힌다' },
  { fn: 'retractCrossing', breaks: '건넌 것을 되돌릴 수 없다 — 한 방향 승격은 넘나듦이 아니라 다른 감옥이다' },
  { fn: 'worldTrajectory', breaks: '두 세계를 오간 자취를 볼 수 없다' },
  { fn: 'calibration', breaks: '봉인해 둔 예측을 채점할 수 없다' },
  { fn: 'extractCandidates', breaks: '대화에서 문장을 뽑아올 수 없다 — 전부 손으로 쳐야 한다' },
  { fn: 'turnsFromPluginCandidates', breaks: '플러그인이 이미 가져다 둔 것을 못 읽는다 (0클릭 경로가 죽는다)' },
  { fn: 'watchBlocks', breaks: '만들면 안 되는 감시를 걸러내지 못한다' },
  { fn: 'frameMirror', breaks: '기록의 구조를 비출 수 없다' },
];

const surfaceBodies: string[] = [];
const walk = (dir: string) => {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === '__tests__' || e.name === 'node_modules') continue;
      walk(p);
    } else if (/\.tsx?$/.test(e.name) && !/\.test\./.test(e.name)) {
      surfaceBodies.push(readFileSync(p, 'utf8'));
    }
  }
};
for (const d of SURFACE_DIRS) walk(join(ROOT, d));

describe('인지 엔진 배선 — 하중 받는 것이 화면에 닿는가', () => {
  it('화면 파일을 실제로 읽었다 (스캐너가 빈손이면 이 테스트는 아무것도 안 지킨다)', () => {
    expect(surfaceBodies.length).toBeGreaterThan(50);
  });

  it.each(LOAD_BEARING.map((x) => [x.fn, x.breaks] as const))(
    '%s 가 화면에서 불린다',
    (fn, breaks) => {
      // **부르는 자리**를 찾는다. 이름만 세면 import 줄 하나로 통과한다 —
      // 실제로 그렇게 뚫렸다. 아무도 안 부르는 import 는 배선이 아니다.
      const re = new RegExp(`\\b${fn}\\s*\\(`);
      const hit = surfaceBodies.some((b) => re.test(b));
      expect(hit, `${fn} 이 어떤 화면에서도 안 불립니다 — 끊기면: ${breaks}`).toBe(true);
    },
  );
});

describe('반대 방향 — 화면이 판정을 직접 하지 않는가', () => {
  /**
   * 배선을 잇는 것과 화면이 판정을 갖는 것은 다르다. 화면에 판정이 있으면
   * 순수 테스트가 못 읽는 곳으로 숨는다 (이 저장소가 이미 겪은 실수 —
   * 저자성 판정이 SealMoment 컴포넌트 안에 있던 시절).
   */
  const raw = readFileSync(join(ROOT, 'src/app/method-pilot/frames/page.tsx'), 'utf8');
  /**
   * 주석을 걷어낸 뒤 본다. 첫 판은 **규칙을 적어둔 주석 자체**에 걸렸다
   * ("사람에 대한 점수·등급·성향 문장이 없다"). 규율을 설명하는 문장과
   * 규율을 어기는 문장을 구별 못 하는 검사는 개발자에게 규율을 적지 말라고
   * 시키는 셈이라, 정확히 반대 효과를 낸다.
   */
  const pilot = raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trim().startsWith('//'))
    .join('\n');

  it('임계·표본 수를 화면이 다시 정하지 않는다', () => {
    // 엔진이 정한 임계를 화면이 하드코딩하면 두 곳이 갈라진다.
    expect(pilot).not.toMatch(/MIN_SAMPLE\s*=/);
    expect(pilot).not.toMatch(/ECHO_THRESHOLD\s*=/);
    expect(pilot).not.toMatch(/decisionInterval\s*:/);
    expect(pilot).not.toMatch(/slack\s*:\s*[0-9]/);
  });

  it('사람에 대한 판정 어휘가 화면에 없다 (Zero-Judgment)', () => {
    for (const banned of ['당신은 ', '당신의 성향', '결정자입니다', '등급']) {
      expect(pilot, `금지 어휘 "${banned}"`).not.toContain(banned);
    }
  });
});
