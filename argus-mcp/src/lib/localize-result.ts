import type { McpToolResult } from './envelope.js';
import { resolveResponseLocale } from './surfaces.js';

type ErrorCopy = { message: string; recovery?: string };

const KO_ERRORS: Record<string, ErrorCopy> = {
  INVALID_INPUT: { message: '입력값이 올바르지 않습니다.', recovery: '오류가 표시된 인자를 고친 뒤 같은 도구를 다시 호출하세요. 사용자가 정해야 할 값은 추측하지 마세요.' },
  INVALID_LOCALE: { message: '지원하지 않는 언어입니다.', recovery: 'locale에는 "ko" 또는 "en"을 사용하세요.' },
  ALREADY_CLOSED: { message: '이미 진행 중이거나 닫힌 결정입니다.', recovery: '실제 결과를 기록하려면 argus_resolve를 사용하세요. 닫힌 결정은 다시 열지 않습니다.' },
  CAPTURE_NOT_FOUND: { message: '일치하는 내부 메모를 찾지 못했습니다.', recovery: '전제 문장을 text에 직접 전달하세요.' },
  AMBIGUOUS_REF: { message: '여러 내부 메모와 일치해 대상을 정할 수 없습니다.', recovery: '전제 문장을 text에 직접 전달하세요.' },
  PROVENANCE_REQUIRED: { message: '문장의 출처를 확인해야 합니다.', recovery: '사용자가 쓴 문장이면 user_stated, AI가 제기한 문장이면 ai_surfaced와 원문을 전달하세요.' },
  PREMISES_REQUIRED: { message: '추가할 전제가 없습니다.', recovery: 'text, kind, external, load_bearing, source를 포함한 전제 1~5개를 전달하세요.' },
  PREMISE_ID_COLLISION: { message: '다른 전제가 같은 식별자를 사용하고 있습니다.', recovery: '전제 문장을 조금 다르게 표현한 뒤 다시 추가하세요.' },
  PREMISE_CAP: { message: '이 결정에서 추적할 수 있는 전제 수를 넘었습니다.', recovery: '기존 전제 하나를 정리하거나, 덜 중요한 전제를 핵심 전제에 합치세요.' },
  AMEND_NEEDS_REF: { message: '수정할 전제 번호와 작업이 필요합니다.', recovery: 'argus_patterns view="decision_context"로 목록을 확인한 뒤 ref와 action을 전달하세요.' },
  AMEND_NEEDS_TEXT: { message: '수정된 전제 문장이 필요합니다.', recovery: '사용자의 표현을 그대로 text에 전달하세요. 다시 요약하지 마세요.' },
  PREMISE_RETIRED: { message: '이미 닫힌 전제라 수정할 수 없습니다.', recovery: '기존 기록은 그대로 두고 필요한 경우 새 전제를 추가하세요.' },
  RESOLVE_NEEDS_REF: { message: '답을 닫을 미결 질문 번호가 필요합니다.', recovery: 'argus_patterns view="decision_context"로 목록을 확인한 뒤 ref를 전달하세요.' },
  STILL_OPEN_NEEDS_REF: { message: '열어둘 미결 질문 번호가 필요합니다.', recovery: 'argus_patterns view="decision_context"로 목록을 확인한 뒤 ref를 전달하세요.' },
  NOT_AN_OPEN_QUESTION: { message: '이 항목은 미결 질문이 아니라 전제입니다.', recovery: '전제는 argus_capture action="update_fact"로 현실과 다시 확인하고, 미결 질문만 사용자의 말로 닫으세요.' },
  RESOLVE_NEEDS_DECISION: { message: '미결 질문은 사용자가 직접 내린 판단으로만 닫을 수 있습니다.', recovery: '사용자에게 판단을 물어 decision에 그대로 전달하세요. 아직 결정하지 못했다면 열린 채로 둘 수 있습니다.' },
  RECEIPT_NEEDS_ID: { message: '판단 영수증을 불러올 결정 id가 필요합니다.', recovery: '결정 id를 전달하세요.' },
  RECEIPT_NOT_FOUND: { message: '해당 결정의 판단 영수증을 찾지 못했습니다.', recovery: 'argus_patterns view="all"에서 id를 확인하거나 먼저 예측을 저장하세요.' },
  PREMISES_NEEDS_ID: { message: '전제를 불러올 결정 id가 필요합니다.', recovery: '결정 id를 전달하세요.' },
  NOT_RECHECKABLE: { message: '이 항목은 현실과 재확인할 전제가 아니라 사용자가 답할 미결 질문입니다.', recovery: 'argus_capture action="answer_question"에 사용자의 판단을 그대로 전달하세요.' },
  RECHECK_NEEDS_ASSERTION: { message: '이전 기준과 비교할 수 있는 확인 결과가 필요합니다.', recovery: '수치 사실이면 numeric_value를, 문장형 사실이면 changed=true/false를 명시하세요.' },
  TOO_LARGE: { message: '문서가 처리 가능한 크기를 넘었습니다.', recovery: '판단에 가장 중요한 부분만 검수하거나 문서를 나누세요.' },
  READ_FAILED: { message: '문서 파일을 읽지 못했습니다.', recovery: '절대 경로를 확인하거나 문서 내용을 text에 붙여 넣으세요.' },
  EXTRACT_FAILED: { message: '문서에서 텍스트를 추출하지 못했습니다.', recovery: '문서 내용을 text에 붙여 넣거나 markdown/txt로 변환하세요.' },
  EMPTY: { message: '검수할 수 있는 문서 내용이 없습니다.', recovery: '20자 이상의 text 또는 읽을 수 있는 file_path를 전달하세요.' },
  OUTCOME_REQUIRED: { message: '현실에서 실제로 어떻게 됐는지 결과가 필요합니다.', recovery: '사용자에게 결과를 물어 outcome에 전달하세요. 결과를 추론하지 마세요.' },
  PREMATURE_SETTLE: { message: '아직 확인일이 되지 않았습니다.', recovery: '확인일까지 기다리거나 일정이 바뀌었다면 확인일을 수정하세요.' },
  WHAT_HAPPENED_REQUIRED: { message: '실제로 일어난 일을 기록해야 합니다.', recovery: '사용자에게 실제 결과를 물어 what_happened에 그대로 전달하세요.' },
  DEFER_DATE_REQUIRED: { message: '다시 확인할 날짜가 필요합니다.', recovery: '사용자에게 날짜를 물어 defer_to에 YYYY-MM-DD로 전달하세요. 더는 중요하지 않다면 argus_capture action="close"를 사용하세요.' },
  NOT_CONNECTED: { message: '이 터미널은 Argus 계정과 연결돼 있지 않습니다.', recovery: '웹 설정에서 동기화 토큰을 발급하고 MCP 설정의 ARGUS_TOKEN에 넣으세요.' },
  SYNC_FAILED: { message: 'Argus 계정과 동기화하지 못했습니다.', recovery: '네트워크와 ARGUS_API_URL을 확인한 뒤 다시 시도하세요. 로컬 기록은 영향을 받지 않습니다.' },
  TEXT_REQUIRED: { message: '기록할 문장이 필요합니다.', recovery: '사용자의 문장을 고치거나 요약하지 말고 그대로 text에 전달하세요.' },
  INTERNAL_ERROR: { message: '내부 오류가 발생했습니다.', recovery: '같은 작업을 다시 시도하세요. 반복되면 MCP 서버 로그를 확인하세요.' },
  UNKNOWN_TOOL: { message: '알 수 없는 도구입니다.', recovery: 'tools/list에 나온 정확한 도구 이름을 사용하세요.' },
};

export const LOCALIZED_ERROR_CODES = new Set(Object.keys(KO_ERRORS));

interface InvalidField {
  field: string;
  code?: string;
  message?: string;
  minimum?: number;
  maximum?: number;
  expected?: string;
  origin?: string;
}

/** Translate one Zod issue into a Korean, actionable reason. Keeps the English
 *  argument NAME (models and users see arg names in English), but says in Korean
 *  WHY it failed — the piece the generic message threw away. */
function koReason(issue: InvalidField): string {
  const unit = issue.origin === 'string' ? '자' : issue.origin === 'array' ? '개' : '';
  switch (issue.code) {
    case 'too_small':
      if (issue.origin === 'string') return `너무 짧습니다 (최소 ${issue.minimum}자)`;
      if (issue.origin === 'array') return `항목이 부족합니다 (최소 ${issue.minimum}개)`;
      return `너무 작습니다 (최소 ${issue.minimum}${unit})`;
    case 'too_big':
      if (issue.origin === 'string') return `너무 깁니다 (최대 ${issue.maximum}자)`;
      if (issue.origin === 'array') return `항목이 너무 많습니다 (최대 ${issue.maximum}개)`;
      return `너무 큽니다 (최대 ${issue.maximum}${unit})`;
    case 'invalid_type':
      return issue.expected === undefined ? '형식이 올바르지 않습니다' : `필수이거나 형식이 올바르지 않습니다 (${issue.expected} 필요)`;
    case 'invalid_value':
    case 'invalid_enum_value':
      return '허용되지 않는 값입니다';
    case 'unrecognized_keys':
      return '알 수 없는 항목입니다';
    case 'invalid_format':
    case 'invalid_string':
      return '형식이 올바르지 않습니다 (예: 날짜는 YYYY-MM-DD)';
    default:
      return '값을 확인해 주세요';
  }
}

/** Korean INVALID_INPUT that NAMES each offending argument and why. */
function localizeInvalidInput(fields: InvalidField[]): ErrorCopy {
  if (!fields.length) return KO_ERRORS.INVALID_INPUT!;
  const parts = fields.slice(0, 4).map((f) => `${f.field === '(root)' ? '요청' : f.field}: ${koReason(f)}`);
  return {
    message: `입력값이 올바르지 않습니다 — ${parts.join(', ')}.`,
    recovery: '위에 표시된 인자를 고친 뒤 같은 도구를 다시 호출하세요. 사용자가 정해야 할 값은 추측하지 마세요.',
  };
}

const REPRESENTATIVE_FIELDS = [
  'decision', 'predicate', 'what_happened', 'finding', 'text', 'question',
  'human_judgment', 'note', 'title', 'biggest_worry',
] as const;

function responseLocale(args: Record<string, unknown>): 'ko' | 'en' {
  const sample = REPRESENTATIVE_FIELDS
    .map((key) => args[key])
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join('\n');
  const dir = typeof args['argus_dir'] === 'string' ? args['argus_dir'] : null;
  return resolveResponseLocale(dir, sample);
}

/**
 * Dispatch-level locale safety net. Tool handlers retain precise English
 * diagnostics for development, while every Korean MCP call receives a Korean
 * user surface even on validation, guard, and rare failure paths.
 */
export function localizeToolResult(
  args: Record<string, unknown>,
  result: McpToolResult,
): McpToolResult {
  if (!result.isError || responseLocale(args) !== 'ko') return result;
  const sc = result.structuredContent;
  if (!sc || sc['ok'] !== false) return result;
  const code = String(sc['error_code'] ?? 'INTERNAL_ERROR');
  const copy = code === 'INVALID_INPUT' && Array.isArray(sc['invalid_fields'])
    ? localizeInvalidInput(sc['invalid_fields'] as InvalidField[])
    : KO_ERRORS[code] ?? {
      message: '요청을 처리하지 못했습니다.',
      recovery: '입력값과 현재 결정 상태를 확인한 뒤 다시 시도하세요.',
    };
  const localized = {
    ...sc,
    message: copy.message,
    ...(copy.recovery ? { recovery: copy.recovery } : {}),
  };
  result.structuredContent = localized;
  result.content = [{ type: 'text', text: JSON.stringify(localized, null, 2) }];
  return result;
}
