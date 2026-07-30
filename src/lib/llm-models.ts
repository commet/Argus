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
export const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-5';
export const DEFAULT_OPENAI_MODEL = 'gpt-5.6-terra';
export const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash';

export const ANTHROPIC_MODELS = [
  { id: 'claude-sonnet-5', name: 'Sonnet 5', price: '$2/$10', noteKo: '균형 · 기본값', noteEn: 'Balanced · default' },
  { id: 'claude-opus-5', name: 'Opus 5', price: '$5/$25', noteKo: '복잡한 분석', noteEn: 'Complex analysis' },
  { id: 'claude-opus-4-8', name: 'Opus 4.8', price: '$5/$25', noteKo: '이전 Opus 유지', noteEn: 'Previous Opus' },
  { id: 'claude-fable-5', name: 'Fable 5', price: '$10/$50', noteKo: '가장 어려운 장기 작업', noteEn: 'Hardest long-running work' },
] as const;

export const OPENAI_MODELS = [
  { id: 'gpt-5.6-terra', name: 'GPT-5.6 Terra', price: '$2.50/$15', noteKo: '균형 · 기본값', noteEn: 'Balanced · default' },
  { id: 'gpt-5.6', name: 'GPT-5.6 Sol', price: '$5/$30', noteKo: '최고 성능', noteEn: 'Frontier' },
  { id: 'gpt-5.6-luna', name: 'GPT-5.6 Luna', price: '$1/$6', noteKo: '빠르고 경제적', noteEn: 'Fast and economical' },
] as const;

export const GEMINI_MODELS = [
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash', price: '$1.50/$7.50', noteKo: '최신 균형 · 기본값', noteEn: 'Latest balance · default' },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview', price: '$2/$12', noteKo: '복잡한 추론 · 프리뷰', noteEn: 'Complex reasoning · preview' },
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite', price: '$0.30/$2.50', noteKo: '대량·저비용', noteEn: 'High-volume · low cost' },
] as const;
