import type { McpToolResult } from './envelope.js';
import { resolveResponseLocale } from './surfaces.js';

type ErrorCopy = { message: string; recovery?: string };

const KO_ERRORS: Record<string, ErrorCopy> = {
  INVALID_INPUT: { message: '입력값이 올바르지 않습니다.', recovery: '오류가 표시된 인자를 고친 뒤 같은 도구를 다시 호출하세요. 사용자가 정해야 할 값은 추측하지 마세요.' },
  INVALID_LOCALE: { message: '지원하지 않는 언어입니다.', recovery: 'locale에는 "ko" 또는 "en"을 사용하세요.' },
  ALREADY_CLOSED: { message: '이미 진행 중이거나 닫힌 결정입니다.', recovery: '실제 결과를 기록하려면 argus_resolve를 사용하세요. 닫힌 결정은 다시 열지 않습니다.' },
  CAPTURE_NOT_FOUND: { message: '일치하는 내부 메모를 찾지 못했습니다.', recovery: '전제 문장을 text에 직접 전달하세요.' },
  AMBIGUOUS_REF: { message: '참조가 여러 항목과 일치합니다.', recovery: 'P1 같은 서수(번호)로 정확히 지정하세요. 번호는 argus_patterns view="decision_context"에서 볼 수 있습니다.' },
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
  PREMATURE_SETTLE: { message: '아직 확인일이 되지 않았습니다.', recovery: '확인일까지 기다리세요. 일정이 바뀌었다면 outcome="still_pending"에 defer_to로 새 확인일을 전달하면 됩니다.' },
  // ko/en 패리티: 아래 코드들은 en에서만 상세했고 ko는 제네릭 폴백이었다 —
  // 한국어 사용자가 같은 품질의 복구 안내를 받도록 전용 문구를 둔다.
  // "못 읽었다"를 "없다"로 말하지 않는다 (적대 감사 2026-07-27). 원장이 있는데
  // 읽히지 않을 때 쓰기를 멈추는 그 순간, 사용자가 가장 먼저 두려워하는 것은
  // "내 기록이 날아갔나"다 — 그 답부터 준다.
  LEDGER_UNREADABLE: {
    message: '기록 파일은 있는데 읽을 수 없었습니다. 아무것도 쓰지 않았습니다. 이미 있는 기록을 덮어쓸 수 있어서 멈췄습니다.',
    recovery: '.argus/ledger/ledger.jsonl 의 권한을 확인하고(폴더가 아니라 파일이 맞는지도), 그 파일을 잡고 있는 다른 프로그램이 있으면 닫은 뒤 다시 시도하세요. 잃은 것은 없습니다. 기록은 디스크에 그대로 있습니다.',
  },
  // 만료된 연결을 "연결 안 됨"이라 말하지 않는다 (적대 감사 2026-07-27). 이 상태의
  // 사용자는 그동안 계정에 아무것도 안 올라갔다는 사실을 방금 처음 듣는다 —
  // 그러니 "여기 기록은 멀쩡하다"를 같은 호흡에 붙인다.
  CONNECTION_EXPIRED: {
    message: '이 터미널의 계정 연결이 만료됐습니다. 그동안의 저장·정산이 계정에 닿지 않았습니다.',
    recovery: '터미널에서 `npx argus-decision-mcp connect`를 실행해 다시 연결하세요 (플러그인 사용자는 /argus:connect). 로컬에서 잃은 것은 없습니다. 모든 결정은 여기 기록에 그대로 있고, 다시 연결한 뒤 argus_settings action="sync"를 돌리면 밀린 것들이 올라갑니다.',
  },
  NO_PRIOR_SEAL: { message: '이 id로 저장된 예측이 없습니다.', recovery: 'argus_predict로 나중에 확인할 수 있는 예측과 확인일을 먼저 저장하세요. (id가 argus_settings sync에서 온 "mcp_" 접두사라면 접두사를 뗀 id를 쓰세요.)' },
  BAD_CHECK_BY: { message: '확인일이 오늘 이후의 실제 달력 날짜(YYYY-MM-DD)가 아닙니다 (예: 2026-13-01처럼 없는 달·날짜는 불가).', recovery: '오늘 이후의 올바른 날짜를 YYYY-MM-DD로 다시 전달하세요.' },
  ILLEGAL_TRANSITION: { message: '이 결정에 지금은 할 수 없는 작업입니다 (id 오타이거나, 이미 저장·정산·종료된 상태일 수 있습니다).', recovery: 'argus_patterns view="all"로 id와 현재 상태를 확인하세요. 없는 id면 argus_capture 또는 argus_predict로 새로 시작하세요.' },
  PREMISE_LOCKED: { message: '확인일이 지나 전제를 더는 바꿀 수 없습니다.', recovery: '먼저 argus_resolve로 실제 결과를 기록하세요. 확인일이 온 뒤에는 전제/예측을 고칠 수 없습니다.' },
  ARGUS_DIR_INVALID: { message: 'Argus 기록 경로(argus_dir / ARGUS_DIR)가 올바르지 않습니다.', recovery: '절대 경로여야 하고 ".."을 포함할 수 없습니다. MCP 설정에서 절대 경로(예: C:\\Users\\이름\\.argus, /Users/이름/.argus)로 바꾸거나 ARGUS_DIR을 지워 기본값(~/.argus)을 쓰세요. ${...} 같은 변수는 호스트가 확장하지 못할 수 있습니다.' },
  ARGUS_DIR_UNWRITABLE: { message: 'Argus가 기록 폴더를 만들거나 쓰지 못했습니다.', recovery: 'ARGUS_DIR(또는 argus_dir)을 실제로 있고 쓸 수 있는 폴더로 바꿔 주세요. 실제 드라이브의 절대 경로여야 하고 ".."은 넣을 수 없습니다. 그다음 다시 시도하세요.' },
  EMPTY_PREDICATE: { message: '확인 가능한 예측 문장이 필요합니다 (공백 제외 최소 8자).', recovery: '현실이 참/거짓으로 확인할 수 있는 문장으로 다시 적으세요. 예: "컷오버 다운타임 5분 미만".' },
  ALREADY_SETTLED: { message: '이미 실제 결과가 기록된 결정입니다.', recovery: '영수증은 argus_patterns view="receipt"로 볼 수 있습니다. 새 결정이면 새 id로 여세요.' },
  DECISION_CLOSED: { message: '닫힌 결정이라 더 진행할 수 없습니다.', recovery: '필요하면 새 id로 다시 여세요. 닫힌 기록은 그대로 남습니다.' },
  GOALPOST_MOVED: { message: '봉인된 예측 문장은 확인일 전에 바꿀 수 없습니다.', recovery: '일정 변경은 outcome="still_pending"과 defer_to로, 예측 자체가 달라졌다면 새 결정으로 여세요.' },
  NO_SUCH_PREMISE: { message: '해당 번호의 전제를 찾지 못했습니다 (이 결정에 아직 전제가 없을 수 있습니다).', recovery: 'argus_patterns view="decision_context"로 목록과 번호를 확인하고, 전제가 없으면 argus_capture action="add_context"로 먼저 추가하세요.' },
  WHAT_HAPPENED_REQUIRED: { message: '실제로 일어난 일을 기록해야 합니다.', recovery: '사용자에게 실제 결과를 물어 what_happened에 그대로 전달하세요.' },
  DEFER_DATE_REQUIRED: { message: '다시 확인할 날짜가 필요합니다.', recovery: '사용자에게 날짜를 물어 defer_to에 YYYY-MM-DD로 전달하세요. 더는 중요하지 않다면 argus_capture action="close"를 사용하세요.' },
  NOT_CONNECTED: { message: '이 터미널은 Argus 계정과 연결돼 있지 않습니다.', recovery: '터미널에서 `npx argus-decision-mcp connect`를 실행하면 브라우저에서 한 번 승인하고 끝납니다 (플러그인은 /argus:connect). CI 등에서는 웹 설정의 동기화 토큰을 ARGUS_TOKEN에 넣어도 됩니다.' },
  SYNC_FAILED: { message: 'Argus 계정과 동기화하지 못했습니다.', recovery: '네트워크와 ARGUS_API_URL을 확인한 뒤 다시 시도하세요. 로컬 기록은 영향을 받지 않습니다.' },
  TEXT_REQUIRED: { message: '기록할 문장이 필요합니다.', recovery: '사용자의 문장을 고치거나 요약하지 말고 그대로 text에 전달하세요.' },
  SEAL_INVALID: { message: '다시 쓴 예측 문장의 길이가 맞지 않습니다 (8~400자).', recovery: '사용자에게 예측 문장을 8~400자로 다시 물어 그대로 저장하세요.' },
  SETTLE_INVALID: { message: '무슨 일이 있었는지가 기록 상한(600자)을 넘습니다.', recovery: 'data.user_input.what_happened 가 사용자가 방금 쓴 문장입니다. 다시 타이핑시키지 말고, 하중이 실린 대목만 600자 이내로 줄여 확인받은 뒤 outcome 과 함께 다시 부르세요.' },
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

// The allowed values for each enum field, so a wrong guess (stakes="medium",
// outcome="success", …) TEACHES the model the valid set instead of a bare "not
// allowed". Keyed by the field's LAST path segment (so premises.0.kind → kind).
const ENUM_HINTS: Record<string, string> = {
  stakes: 'trivial · low · moderate · high',
  reversibility: 'one_way_door · costly_to_reverse · easily_reversible',
  outcome: 'held · avoided · partial · still_pending · missed',
  outcome_source: 'user_stated',
  view: 'active · all · receipt · decision_context · timeline · reflection',
  action: 'open · add_context · answer_question · keep_question_open · update_fact · change_prediction · close',
  locale: 'ko · en',
  basis: 'judgment · luck · mixed · unsure',
  kind: 'premise · open_question',
  predicate_owner: 'user · ai_surfaced',
  source: 'user_stated · ai_surfaced (update_fact에서는 url · user_stated · host_reported)',
  dismiss_reason: 'became_irrelevant · decided_elsewhere · superseded · user_declined · changed_mind · other',
};
const DATE_FIELDS = new Set(['check_by', 'defer_to', 'today_override', 'snooze_until']);
const TYPE_KO: Record<string, string> = { string: '문자열', number: '숫자', boolean: '참/거짓', array: '목록', object: '객체', integer: '정수' };

/** The REAL allowed values, parsed from Zod's own English message
 *  ("… expected one of "a"|"b"|"c""). Lets the Korean surface show the ACTUAL
 *  per-tool enum instead of a hardcoded guess — ENUM_HINTS is keyed by field
 *  NAME, so `action` in argus_settings (status·update·sync) was being told the
 *  argus_capture action set. The message carries the truth per call; use it. */
function enumValuesFromMessage(msg?: string): string[] {
  const m = msg?.match(/expected one of (.+)$/i);
  if (!m) return [];
  return (m[1].match(/"([^"]+)"|'([^']+)'/g) ?? []).map((s) => s.replace(/["']/g, ''));
}

/** The offending key name(s) from Zod's "Unrecognized key(s): "x"" message, so
 *  the Korean surface can NAME what to remove instead of a blank "요청:". */
function keysFromMessage(msg?: string): string[] {
  if (!msg || !/unrecognized key/i.test(msg)) return [];
  return (msg.match(/"([^"]+)"|'([^']+)'/g) ?? []).map((s) => s.replace(/["']/g, ''));
}

/** Translate one Zod issue into a Korean, actionable reason. Keeps the English
 *  argument NAME (models and users see arg names in English), but says in Korean
 *  WHY it failed — the piece the generic message threw away. Field-aware so an id
 *  regex failure isn't told to "use YYYY-MM-DD" and an enum lists its values. */
function koReason(issue: InvalidField, field: string): string {
  const key = field.split('.').pop() || field;
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
      return issue.expected === undefined ? '형식이 올바르지 않습니다' : `필수이거나 형식이 올바르지 않습니다 (${TYPE_KO[issue.expected] ?? issue.expected} 형식 필요)`;
    case 'invalid_value':
    case 'invalid_enum_value': {
      const vals = enumValuesFromMessage(issue.message);
      if (vals.length) return `허용되지 않는 값입니다 (가능: ${vals.join(' · ')})`;
      const hint = ENUM_HINTS[key];
      return hint ? `허용되지 않는 값입니다 (가능: ${hint})` : '허용되지 않는 값입니다';
    }
    case 'unrecognized_keys':
      return '알 수 없는 항목입니다';
    case 'invalid_format':
    case 'invalid_string':
      if (key === 'id') return '영문·숫자와 . _ - 만 쓸 수 있습니다 (한글·공백·특수문자 불가, 예: "career-move")';
      if (DATE_FIELDS.has(key)) return 'YYYY-MM-DD 형식의 날짜여야 합니다';
      return '형식이 올바르지 않습니다';
    default:
      // Same text as the invalid_format id case so the two issues the id regex +
      // superRefine both raise dedup to a single line.
      if (key === 'id') return '영문·숫자와 . _ - 만 쓸 수 있습니다 (한글·공백·특수문자 불가, 예: "career-move")';
      return '값을 확인해 주세요';
  }
}

/** Korean INVALID_INPUT that NAMES each offending argument and why. */
function localizeInvalidInput(fields: InvalidField[]): ErrorCopy {
  if (!fields.length) return KO_ERRORS.INVALID_INPUT!;
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const f of fields) {
    let part: string;
    if (f.code === 'unrecognized_keys') {
      // The field path is just '(root)'; the useful info is WHICH key. Name it,
      // and drop the meaningless "요청:" prefix that told the user nothing.
      const keys = keysFromMessage(f.message);
      part = keys.length
        ? `${keys.map((k) => `"${k}"`).join(', ')}: 이 도구가 받지 않는 항목입니다`
        : '이 도구가 받지 않는 항목입니다';
    } else {
      const name = f.field === '(root)' ? '요청' : f.field;
      part = `${name}: ${koReason(f, f.field)}`;
    }
    if (seen.has(part)) continue; // dedup "id: …, id: …" (regex + superRefine both fire)
    seen.add(part);
    parts.push(part);
    if (parts.length >= 4) break;
  }
  return {
    message: `입력값이 올바르지 않습니다: ${parts.join(', ')}.`,
    recovery: '위에 표시된 인자를 고친 뒤 같은 도구를 다시 호출하세요. 사용자가 정해야 할 값은 추측하지 마세요.',
  };
}

/** English mirror of koReason: a plain reason for one Zod issue, so an EN user
 *  sees "check_by is required" instead of raw "expected string, received undefined". */
function enReason(issue: InvalidField): string {
  const key = issue.field.split('.').pop() || issue.field;
  switch (issue.code) {
    case 'too_small':
      if (issue.origin === 'string') return `is too short (min ${issue.minimum} characters)`;
      if (issue.origin === 'array') return `needs at least ${issue.minimum} item${issue.minimum === 1 ? '' : 's'}`;
      return `is too small (min ${issue.minimum})`;
    case 'too_big':
      if (issue.origin === 'string') return `is too long (max ${issue.maximum} characters)`;
      if (issue.origin === 'array') return `has too many items (max ${issue.maximum})`;
      return `is too big (max ${issue.maximum})`;
    case 'invalid_type':
      return issue.expected ? `is required (expected ${issue.expected})` : 'has the wrong format';
    case 'invalid_value':
    case 'invalid_enum_value': {
      const vals = enumValuesFromMessage(issue.message);
      return vals.length ? `must be one of ${vals.join(', ')}` : 'is not an allowed value';
    }
    case 'invalid_format':
    case 'invalid_string':
      if (key === 'id') return 'may use only letters, digits and . _ - (no spaces or other characters, e.g. "career-move")';
      if (DATE_FIELDS.has(key)) return 'must be a YYYY-MM-DD date';
      return 'has the wrong format';
    default:
      if (key === 'id') return 'may use only letters, digits and . _ - (no spaces or other characters, e.g. "career-move")';
      return 'needs checking';
  }
}

/** English INVALID_INPUT that NAMES the offending argument(s), instead of raw
 *  Zod ("(root): Unrecognized key", "expected string, received undefined"). */
function englishInvalidInput(fields: InvalidField[]): ErrorCopy {
  const recovery = 'Fix the named argument(s) and call the same tool again. Do not infer missing user-owned fields. If a predicate was rejected for length, it is usually several predictions bundled into one — split it and seal each separately rather than shortening it into vagueness.';
  if (!fields.length) return { message: 'Invalid input.', recovery };
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const f of fields) {
    let part: string;
    if (f.code === 'unrecognized_keys') {
      const keys = keysFromMessage(f.message);
      part = keys.length
        ? `${keys.map((k) => `"${k}"`).join(', ')} ${keys.length === 1 ? "isn't a field" : "aren't fields"} this tool accepts`
        : 'an unexpected field was passed';
    } else {
      const name = f.field === '(root)' ? 'the request' : f.field;
      part = `${name} ${enReason(f)}`;
    }
    if (seen.has(part)) continue;
    seen.add(part);
    parts.push(part);
    if (parts.length >= 4) break;
  }
  return { message: `Invalid input: ${parts.join('; ')}.`, recovery };
}

/** Friendly English for the codes whose handler/guard message otherwise leaks
 *  internal machinery (raw Zod, state-machine states). Codes NOT listed keep
 *  their handler's already-fine English. */
const EN_FRIENDLY: Record<string, ErrorCopy> = {
  ILLEGAL_TRANSITION: {
    message: "This isn't a step you can take on this decision right now (the id may be a typo, or it may already be saved, settled, or closed).",
    recovery: 'Check the id and its state with argus_patterns view="all". If no such id exists, start fresh with argus_capture or argus_predict.',
  },
};

function englishHumanize(code: string, sc: Record<string, unknown>): ErrorCopy | null {
  if (code === 'INVALID_INPUT' && Array.isArray(sc['invalid_fields'])) {
    return englishInvalidInput(sc['invalid_fields'] as InvalidField[]);
  }
  return EN_FRIENDLY[code] ?? null;
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
  if (!result.isError) return result;
  const sc = result.structuredContent;
  if (!sc || sc['ok'] !== false) return result;
  const code = String(sc['error_code'] ?? 'INTERNAL_ERROR');
  if (responseLocale(args) !== 'ko') {
    // English path: handler prose is already English — humanize ONLY the codes
    // that otherwise leak raw Zod / state-machine internals to the user.
    const en = englishHumanize(code, sc);
    if (!en) return result;
    const enLocalized = { ...sc, message: en.message, ...(en.recovery ? { recovery: en.recovery } : {}) };
    result.structuredContent = enLocalized;
    result.content = [{ type: 'text' as const, text: JSON.stringify(enLocalized, null, 2) }];
    return result;
  }
  // Some handlers already return a hand-written Korean message (e.g.
  // NOT_FALSIFIABLE: "이건 기분이지 확인 가능한 예측이 아닙니다"). If this code
  // isn't in KO_ERRORS, the generic fallback used to DESTROY that Korean copy.
  // Preserve any message that already contains Hangul instead of overwriting it.
  const existingMsg = typeof sc['message'] === 'string' ? sc['message'] : '';
  const existingRec = typeof sc['recovery'] === 'string' ? sc['recovery'] : '';
  const genericFallback = /[가-힣]/.test(existingMsg)
    ? { message: existingMsg, ...(existingRec ? { recovery: existingRec } : {}) }
    : { message: '요청을 처리하지 못했습니다.', recovery: '입력값과 현재 결정 상태를 확인한 뒤 다시 시도하세요.' };
  let copy = code === 'INVALID_INPUT' && Array.isArray(sc['invalid_fields'])
    ? localizeInvalidInput(sc['invalid_fields'] as InvalidField[])
    : KO_ERRORS[code] ?? genericFallback;
  // A handler-authored KOREAN message is at least as specific as the generic
  // map — KO_ERRORS exists to replace ENGLISH copy, not better Korean. Without
  // this, errors.ts's "내부 오류가 발생했습니다: EACCES …" lost its detail to
  // the generic '내부 오류가 발생했습니다.' (1.4.6 backlog: ko detail loss).
  // Quoted spans are stripped BEFORE the Hangul test: an English template that
  // merely embeds the user's Korean predicate ('already sealed: "매출 1억…"')
  // is still English-authored and must still be replaced.
  const authoredKo = (s: string): boolean => /[가-힣]/.test(s.replace(/"[^"]*"|'[^']*'|「[^」]*」/g, ''));
  if (code !== 'INVALID_INPUT' && authoredKo(existingMsg)) {
    copy = {
      message: existingMsg,
      ...(existingRec && authoredKo(existingRec) ? { recovery: existingRec } : copy.recovery ? { recovery: copy.recovery } : {}),
    };
  } else if (code === 'INTERNAL_ERROR') {
    // English-authored internal error: carry the diagnostic detail across the
    // language switch instead of discarding it.
    const d = existingMsg.match(/^Internal error: ([\s\S]+)$/);
    if (d) copy = { message: `내부 오류가 발생했습니다: ${d[1]}`, ...(copy.recovery ? { recovery: copy.recovery } : {}) };
  }
  // en에만 있던 날짜 상세를 ko에서도 보존 — "언제가 확인일인데?"에 답이 되도록.
  if (code === 'PREMATURE_SETTLE') {
    const m = String(sc['message'] ?? '').match(/check-by (\d{4}-\d{2}-\d{2}), today (\d{4}-\d{2}-\d{2})/);
    if (m) copy = { message: `아직 확인일이 되지 않았습니다 (확인일 ${m[1]} · 오늘 ${m[2]}).`, recovery: copy.recovery };
  }
  const localized = {
    ...sc,
    message: copy.message,
    ...(copy.recovery ? { recovery: copy.recovery } : {}),
  };
  result.structuredContent = localized;
  result.content = [{ type: 'text', text: JSON.stringify(localized, null, 2) }];
  return result;
}
