/**
 * P0 스파이크 ④ — 라우팅 eval 하네스 (CI red 게이트).
 *
 * 이 파일이 영속 자산이다. 검출기(routing-skeleton.ts)는 P3에서 교체되지만,
 * 이 하네스와 말뭉치는 새 검출기를 같은 잣대로 계속 잰다.
 *
 * 게이트 규약:
 *  - GATE 1 (하드): expect='silent' 케이스에서 발화 1건 = 빌드 사망.
 *    over-fire는 스파인 위반이므로 협상 없음 (정본 Release Matrix "Capture" 행:
 *    "flat 20발화 replay에서 질문 0 (CI red)"의 선행 형태).
 *  - GATE 2 (후퇴 방지): expect='fire' 케이스는 전건 발화해야 한다 — 단,
 *    P3에서 키워드 floor가 못 잡는 어려운 케이스를 추가할 때는 케이스에
 *    "floor": false 를 붙인다. 그 케이스는 하드 게이트에서 빠지고 리포트로만
 *    측정된다 (재현율을 100%로 사칭하지 않기 위한 정직 장치 — floor:false가
 *    쌓이는 것 자체가 "검출기를 교체하라"는 신호다).
 *  - GATE 3 (형식 일치): 발화한 케이스의 kind(선언형/유예형)가 ground truth와
 *    일치해야 한다 — 유예를 선언으로 오분류하면 잘못된 캡처 카피가 나간다.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { detect, loadKeywords, userUtterances } from './routing-skeleton.js';

const here = path.dirname(fileURLToPath(import.meta.url));

interface RoutingCase {
  id: string;
  lang: 'ko' | 'en';
  kind: string;
  expect: 'fire' | 'silent';
  text: string;
  /** false = 키워드 floor의 하드 게이트에서 제외 (P3 확장용 — 위 GATE 2 참조) */
  floor?: boolean;
}

const { cases } = JSON.parse(
  fs.readFileSync(path.join(here, 'routing-cases.json'), 'utf8'),
) as { cases: RoutingCase[] };
const kw = loadKeywords();

describe('routing eval harness (P0 spike ④)', () => {
  it('corpus sanity: silent flat cases are numerous enough to mean something', () => {
    // 정본 Matrix가 "flat 20발화"를 요구한다 — 말뭉치가 그 밑으로 줄면
    // 게이트 1의 통과가 공허해지므로 여기서 막는다.
    const silent = cases.filter((c) => c.expect === 'silent');
    expect(silent.length).toBeGreaterThanOrEqual(20);
    // 두 언어 모두 침묵 케이스를 가져야 한다 (ko만 통과하는 검출기 방지).
    expect(silent.some((c) => c.lang === 'ko')).toBe(true);
    expect(silent.some((c) => c.lang === 'en')).toBe(true);
  });

  it('GATE 1 (hard): zero fires on silent-expected utterances — over-fire kills the build', () => {
    const overFires = cases
      .filter((c) => c.expect === 'silent')
      .map((c) => ({ c, v: detect(c.text, kw) }))
      .filter(({ v }) => v.fire);
    expect(
      overFires.map(({ c, v }) => `${c.id} "${c.text}" ← matched ${(v as { matched: string }).matched}`),
    ).toEqual([]);
  });

  it('GATE 2 (regression): every floor-eligible fire case fires', () => {
    const misses = cases
      .filter((c) => c.expect === 'fire' && c.floor !== false)
      .filter((c) => !detect(c.text, kw).fire);
    expect(misses.map((c) => `${c.id} "${c.text}"`)).toEqual([]);
  });

  it('GATE 3 (form): fired kind matches ground truth (declarative vs deferred)', () => {
    const wrongKind = cases
      .filter((c) => c.expect === 'fire' && (c.kind === 'declarative' || c.kind === 'deferred'))
      .map((c) => ({ c, v: detect(c.text, kw) }))
      .filter(({ c, v }) => v.fire && v.kind !== c.kind);
    expect(wrongKind.map(({ c, v }) => `${c.id}: expected ${c.kind}, got ${String(v.kind)}`)).toEqual([]);
  });

  it('reports floor-excluded cases instead of hiding them', () => {
    // floor:false 케이스가 생기면 여기 로그로 드러난다 — 조용한 제외 금지.
    const excluded = cases.filter((c) => c.expect === 'fire' && c.floor === false);
    for (const c of excluded) {
      const v = detect(c.text, kw);
      console.log(`[floor-excluded] ${c.id} fire=${v.fire} — keyword floor ${v.fire ? 'catches' : 'MISSES'} this`);
    }
    expect(true).toBe(true); // 리포트 전용 — 게이트 아님
  });
});

describe('fixture integration (spike ③ ↔ ④)', () => {
  const ko = userUtterances(path.join(here, 'fixtures', 'session-ko.jsonl'));
  const en = userUtterances(path.join(here, 'fixtures', 'session-en.jsonl'));

  it('extracts exactly the user utterances, skipping assistant/unknown lines without crashing', () => {
    expect(ko).toHaveLength(3);
    expect(en).toHaveLength(2);
  });

  it('ko session: flat opener stays silent, both decision turns fire', () => {
    const verdicts = ko.map((t) => detect(t, kw));
    expect(verdicts[0].fire).toBe(false); // "세션 만료 버그부터 잡자…"
    expect(verdicts[1]).toMatchObject({ fire: true, kind: 'declarative' }); // "postgres로 가기로 했다…"
    expect(verdicts[2]).toMatchObject({ fire: true, kind: 'declarative' }); // "올리기로 하자"
  });

  it('en session: question stays silent, decision turn fires', () => {
    const verdicts = en.map((t) => detect(t, kw));
    expect(verdicts[0]).toMatchObject({ fire: false, guard: 'question' });
    expect(verdicts[1]).toMatchObject({ fire: true, kind: 'declarative' });
  });

  it('fixture schema matches the verified real-transcript shape (spike ③ contract)', () => {
    // 실물 2.1.207 세션에서 검증한 필드들 — 픽스처가 이 shape에서 이탈하면
    // "실전 구조" 주장이 거짓이 되므로 테스트로 고정한다.
    for (const f of ['session-ko.jsonl', 'session-en.jsonl']) {
      const lines = fs
        .readFileSync(path.join(here, 'fixtures', f), 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l) as Record<string, unknown>);
      const users = lines.filter((l) => l['type'] === 'user');
      const assistants = lines.filter((l) => l['type'] === 'assistant');
      expect(users.length).toBeGreaterThan(0);
      expect(assistants.length).toBeGreaterThan(0);
      for (const u of users) {
        for (const key of ['uuid', 'timestamp', 'sessionId', 'cwd', 'version', 'gitBranch', 'promptId']) {
          expect(u, `user line in ${f} missing ${key}`).toHaveProperty(key);
        }
        expect((u['message'] as Record<string, unknown>)['role']).toBe('user');
      }
      for (const a of assistants) {
        const msg = a['message'] as Record<string, unknown>;
        expect(msg['role']).toBe('assistant');
        expect(Array.isArray(msg['content'])).toBe(true);
        expect(msg).toHaveProperty('usage');
        expect(a).toHaveProperty('requestId');
      }
      // 미지 타입 라인이 실제로 존재해야 skip 경로가 테스트된 것이다.
      expect(lines.some((l) => l['type'] === 'unknown-future-line')).toBe(true);
    }
  });
});
