import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 능력 지도가 썩지 않게 하는 가드.
 *
 * `scripts/capability-map.json` 은 "이 능력은 이미 여기 산다"를 적어둔 등기부다.
 * `scripts/check-capability-duplication.mjs` 가 새 파일이 그 자리를 언급했는지
 * 검사한다. 그런데 **등기부 자체가 낡으면 검사가 조용히 무력해진다** — 파일이
 * 옮겨가면 언급 검사가 아무거나 통과시키거나 아무것도 못 잡는다.
 *
 * 이 저장소가 이미 여러 번 겪은 실패다: 기계가 안 보는 규약은 지켜지지 않는다.
 */
const MAP_PATH = join(process.cwd(), 'scripts/capability-map.json');

interface Capability {
  id: string;
  label: string;
  keywords: string[];
  lives_at: string[];
  strong_keywords?: string[];
}

const map = JSON.parse(readFileSync(MAP_PATH, 'utf8')) as {
  capabilities: Capability[];
};

describe('능력 지도 — 등기부가 실제 파일을 가리키는가', () => {
  it('능력이 하나 이상 등록되어 있다', () => {
    expect(map.capabilities.length).toBeGreaterThan(0);
  });

  it.each(map.capabilities.map((c) => [c.id, c] as const))('%s 의 lives_at 은 전부 실존한다', (_id, cap) => {
    for (const loc of cap.lives_at) {
      expect(existsSync(join(process.cwd(), loc)), `${cap.id}: ${loc} 가 없습니다 — 옮겼으면 지도를 고치세요`).toBe(true);
    }
  });

  it.each(map.capabilities.map((c) => [c.id, c] as const))('%s 는 키워드와 자리를 모두 갖는다', (_id, cap) => {
    expect(cap.keywords.length).toBeGreaterThan(0);
    expect(cap.lives_at.length).toBeGreaterThan(0);
    expect(cap.label.length).toBeGreaterThan(0);
  });

  it('강한 키워드는 그 능력의 정본 파일에서 실제로 쓰인다', () => {
    // 강한 키워드 하나만 나와도 위반으로 치므로, 그 이름이 진짜 그 능력의
    // 것인지 확인한다. 아니면 엉뚱한 파일을 계속 잡는다.
    const unproven: string[] = [];
    for (const cap of map.capabilities) {
      for (const kw of cap.strong_keywords || []) {
        const found = cap.lives_at.some((loc) => {
          const p = join(process.cwd(), loc);
          return existsSync(p) && readFileSync(p, 'utf8').toLowerCase().includes(kw.toLowerCase());
        });
        // 한글 설명어(민감정보 등)는 영문 코드베이스에 없을 수 있으므로 면제.
        if (!found && /^[\x20-\x7E]+$/.test(kw)) unproven.push(`${cap.id}: "${kw}"`);
      }
    }
    expect(unproven, `정본 파일에 없는 강한 키워드: ${unproven.join(', ')}`).toEqual([]);
  });

  it('검사기 자체가 존재한다', () => {
    expect(existsSync(join(process.cwd(), 'scripts/check-capability-duplication.mjs'))).toBe(true);
  });
});
