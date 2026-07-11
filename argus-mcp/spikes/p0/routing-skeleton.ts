/**
 * P0 스파이크 ④ 검출기 — P3-1에서 src/v2/gate.ts로 졸업했다.
 *
 * 이 파일은 재수출만 남긴다: eval 하네스(routing-eval.test.ts)가 재는
 * 검출기와 서버가 배송하는 검출기가 **같은 함수**가 되게 하기 위해서다
 * (측정본 ≠ 배송본 드리프트의 구조적 봉쇄). 검출 로직·키워드를 고치려면
 * src/v2/gate.ts / gate-keywords.ts로 — 여기 말고.
 *
 * anchor-keywords.json도 gate-keywords.ts(TS 데이터 모듈)로 승격되어
 * 삭제됐다. routing-cases.json(eval 말뭉치)만 이 디렉토리에 남아 계속
 * 성장한다.
 */
export { detect, loadKeywords, userUtterances } from '../../src/v2/gate.js';
export type { RouteKind, RouteVerdict } from '../../src/v2/gate.js';
