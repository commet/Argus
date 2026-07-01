/**
 * 기본 모델 ID — 단일 소스 (single source of truth).
 *
 * settings 기본값 · LLM 호출 폴백 · 설정 UI 드롭다운 기본값이 모두 이 상수를
 * 읽는다. 이전엔 같은 문자열('gpt-4o' / 'gemini-2.5-flash')이 5곳에 복붙돼 있어,
 * 한 곳만 바꾸면 사용자가 고른 모델과 실제로 호출되는 모델이 조용히 갈릴 수
 * 있었다(drift). 여기 한 곳만 바꾸면 전부 따라온다.
 *
 * (참고: 설정 UI의 <option> 목록은 "선택 가능한 모델 카탈로그"라 별개로 둔다 —
 *  여기서 단일화하는 것은 "기본값/폴백"뿐이다.)
 */
export const DEFAULT_OPENAI_MODEL = 'gpt-4o';
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
