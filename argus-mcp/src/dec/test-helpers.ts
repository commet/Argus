import type { DecisionRecord } from './types.js';

/**
 * 손으로 만드는 결정 기록 — **테스트 전용**.
 *
 * 왜 있나: `DecisionRecord` 에 필드를 더할 때마다 손 픽스처가 뒤처져
 * `undefined.some(...)` 으로 죽었다. 세 번 났다 (`reviews` 때 둘, `pauses` 때
 * 하나). 타입은 초록이었다 — `Partial` 스프레드가 가렸기 때문이다.
 *
 * **여기 한 군데만 고치면 되게** 모은다. 접힘이 늘 채우는 목록 필드(`amendments`
 * ·`fires`·`reviews`·`pauses`)는 여기서 빈 배열로 시작한다.
 *
 * 제품 코드에서 부르지 않는다 — `foldDecisions` 가 진짜 생산자다. 파일 이름이
 * `test-helpers` 인 것도 그래서다: 도달성 게이트가 이 이름을 테스트 자산으로
 * 보고 "아무도 안 부르는 제품 파일"로 세지 않는다.
 */
export function makeRecord(id: string, extra: Partial<DecisionRecord> = {}): DecisionRecord {
  return {
    id, type: 'pin', decision: `${id} 의 문장`, scope: 'repo', binds: '나', author: '나',
    provenance: 'user', adopted: '2026-08-01', unattended: 'park', watch: 'inject_only',
    status: 'active',
    amendments: [], fires: [], misfires: 0, reviews: [], pauses: [],
    ...extra,
  };
}
